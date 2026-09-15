// PATH: functions/src/skillBattleSubmission.ts
//
// SECURITY FIX (SkillBattle trust-boundary remediation — SB-P1-03): the
// only duplicate/over-limit submission guard used to be
// apps/mobile/app/Createreelscreen.tsx's checkPostLimit(), a client-side
// pre-flight query — trivially bypassed by writing straight to
// posts/{postId} with the client SDK (nothing server-side ever re-checked
// it). firestore.rules' posts/{postId} create rule (see its own SB-P0-02
// comment) closes the "forge a pre-approved/pre-scored post" hole with a
// strict field allowlist, but Firestore rules have no way to count
// existing sibling documents, so they can't enforce a "max N submissions
// per battle" cap on their own.
//
// submitSkillBattleReel below is the new, actual creation path: it wraps
// the count check AND the doc write in one transaction (closing the
// race a separate pre-flight-query-then-write always has), and forces
// every trust-sensitive field (status, engagement counters, review
// metadata) to its one safe initial value regardless of what's passed in
// — the caller can't influence them even in principle, not just "the
// rules currently reject a different value". The direct-client-write path
// through firestore.rules' allowlist remains as defense-in-depth (e.g. if
// this function is ever bypassed by a client bug), not the intended route.
//
// MEDIA OWNERSHIP (2026-09-11 audit P0, fixed): mediaUrl used to be
// trusted verbatim from the client with no proof it was this student's
// own upload — see functions/src/mediaOwnership.ts's header for the full
// fix (Cloudflare Worker now requires a verified Firebase ID token before
// issuing an upload, and mints a short-lived signed ownership token this
// function verifies below). `ownershipToken` is now a required field.

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { verifyMediaOwnershipToken } from "./mediaOwnership";
import { checkOriginalityDeclaration } from "./moderation/originalityDeclaration";
import { runModerationPipeline, moderationResultToFields } from "./moderation/pipeline";

const db = admin.firestore();

const MAX_SUBMISSIONS_PER_BATTLE = 4;

// Same generic, reason-hiding message as battleSubmissions.ts's
// createBattleSubmission — see mediaOwnership.ts's header for why the
// two callables share one verification module instead of duplicating it.
const OWNERSHIP_ERROR_MESSAGE =
  "Media ownership could not be verified. Please upload your video again and resubmit.";

interface SkillBattleDoc {
  isActive?: boolean;
  startDate?: string | null;
  endDate?:   string | null;
}

interface StudentDoc {
  name?: string; school?: string; profilePic?: string;
  class?: string | number; preferredLanguage?: string;
  location?: { city?: string; district?: string; state?: string; pincode?: string };
}

interface SubmitSkillBattleReelInput {
  battleId?:    string;
  battleTitle?: string;
  battleType?:  string;
  month?:       string;
  caption?:     string;
  // Soft personalization signals only (lib/reelScoring.ts) — never used
  // for moderation/scoring/eligibility, so accepting them as client input
  // (rather than forcing a server default) doesn't reopen any trust gap;
  // see Createreelscreen.tsx's own comment on these two fields.
  targetState?:    string[];
  targetLanguage?: string[];
  // Media — already uploaded by the time this is called (Cloudflare
  // Stream for video, Firebase Storage for the thumbnail); this function
  // only ever writes the resulting URLs, it doesn't touch either upload.
  mediaUrl?:  string;
  thumbnail?: string;
  // Short-lived, HMAC-signed token minted by the Cloudflare Worker after
  // it verified this student's Firebase ID token — see mediaOwnership.ts.
  ownershipToken?: string;
  // Originality declaration — see moderation/originalityDeclaration.ts's
  // header for the Phase A compatibility rule (omitted = today's
  // pre-Phase-B mobile client; a present-but-invalid value is rejected).
  declarationAccepted?: unknown;
  declarationVersion?: unknown;
}

export const submitSkillBattleReel = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "128MB", secrets: ["WORKER_OWNERSHIP_SECRET"] })
  .https.onCall(async (data: SubmitSkillBattleReelInput, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const {
      battleId, battleTitle, battleType, month, caption, targetState, targetLanguage, mediaUrl, thumbnail,
      ownershipToken, declarationAccepted, declarationVersion,
    } = data ?? {};

    if (!battleId || typeof battleId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "battleId is required");
    }
    if (!mediaUrl || typeof mediaUrl !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "mediaUrl is required — upload the video first");
    }

    // ── Originality declaration — see moderation/originalityDeclaration.ts.
    const declarationCheck = checkOriginalityDeclaration({ declarationAccepted, declarationVersion });
    if (!declarationCheck.valid) {
      throw new functionsV1.https.HttpsError("invalid-argument", declarationCheck.reason ?? "Originality declaration invalid.");
    }

    // ── Media ownership (2026-09-11 audit P0 fix) — verified before any
    // battle reads, same "reject cheaply first" posture as the argument
    // checks above. `uid` is context.auth.uid — never client-supplied.
    const ownership = verifyMediaOwnershipToken(ownershipToken, uid, mediaUrl, process.env.WORKER_OWNERSHIP_SECRET ?? "");
    if (!ownership.valid) {
      console.warn(`submitSkillBattleReel: media ownership check failed (uid=${uid} reason=${ownership.reason ?? "unknown"})`);
      throw new functionsV1.https.HttpsError("failed-precondition", OWNERSHIP_ERROR_MESSAGE);
    }

    const battleSnap = await db.doc(`skillBattles/${battleId}`).get();
    if (!battleSnap.exists) {
      throw new functionsV1.https.HttpsError("not-found", "This battle does not exist.");
    }
    const battle = battleSnap.data() as SkillBattleDoc;
    if (battle.isActive === false) {
      throw new functionsV1.https.HttpsError("failed-precondition", "This battle is not currently active.");
    }
    if (battle.endDate && new Date(battle.endDate).getTime() <= Date.now()) {
      throw new functionsV1.https.HttpsError("failed-precondition", "This battle has already ended — submissions are closed.");
    }
    if (battle.startDate && new Date(battle.startDate).getTime() > Date.now()) {
      throw new functionsV1.https.HttpsError("failed-precondition", "This battle hasn't started yet.");
    }

    const studentSnap = await db.doc(`students/${uid}`).get();
    if (!studentSnap.exists) {
      throw new functionsV1.https.HttpsError("failed-precondition", "Student profile not found.");
    }
    const student = studentSnap.data() as StudentDoc;
    const cls = student.class !== undefined ? String(student.class) : "";

    const postsRef   = db.collection("posts");
    const newPostRef = postsRef.doc();

    // ── Automated moderation pipeline (Phase A) — see battleSubmissions.ts's
    // identical call for why this runs once, outside the transaction.
    const moderationResult = await runModerationPipeline({
      submissionId: newPostRef.id,
      videoRef: mediaUrl,
      battleId,
    });

    await db.runTransaction(async (tx) => {
      // Count-and-create in one transaction — the old client pre-flight
      // check-then-write had a race (and, separately, was skippable
      // entirely by writing straight to Firestore).
      const existingSnap = await tx.get(
        postsRef
          .where("userId",   "==", uid)
          .where("battleId", "==", battleId)
          .where("status",   "in", ["pending", "in_review", "approved"])
      );
      if (existingSnap.size >= MAX_SUBMISSIONS_PER_BATTLE) {
        throw new functionsV1.https.HttpsError(
          "resource-exhausted",
          `You've reached the ${MAX_SUBMISSIONS_PER_BATTLE}-submission limit for this battle.`
        );
      }

      tx.set(newPostRef, {
        userId: uid,
        name:       student.name       ?? "",
        school:     student.school     ?? "",
        class:      cls,
        profilePic: student.profilePic ?? "",
        battleId,
        battleTitle: battleTitle ?? "",
        battleType:  battleType  ?? "sponsored",
        isSkillBattle: true,
        postType:      "reel",
        month:         month ?? "",
        caption:        (caption ?? "").trim(),
        targetState:    targetState?.length    ? targetState    : ["All"],
        targetLanguage: targetLanguage?.length  ? targetLanguage : [student.preferredLanguage ?? "English"],
        location: {
          city:     student.location?.city     ?? "",
          district: student.location?.district ?? "",
          state:    student.location?.state    ?? "",
          pincode:  student.location?.pincode  ?? "",
          country:  "India",
        },
        mediaUrl,
        thumbnail: thumbnail ?? "",
        // Every trust-sensitive field forced, regardless of input —
        // there's nowhere in SubmitSkillBattleReelInput to even pass a
        // different value for any of these.
        status: "pending", rejectionReason: "", reviewedAt: null, reviewedBy: "",
        likes: 0, views: 0, shares: 0, comments: 0, watchTime: 0,
        // Real, verified true — the ownership check above already
        // rejected this request otherwise. Never hardcoded/assumed.
        mediaOwnershipVerified: true,
        // Video moderation/copyright pipeline (Phase A) — added
        // alongside the existing `status` field, not a replacement for
        // it: `status` stays "pending"/"approved"/"rejected" (unchanged,
        // still what updateSkillboard's trigger and getReelsFeed key
        // off), while these new fields carry the richer moderation
        // metadata the decision engine actually computed. See this
        // file's header and moderation/decisionEngine.ts.
        ...moderationResultToFields(moderationResult),
        ...declarationCheck.record,
        winnerStatus: "NOT_APPLICABLE",
        prizeStatus: "NOT_APPLICABLE",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    console.log(`✅ SkillBattle submission created: uid=${uid} battle=${battleId} post=${newPostRef.id} moderationStatus=${moderationResult.decision.nextStatus}`);
    return { postId: newPostRef.id, moderationStatus: moderationResult.decision.nextStatus };
  });

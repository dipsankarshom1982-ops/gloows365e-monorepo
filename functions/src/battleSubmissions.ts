// PATH: functions/src/battleSubmissions.ts
//
// Phase 2C — Battle Engine: the new canonical `submissions` collection.
// This is deliberately SEPARATE from the legacy posts-based SkillBattle
// flow (Createreelscreen.tsx → submitSkillBattleReel → posts, Phase 1) —
// see this file's own note under "LEGACY COMPATIBILITY" below.
// Createreelscreen.tsx now calls createBattleSubmission for
// canonical-engine (state-bearing) battles.
//
// MEDIA OWNERSHIP (2026-09-11 audit P0, fixed): the Cloudflare Stream
// Worker (apps/mobile/cloudflare-worker.js) used to accept unauthenticated
// upload requests and never stamped the resulting video ID with any
// verified uid — this function had no way to cryptographically verify a
// submitted mediaRef was actually produced by the calling student's own
// upload. The Worker now requires a verified Firebase ID token before
// issuing an upload authorization, and mints a short-lived, HMAC-signed
// ownership token binding {uid, videoUid} — see functions/src/
// mediaOwnership.ts's header for the full design. `ownershipToken` is now
// a REQUIRED field on this callable's input, verified against the
// AUTHENTICATED caller's own uid (never a client-supplied one) and
// against the submitted mediaRef, before a submission is ever created.
// mediaOwnershipVerified is only ever set true when that check actually
// passed — never a hardcoded/assumed value.

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { verifyMediaOwnershipToken } from "./mediaOwnership";

const db = admin.firestore();

// Client-facing message for every ownership-check failure — deliberately
// the SAME message regardless of the specific internal reason (expired,
// bad signature, uid mismatch, media mismatch, ...), so a caller probing
// this endpoint can't learn which check it tripped. The real reason is
// still logged server-side (console.warn below).
const OWNERSHIP_ERROR_MESSAGE =
  "Media ownership could not be verified. Please upload your video again and resubmit.";

export type SubmissionStatus =
  | "PENDING_MODERATION"
  | "APPROVED"
  | "REJECTED"
  | "REMOVED"
  | "WITHDRAWN";

interface SkillBattleDoc {
  isActive?: boolean;
  state?: string;
  skillId?: string;
  submissionDeadline?: string | null;
}

interface SkillDoc {
  isActive?: boolean;
  categoryId?: string;
}

interface StudentDoc {
  name?: string;
  class?: string | number;
}

// ─── createBattleSubmission ─────────────────────────────────────────────────
// V1 rule (Phase 2C brief §9): one student → one submission → one battle.
// Enforced structurally, not by counting — the doc ID IS `{battleId}_{uid}`,
// so a transactional check-then-create on that single doc is race-proof by
// construction (two concurrent calls serialize on the same document; the
// loser sees it already exists and fails cleanly) rather than relying on a
// count-then-write pattern that has a window for a duplicate.
export const createBattleSubmission = functionsV1
  .runWith({ timeoutSeconds: 20, memory: "128MB", secrets: ["WORKER_OWNERSHIP_SECRET"] })
  .https.onCall(async (
    data: { battleId?: string; mediaRef?: string; title?: string; description?: string; ownershipToken?: string },
    context
  ) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const { battleId, mediaRef, title, description, ownershipToken } = data ?? {};

    if (!battleId || typeof battleId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "battleId is required");
    }
    if (!mediaRef || typeof mediaRef !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "mediaRef is required — upload the media first");
    }

    // ── Media ownership (2026-09-11 audit P0 fix) — verified BEFORE any
    // battle/state reads, same "reject cheaply first" posture as the
    // argument checks above. `uid` here is context.auth.uid — never a
    // client-supplied value — so this can't be satisfied by a forged UID.
    const ownership = verifyMediaOwnershipToken(ownershipToken, uid, mediaRef, process.env.WORKER_OWNERSHIP_SECRET ?? "");
    if (!ownership.valid) {
      console.warn(`createBattleSubmission: media ownership check failed (uid=${uid} reason=${ownership.reason ?? "unknown"})`);
      throw new functionsV1.https.HttpsError("failed-precondition", OWNERSHIP_ERROR_MESSAGE);
    }

    const battleSnap = await db.doc(`skillBattles/${battleId}`).get();
    if (!battleSnap.exists) {
      throw new functionsV1.https.HttpsError("not-found", "This battle does not exist.");
    }
    const battle = battleSnap.data() as SkillBattleDoc;

    // Battle eligibility (§7) — client cannot determine this.
    if (battle.state !== "OPEN") {
      throw new functionsV1.https.HttpsError(
        "failed-precondition",
        `This battle is not open for submissions (state: ${battle.state ?? "unmanaged"}).`
      );
    }
    if (battle.submissionDeadline && new Date(battle.submissionDeadline).getTime() <= Date.now()) {
      throw new functionsV1.https.HttpsError("failed-precondition", "The submission deadline has passed.");
    }
    if (!battle.skillId) {
      throw new functionsV1.https.HttpsError("failed-precondition", "This battle has no skill configured.");
    }
    const skillSnap = await db.doc(`skills/${battle.skillId}`).get();
    if (!skillSnap.exists || (skillSnap.data() as SkillDoc).isActive === false) {
      throw new functionsV1.https.HttpsError("failed-precondition", "This battle's skill is no longer active.");
    }

    const studentSnap = await db.doc(`students/${uid}`).get();
    if (!studentSnap.exists) {
      throw new functionsV1.https.HttpsError("failed-precondition", "Student profile not found.");
    }
    const student = studentSnap.data() as StudentDoc;

    const submissionRef = db.doc(`submissions/${battleId}_${uid}`);

    return db.runTransaction(async (tx) => {
      const existing = await tx.get(submissionRef);
      if (existing.exists) {
        throw new functionsV1.https.HttpsError(
          "already-exists",
          "You have already submitted to this battle. Withdraw your existing submission first if you need to resubmit."
        );
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.set(submissionRef, {
        studentId: uid,
        studentName: student.name ?? "",
        studentClass: student.class !== undefined ? String(student.class) : "",
        battleId,
        skillId: battle.skillId,
        mediaRef,
        // Real, verified true — the ownership check above already
        // rejected this request otherwise. Never hardcoded/assumed.
        mediaOwnershipVerified: true,
        title: (title ?? "").trim(),
        description: (description ?? "").trim(),
        status: "PENDING_MODERATION" as SubmissionStatus,
        rejectionReason: "",
        reviewedBy: "",
        reviewedAt: null,
        approvedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      return { submissionId: submissionRef.id };
    });
  });

// ─── withdrawBattleSubmission ───────────────────────────────────────────────
// Student-initiated, pre-approval only (§5's lifecycle) — an approved
// submission that's already contributing to a live leaderboard can't be
// silently pulled by the student; that needs a moderator/admin decision
// (reviewBattleSubmission below, action:"REMOVE"), same asymmetry as the
// legacy posts flow's delete rule.
export const withdrawBattleSubmission = functionsV1
  .runWith({ timeoutSeconds: 15, memory: "128MB" })
  .https.onCall(async (data: { battleId?: string }, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const { battleId } = data ?? {};
    if (!battleId || typeof battleId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "battleId is required");
    }

    const ref = db.doc(`submissions/${battleId}_${uid}`);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "No submission found for this battle.");
      }
      const status = snap.data()?.status as SubmissionStatus;
      if (status !== "PENDING_MODERATION") {
        throw new functionsV1.https.HttpsError(
          "failed-precondition",
          `Cannot withdraw a submission that is already ${status}.`
        );
      }
      tx.update(ref, { status: "WITHDRAWN", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return { ok: true };
    });
  });

// ─── reviewBattleSubmission ─────────────────────────────────────────────────
// SECURITY: the only writer of `status` on a submission after creation.
// Students can never self-transition PENDING_MODERATION → APPROVED or
// REJECTED → APPROVED (§11) — firestore.rules denies ALL client writes to
// submissions/{id}.status unconditionally, admin included; this callable
// (Admin SDK) is the sole path, same posture as posts/{id}.status (Phase 1)
// and skillBattles/{id}.state (Phase 2B).
export const reviewBattleSubmission = functionsV1
  .runWith({ timeoutSeconds: 15, memory: "128MB" })
  .https.onCall(async (
    data: { battleId?: string; studentId?: string; action?: "APPROVE" | "REJECT" | "REMOVE"; reason?: string },
    context
  ) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    if (context.auth.token.admin !== true) {
      throw new functionsV1.https.HttpsError("permission-denied", "Admin only");
    }
    const { battleId, studentId, action, reason } = data ?? {};
    if (!battleId || !studentId) {
      throw new functionsV1.https.HttpsError("invalid-argument", "battleId and studentId are required");
    }
    if (action !== "APPROVE" && action !== "REJECT" && action !== "REMOVE") {
      throw new functionsV1.https.HttpsError("invalid-argument", 'action must be "APPROVE", "REJECT", or "REMOVE"');
    }

    const ref = db.doc(`submissions/${battleId}_${studentId}`);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "Submission not found.");
      }
      const currentStatus = snap.data()?.status as SubmissionStatus;
      const now = admin.firestore.FieldValue.serverTimestamp();

      if (action === "REMOVE") {
        if (currentStatus !== "APPROVED") {
          throw new functionsV1.https.HttpsError("failed-precondition", "Can only remove an approved submission.");
        }
        tx.update(ref, {
          status: "REMOVED" as SubmissionStatus,
          reviewedBy: context.auth!.uid, reviewedAt: now, updatedAt: now,
          rejectionReason: reason ?? "",
        });
        return { ok: true, status: "REMOVED" };
      }

      if (currentStatus !== "PENDING_MODERATION") {
        throw new functionsV1.https.HttpsError(
          "failed-precondition",
          `Cannot ${action.toLowerCase()} a submission that is already ${currentStatus}.`
        );
      }

      const newStatus: SubmissionStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";
      tx.update(ref, {
        status: newStatus,
        reviewedBy: context.auth!.uid, reviewedAt: now, updatedAt: now,
        ...(newStatus === "APPROVED" ? { approvedAt: now } : {}),
        rejectionReason: newStatus === "REJECTED" ? (reason ?? "") : "",
      });
      // Moderation completing after the submission deadline (§11) is
      // explicitly fine here — approving/rejecting is always allowed
      // regardless of the deadline, since a moderation decision isn't a
      // new submission. What it does NOT do is retroactively extend the
      // competition: battleRanking.ts's recompute trigger (fired by this
      // write) checks the battle's state and is a no-op once
      // RANKING_FINALIZATION has already started or the result is
      // RESULT_LOCKED — a late approval can't change an already-final
      // outcome, see that file's header comment.
      return { ok: true, status: newStatus };
    });
  });

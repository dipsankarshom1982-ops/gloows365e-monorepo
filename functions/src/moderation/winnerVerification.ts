// PATH: functions/src/moderation/winnerVerification.ts
//
// Phase B §9/§10 — the critical security boundary between "the
// leaderboard says this student is #1" and "this student may actually
// receive a prize." Before this file, claimSkillBattleReward
// (functions/src/vcoins.ts) and claimBattleReward
// (functions/src/battleRewards.ts) computed a rank from
// server-authoritative data and credited VCoins directly — a real fix
// for the earlier "client-supplied rank" vulnerability, but with no
// independent check that the winning submission was ever actually
// approved, had no unresolved reports, or had an originality
// declaration on file. requireVerifiedWinner() below is that check,
// called from both claim functions before any crediting happens — see
// each file's own call site for exactly where.
//
// Storage: winnerVerifications/{battleId}_{uid} (deterministic, one per
// battle+student, same doc-ID-as-lock pattern used throughout this
// codebase for exactly this kind of once-only guarantee). Firestore
// rules: allow write: if false — this file and verifyBattleWinner below
// (Admin SDK) are the only writers.
//
// OBJECTIVELY-CHECKABLE gates (hard-enforced, cannot be marked VERIFIED
// if any fail): submission/post approved, originality declaration
// accepted, no unresolved (OPEN) report. Criteria requiring human
// judgment (challenge rules satisfied, voting/activity integrity,
// account eligibility) are NOT automated here — verifyBattleWinner
// records them as an explicit moderator decision, not a computed
// boolean, exactly because this codebase should not pretend to
// automate a judgment call brief §9 itself frames as requiring a human
// "before any Skill Battle prize is approved."

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { WinnerStatus, PrizeStatus } from "./types";

const db = admin.firestore();

export type VerificationEngine = "legacy" | "canonical";

interface EligibilityChecklist {
  hasApprovedContent: boolean;
  declarationAccepted: boolean;
  noUnresolvedReports: boolean;
}

interface WinnerVerificationDoc {
  battleId: string;
  uid: string;
  engine: VerificationEngine;
  winnerStatus: WinnerStatus;
  prizeStatus: PrizeStatus;
  checklist: EligibilityChecklist | null;
  verifiedBy: string | null;
  verifiedAt: admin.firestore.FieldValue | null;
  reason: string;
  createdAt: admin.firestore.FieldValue;
  updatedAt: admin.firestore.FieldValue;
}

function verificationRef(battleId: string, uid: string) {
  return db.doc(`winnerVerifications/${battleId}_${uid}`);
}

async function computeEligibilityChecklist(engine: VerificationEngine, battleId: string, uid: string): Promise<EligibilityChecklist> {
  if (engine === "canonical") {
    const [subSnap, reportsSnap] = await Promise.all([
      db.doc(`submissions/${battleId}_${uid}`).get(),
      db.collection("skillBattleReports")
        .where("contentType", "==", "submission")
        .where("contentId", "==", `${battleId}_${uid}`)
        .where("status", "==", "OPEN")
        .limit(1)
        .get(),
    ]);
    const sub = subSnap.data();
    return {
      hasApprovedContent: sub?.status === "APPROVED",
      declarationAccepted: sub?.declarationAccepted === true,
      noUnresolvedReports: reportsSnap.empty,
    };
  }

  // legacy — a student may have up to MAX_SUBMISSIONS_PER_BATTLE posts
  // for one battle; eligible if at least one is approved+declared, and
  // none of that student's posts for this battle have an open report.
  const postsSnap = await db.collection("posts")
    .where("userId", "==", uid)
    .where("battleId", "==", battleId)
    .where("isSkillBattle", "==", true)
    .get();
  const approvedDeclared = postsSnap.docs.some((d) => d.data().status === "approved" && d.data().declarationAccepted === true);

  let noUnresolvedReports = true;
  if (!postsSnap.empty) {
    const postIds = postsSnap.docs.map((d) => d.id);
    const reportChecks = await Promise.all(
      postIds.map((id) =>
        db.collection("skillBattleReports")
          .where("contentType", "==", "post")
          .where("contentId", "==", id)
          .where("status", "==", "OPEN")
          .limit(1)
          .get()
      )
    );
    noUnresolvedReports = reportChecks.every((snap) => snap.empty);
  }

  return { hasApprovedContent: approvedDeclared, declarationAccepted: approvedDeclared, noUnresolvedReports };
}

/**
 * Called from claimSkillBattleReward/claimBattleReward BEFORE any
 * crediting. Returns { allowed: true } only if a prior moderator
 * verification exists and passed. On the FIRST call for a given
 * battle+student (no verification doc yet), creates one in
 * WINNER_PENDING_REVIEW and returns { allowed: false } — the claim is
 * rejected, not silently queued for later auto-completion; a moderator
 * must act via verifyBattleWinner below.
 */
export async function requireVerifiedWinner(
  engine: VerificationEngine, battleId: string, uid: string,
): Promise<{ allowed: boolean; status: WinnerStatus; message: string }> {
  const ref = verificationRef(battleId, uid);
  const snap = await ref.get();

  if (!snap.exists) {
    const now = admin.firestore.FieldValue.serverTimestamp();
    await ref.set({
      battleId, uid, engine,
      winnerStatus: "WINNER_PENDING_REVIEW" as WinnerStatus,
      prizeStatus: "PRIZE_PENDING" as PrizeStatus,
      checklist: null, verifiedBy: null, verifiedAt: null, reason: "",
      createdAt: now, updatedAt: now,
    } satisfies WinnerVerificationDoc);
    return {
      allowed: false, status: "WINNER_PENDING_REVIEW",
      message: "Your result is pending moderator verification before any reward can be released. Please check back soon.",
    };
  }

  const data = snap.data() as WinnerVerificationDoc;
  if (data.winnerStatus === "WINNER_VERIFIED") {
    return { allowed: true, status: "WINNER_VERIFIED", message: "" };
  }
  if (data.winnerStatus === "WINNER_REJECTED") {
    return {
      allowed: false, status: "WINNER_REJECTED",
      message: "This result did not pass verification and is not eligible for a reward.",
    };
  }
  return {
    allowed: false, status: "WINNER_PENDING_REVIEW",
    message: "Your result is pending moderator verification before any reward can be released. Please check back soon.",
  };
}

interface VerifyBattleWinnerInput {
  engine?: VerificationEngine;
  battleId?: string;
  uid?: string;
  decision?: "VERIFIED" | "REJECTED";
  reason?: string;
}

// Moderator-facing callable — the human decision point brief §9 requires
// ("before any Skill Battle prize is approved"). The objective checklist
// is computed and stored for audit/UI purposes and hard-blocks a
// VERIFIED decision if any item fails; it does not by itself decide
// REJECTED vs VERIFIED when all objective items pass — that's still the
// moderator's call (challenge-rules/voting-integrity/account-eligibility
// judgment calls this file's header explains are not automated).
export const verifyBattleWinner = functionsV1
  .runWith({ timeoutSeconds: 20, memory: "128MB" })
  .https.onCall(async (data: VerifyBattleWinnerInput, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    if (context.auth.token.admin !== true) {
      throw new functionsV1.https.HttpsError("permission-denied", "Admin only");
    }
    const { engine, battleId, uid, decision, reason } = data ?? {};
    if (engine !== "legacy" && engine !== "canonical") {
      throw new functionsV1.https.HttpsError("invalid-argument", 'engine must be "legacy" or "canonical"');
    }
    if (!battleId || !uid) {
      throw new functionsV1.https.HttpsError("invalid-argument", "battleId and uid are required");
    }
    if (decision !== "VERIFIED" && decision !== "REJECTED") {
      throw new functionsV1.https.HttpsError("invalid-argument", 'decision must be "VERIFIED" or "REJECTED"');
    }

    const checklist = await computeEligibilityChecklist(engine, battleId, uid);
    const allObjectiveChecksPass = checklist.hasApprovedContent && checklist.declarationAccepted && checklist.noUnresolvedReports;

    if (decision === "VERIFIED" && !allObjectiveChecksPass) {
      throw new functionsV1.https.HttpsError(
        "failed-precondition",
        `Cannot verify: objective eligibility checks failed (${JSON.stringify(checklist)}).`
      );
    }

    const ref = verificationRef(battleId, uid);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const winnerStatus: WinnerStatus = decision === "VERIFIED" ? "WINNER_VERIFIED" : "WINNER_REJECTED";
    const prizeStatus: PrizeStatus = decision === "VERIFIED" ? "PRIZE_PENDING" : "PRIZE_REJECTED";

    // Read first so a pre-existing createdAt (set by requireVerifiedWinner's
    // first-claim-attempt auto-create) is never overwritten — merge:true
    // alone isn't enough since createdAt would otherwise be part of this
    // same write's payload.
    const existing = await ref.get();
    await ref.set({
      battleId, uid, engine,
      winnerStatus, prizeStatus, checklist,
      verifiedBy: context.auth.uid, verifiedAt: now,
      reason: reason ?? "",
      updatedAt: now,
      ...(existing.exists ? {} : { createdAt: now }),
    }, { merge: true });

    return { ok: true, winnerStatus, checklist };
  });

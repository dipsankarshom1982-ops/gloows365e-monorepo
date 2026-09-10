// PATH: functions/src/battleEngagement.ts
//
// Phase 2C — Battle Engine: server-verified engagement.
//
// "verifiedLikes"/"verifiedViews" (battleScoring.ts's scoring inputs) mean
// exactly this: the count of submissions/{submissionId}/engagements docs
// of that type. Each doc's ID is deterministic — `{type}_{studentId}` —
// so a given authenticated student can ever have AT MOST ONE like and AT
// MOST ONE view recorded against a given submission, structurally, by
// Firestore document-uniqueness itself. This is stronger than Phase 1's
// bounded-per-write-delta approach on the legacy posts counters: there is
// no counter field to inflate here at all — the source of truth is one
// immutable fact per (submission, student, type), and score is always
// COUNTED from those facts, never incremented by a client-supplied delta.
//
// Duplicate/repeated/rapid/scripted engagement requests (Phase 2C brief
// §14) all fail the same way: the second attempt's transaction sees the
// engagement doc already exists and rejects — no separate rate-limiter
// needed for THIS specific abuse vector, though a general per-uid rate
// limit on the callable itself is still a reasonable defense-in-depth
// addition flagged as a follow-up in the final report.

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";

const db = admin.firestore();

export type EngagementType = "like" | "view";
const VALID_TYPES: readonly EngagementType[] = ["like", "view"];

interface SubmissionDoc {
  studentId?: string;
  battleId?: string;
  status?: string;
}
interface SkillBattleDoc {
  state?: string;
}

// ─── engageBattleSubmission ─────────────────────────────────────────────────
export const engageBattleSubmission = functionsV1
  .runWith({ timeoutSeconds: 15, memory: "128MB" })
  .https.onCall(async (data: { submissionId?: string; type?: string }, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const { submissionId, type } = data ?? {};

    if (!submissionId || typeof submissionId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "submissionId is required");
    }
    if (!VALID_TYPES.includes(type as EngagementType)) {
      throw new functionsV1.https.HttpsError("invalid-argument", `type must be one of: ${VALID_TYPES.join(", ")}`);
    }
    const engagementType = type as EngagementType;

    const submissionRef = db.doc(`submissions/${submissionId}`);
    const submissionSnap = await submissionRef.get();
    if (!submissionSnap.exists) {
      throw new functionsV1.https.HttpsError("not-found", "Submission not found.");
    }
    const submission = submissionSnap.data() as SubmissionDoc;

    // SELF-ENGAGEMENT RULE (Phase 2C brief §13, V1 decision): a student
    // cannot meaningfully score their own submission. Applied to BOTH
    // like and view — not just likes — so a student can't inflate their
    // own view count either; there is no "passive view" carve-out in
    // this engine (unlike the brief's fallback suggestion) because every
    // engagement type here is a competitive scoring input, not a display
    // metric.
    if (submission.studentId === uid) {
      throw new functionsV1.https.HttpsError("permission-denied", "You cannot engage with your own submission.");
    }
    // Only an APPROVED (= live/visible, see this file's header) submission
    // can be engaged with.
    if (submission.status !== "APPROVED") {
      throw new functionsV1.https.HttpsError("failed-precondition", "This submission is not currently live.");
    }

    if (!submission.battleId) {
      throw new functionsV1.https.HttpsError("failed-precondition", "Submission has no battle reference.");
    }
    const battleSnap = await db.doc(`skillBattles/${submission.battleId}`).get();
    const battleState = battleSnap.exists ? (battleSnap.data() as SkillBattleDoc).state : undefined;
    // Engagement window == submission window (§14 "engagement after
    // battle cutoff" must fail) — once a battle leaves OPEN, engagement
    // stops along with new submissions. A simple, defensible V1 choice;
    // documented rather than silently assumed.
    if (battleState !== "OPEN") {
      throw new functionsV1.https.HttpsError(
        "failed-precondition",
        "This battle is not accepting engagement right now."
      );
    }

    const engagementRef = submissionRef.collection("engagements").doc(`${engagementType}_${uid}`);

    return db.runTransaction(async (tx) => {
      const existing = await tx.get(engagementRef);
      if (existing.exists) {
        // Not an error — a duplicate/retried/double-clicked request is
        // simply a no-op, same idempotent-on-retry posture as the rest of
        // this engine.
        return { recorded: false, alreadyEngaged: true };
      }
      tx.set(engagementRef, {
        studentId: uid,
        type: engagementType,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { recorded: true, alreadyEngaged: false };
    });
  });

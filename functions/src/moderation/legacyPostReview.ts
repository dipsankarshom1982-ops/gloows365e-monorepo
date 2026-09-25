// PATH: functions/src/moderation/legacyPostReview.ts
//
// Phase B §5 — the legacy `posts` collection had NO reviewer at all
// before this file: nothing could ever move a SkillBattle post out of
// `status:"pending"`. This callable is that reviewer, mirroring
// battleSubmissions.ts's reviewBattleSubmission exactly (same admin-only
// authorization bar, same action set, same audit trail), operating on
// `posts` instead of `submissions`.
//
// Keeps BOTH status fields in sync: `status` (lowercase — the field
// getReelsFeed and updateSkillboard's trigger actually gate on, unchanged
// since before Phase A) and `moderationStatus` (uppercase — the Phase A
// decision-engine field). A direct client write to either is already
// blocked by firestore.rules; this Admin-SDK callable is the only path
// that can move either one after creation.

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { recordModerationAuditEvent } from "./auditLog";

const db = admin.firestore();

type ReviewAction = "APPROVE" | "REJECT" | "ESCALATE" | "REQUEST_CHANGES" | "REMOVE";

interface ReviewPostInput {
  postId?: string;
  action?: ReviewAction;
  reason?: string;
}

const REVIEWABLE_STATUSES = new Set(["pending", "in_review"]);

export const reviewSkillBattlePost = functionsV1
  .runWith({ timeoutSeconds: 15, memory: "128MB" })
  .https.onCall(async (data: ReviewPostInput, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    // Same authorization bar as reviewBattleSubmission — this codebase
    // has exactly one moderator-capable claim (`admin`), not a separate
    // competing role; reusing it here rather than inventing a new one.
    if (context.auth.token.admin !== true) {
      throw new functionsV1.https.HttpsError("permission-denied", "Admin only");
    }
    const { postId, action, reason } = data ?? {};
    if (!postId || typeof postId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "postId is required");
    }
    const validActions: ReviewAction[] = ["APPROVE", "REJECT", "ESCALATE", "REQUEST_CHANGES", "REMOVE"];
    if (!action || !validActions.includes(action)) {
      throw new functionsV1.https.HttpsError("invalid-argument", `action must be one of: ${validActions.join(", ")}`);
    }

    const ref = db.doc(`posts/${postId}`);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "Post not found.");
      }
      const post = snap.data()!;
      if (post.isSkillBattle !== true) {
        throw new functionsV1.https.HttpsError("failed-precondition", "This post is not a Skill Battle submission.");
      }
      const currentStatus = String(post.status ?? "");
      const now = admin.firestore.FieldValue.serverTimestamp();

      if (action === "REMOVE") {
        if (currentStatus !== "approved") {
          throw new functionsV1.https.HttpsError("failed-precondition", "Can only remove an approved post.");
        }
        tx.update(ref, {
          status: "removed", moderationStatus: "REMOVED",
          reviewedBy: context.auth!.uid, reviewedAt: now, rejectionReason: reason ?? "",
        });
        return { status: "removed" as const, previousStatus: currentStatus };
      }

      if (!REVIEWABLE_STATUSES.has(currentStatus)) {
        throw new functionsV1.https.HttpsError(
          "failed-precondition",
          `Cannot ${action.toLowerCase()} a post that is already ${currentStatus}.`
        );
      }

      if (action === "ESCALATE" || action === "REQUEST_CHANGES") {
        // Neither approves nor rejects — just records the moderator's
        // note and keeps the post out of the public feed (status stays
        // "pending"/"in_review", moderationStatus records the decision).
        const nextModerationStatus = action === "ESCALATE" ? "PENDING_HUMAN_REVIEW" : "REJECTED";
        tx.update(ref, {
          status: action === "REQUEST_CHANGES" ? "in_review" : currentStatus,
          moderationStatus: nextModerationStatus,
          reviewedBy: context.auth!.uid, reviewedAt: now, rejectionReason: reason ?? "",
        });
        return { status: action.toLowerCase() as "escalate" | "request_changes", previousStatus: currentStatus };
      }

      const newStatus = action === "APPROVE" ? "approved" : "rejected";
      const newModerationStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";
      tx.update(ref, {
        status: newStatus, moderationStatus: newModerationStatus,
        reviewedBy: context.auth!.uid, reviewedAt: now,
        rejectionReason: action === "REJECT" ? (reason ?? "") : "",
      });
      return { status: newStatus as "approved" | "rejected", previousStatus: currentStatus };
    });

    await recordModerationAuditEvent({
      engine: "legacy",
      submissionId: postId,
      battleId: (await ref.get()).data()?.battleId ?? "",
      actorUid: context.auth.uid,
      actorRole: "admin",
      action,
      previousStatus: result.previousStatus,
      newStatus: result.status,
      reason,
    }).catch((e) => console.warn("reviewSkillBattlePost: audit log write failed (non-fatal):", e));

    return { ok: true, status: result.status };
  });

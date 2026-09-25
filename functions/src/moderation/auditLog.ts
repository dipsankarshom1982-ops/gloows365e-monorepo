// PATH: functions/src/moderation/auditLog.ts
//
// Append-only moderation audit trail — shared by every moderator action
// across both engines (legacy posts, canonical submissions), reporting,
// and winner verification, so there is exactly one audit shape, not a
// separate ad-hoc log per feature.
//
// Firestore collection: moderationAuditLog/{eventId} (auto-id). Locked
// down in firestore.rules to `allow read: if admin; allow write: if
// false` — every write here goes through the Admin SDK (this function),
// never a direct client write, and reads back require the admin claim
// (superAdmin is a superset per hasPermission()'s own semantics, so this
// doesn't need a separate superAdmin carve-out).

import * as admin from "firebase-admin";

const db = admin.firestore();

export interface ModerationAuditEventInput {
  engine: "legacy" | "canonical";
  submissionId: string; // postId or submissions/{battleId}_{uid}
  battleId: string;
  actorUid: string;
  actorRole: "admin" | "system";
  action: string; // "APPROVE" | "REJECT" | "ESCALATE" | "REMOVE" | "REQUEST_CHANGES" | "REPORT_FILED" | "REPORT_RESOLVED" | "WINNER_VERIFIED" | "WINNER_REJECTED" | ...
  previousStatus: string | null;
  newStatus: string | null;
  reason?: string;
}

export async function recordModerationAuditEvent(input: ModerationAuditEventInput): Promise<string> {
  const ref = db.collection("moderationAuditLog").doc();
  await ref.set({
    engine: input.engine,
    submissionId: input.submissionId,
    battleId: input.battleId,
    actorUid: input.actorUid,
    actorRole: input.actorRole,
    action: input.action,
    previousStatus: input.previousStatus,
    newStatus: input.newStatus,
    reason: input.reason ?? "",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

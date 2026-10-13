// PATH: functions/src/moderation/reporting.ts
//
// User reporting for published Skill Battle content — Phase B §8.
// Works across both engines: `contentType: "post"` (legacy) or
// `"submission"` (canonical), keyed by the doc's own ID within that
// collection.
//
// Duplicate/abuse prevention: report doc ID is deterministic
// (`report_{contentType}_{contentId}_{reporterUid}`), so a transactional
// check-then-create on that single doc is race-proof by construction —
// the same pattern createBattleSubmission already uses for "one student,
// one submission, one battle" (see battleSubmissions.ts's header). A
// second report attempt from the same user on the same content simply
// fails with already-exists; it is never silently double-counted.
//
// Severe categories trigger immediate quarantine (pulling an already-
// APPROVED post/submission back to PENDING_HUMAN_REVIEW) while
// preserving the report and the content itself — never a delete, and
// never treated as proof of guilt on its own (brief: "Do not
// automatically declare a user guilty based solely on a report").

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { recordModerationAuditEvent } from "./auditLog";
import { triggerReModerationAfterReport } from "./reModeration";

const db = admin.firestore();

export type ReportCategory =
  | "copyright" | "reuploaded" | "inappropriate" | "harassment"
  | "violence" | "dangerous_activity" | "spam" | "impersonation" | "other";

const VALID_CATEGORIES: ReadonlySet<ReportCategory> = new Set([
  "copyright", "reuploaded", "inappropriate", "harassment",
  "violence", "dangerous_activity", "spam", "impersonation", "other",
]);

// Categories serious enough to pull already-public content back to
// review immediately, rather than waiting for the normal queue —
// "immediate quarantine while preserving evidence/audit logs" (brief §8).
const SEVERE_CATEGORIES: ReadonlySet<ReportCategory> = new Set([
  "harassment", "violence", "dangerous_activity",
]);

interface SubmitReportInput {
  contentType?: "post" | "submission";
  contentId?: string;
  battleId?: string;
  category?: string;
  note?: string;
}

export const reportSkillBattleContent = functionsV1
  .runWith({ timeoutSeconds: 20, memory: "128MB" })
  .https.onCall(async (data: SubmitReportInput, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const reporterUid = context.auth.uid;
    const { contentType, contentId, battleId, note } = data ?? {};
    const category = data?.category as ReportCategory | undefined;

    if (contentType !== "post" && contentType !== "submission") {
      throw new functionsV1.https.HttpsError("invalid-argument", 'contentType must be "post" or "submission"');
    }
    if (!contentId || typeof contentId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "contentId is required");
    }
    if (!battleId || typeof battleId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "battleId is required");
    }
    if (!category || !VALID_CATEGORIES.has(category)) {
      throw new functionsV1.https.HttpsError("invalid-argument", "A valid report category is required");
    }

    const contentCollection = contentType === "post" ? "posts" : "submissions";
    const contentRef = db.doc(`${contentCollection}/${contentId}`);
    // Deterministic — a second report from the same user on the same
    // content collides on this exact doc, never silently double-counted.
    const reportRef = db.doc(`skillBattleReports/report_${contentType}_${contentId}_${reporterUid}`);

    return db.runTransaction(async (tx) => {
      const [existingReport, contentSnap] = await Promise.all([tx.get(reportRef), tx.get(contentRef)]);

      if (existingReport.exists) {
        throw new functionsV1.https.HttpsError("already-exists", "You have already reported this content.");
      }
      if (!contentSnap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "This content does not exist.");
      }
      const content = contentSnap.data()!;
      const ownerUid = contentType === "post" ? content.userId : content.studentId;

      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.set(reportRef, {
        contentType, contentId, battleId,
        reportedUid: ownerUid ?? null,
        reporterUid,
        category,
        note: (note ?? "").trim().slice(0, 1000),
        status: "OPEN",
        createdAt: now,
        resolvedAt: null,
        resolvedBy: "",
        resolution: "",
      });
      tx.update(contentRef, { reportCount: admin.firestore.FieldValue.increment(1) });

      // Severe-category immediate quarantine — pulls already-public
      // content back to review without deleting anything. Uses whichever
      // status field the content type actually gates its public feed on:
      // `status` for legacy posts (getReelsFeed's real gate), `status`
      // for canonical submissions (battleEngagement.ts's real gate) — see
      // both files' own headers.
      let quarantined = false;
      const currentStatus = contentType === "post" ? content.status : content.status;
      const publicStatusValue = contentType === "post" ? "approved" : "APPROVED";
      const quarantineStatusValue = contentType === "post" ? "pending" : "PENDING_HUMAN_REVIEW";
      if (SEVERE_CATEGORIES.has(category) && currentStatus === publicStatusValue) {
        tx.update(contentRef, {
          status: quarantineStatusValue,
          ...(contentType === "post" ? { moderationStatus: "PENDING_HUMAN_REVIEW" } : {}),
        });
        quarantined = true;
      }

      return { reportId: reportRef.id, quarantined };
    }).then(async (result) => {
      await recordModerationAuditEvent({
        engine: contentType === "post" ? "legacy" : "canonical",
        submissionId: contentId,
        battleId,
        actorUid: reporterUid,
        actorRole: "system",
        action: result.quarantined ? "REPORT_FILED_AND_QUARANTINED" : "REPORT_FILED",
        previousStatus: null,
        newStatus: null,
        reason: category,
      }).catch((e) => console.warn("reportSkillBattleContent: audit log write failed (non-fatal):", e));

      // Phase C §16 — a severe-category quarantine is also a good moment
      // to re-run the automated checks (the report itself is evidence
      // something may be wrong that the original pass missed). Strictly
      // best-effort: the quarantine above has ALREADY taken effect
      // synchronously and reliably regardless of what happens here — see
      // reModeration.ts's header.
      if (result.quarantined) {
        await triggerReModerationAfterReport(contentType === "post" ? "legacy" : "canonical", contentId);
      }

      return result;
    });
  });

interface ResolveReportInput {
  reportId?: string;
  resolution?: "NO_ACTION" | "CONTENT_REMOVED" | "CONTENT_APPROVED" | "ESCALATED";
  note?: string;
}

export const resolveSkillBattleReport = functionsV1
  .runWith({ timeoutSeconds: 15, memory: "128MB" })
  .https.onCall(async (data: ResolveReportInput, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    if (context.auth.token.admin !== true) {
      throw new functionsV1.https.HttpsError("permission-denied", "Admin only");
    }
    const { reportId, resolution, note } = data ?? {};
    if (!reportId || typeof reportId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "reportId is required");
    }
    const validResolutions = ["NO_ACTION", "CONTENT_REMOVED", "CONTENT_APPROVED", "ESCALATED"];
    if (!resolution || !validResolutions.includes(resolution)) {
      throw new functionsV1.https.HttpsError("invalid-argument", `resolution must be one of: ${validResolutions.join(", ")}`);
    }

    const reportRef = db.doc(`skillBattleReports/${reportId}`);
    const snap = await reportRef.get();
    if (!snap.exists) {
      throw new functionsV1.https.HttpsError("not-found", "Report not found.");
    }
    if (snap.data()?.status !== "OPEN") {
      throw new functionsV1.https.HttpsError("failed-precondition", "This report is already resolved.");
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    await reportRef.update({
      status: "RESOLVED",
      resolvedAt: now,
      resolvedBy: context.auth.uid,
      resolution,
      resolutionNote: (note ?? "").trim().slice(0, 1000),
    });

    await recordModerationAuditEvent({
      engine: snap.data()?.contentType === "post" ? "legacy" : "canonical",
      submissionId: snap.data()?.contentId ?? "",
      battleId: snap.data()?.battleId ?? "",
      actorUid: context.auth.uid,
      actorRole: "admin",
      action: "REPORT_RESOLVED",
      previousStatus: "OPEN",
      newStatus: resolution,
      reason: note,
    }).catch((e) => console.warn("resolveSkillBattleReport: audit log write failed (non-fatal):", e));

    return { ok: true };
  });

// PATH: functions/src/moderation/reModeration.ts
//
// Phase C §15/§16 — a safe way to re-run the automated checks on a
// submission that already went through streamWebhook.ts once, without
// ever overwriting its history (see that file's moderationHistory
// snapshot, reused here via processReadyVideo).
//
// Two triggers:
//   1. requestReModeration — an admin-only callable (product/policy
//      change, provider swap, or "this looks stale, recheck it").
//   2. triggerReModerationAfterReport — called by reporting.ts right
//      after a severe-category report quarantines already-approved
//      content back to human review (Phase B behavior, PRESERVED
//      unchanged — see that file); this is a Phase C ADDITION on top of
//      it, not a replacement, and is explicitly best-effort/non-fatal so
//      a provider hiccup here can never block the report itself from
//      being filed and the quarantine from taking effect.

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { processReadyVideo } from "./streamWebhook";
import { recordModerationAuditEvent } from "./auditLog";

const db = admin.firestore();

// Phase C §19 — cost control. A report-triggered recheck (any
// authenticated student can indirectly cause one, via
// reportSkillBattleContent) must not become a way to repeatedly trigger
// billable provider calls against the same content. The admin-only
// requestReModeration callable is NOT rate-limited here — an
// authenticated admin explicitly asking for an immediate recheck is a
// much higher trust bar than "any student's report", and gating it would
// only get in a moderator's way.
const REPORT_RECHECK_COOLDOWN_MS = 5 * 60 * 1000;

async function reModerate(
  engine: "legacy" | "canonical", docId: string, triggeredBy: string, opts: { respectCooldown?: boolean } = {},
) {
  const collection = engine === "legacy" ? "posts" : "submissions";
  const ref = db.collection(collection).doc(docId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new functionsV1.https.HttpsError("not-found", "Submission not found.");
  }
  const data = snap.data()!;
  const streamVideoUid = data.streamVideoUid;
  if (!streamVideoUid || typeof streamVideoUid !== "string") {
    throw new functionsV1.https.HttpsError(
      "failed-precondition",
      "This submission has no recorded Cloudflare Stream video id — it predates Phase C or never completed the initial async check, so there is nothing to re-run yet."
    );
  }
  if (opts.respectCooldown) {
    const lastAt = data.lastAutomatedModerationAt;
    const lastMs = typeof lastAt?.toMillis === "function" ? lastAt.toMillis() : null;
    if (lastMs !== null && Date.now() - lastMs < REPORT_RECHECK_COOLDOWN_MS) {
      console.warn(`reModerate: skipping report-triggered recheck for ${engine}/${docId} — within cooldown window (last run ${Date.now() - lastMs}ms ago).`);
      return { ok: true, skipped: "cooldown" };
    }
  }
  await processReadyVideo(ref, engine, streamVideoUid);
  return { ok: true };
}

export const requestReModeration = functionsV1
  .runWith({ timeoutSeconds: 60, memory: "256MB", secrets: ["CLOUDFLARE_STREAM_WEBHOOK_SECRET", "CLOUDFLARE_API_TOKEN"] })
  .https.onCall(async (data: { engine?: "legacy" | "canonical"; docId?: string; reason?: string }, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    if (context.auth.token.admin !== true) {
      throw new functionsV1.https.HttpsError("permission-denied", "Admin only");
    }
    const { engine, docId, reason } = data ?? {};
    if (engine !== "legacy" && engine !== "canonical") {
      throw new functionsV1.https.HttpsError("invalid-argument", 'engine must be "legacy" or "canonical"');
    }
    if (!docId || typeof docId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "docId is required");
    }

    const result = await reModerate(engine, docId, context.auth.uid);

    await recordModerationAuditEvent({
      engine, submissionId: docId, battleId: "",
      actorUid: context.auth.uid, actorRole: "admin",
      action: "MANUAL_REMODERATION_REQUESTED",
      previousStatus: null, newStatus: null,
      reason: reason ?? "Admin-requested recheck",
    }).catch((e) => console.warn("requestReModeration: audit log write failed (non-fatal):", e));

    return result;
  });

// Called from reporting.ts, AFTER its own transaction commits — never
// blocks or fails the report-filing flow itself (see this file's header).
export async function triggerReModerationAfterReport(
  engine: "legacy" | "canonical",
  docId: string,
): Promise<void> {
  try {
    await reModerate(engine, docId, "system:report-quarantine", { respectCooldown: true });
  } catch (e) {
    console.warn(`triggerReModerationAfterReport: best-effort recheck failed for ${engine}/${docId} (non-fatal):`, e);
  }
}

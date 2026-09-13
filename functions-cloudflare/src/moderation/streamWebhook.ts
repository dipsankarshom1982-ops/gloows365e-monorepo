// PATH: functions-cloudflare/src/moderation/streamWebhook.ts
//
// MIRRORED FILE — this code is mirrored from functions/src/moderation for
// isolated Firebase deployment (the "cloudflare-webhook" codebase, added
// so handleCloudflareStreamWebhook can be discovered/deployed without
// loading the entire ~190-function "default" codebase). Changes to the
// canonical moderation implementation at functions/src/moderation/streamWebhook.ts
// must be mirrored here until a shared package/drift-check is introduced.
// Do not diverge the two copies' behavior — this is the ONLY place that
// exports handleCloudflareStreamWebhook itself, so it is the highest-risk
// file in this mirror to let drift.
//
// Original header follows unchanged:
//
// PATH: functions/src/moderation/streamWebhook.ts
//
// Phase C §6/§7/§8 — the async pipeline's entry point. Cloudflare Stream
// calls this HTTPS endpoint when a video finishes encoding ("ready to
// stream") or errors — see index.ts for the export and the report's
// Production Launch Checklist for the one-time, out-of-band step of
// actually registering this URL with Cloudflare
// (PUT /accounts/{id}/stream/webhook — an administrative action, not
// something this codebase should do to itself at runtime).
//
// This is the ONLY place copyright/similarity checks actually run — see
// pipeline.ts's header for why they cannot run at submission-creation
// time. Never reachable from the mobile client; Cloudflare is the only
// caller, verified via HMAC signature (see verifyStreamSignature below).
//
// SECURITY: this is a firebase-functions v1 `.https.onRequest` endpoint,
// NOT an `onCall` — there is no Firebase Auth context here at all, by
// necessity (Cloudflare cannot mint a Firebase ID token). The signature
// check below is the ONLY authentication boundary; every code path that
// skips it is treated as a security bug, not a convenience.

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import * as crypto from "crypto";
import { getCloudflareStreamEnvConfig } from "./providerConfig";
import { runModerationPipeline, moderationResultToFields } from "./pipeline";
import { recordModerationAuditEvent } from "./auditLog";

const db = admin.firestore();

// Configurable replay window (seconds) — same envNumber-with-safe-fallback
// pattern already established elsewhere in this codebase (see
// decisionEngine.ts's MODERATION_HIGH_THRESHOLD/MODERATION_REVIEW_THRESHOLD)
// rather than a new configuration mechanism. 300s (5 min) is a
// conservative default wide enough to absorb normal clock drift and
// Cloudflare's own delivery/retry latency without meaningfully weakening
// replay protection. Not documented as a *required* secret — this is a
// tuning knob, not a credential.
//
// Deliberately read PER-CALL, not cached in a module-level constant the
// way decisionEngine.ts's thresholds are — this value has no cold-start
// performance reason to be cached (it's one process.env read), and
// reading it fresh means a redeploy or (in the emulator/tests) an env
// change always takes effect without relying on module-cache timing.
function webhookMaxSkewSeconds(): number {
  const raw = process.env.CLOUDFLARE_STREAM_WEBHOOK_MAX_SKEW_SECONDS;
  if (!raw) return 300;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 300;
}

// ── Signature verification (Cloudflare Stream's documented scheme,
// 2026-09 verified) ─────────────────────────────────────────────────────
// Header: "Webhook-Signature: time=<unix_seconds>,sig1=<hex_hmac_sha256>"
// Signed string: `${time}.${rawBody}` (exact bytes, not re-serialized
// JSON — mirrors mediaOwnership.ts's "verify before ever trusting the
// payload" posture).
//
// FRESHNESS (added alongside the original HMAC check, not a replacement
// for it — the HMAC remains the primary authentication mechanism; this
// closes a separate gap: a captured, correctly-signed request replayed
// well after the fact would otherwise still pass signature verification
// forever, since Cloudflare's secret doesn't rotate on its own). Rejects
// a `time` older OR materially newer than WEBHOOK_MAX_SKEW_SECONDS from
// now — both directions matter: too old is a replay candidate, too far
// in the future is a forged/clock-abused timestamp. This is intentionally
// checked only AFTER the HMAC comparison succeeds, so a request with a
// bad signature is always rejected for the same reason (401) regardless
// of its timestamp, and never leaks timing information about which check
// tripped.
export function verifyStreamWebhookSignature(
  header: string | undefined,
  rawBody: string,
  secret: string,
): boolean {
  if (!header || !secret) return false;
  const fields: Record<string, string> = {};
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    fields[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  const time = fields["time"];
  const sig1 = fields["sig1"];
  if (!time || !sig1) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${time}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  let providedBuf: Buffer;
  try {
    providedBuf = Buffer.from(sig1, "hex");
  } catch {
    return false;
  }
  if (expectedBuf.length !== providedBuf.length) return false;
  if (!crypto.timingSafeEqual(expectedBuf, providedBuf)) return false;

  const timeSeconds = Number(time);
  if (!Number.isFinite(timeSeconds)) return false;
  const skew = Math.abs(Date.now() / 1000 - timeSeconds);
  if (skew > webhookMaxSkewSeconds()) return false;

  return true;
}

interface StreamWebhookPayload {
  uid?: string;
  readyToStream?: boolean;
  status?: { state?: string; errReasonCode?: string; errReasonText?: string };
  modified?: string;
}

// ── Audio extraction (Cloudflare's own /downloads/audio, verified 2026-09;
// avoids needing ffmpeg/ any video-processing dependency in this Cloud
// Function — see this file's header). Bounded polling: a handful of short
// retries, then gives up rather than holding the webhook handler (and
// Cloudflare's own retry budget for THIS webhook) open indefinitely. A
// timeout here is reported as an honest UNKNOWN copyright result (fail-
// closed), never silently skipped. ─────────────────────────────────────
const AUDIO_POLL_ATTEMPTS = 4;
const AUDIO_POLL_DELAY_MS = 3000;

async function fetchAudioSample(uid: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const { accountId, apiToken } = getCloudflareStreamEnvConfig();
  if (!accountId || !apiToken) return null;
  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}/downloads`;
  const headers = { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" };

  try {
    await fetch(`${base}/audio`, { method: "POST", headers });
  } catch (e) {
    console.error(`streamWebhook: failed to request audio download for ${uid}:`, e);
    return null;
  }

  for (let attempt = 0; attempt < AUDIO_POLL_ATTEMPTS; attempt++) {
    let statusJson: { result?: { audio?: { status?: string; url?: string } } } | null = null;
    try {
      const res = await fetch(base, { headers });
      statusJson = await res.json().catch(() => null);
    } catch (e) {
      console.error(`streamWebhook: audio download status check failed for ${uid}:`, e);
      return null;
    }
    const audio = statusJson?.result?.audio;
    if (audio?.status === "ready" && audio.url) {
      try {
        const fileRes = await fetch(audio.url);
        if (!fileRes.ok) return null;
        return { bytes: Buffer.from(await fileRes.arrayBuffer()), contentType: "audio/mp4" };
      } catch (e) {
        console.error(`streamWebhook: audio file download failed for ${uid}:`, e);
        return null;
      }
    }
    if (attempt < AUDIO_POLL_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, AUDIO_POLL_DELAY_MS));
    }
  }
  console.warn(`streamWebhook: audio download not ready for ${uid} after ${AUDIO_POLL_ATTEMPTS} attempts — giving up, copyright check reported UNKNOWN.`);
  return null;
}

// Status values a moderator decision has already moved PAST — a late/
// duplicate automated result must never drag one of these back to
// PENDING_HUMAN_REVIEW (Phase C brief §7: "never overwrite a later
// moderator decision"). New automated data is still stored for the
// audit trail; `status`/`moderationStatus` itself is left untouched.
const HUMAN_DECIDED_STATUSES = new Set(["APPROVED", "REJECTED", "REMOVED", "approved", "rejected", "removed"]);

// The legacy `posts` collection's `status` field uses a DIFFERENT,
// lowercase vocabulary from the shared uppercase ModerationStatus enum
// (see legacyPostReview.ts's identical mapping) — canonical `submissions`
// reuse ModerationStatus's own values directly for `status`. Both engines'
// PROCESSING/unresolved outcomes always route to PENDING_HUMAN_REVIEW
// (decisionEngine.ts), which is the only value this mapping needs to
// cover in practice while AUTO_REJECT_HIGH_RISK/AUTO_APPROVE_LOW_RISK
// stay off — REJECTED/APPROVED are handled too, honestly, in case either
// is ever turned on.
export const LEGACY_STATUS_MAP: Record<string, string> = {
  PENDING_MODERATION: "pending", PENDING_HUMAN_REVIEW: "pending",
  APPROVED: "approved", REJECTED: "rejected", REMOVED: "removed",
};

// Exported (Phase C §15/§16) — the SAME "run the real checks and merge
// into the decision engine" logic used by this webhook is reused by
// reModeration.ts's admin-requested recheck and reporting.ts's
// report-triggered recheck, rather than duplicating it a second time.
// Never call this without already knowing the video is actually ready —
// callers are responsible for that precondition (this webhook checks
// `status.state==="ready"` before calling; the other two callers only
// ever act on a submission that has already been through this path once,
// so streamVideoUid/mediaUrl are already known-good).
export async function processReadyVideo(
  docRef: admin.firestore.DocumentReference,
  engine: "legacy" | "canonical",
  streamUid: string,
) {
  const snap = await docRef.get();
  if (!snap.exists) return;
  const data = snap.data()!;
  const currentStatus = String(data.status ?? "");
  const battleId = String(data.battleId ?? "");
  const mediaUrl = String(data.mediaUrl ?? data.mediaRef ?? "");

  const audioSample = await fetchAudioSample(streamUid);

  const result = await runModerationPipeline({
    submissionId: docRef.id,
    videoRef: mediaUrl,
    battleId,
    streamVideoUid: streamUid,
    audioSample: audioSample ?? undefined,
  });

  const previousReasons: string[] = Array.isArray(data.moderationReasons) ? data.moderationReasons : [];
  const previousRisk = data.moderationRiskLevel ?? null;
  const fields = moderationResultToFields(result);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const previousVersion = Number(data.moderationProcessingVersion) || 0;
  const nextVersion = previousVersion + 1;

  // §15 — never overwrite history: snapshot the PRE-update fields into an
  // append-only subcollection before this function's own update() call
  // replaces them. A version-0 doc (never processed before) has nothing
  // meaningful to snapshot, so this is skipped only in that one case.
  if (previousVersion > 0) {
    await docRef.collection("moderationHistory").doc(`v${previousVersion}`).set({
      version: previousVersion,
      moderationStatus: data.moderationStatus ?? null,
      moderationRiskLevel: data.moderationRiskLevel ?? null,
      moderationReasons: previousReasons,
      safetyModeration: data.safetyModeration ?? null,
      copyrightStatus: data.copyrightStatus ?? null,
      copyrightCheck: data.copyrightCheck ?? null,
      similarityStatus: data.similarityStatus ?? null,
      similarityCheck: data.similarityCheck ?? null,
      archivedAt: now,
    });
  }

  const humanAlreadyDecided = HUMAN_DECIDED_STATUSES.has(currentStatus);
  // §7 — a late/re-run automated result must never drag a human-decided
  // submission's VISIBLE status back to PENDING_HUMAN_REVIEW. moderationStatus
  // is deliberately excluded from the base `fields` spread (not just left
  // to be "overridden" after) when a human has already decided, since a
  // naive spread-then-override would still momentarily include it in the
  // payload — this keeps the update object honestly reflecting what is
  // actually being changed.
  const { moderationStatus: _newModerationStatus, ...fieldsWithoutStatus } = fields;
  const newStatusValue = engine === "legacy"
    ? (LEGACY_STATUS_MAP[fields.moderationStatus] ?? "pending")
    : fields.moderationStatus;
  await docRef.update({
    ...(humanAlreadyDecided ? fieldsWithoutStatus : { ...fields, status: newStatusValue }),
    moderationProcessingVersion: nextVersion,
    lastAutomatedModerationAt: now,
    updatedAt: now,
  });

  await recordModerationAuditEvent({
    engine, submissionId: docRef.id, battleId,
    actorUid: "system", actorRole: "system",
    action: "AUTOMATED_MODERATION_COMPLETE",
    previousStatus: humanAlreadyDecided ? currentStatus : (previousReasons.length ? "PENDING_HUMAN_REVIEW" : currentStatus),
    newStatus: humanAlreadyDecided ? currentStatus : fields.moderationStatus,
    reason: humanAlreadyDecided
      ? `Automated result arrived after a moderator decision (${currentStatus}) — stored for audit only, status preserved. risk=${fields.moderationRiskLevel} (was ${previousRisk})`
      : `risk=${fields.moderationRiskLevel} reasons=${fields.moderationReasons.join("; ")}`,
  }).catch((e) => console.warn("streamWebhook: audit log write failed (non-fatal):", e));
}

export const handleCloudflareStreamWebhook = functionsV1
  .runWith({ timeoutSeconds: 60, memory: "256MB", secrets: ["CLOUDFLARE_STREAM_WEBHOOK_SECRET", "CLOUDFLARE_API_TOKEN"] })
  .https.onRequest(async (req, res) => {
    // Method enforcement — checked BEFORE any body parsing/secret lookup/
    // signature work, so a non-POST request is rejected as cheaply as
    // possible and never reaches code that trusts req.rawBody.
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const { webhookSigningSecret } = getCloudflareStreamEnvConfig();
    if (!webhookSigningSecret) {
      console.error("handleCloudflareStreamWebhook: CLOUDFLARE_STREAM_WEBHOOK_SECRET not configured — rejecting all requests fail-closed.");
      res.status(500).send("Not configured");
      return;
    }

    // req.rawBody is populated by firebase-functions v1 for every
    // onRequest handler — required here since the signature is computed
    // over the exact raw bytes, not a re-serialized JSON.parse(body).
    const rawBody: string = (req as unknown as { rawBody?: Buffer }).rawBody?.toString("utf8") ?? "";
    const signatureHeader = req.get("Webhook-Signature");
    if (!verifyStreamWebhookSignature(signatureHeader, rawBody, webhookSigningSecret)) {
      console.warn("handleCloudflareStreamWebhook: signature verification failed — rejecting.");
      res.status(401).send("Invalid signature");
      return;
    }

    let payload: StreamWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      res.status(400).send("Malformed payload");
      return;
    }
    const uid = payload.uid;
    if (!uid) {
      res.status(400).send("Missing uid");
      return;
    }

    try {
      const [submissionsSnap, postsSnap] = await Promise.all([
        db.collection("submissions").where("streamVideoUid", "==", uid).limit(1).get(),
        db.collection("posts").where("streamVideoUid", "==", uid).where("isSkillBattle", "==", true).limit(1).get(),
      ]);
      const docRef = submissionsSnap.docs[0]?.ref ?? postsSnap.docs[0]?.ref;
      if (!docRef) {
        // A Stream video with no matching submission — could be a video
        // uploaded but never actually submitted (withdrawn mid-upload,
        // or a non-SkillBattle upload sharing the same Worker). Not an
        // error; just nothing to do.
        res.status(200).send("No matching submission");
        return;
      }
      const engine: "legacy" | "canonical" = submissionsSnap.docs[0] ? "canonical" : "legacy";

      // ── Idempotency (§7): a duplicate/replayed webhook for the same
      // uid+modified is a no-op — checked BEFORE any provider call so a
      // replay never triggers a second round of (billable) provider work.
      const existing = await docRef.get();
      const lastModified = existing.data()?.streamWebhookLastModified;
      if (payload.modified && lastModified === payload.modified) {
        res.status(200).send("Duplicate webhook, already processed");
        return;
      }
      await docRef.update({ streamWebhookLastModified: payload.modified ?? admin.firestore.FieldValue.serverTimestamp() });

      if (payload.status?.state === "error") {
        // The video itself is unusable — an honest FAILED safety result,
        // not silently ignored (Phase C brief §8: never "provider failed
        // -> assume safe -> approve").
        const now = admin.firestore.FieldValue.serverTimestamp();
        await docRef.update({
          moderationStatus: "PENDING_HUMAN_REVIEW",
          moderationReasons: [`Video processing failed: ${payload.status.errReasonCode ?? "unknown error"}`],
          updatedAt: now,
        });
        res.status(200).send("Video error recorded");
        return;
      }
      if (payload.status?.state !== "ready" || payload.readyToStream !== true) {
        // Still processing — nothing to do yet, this webhook will fire
        // again on the actual ready/error transition.
        res.status(200).send("Not ready yet");
        return;
      }

      await processReadyVideo(docRef, engine, uid);
      res.status(200).send("OK");
    } catch (e) {
      console.error("handleCloudflareStreamWebhook: unhandled error:", e);
      // 500 so Cloudflare retries — an internal error here must not be
      // mistaken for "nothing to check", per fail-closed policy.
      res.status(500).send("Internal error");
    }
  });

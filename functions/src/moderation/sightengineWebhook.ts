// PATH: functions/src/moderation/sightengineWebhook.ts
//
// Phase C §6/§7/§8 — receives Sightengine's async video-moderation
// result (the OTHER half of videoModerationProvider.ts's
// SightengineVideoModerationProvider, which only ever SUBMITS a job —
// see that file's header). This is the only place a submission's visual-
// safety check is ever marked COMPLETED.
//
// SECURITY: same posture as streamWebhook.ts — an unauthenticated
// `.https.onRequest` endpoint, Sightengine is the only intended caller,
// verified via HMAC signature (see verifySightengineSignature below).
//
// NOT VERIFIED (brief §8, malformed-response handling): Sightengine's
// documented callback shape is `{media, request, data, status}` at a
// high level, but this codebase has not seen a real payload from a live
// account — the exact category/label field names inside `data` are
// PARSED DEFENSIVELY below (extractWorstCaseLabels), not assumed. See
// that function's own comment for exactly what is and is not trusted.
// This does not weaken the actual safety boundary: AUTO_APPROVE_LOW_RISK
// stays false by default (decisionEngine.ts), so even a perfectly-parsed
// "clean" result still lands in PENDING_HUMAN_REVIEW — a parsing miss
// here can only ever affect triage priority, never cause an unsafe
// auto-publish.

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import * as crypto from "crypto";
import { getVideoModerationProviderEnvConfig } from "./providerConfig";
import { evaluateModerationDecision } from "./decisionEngine";
import { moderationResultToFields } from "./pipeline";
import { recordModerationAuditEvent } from "./auditLog";
import { LEGACY_STATUS_MAP } from "./streamWebhook";
import { VideoModerationLabel, VideoModerationResult, CopyrightCheckResult, SimilarityCheckResult } from "./types";

const db = admin.firestore();

// ── Signature verification (Sightengine's documented scheme, 2026-09
// verified): header "Sightengine-Signature: t=<unix_seconds>,v1=<hex_hmac>",
// signed string `${t}.${rawBody}`, secret is the endpoint's signing
// secret (prefixed casec_ in Sightengine's dashboard). Same shape as
// Cloudflare's own scheme (streamWebhook.ts) — coincidence, not a shared
// implementation, each verified independently against its own docs.
export function verifySightengineSignature(
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
  const t = fields["t"];
  const v1 = fields["v1"];
  if (!t || !v1) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  let providedBuf: Buffer;
  try {
    providedBuf = Buffer.from(v1, "hex");
  } catch {
    return false;
  }
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

interface SightengineCallbackPayload {
  media?: { id?: string };
  status?: "ongoing" | "finished" | "stopped" | "failure";
  data?: unknown;
}

// Walks the callback's `data` looking for numeric leaf values that look
// like 0-1 confidence scores, paired with their key path as a label name.
// This is deliberately generic rather than hardcoding a category list
// this codebase has not verified against a live payload (see this file's
// header) — it will over-report candidate labels rather than silently
// miss a real one, which is the safer failure direction here (worst case
// is an inflated-but-still-just-advisory riskLevel, never a missed
// unsafe video being scored as clean).
function extractWorstCaseLabels(data: unknown, pathPrefix = "", depth = 0): VideoModerationLabel[] {
  if (depth > 4 || data === null || typeof data !== "object") return [];
  const labels: VideoModerationLabel[] = [];
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const path = pathPrefix ? `${pathPrefix}.${key}` : key;
    if (typeof value === "number" && value >= 0 && value <= 1) {
      labels.push({ name: path, confidence: Math.round(value * 100) });
    } else if (Array.isArray(value)) {
      for (const item of value) labels.push(...extractWorstCaseLabels(item, path, depth + 1));
    } else if (value && typeof value === "object") {
      labels.push(...extractWorstCaseLabels(value, path, depth + 1));
    }
  }
  return labels;
}

export const handleSightengineCallback = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "128MB", secrets: ["SIGHTENGINE_CALLBACK_SIGNING_SECRET"] })
  .https.onRequest(async (req, res) => {
    const { callbackSigningSecret } = getVideoModerationProviderEnvConfig();
    if (!callbackSigningSecret) {
      console.error("handleSightengineCallback: SIGHTENGINE_CALLBACK_SIGNING_SECRET not configured — rejecting fail-closed.");
      res.status(500).send("Not configured");
      return;
    }

    const rawBody: string = (req as unknown as { rawBody?: Buffer }).rawBody?.toString("utf8") ?? "";
    const signatureHeader = req.get("Sightengine-Signature");
    if (!verifySightengineSignature(signatureHeader, rawBody, callbackSigningSecret)) {
      console.warn("handleSightengineCallback: signature verification failed — rejecting.");
      res.status(401).send("Invalid signature");
      return;
    }

    let payload: SightengineCallbackPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      res.status(400).send("Malformed payload");
      return;
    }
    const jobId = payload.media?.id;
    if (!jobId) {
      res.status(400).send("Missing media.id");
      return;
    }
    if (payload.status === "ongoing") {
      // Preliminary/interim update — not a final result. Acknowledge and
      // do nothing; only "finished"/"failure"/"stopped" are terminal.
      res.status(200).send("Acknowledged (ongoing)");
      return;
    }

    try {
      const [submissionsSnap, postsSnap] = await Promise.all([
        db.collection("submissions").where("safetyModerationJobId", "==", jobId).limit(1).get(),
        db.collection("posts").where("safetyModerationJobId", "==", jobId).where("isSkillBattle", "==", true).limit(1).get(),
      ]);
      const docRef = submissionsSnap.docs[0]?.ref ?? postsSnap.docs[0]?.ref;
      if (!docRef) {
        // No submission currently references this job id — either a
        // stale/duplicate callback for a job a later re-moderation cycle
        // already superseded (see providers' jobId being overwritten on
        // each new kickoff), or a callback for a job this system never
        // tracked. Either way, safely a no-op.
        res.status(200).send("No matching submission for this job id");
        return;
      }
      const engine: "legacy" | "canonical" = submissionsSnap.docs[0] ? "canonical" : "legacy";

      const snap = await docRef.get();
      const data = snap.data()!;
      const currentSafety = data.safetyModeration as { status?: string } | undefined;

      // ── Idempotency (§7): a duplicate "finished"/"failure" callback for
      // a job already marked terminal is a no-op — Sightengine's own docs
      // describe callbacks as "at most once per interesting event plus
      // one final", but treating this defensively costs nothing.
      if (currentSafety?.status === "COMPLETED" || currentSafety?.status === "FAILED") {
        res.status(200).send("Already processed");
        return;
      }

      const moderation: VideoModerationResult = payload.status === "failure"
        ? { provider: "sightengine", jobId, status: "FAILED", labels: [], processedAt: Date.now(), error: "Sightengine reported failure" }
        : payload.status === "stopped"
        ? { provider: "sightengine", jobId, status: "FAILED", labels: [], processedAt: Date.now(), error: "Sightengine job stopped before completion" }
        : { provider: "sightengine", jobId, status: "COMPLETED", labels: extractWorstCaseLabels(payload.data), processedAt: Date.now(), error: null };

      // Re-run the EXISTING decision engine with the stored copyright/
      // similarity results (already computed by streamWebhook.ts, or
      // still their honest "not yet checked" placeholders if this
      // callback somehow arrived first) plus this new safety result —
      // never a second, competing decision path (Phase C brief §9).
      const copyright: CopyrightCheckResult = data.copyrightCheck
        ? { provider: data.copyrightCheck.provider ?? "none", status: data.copyrightStatus ?? "NOT_CONFIGURED", ...data.copyrightCheck }
        : { provider: "none", status: "NOT_CONFIGURED", confidence: null, matchedWork: null, matchStartSeconds: null, matchEndSeconds: null, providerReference: null, processedAt: null, error: null };
      const similarity: SimilarityCheckResult = data.similarityCheck
        ? { provider: data.similarityCheck.provider ?? "none", status: data.similarityStatus ?? "NOT_CHECKED", ...data.similarityCheck }
        : { provider: "none", fingerprintVersion: null, fingerprint: null, status: "NOT_CHECKED", similarityScore: null, matchedSubmissionId: null, processedAt: null, error: null };

      const decision = evaluateModerationDecision(moderation, copyright, similarity);
      const fields = moderationResultToFields({ moderation, copyright, similarity, decision });

      const currentStatus = String(data.status ?? "");
      const HUMAN_DECIDED = new Set(["APPROVED", "REJECTED", "REMOVED", "approved", "rejected", "removed"]);
      const humanAlreadyDecided = HUMAN_DECIDED.has(currentStatus);
      const now = admin.firestore.FieldValue.serverTimestamp();
      const previousVersion = Number(data.moderationProcessingVersion) || 0;
      const nextVersion = previousVersion + 1;

      // §15 — same append-only history snapshot as streamWebhook.ts's
      // processReadyVideo(); never overwrite the pre-update record.
      if (previousVersion > 0) {
        await docRef.collection("moderationHistory").doc(`v${previousVersion}`).set({
          version: previousVersion,
          moderationStatus: data.moderationStatus ?? null,
          moderationRiskLevel: data.moderationRiskLevel ?? null,
          moderationReasons: Array.isArray(data.moderationReasons) ? data.moderationReasons : [],
          safetyModeration: data.safetyModeration ?? null,
          copyrightStatus: data.copyrightStatus ?? null,
          copyrightCheck: data.copyrightCheck ?? null,
          similarityStatus: data.similarityStatus ?? null,
          similarityCheck: data.similarityCheck ?? null,
          archivedAt: now,
        });
      }

      // §7 — same "never drag a human-decided submission back" fix as
      // streamWebhook.ts's processReadyVideo; see that file's comment.
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
        engine, submissionId: docRef.id, battleId: String(data.battleId ?? ""),
        actorUid: "system", actorRole: "system",
        action: "AUTOMATED_SAFETY_RESULT",
        previousStatus: currentStatus, newStatus: humanAlreadyDecided ? currentStatus : fields.moderationStatus,
        reason: `Sightengine job ${jobId} → ${moderation.status}, risk=${fields.moderationRiskLevel}`,
      }).catch((e) => console.warn("sightengineWebhook: audit log write failed (non-fatal):", e));

      res.status(200).send("OK");
    } catch (e) {
      console.error("handleSightengineCallback: unhandled error:", e);
      res.status(500).send("Internal error");
    }
  });

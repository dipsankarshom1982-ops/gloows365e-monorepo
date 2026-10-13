// PATH: functions/src/moderation/copyrightDetectionProvider.ts
//
// Abstraction over audio/content fingerprint-based copyright matching —
// deliberately separate from videoModerationProvider.ts. AWS Rekognition
// (or any visual-safety provider) does NOT detect copyright infringement;
// that requires an audio-fingerprint/rights-database lookup from a
// dedicated provider (e.g. a licensed music-recognition API), which is a
// completely different product category and a separate legal
// relationship. Conflating the two would misrepresent what either
// system actually checked.
//
// PHASE A STATUS — NOT CONFIGURED. No copyright-detection vendor has
// been selected or credentialed for this project. This file exists so
// the rest of the pipeline has a real, typed interface to call and a
// real, honest "not configured" result to react to — never a faked pass.
//
// CopyrightStatus (types.ts) intentionally distinguishes
// "COPYRIGHT_CHECK_NOT_CONFIGURED"-equivalent (NOT_CONFIGURED) from
// "COPYRIGHT_CHECK_PASSED"-equivalent (NO_MATCH) — the decision engine
// must never treat the former as the latter. See decisionEngine.ts.
//
// Terminology note (brief §26): this file's result type is
// CONFIRMED_MATCH, never "COPYRIGHT_INFRINGEMENT_CONFIRMED" — a
// fingerprint match is evidence for a human/legal process to weigh, not
// a legal determination this codebase is positioned to make.

import * as crypto from "crypto";
import { CopyrightCheckResult } from "./types";
import { getCopyrightProviderEnvConfig } from "./providerConfig";

export interface CopyrightCheckInput {
  submissionId: string;
  videoRef: string;
  // Phase C — populated by the async moderation job (streamWebhook.ts)
  // AFTER downloading a short audio sample from Cloudflare Stream's
  // `/downloads/audio` endpoint. Absent at submission-creation time
  // (the video isn't processed yet) — see pipeline.ts's header for why
  // this check can never run synchronously on the upload path.
  audioSample?: { bytes: Buffer; contentType: string };
}

export interface CopyrightDetectionProvider {
  readonly name: string;
  checkCopyright(input: CopyrightCheckInput): Promise<CopyrightCheckResult>;
}

// REQUIRED CONFIGURATION (once a vendor is actually selected — none is
// today): COPYRIGHT_PROVIDER (which implementation to select),
// COPYRIGHT_API_KEY, COPYRIGHT_API_SECRET. See functions/.env.example.
export class UnconfiguredCopyrightDetectionProvider implements CopyrightDetectionProvider {
  readonly name = "none";

  async checkCopyright(input: CopyrightCheckInput): Promise<CopyrightCheckResult> {
    console.warn(
      `UnconfiguredCopyrightDetectionProvider: no copyright provider configured ` +
      `(COPYRIGHT_PROVIDER/COPYRIGHT_API_KEY/COPYRIGHT_API_SECRET) — ` +
      `submission=${input.submissionId} routed to NOT_CONFIGURED, never treated as a pass.`
    );
    return {
      provider: this.name,
      status: "NOT_CONFIGURED",
      confidence: null,
      matchedWork: null,
      matchStartSeconds: null,
      matchEndSeconds: null,
      providerReference: null,
      processedAt: Date.now(),
      error: null,
    };
  }
}

// ── ACRCloud Identification API (Phase C — REAL, verified integration) ──
// Chosen because it publishes a documented, self-serve REST API with a
// reference music database (150M+ tracks) and a working free trial — not
// selected merely by familiarity (brief §4's warning). YouTube Content ID
// was explicitly ruled out (no official API access for a project this
// size). Audible Magic is the enterprise/industry-standard alternative
// but requires a direct commercial relationship to get API credentials
// at all — not evaluable without that relationship in place, so it is
// documented here as a REQUIRES ACCOUNT alternative, not implemented.
//
// Verified against ACRCloud's own docs (2026-09):
//   POST https://{ACRCLOUD_HOST}/v1/identify (e.g. identify-eu-west-1.
//   acrcloud.com, identify-ap-southeast-1.acrcloud.com — pick the region
//   closest to this project's users; India traffic is commonly routed to
//   an ap-southeast-1 endpoint, but the exact recommended region for an
//   India-based account should be confirmed with ACRCloud directly, not
//   assumed here).
//   multipart/form-data: sample (audio bytes, <=5MB), access_key,
//   sample_bytes, timestamp, signature (HMAC-SHA1), data_type="audio",
//   signature_version="1".
//   Signature: HMAC-SHA1("POST\n/v1/identify\n{access_key}\naudio\n1\n
//   {timestamp}", access_secret), base64-encoded.
//   SYNCHRONOUS — the response is the actual match result, no polling or
//   webhook for this specific endpoint (unlike Sightengine above). This
//   is what makes it safe to call from within the async Stream-webhook
//   job without needing a third webhook receiver.
//
// NOT VERIFIED (no live ACRCloud account in this environment): the
// complete catalogue of non-zero `status.code` values beyond the
// documented success (0) case — see the defensive parsing below and its
// own comment for exactly what that means for NO_MATCH vs UNKNOWN.
export class AcrCloudCopyrightDetectionProvider implements CopyrightDetectionProvider {
  readonly name = "acrcloud";

  private isConfigured(): boolean {
    const c = getCopyrightProviderEnvConfig();
    return !!(c.host && c.accessKey && c.accessSecret);
  }

  async checkCopyright(input: CopyrightCheckInput): Promise<CopyrightCheckResult> {
    const c = getCopyrightProviderEnvConfig();
    const notConfigured = (): CopyrightCheckResult => {
      console.warn(
        `AcrCloudCopyrightDetectionProvider: no copyright provider configured ` +
        `(ACRCLOUD_HOST/ACRCLOUD_ACCESS_KEY/ACRCLOUD_ACCESS_SECRET) — ` +
        `submission=${input.submissionId} routed to NOT_CONFIGURED, never treated as a pass.`
      );
      return {
        provider: this.name, status: "NOT_CONFIGURED", confidence: null, matchedWork: null,
        matchStartSeconds: null, matchEndSeconds: null, providerReference: null,
        processedAt: Date.now(), error: null,
      };
    };

    if (!this.isConfigured()) return notConfigured();

    if (!input.audioSample) {
      // The video wasn't ready / audio extraction hasn't run yet — an
      // honest "can't answer this yet", not a fabricated NO_MATCH.
      // decisionEngine.ts's riskFromCopyright() treats UNKNOWN as
      // unresolved, same fail-closed posture as NOT_CONFIGURED.
      return {
        provider: this.name, status: "UNKNOWN", confidence: null, matchedWork: null,
        matchStartSeconds: null, matchEndSeconds: null, providerReference: null,
        processedAt: Date.now(), error: "No audio sample available yet",
      };
    }

    // ACRCloud caps a single identify request at 5MB — truncate rather
    // than reject outright; a partial sample still gives ACRCloud a real
    // chance at a match (their own guidance says clips under 15s already
    // work well, and a 60s Skill Battle clip's audio track is typically
    // well under this cap at a normal bitrate regardless).
    const MAX_SAMPLE_BYTES = 5 * 1024 * 1024;
    const sampleBytes = input.audioSample.bytes.length > MAX_SAMPLE_BYTES
      ? input.audioSample.bytes.subarray(0, MAX_SAMPLE_BYTES)
      : input.audioSample.bytes;

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const stringToSign = `POST\n/v1/identify\n${c.accessKey}\naudio\n1\n${timestamp}`;
    const signature = crypto.createHmac("sha1", c.accessSecret!).update(stringToSign).digest("base64");

    try {
      const form = new FormData();
      form.append("access_key", c.accessKey!);
      form.append("sample_bytes", String(sampleBytes.length));
      form.append("timestamp", timestamp);
      form.append("signature", signature);
      form.append("data_type", "audio");
      form.append("signature_version", "1");
      // Node's Buffer vs the DOM BlobPart type: a runtime-safe mismatch
      // only (Node's undici Blob implementation accepts a Buffer/
      // Uint8Array directly), not an actual incompatibility — see
      // https://github.com/nodejs/undici's Blob support.
      form.append("sample", new Blob([sampleBytes as unknown as ArrayBuffer], { type: input.audioSample.contentType }), "sample.m4a");

      const res = await fetch(`https://${c.host}/v1/identify`, { method: "POST", body: form });
      const json = await res.json().catch(() => null) as {
        status?: { code?: number; msg?: string };
        metadata?: { music?: Array<{ title?: string; score?: number; play_offset_ms?: number; acrid?: string }> };
      } | null;

      if (!res.ok || !json || typeof json.status?.code !== "number") {
        return {
          provider: this.name, status: "UNKNOWN", confidence: null, matchedWork: null,
          matchStartSeconds: null, matchEndSeconds: null, providerReference: null,
          processedAt: Date.now(), error: `ACRCloud malformed/error response (HTTP ${res.status})`,
        };
      }

      const music = json.status.code === 0 ? (json.metadata?.music ?? []) : [];
      if (json.status.code === 0 && music.length === 0) {
        // A clean, successful call that found nothing — the one case
        // this integration is confident enough to call NO_MATCH rather
        // than UNKNOWN, since the provider actually answered.
        return {
          provider: this.name, status: "NO_MATCH", confidence: null, matchedWork: null,
          matchStartSeconds: null, matchEndSeconds: null, providerReference: null,
          processedAt: Date.now(), error: null,
        };
      }
      if (json.status.code !== 0) {
        // Any non-zero code we have not independently verified the exact
        // meaning of (rate limit vs auth vs "no result" all live in this
        // family per ACRCloud's status-code reference) — treated as
        // UNKNOWN, never NO_MATCH, so an unverified failure mode can
        // never masquerade as "checked and clean". See this class's
        // header.
        return {
          provider: this.name, status: "UNKNOWN", confidence: null, matchedWork: null,
          matchStartSeconds: null, matchEndSeconds: null, providerReference: null,
          processedAt: Date.now(), error: `ACRCloud status ${json.status.code}: ${json.status.msg ?? "unknown"}`,
        };
      }

      const top = music[0];
      const score = typeof top.score === "number" ? top.score : 0;
      // Brief §10 — a music match is NOT automatically "infringement";
      // status naming here deliberately mirrors that (POSSIBLE_MATCH
      // below MATCH_CONFIDENCE_THRESHOLD, never an auto-reject signal on
      // its own — decisionEngine.ts routes both to at most MEDIUM/HIGH
      // risk -> PENDING_HUMAN_REVIEW, never an automatic rejection,
      // unless AUTO_REJECT_HIGH_RISK is explicitly turned on).
      return {
        provider: this.name,
        status: score >= c.matchConfidenceThreshold ? "CONFIRMED_MATCH" : "POSSIBLE_MATCH",
        confidence: score,
        matchedWork: top.title ?? null,
        matchStartSeconds: typeof top.play_offset_ms === "number" ? top.play_offset_ms / 1000 : null,
        matchEndSeconds: null,
        providerReference: top.acrid ?? null,
        processedAt: Date.now(),
        error: null,
      };
    } catch (e) {
      console.error(`AcrCloudCopyrightDetectionProvider: network error for ${input.submissionId}:`, e);
      return {
        provider: this.name, status: "UNKNOWN", confidence: null, matchedWork: null,
        matchStartSeconds: null, matchEndSeconds: null, providerReference: null,
        processedAt: Date.now(), error: "ACRCloud network error",
      };
    }
  }
}

// Single selection point, same reasoning as
// videoModerationProvider.ts's getVideoModerationProvider().
export function getCopyrightDetectionProvider(): CopyrightDetectionProvider {
  if (process.env.COPYRIGHT_PROVIDER === "acrcloud") {
    return new AcrCloudCopyrightDetectionProvider();
  }
  return new UnconfiguredCopyrightDetectionProvider();
}

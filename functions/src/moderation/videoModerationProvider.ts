// PATH: functions/src/moderation/videoModerationProvider.ts
//
// Abstraction over automated visual-content ("is this video safe")
// moderation, so the rest of the pipeline never depends on a specific
// vendor. Preferred provider per the product brief: AWS Rekognition
// Video content moderation.
//
// PHASE A STATUS — NOT ACTIVE. No AWS credentials exist in this
// environment, and Rekognition's Video moderation API
// (StartContentModeration/GetContentModeration) requires the source
// video to already be sitting in an S3 bucket Rekognition has read
// access to — this app's videos live in Cloudflare Stream, not S3, so a
// real integration needs an additional ingestion pipeline (copy/stream
// the Cloudflare Stream asset into S3) that does not exist yet, on top
// of the credentials themselves. That's a Phase C infrastructure
// decision, not something this phase should half-build. Rather than
// install the AWS SDK now and ship a code path that can never actually
// run or be tested in this environment, AwsRekognitionVideoModerationProvider
// below is a REAL, complete implementation of the interface that checks
// for the required configuration and returns NOT_CONFIGURED honestly —
// see its own header for exactly what Phase C needs to add.
//
// getVideoModerationProvider() is the one place that decides which
// concrete provider is active — swap it there when a real one is wired
// up; nothing else in the moderation pipeline needs to change.

import { VideoModerationResult } from "./types";

export interface VideoModerationInput {
  submissionId: string;
  videoRef: string; // mediaRef/mediaUrl — the Cloudflare Stream reference
}

export interface VideoModerationProvider {
  readonly name: string;
  analyzeVideo(input: VideoModerationInput): Promise<VideoModerationResult>;
}

// ── Default: no provider configured ─────────────────────────────────────
// Always returns NOT_CONFIGURED, instantly, with no network call — the
// safe default for every environment until a real provider is wired in.
// Never silently treated as "safe" by the decision engine: see
// decisionEngine.ts's header for why NOT_CONFIGURED routes to human
// review, the same as an explicit FAILED result would.
export class UnconfiguredVideoModerationProvider implements VideoModerationProvider {
  readonly name = "none";

  async analyzeVideo(_input: VideoModerationInput): Promise<VideoModerationResult> {
    return {
      provider: this.name,
      jobId: null,
      status: "NOT_CONFIGURED",
      labels: [],
      processedAt: Date.now(),
      error: null,
    };
  }
}

// ── AWS Rekognition Video — REQUIRES (not yet provisioned in this
// environment):
//   - npm dependency: @aws-sdk/client-rekognition (deliberately not
//     added in Phase A — see this file's header)
//   - env vars: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
//     AWS_REKOGNITION_ROLE_ARN (an IAM role Rekognition assumes to read
//     the source video and publish job-completion notifications)
//   - an S3 bucket the video is copied into before StartContentModeration
//     is called (Rekognition Video moderation cannot read an arbitrary
//     HTTPS URL like a Cloudflare Stream playback link directly)
//   - an SNS topic + subscription for the async job-completion callback
//     (StartContentModeration is asynchronous; GetContentModeration is
//     polled or notified via SNS, never synchronous)
//
// None of that infrastructure exists yet, so this class is a real,
// complete VideoModerationProvider implementation that fails safe: it
// checks configuration and returns NOT_CONFIGURED without ever
// attempting a call. It is NOT selected by getVideoModerationProvider()
// below yet — Phase C both provisions the infrastructure above AND flips
// that selection over.
export class AwsRekognitionVideoModerationProvider implements VideoModerationProvider {
  readonly name = "aws-rekognition";

  private isConfigured(): boolean {
    return !!(
      process.env.AWS_REGION &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_REKOGNITION_ROLE_ARN
    );
  }

  async analyzeVideo(input: VideoModerationInput): Promise<VideoModerationResult> {
    if (!this.isConfigured()) {
      console.warn(
        `AwsRekognitionVideoModerationProvider: not configured (missing AWS_REGION/` +
        `AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/AWS_REKOGNITION_ROLE_ARN) — ` +
        `submission=${input.submissionId} routed to NOT_CONFIGURED, never treated as safe.`
      );
      return {
        provider: this.name,
        jobId: null,
        status: "NOT_CONFIGURED",
        labels: [],
        processedAt: Date.now(),
        error: "AWS Rekognition credentials/role not configured",
      };
    }

    // Real integration point (Phase C): would require the S3-hosted copy
    // of the video described in this class's header, then call
    // StartContentModeration({ Video: { S3Object: {...} }, NotificationChannel: {...} }),
    // and either poll or await the SNS-notified GetContentModeration
    // result here. Not implemented — even with the env vars present,
    // the S3 ingestion pipeline this depends on does not exist, so
    // reaching this branch today would still have nothing valid to call.
    console.error(
      `AwsRekognitionVideoModerationProvider: credentials present but the required S3 ` +
      `ingestion pipeline is not implemented — submission=${input.submissionId} treated ` +
      `as a provider failure, not a pass.`
    );
    return {
      provider: this.name,
      jobId: null,
      status: "FAILED",
      labels: [],
      processedAt: Date.now(),
      error: "S3 ingestion pipeline not implemented",
    };
  }
}

// ── Sightengine Video Moderation (Phase C — REAL, verified integration) ──
// Chosen over AWS Rekognition Video (Phase A's stub, kept above for
// reference/rollback) because Rekognition Video's StartContentModeration
// hard-requires the source video to already sit in S3 — this app's
// videos live in Cloudflare Stream, and building a Stream→S3 mirroring
// pipeline just to satisfy that requirement is exactly the "deliberate
// ingestion architecture" the Phase C brief says not to default into.
// Sightengine's video moderation API accepts a `stream_url` directly
// (any HTTPS video/HLS URL, including a Cloudflare Stream playback URL)
// and reports results asynchronously via webhook — no S3, no video
// download by this codebase, no synchronous wait on the upload path.
// Verified against Sightengine's own docs (2026-09):
//   - Submit: GET/POST https://api.sightengine.com/1.0/video/check.json
//     with stream_url, models, callback_url, api_user, api_secret.
//     Immediate response: { status, media: { id: "med_..." }, callback }.
//   - Result delivery: an async POST to callback_url when the video is
//     fully read ("finished") or on an "interesting event" — see
//     sightengineWebhook.ts, which is the ONLY place that ever marks this
//     check COMPLETED. This provider's job here is only the fast,
//     synchronous "submit" call — never a wait for the real analysis.
// NOT VERIFIED (no live Sightengine account in this environment): the
// exact set of category/label field names inside a real callback
// payload beyond the documented high-level shape (status/media/data) —
// sightengineWebhook.ts's result-parsing is deliberately defensive about
// this, see its header.
import { getVideoModerationProviderEnvConfig } from "./providerConfig";

export class SightengineVideoModerationProvider implements VideoModerationProvider {
  readonly name = "sightengine";

  private isConfigured(): boolean {
    const c = getVideoModerationProviderEnvConfig();
    return !!(c.apiUser && c.apiSecret && c.callbackUrl);
  }

  async analyzeVideo(input: VideoModerationInput): Promise<VideoModerationResult> {
    const c = getVideoModerationProviderEnvConfig();
    if (!this.isConfigured()) {
      console.warn(
        `SightengineVideoModerationProvider: not configured (missing SIGHTENGINE_API_USER/` +
        `SIGHTENGINE_API_SECRET/SIGHTENGINE_CALLBACK_URL) — submission=${input.submissionId} ` +
        `routed to NOT_CONFIGURED, never treated as safe.`
      );
      return {
        provider: this.name, jobId: null, status: "NOT_CONFIGURED", labels: [],
        processedAt: Date.now(), error: "Sightengine credentials not configured",
      };
    }

    const params = new URLSearchParams({
      stream_url: input.videoRef,
      models: c.models,
      callback_url: c.callbackUrl!,
      api_user: c.apiUser!,
      api_secret: c.apiSecret!,
      // Threaded back through the callback so sightengineWebhook.ts can
      // look the submission up even before persisting media.id (belt and
      // suspenders — the primary lookup key is media.id once we have it).
      state: input.submissionId,
    });

    try {
      const res = await fetch(`https://api.sightengine.com/1.0/video/check.json?${params.toString()}`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null) as
        { status?: string; media?: { id?: string }; error?: { message?: string } } | null;

      if (!res.ok || !json || json.status === "failure" || !json.media?.id) {
        const errMsg = json?.error?.message ?? `HTTP ${res.status}`;
        console.error(`SightengineVideoModerationProvider: submission failed for ${input.submissionId}: ${errMsg}`);
        return {
          provider: this.name, jobId: null, status: "FAILED", labels: [],
          processedAt: Date.now(), error: `Sightengine submission failed: ${errMsg}`,
        };
      }

      // Job accepted — the REAL result is not known yet. This is a
      // provider "in flight" state, not a pass; decisionEngine.ts treats
      // any non-COMPLETED status as unresolved (see types.ts's header on
      // VideoModerationRunStatus.PROCESSING).
      return {
        provider: this.name, jobId: json.media.id, status: "PROCESSING", labels: [],
        processedAt: Date.now(), error: null,
      };
    } catch (e) {
      console.error(`SightengineVideoModerationProvider: network error for ${input.submissionId}:`, e);
      return {
        provider: this.name, jobId: null, status: "FAILED", labels: [],
        processedAt: Date.now(), error: "Sightengine submission network error",
      };
    }
  }
}

// Single selection point — change this when a real provider is ready to
// go live. Env-driven (VIDEO_MODERATION_PROVIDER=sightengine) since
// there are now two real candidates (Sightengine active-path, AWS kept
// as a documented fallback design) and a single hardcoded return would
// hide which one is live from anyone reading .env.example.
export function getVideoModerationProvider(): VideoModerationProvider {
  if (process.env.VIDEO_MODERATION_PROVIDER === "sightengine") {
    return new SightengineVideoModerationProvider();
  }
  if (process.env.VIDEO_MODERATION_PROVIDER === "aws-rekognition") {
    return new AwsRekognitionVideoModerationProvider();
  }
  return new UnconfiguredVideoModerationProvider();
}

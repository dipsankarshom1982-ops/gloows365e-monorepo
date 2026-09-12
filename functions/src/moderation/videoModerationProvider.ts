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

// Single selection point — change this when a real provider is ready to
// go live. Deliberately NOT environment-variable-driven (e.g.
// VIDEO_MODERATION_PROVIDER=aws) yet, since there is only ever one real
// candidate today and an env-driven switch would just be another way to
// silently end up on the wrong provider in production.
export function getVideoModerationProvider(): VideoModerationProvider {
  return new UnconfiguredVideoModerationProvider();
}

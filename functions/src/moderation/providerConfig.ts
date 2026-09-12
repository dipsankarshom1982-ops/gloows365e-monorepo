// PATH: functions/src/moderation/providerConfig.ts
//
// Phase C — single place every real provider/webhook reads its own env
// config from, so a missing variable's name is defined exactly once
// (mirrors decisionEngine.ts's envNumber/envFlag pattern for the same
// reason: no scattered process.env reads to drift out of sync). See
// functions/.env.example for the authoritative list of variable NAMES
// (no values/secrets there — see that file's own header).
//
// Every one of these is meant to be bound via `.runWith({ secrets: [...] })`
// in production (Google Cloud Secret Manager), never a plaintext env var
// for anything credential-shaped — same posture as WORKER_OWNERSHIP_SECRET
// and the Razorpay keys elsewhere in this codebase (see mediaOwnership.ts's
// .env.example section).

export interface VideoModerationProviderEnvConfig {
  apiUser: string | undefined;
  apiSecret: string | undefined;
  callbackUrl: string | undefined;
  callbackSigningSecret: string | undefined;
  models: string;
}

export function getVideoModerationProviderEnvConfig(): VideoModerationProviderEnvConfig {
  return {
    apiUser: process.env.SIGHTENGINE_API_USER,
    apiSecret: process.env.SIGHTENGINE_API_SECRET,
    callbackUrl: process.env.SIGHTENGINE_CALLBACK_URL,
    callbackSigningSecret: process.env.SIGHTENGINE_CALLBACK_SIGNING_SECRET,
    // Category set NOT independently verified against a live Sightengine
    // account in this environment — see videoModerationProvider.ts's
    // header. Configurable precisely so a verified set can replace this
    // default without a code change.
    models: process.env.SIGHTENGINE_MODELS || "nudity-2.1,violence,gore,self-harm,offensive",
  };
}

export interface CopyrightProviderEnvConfig {
  host: string | undefined;
  accessKey: string | undefined;
  accessSecret: string | undefined;
  matchConfidenceThreshold: number;
}

export function getCopyrightProviderEnvConfig(): CopyrightProviderEnvConfig {
  const raw = process.env.ACRCLOUD_MATCH_CONFIDENCE_THRESHOLD;
  const parsed = raw ? Number(raw) : NaN;
  return {
    host: process.env.ACRCLOUD_HOST,
    accessKey: process.env.ACRCLOUD_ACCESS_KEY,
    accessSecret: process.env.ACRCLOUD_ACCESS_SECRET,
    matchConfidenceThreshold: Number.isFinite(parsed) ? parsed : 80,
  };
}

export interface CloudflareStreamEnvConfig {
  accountId: string | undefined;
  apiToken: string | undefined;
  customerSubdomain: string | undefined;
  webhookSigningSecret: string | undefined;
}

export function getCloudflareStreamEnvConfig(): CloudflareStreamEnvConfig {
  return {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    customerSubdomain: process.env.CLOUDFLARE_CUSTOMER_SUBDOMAIN,
    webhookSigningSecret: process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET,
  };
}

export interface SimilarityProviderEnvConfig {
  // Average per-frame Hamming distance (0-64) at/under which two
  // fingerprints are treated as HIGH_SIMILARITY. Not independently
  // tuned against a real corpus in this environment — see
  // videoSimilarityProvider.ts's header. Configurable so product can
  // tighten/loosen it once real duplicate/non-duplicate pairs exist to
  // calibrate against.
  hammingThreshold: number;
}

export function getSimilarityProviderEnvConfig(): SimilarityProviderEnvConfig {
  const raw = process.env.SIMILARITY_HAMMING_THRESHOLD;
  const parsed = raw ? Number(raw) : NaN;
  return { hammingThreshold: Number.isFinite(parsed) ? parsed : 10 };
}

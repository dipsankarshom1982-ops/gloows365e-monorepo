// PATH: functions-cloudflare/src/moderation/videoSimilarityProvider.ts
//
// MIRRORED FILE — this code is mirrored from functions/src/moderation for
// isolated Firebase deployment (the "cloudflare-webhook" codebase, added
// so handleCloudflareStreamWebhook can be discovered/deployed without
// loading the entire ~190-function "default" codebase). Changes to the
// canonical moderation implementation at functions/src/moderation/videoSimilarityProvider.ts
// must be mirrored here until a shared package/drift-check is introduced.
// Do not diverge the two copies' behavior.
//
// Original header follows unchanged:
//
// PATH: functions/src/moderation/videoSimilarityProvider.ts
//
// Abstraction over duplicate/re-upload detection — one student uploading
// another student's Skill Battle video (exact copy, re-encode, crop/
// resize, or reused audio track).
//
// PHASE A STATUS — NOT CHECKED. A real fingerprint strategy (perceptual
// frame hashing, sampled-frame comparison, or audio fingerprinting) needs
// either a video-processing toolchain (e.g. ffmpeg — confirmed NOT
// installed in this environment) to extract frames/audio, or a paid
// third-party API. Neither exists here, so implementing a "real but
// untestable" fingerprinting algorithm in this pass would be exactly the
// kind of unverifiable code this project has consistently avoided
// elsewhere. This file defines the real interface and result shape the
// rest of the pipeline needs, with a honest NOT_CHECKED default — never
// a fabricated similarity score.
//
// A HIGH_SIMILARITY result is evidence for human review, never automatic
// proof of copyright infringement on its own (brief §7) — the decision
// engine treats it as a review/rejection signal, not a verdict.

import * as admin from "firebase-admin";
import { SimilarityCheckResult } from "./types";
import { getSimilarityProviderEnvConfig, getCloudflareStreamEnvConfig } from "./providerConfig";
import { averageHashFromJpeg, joinFrameHashes, compareFingerprints } from "./hashUtils";

export interface SimilarityCheckInput {
  submissionId: string;
  videoRef: string;
  battleId: string;
  // Phase C — the bare Cloudflare Stream video uid (not the full
  // playback URL) needed to build thumbnail URLs directly. Optional so
  // the existing Unconfigured stub's signature/tests are untouched;
  // required in practice for CloudflareThumbnailSimilarityProvider.
  streamVideoUid?: string;
}

// Current fingerprint format version — bump this if the sampling
// strategy (frame count/timestamps) or hash algorithm ever changes, so
// compareFingerprints() can refuse to compare across versions rather
// than silently producing a meaningless distance (see hashUtils.ts).
export const SIMILARITY_FINGERPRINT_VERSION = "athash-3x8x8-v1";

export interface VideoSimilarityProvider {
  readonly name: string;
  checkSimilarity(input: SimilarityCheckInput): Promise<SimilarityCheckResult>;
}

// REQUIRED (once a real fingerprint strategy is chosen — none is today):
// either a video-processing dependency capable of frame/audio extraction,
// or a third-party fingerprinting API's credentials. See
// functions/.env.example for the placeholder this will need.
export class UnconfiguredVideoSimilarityProvider implements VideoSimilarityProvider {
  readonly name = "none";

  async checkSimilarity(input: SimilarityCheckInput): Promise<SimilarityCheckResult> {
    console.warn(
      `UnconfiguredVideoSimilarityProvider: no fingerprinting strategy configured — ` +
      `submission=${input.submissionId} routed to NOT_CHECKED, never treated as verified-unique.`
    );
    return {
      provider: this.name,
      fingerprintVersion: null,
      fingerprint: null,
      status: "NOT_CHECKED",
      similarityScore: null,
      matchedSubmissionId: null,
      processedAt: Date.now(),
      error: null,
    };
  }
}

// ── Cloudflare-thumbnail perceptual-hash similarity (Phase C — REAL,
// in-house implementation) ──────────────────────────────────────────────
// No third-party API exists for "does this match something already in
// MY OWN corpus" the way ACRCloud/Sightengine answer general-purpose
// questions — this has to be built in-house against Gloows365's own
// submissions, exactly as the Phase C brief anticipates (§5: "prefer an
// asynchronous worker/function", "do not require the mobile client to
// perform fingerprinting"). Uses Cloudflare Stream's own thumbnail
// endpoint (already used elsewhere in this codebase for playback
// previews — no new Cloudflare capability being assumed) at three
// timestamps, decodes each JPEG (jpeg-js, pure JS — see hashUtils.ts),
// and computes a coarse perceptual hash per frame. Comparison is against
// OTHER submissions in the SAME battle only (V1 scope — a cross-battle/
// cross-skill corpus search is a real future improvement, not built here
// since it needs a real vector-similarity index to stay fast at scale,
// not a linear scan).
//
// A HIGH_SIMILARITY result never asserts "this is a re-upload of THAT
// exact video" as fact — it names a matchedSubmissionId for a human
// moderator to actually compare, per this file's original header above.
export class CloudflareThumbnailSimilarityProvider implements VideoSimilarityProvider {
  readonly name = "cloudflare-thumbnail-ahash";
  private readonly db = admin.firestore();
  // Fractions of a nominal window to sample — Stream's thumbnail
  // endpoint takes an absolute `time` in seconds, and this provider has
  // no independently-verified way to know a video's exact duration
  // without an extra Stream API call, so fixed early/mid/late-ish offsets
  // are used instead of duration-relative percentages. Reasonable for the
  // ~60s clips this product accepts (see Createreelscreen.tsx's
  // videoMaxDuration) — a longer-form product would need duration-aware
  // sampling instead.
  private readonly sampleTimesSeconds = [2, 15, 30];

  private thumbnailUrl(uid: string, timeSeconds: number): string {
    const { customerSubdomain } = getCloudflareStreamEnvConfig();
    return `https://customer-${customerSubdomain}.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg?time=${timeSeconds}s`;
  }

  async checkSimilarity(input: SimilarityCheckInput): Promise<SimilarityCheckResult> {
    const unresolved = (status: "ERROR" | "NOT_CHECKED", error: string | null): SimilarityCheckResult => ({
      provider: this.name, fingerprintVersion: SIMILARITY_FINGERPRINT_VERSION, fingerprint: null,
      status, similarityScore: null, matchedSubmissionId: null, processedAt: Date.now(), error,
    });

    const { customerSubdomain } = getCloudflareStreamEnvConfig();
    if (!customerSubdomain) {
      console.warn(
        `CloudflareThumbnailSimilarityProvider: CLOUDFLARE_CUSTOMER_SUBDOMAIN not configured — ` +
        `submission=${input.submissionId} routed to NOT_CHECKED, never treated as verified-unique.`
      );
      return unresolved("NOT_CHECKED", "Cloudflare Stream customer subdomain not configured");
    }
    if (!input.streamVideoUid) {
      return unresolved("NOT_CHECKED", "No Cloudflare Stream video uid available yet");
    }

    let frameHashes: string[];
    try {
      frameHashes = await Promise.all(
        this.sampleTimesSeconds.map(async (t) => {
          const res = await fetch(this.thumbnailUrl(input.streamVideoUid!, t));
          if (!res.ok) throw new Error(`thumbnail fetch failed (HTTP ${res.status}) at t=${t}s`);
          const buf = Buffer.from(await res.arrayBuffer());
          return averageHashFromJpeg(buf);
        })
      );
    } catch (e) {
      console.error(`CloudflareThumbnailSimilarityProvider: frame hashing failed for ${input.submissionId}:`, e);
      return unresolved("ERROR", "Could not fetch/decode video thumbnails");
    }

    const fingerprint = joinFrameHashes(frameHashes);
    const { hammingThreshold } = getSimilarityProviderEnvConfig();

    // Compare against OTHER submissions/posts already fingerprinted in
    // this same battle — both engines, since a duplicate could legitimately
    // be re-uploaded through either one. battleId is an existing top-level
    // field on both collections; the fingerprint itself is read from each
    // matching doc's nested similarityCheck field in memory (no dotted-
    // path Firestore query needed — see pipeline.ts's storage comment).
    let bestDistance = Infinity;
    let bestMatchId: string | null = null;
    try {
      const [submissionsSnap, postsSnap] = await Promise.all([
        this.db.collection("submissions").where("battleId", "==", input.battleId).get(),
        this.db.collection("posts").where("battleId", "==", input.battleId).where("isSkillBattle", "==", true).get(),
      ]);
      for (const doc of [...submissionsSnap.docs, ...postsSnap.docs]) {
        if (doc.id === input.submissionId) continue;
        const otherFingerprint = doc.data()?.similarityCheck?.fingerprint;
        const otherVersion = doc.data()?.similarityCheck?.fingerprintVersion;
        if (typeof otherFingerprint !== "string" || otherVersion !== SIMILARITY_FINGERPRINT_VERSION) continue;
        const distance = compareFingerprints(fingerprint, otherFingerprint);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestMatchId = doc.id;
        }
      }
    } catch (e) {
      // A corpus-lookup failure still leaves us with a real fingerprint —
      // store it (so FUTURE submissions can compare against this one) but
      // report this check as unresolved rather than falsely claiming
      // "NO_MATCH" when the comparison itself never actually ran.
      console.error(`CloudflareThumbnailSimilarityProvider: corpus lookup failed for ${input.submissionId}:`, e);
      return {
        provider: this.name, fingerprintVersion: SIMILARITY_FINGERPRINT_VERSION, fingerprint,
        status: "ERROR", similarityScore: null, matchedSubmissionId: null,
        processedAt: Date.now(), error: "Corpus comparison failed",
      };
    }

    if (bestMatchId && bestDistance <= hammingThreshold) {
      return {
        provider: this.name, fingerprintVersion: SIMILARITY_FINGERPRINT_VERSION, fingerprint,
        status: "HIGH_SIMILARITY",
        // Normalized 0-1 "closeness" for display only — 64 bits per
        // frame hash is the maximum possible per-frame distance.
        similarityScore: Math.max(0, 1 - bestDistance / 64),
        matchedSubmissionId: bestMatchId, processedAt: Date.now(), error: null,
      };
    }
    return {
      provider: this.name, fingerprintVersion: SIMILARITY_FINGERPRINT_VERSION, fingerprint,
      status: "NO_MATCH", similarityScore: null, matchedSubmissionId: null,
      processedAt: Date.now(), error: null,
    };
  }
}

// Single selection point, same reasoning as the other two providers.
export function getVideoSimilarityProvider(): VideoSimilarityProvider {
  if (process.env.VIDEO_SIMILARITY_PROVIDER === "cloudflare-thumbnail-ahash") {
    return new CloudflareThumbnailSimilarityProvider();
  }
  return new UnconfiguredVideoSimilarityProvider();
}

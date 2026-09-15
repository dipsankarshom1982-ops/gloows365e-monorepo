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

import { SimilarityCheckResult } from "./types";

export interface SimilarityCheckInput {
  submissionId: string;
  videoRef: string;
  battleId: string;
}

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
      status: "NOT_CHECKED",
      similarityScore: null,
      matchedSubmissionId: null,
      processedAt: Date.now(),
      error: null,
    };
  }
}

// Single selection point, same reasoning as the other two providers.
export function getVideoSimilarityProvider(): VideoSimilarityProvider {
  return new UnconfiguredVideoSimilarityProvider();
}

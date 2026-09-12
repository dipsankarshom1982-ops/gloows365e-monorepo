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

import { CopyrightCheckResult } from "./types";

export interface CopyrightCheckInput {
  submissionId: string;
  videoRef: string;
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

// Single selection point, same reasoning as
// videoModerationProvider.ts's getVideoModerationProvider().
export function getCopyrightDetectionProvider(): CopyrightDetectionProvider {
  return new UnconfiguredCopyrightDetectionProvider();
}

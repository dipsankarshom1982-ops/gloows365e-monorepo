// PATH: functions/src/moderation/types.ts
//
// Shared types for the Skill Battle moderation/copyright/originality
// pipeline (Phase A — foundation). See this directory's other files for
// the provider interfaces and the centralized decision engine.
//
// SCOPE NOTE: this is Phase A of a larger, explicitly-phased project
// (state machine + schema + security rules + provider interfaces +
// decision engine + tests — NO external provider credentials exist in
// this environment, so every provider below is wired through a
// NOT_CONFIGURED-safe default). Phase B (admin moderation queue UI,
// winner-verification gate, user reporting) and Phase C (real AWS
// Rekognition / copyright / similarity vendor wiring, which needs actual
// credentials and, for video moderation specifically, an S3-based
// pipeline Cloudflare Stream doesn't provide today) are deliberately not
// part of this change — see the implementation report for the full
// phasing rationale.

// ── Submission moderation lifecycle ─────────────────────────────────────
// Extends (does not replace) the existing SubmissionStatus in
// battleSubmissions.ts (canonical engine) and the `status` field on
// legacy `posts` docs (skillBattleSubmission.ts) — see this file's
// header in each of those for how the two are kept separate.
export type ModerationStatus =
  | "PENDING_UPLOAD"        // media not yet confirmed uploaded/owned
  | "PENDING_MODERATION"    // submission created, decision engine not yet run
  | "MODERATION_PROCESSING" // provider calls in flight (async, future phase)
  | "PENDING_HUMAN_REVIEW"  // decision engine routed to a human moderator
  | "APPROVED"
  | "REJECTED"
  | "REMOVED"               // post-publication takedown
  | "APPEALED";             // student requested re-review after REJECTED

// ── Automated safety/content moderation (e.g. AWS Rekognition) ─────────
export type VideoModerationRunStatus = "COMPLETED" | "FAILED" | "NOT_CONFIGURED";

export interface VideoModerationLabel {
  name: string;
  confidence: number; // 0-100, provider-reported
}

export interface VideoModerationResult {
  provider: string;               // e.g. "aws-rekognition", "none"
  jobId: string | null;
  status: VideoModerationRunStatus;
  labels: VideoModerationLabel[]; // empty when NOT_CONFIGURED/FAILED
  processedAt: number | null;     // ms epoch
  error: string | null;           // safe, non-sensitive summary only
}

// ── Copyright detection — deliberately NOT conflated with "infringement
// legally established" (see decisionEngine.ts's header and copyright
// ProviderDetection.ts's header for why). ─────────────────────────────
export type CopyrightStatus =
  | "NOT_CONFIGURED"              // no provider credentials in this environment
  | "NO_MATCH"
  | "UNKNOWN"
  | "POSSIBLE_MATCH"
  | "CONFIRMED_MATCH"
  | "LICENSE_INFORMATION_REQUIRED";

export interface CopyrightCheckResult {
  provider: string;
  status: CopyrightStatus;
  confidence: number | null;      // 0-100 when a match was scored, else null
  matchedWork: string | null;     // provider-reported title/track if available
  matchStartSeconds: number | null;
  matchEndSeconds: number | null;
  providerReference: string | null; // opaque job/match id, not raw payload
  processedAt: number | null;
  error: string | null;
}

// ── Duplicate / re-upload similarity detection ──────────────────────────
export type SimilarityStatus =
  | "NOT_CHECKED"                 // no provider configured
  | "NO_MATCH"
  | "LOW_SIMILARITY"
  | "HIGH_SIMILARITY"
  | "ERROR";

export interface SimilarityCheckResult {
  provider: string;
  fingerprintVersion: string | null;
  status: SimilarityStatus;
  similarityScore: number | null; // 0-1
  matchedSubmissionId: string | null;
  processedAt: number | null;
  error: string | null;
}

// ── Decision engine output ───────────────────────────────────────────────
export type ModerationRiskLevel = "LOW_RISK" | "MEDIUM_RISK" | "HIGH_RISK";

export interface ModerationDecision {
  riskLevel: ModerationRiskLevel;
  nextStatus: ModerationStatus;
  reasons: string[]; // short, human-readable, safe to show a moderator
}

// ── Winner / prize verification (Phase A schema only — the actual
// verification GATE and admin UI ship in Phase B; these fields exist now
// so nothing forges them in the meantime). ──────────────────────────────
export type WinnerStatus =
  | "NOT_APPLICABLE"
  | "WINNER_PENDING_REVIEW"
  | "WINNER_VERIFIED"
  | "WINNER_REJECTED";

export type PrizeStatus =
  | "NOT_APPLICABLE"
  | "PRIZE_PENDING"
  | "PRIZE_APPROVED"
  | "PRIZE_REJECTED"
  | "PRIZE_PAID";

// ── Originality declaration ──────────────────────────────────────────────
// CURRENT_DECLARATION_VERSION is the server's own source of truth for
// what a valid acceptance looks like — never trust a client-supplied
// version string as proof of anything beyond "which wording they saw."
export const CURRENT_DECLARATION_VERSION = "v1";

export const ORIGINALITY_DECLARATION_TEXT =
  "I confirm that this video is my original work, or that I have the " +
  "necessary rights or permissions to use the content, music, images, " +
  "and other material included in it. I understand that unauthorized " +
  "copyrighted content may result in removal, disqualification, or loss " +
  "of prize eligibility.";

export interface OriginalityDeclaration {
  declarationAccepted: boolean;
  declarationVersion: string | null;
  declarationAcceptedAt: number | null; // ms epoch, server-stamped
}

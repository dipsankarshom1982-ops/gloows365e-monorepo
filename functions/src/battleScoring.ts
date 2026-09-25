// PATH: functions/src/battleScoring.ts
//
// Phase 2C — Battle Engine: scoring specification + pure calculation.
//
// SCORING SPECIFICATION (documented here per the Phase 2C brief's §2/§3 —
// implemented as code comments + types rather than a separate doc, so it
// can't drift from what actually runs):
//
// A. INPUTS — verifiedLikes, verifiedViews (both defined in
//    battleEngagement.ts as "count of distinct authenticated students who
//    engaged with this submission, each counted at most once ever" — see
//    that file's header for why), plus a fixed participation bonus for
//    any APPROVED submission.
//
// B. EXCLUSIONS — raw client-reported counters (there are none left to
//    exclude — this engine has no client-writable counter field at all,
//    unlike the legacy posts-based flow's bounded-delta counters from
//    Phase 1). Comments/shares/watchTime are explicitly NOT scoring
//    inputs in this V1 — narrowing scope deliberately (see this file's
//    module comment in the PR/commit) rather than building shallow
//    coverage of five engagement types.
//
// C. WEIGHTING — configurable per battle via skillBattles.scoringProfile
//    (falls back to DEFAULT_SCORING_PROFILE if a battle has none), never
//    hard-coded differently in more than one place — this IS the one
//    place. No frontend/admin copy of this table exists to drift out of
//    sync (the SB-P0-05 class of bug from Phase 1).
//
// D. CAPS — none needed beyond the structural guard: verifiedLikes/
//    verifiedViews are literally COUNTS OF ENGAGEMENT DOCUMENTS, one per
//    (submissionId, studentId, type) by construction (battleEngagement.ts's
//    deterministic doc ID) — the same account engaging with the same
//    submission twice is structurally impossible, not just rate-limited.
//    There is nothing left to cap on top of that.
//
// E. DIMINISHING RETURNS — not applicable for the same reason as D: each
//    unique engager contributes exactly one unit, ever, per type. There
//    is no "repeated engagement from the same source" to diminish.
//
// F. TIE-BREAKING — see compareEntries() below; the exact chain
//    recommended in the Phase 2C brief §3.F.
//
// G. FINALIZATION — battleFinalization.ts snapshots each entry's inputs
//    (verifiedLikes, verifiedViews, score, tie-break values) into the
//    immutable battleResults/{battleId} doc at RESULT_LOCKED time; this
//    file's calculateSubmissionScore is called once more there, against
//    the frozen snapshot, not against live data — see that file.
//
// H. REPRODUCIBILITY — calculateSubmissionScore is a pure function of its
//    inputs; given the same inputs (which the finalized snapshot
//    preserves forever), it always returns the same score. No hidden
//    state, no wall-clock dependency, no randomness.
//
// I. AUDITABILITY — battleResults' per-entry inputsSnapshot is exactly
//    what an admin needs to answer "why did A outrank B": compare their
//    verifiedLikes/verifiedViews/score/tie-break fields directly.

export interface ScoringProfile {
  likeWeight: number;
  viewWeight: number;
  participationBonus: number;
}

export const DEFAULT_SCORING_PROFILE: ScoringProfile = {
  likeWeight: 5,
  viewWeight: 1,
  participationBonus: 10,
};

export interface SubmissionScoreInputs {
  verifiedLikes: number;
  verifiedViews: number;
  isApproved: boolean;
}

// isApproved gates score to 0 — a submission that is pending/rejected/
// removed/withdrawn contributes nothing to ranking, regardless of any
// engagement it accumulated before its status changed (engagement can
// only be recorded against a LIVE submission in the first place — see
// battleEngagement.ts — so this is defense-in-depth, not the only guard).
export function calculateSubmissionScore(
  inputs: SubmissionScoreInputs,
  profile: ScoringProfile = DEFAULT_SCORING_PROFILE
): number {
  if (!inputs.isApproved) return 0;
  return (
    inputs.verifiedLikes * profile.likeWeight +
    inputs.verifiedViews * profile.viewWeight +
    profile.participationBonus
  );
}

export interface RankableEntry {
  studentId: string;
  score: number;
  rawEngagement: number; // verifiedLikes + verifiedViews — secondary tie-break signal, distinct from the weighted score
  approvedAt: number; // millis — earlier wins ties
}

// Deterministic tie-break chain (Phase 2C brief §3.F, adopted as-is —
// nothing in this product's existing requirements justified a different
// order): higher score → higher raw verified engagement → earlier
// qualifying submission → lexically-stable studentId. Returns a negative
// number if `a` should rank ABOVE `b` (i.e. suitable for Array.sort's
// ascending convention where index 0 = rank 1).
export function compareEntries(a: RankableEntry, b: RankableEntry): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.rawEngagement !== b.rawEngagement) return b.rawEngagement - a.rawEngagement;
  if (a.approvedAt !== b.approvedAt) return a.approvedAt - b.approvedAt;
  return a.studentId < b.studentId ? -1 : a.studentId > b.studentId ? 1 : 0;
}

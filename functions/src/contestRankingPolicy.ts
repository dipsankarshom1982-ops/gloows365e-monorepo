// PATH: functions/src/contestRankingPolicy.ts
//
// VidyaStar Phase 2 — the single source of truth for how contest
// participants are ordered. Used by the finalization process
// (contestLeaderboard.ts) to compute permanent ranks. The live/dynamic
// leaderboard query (client-side, both platforms) mirrors the first two
// levels of this policy at the Firestore query level and applies the third
// as an in-memory refinement — see contestLeaderboard.ts's header comment
// for exactly why (historical docs missing `correctAnswers`).
//
// OFFICIAL RANKING POLICY (documented, not invented ad hoc):
//   1. PRIMARY:   score DESC             — the existing, dominant signal
//   2. SECONDARY: correctAnswers DESC    — NEW: separates "more correct,
//      slower" from "fewer correct, big time bonus" landing on the same
//      total score
//   3. THIRD:     quizCompletedAt ASC    — existing rule: earlier
//      submission wins a remaining tie
//   4. FINAL:     document ID (uid) ASC  — NEW: guarantees a strict total
//      order (two participants can never compare equal), so ranks are
//      always unique/dense (#1,#2,#3 — never #1,#1,#3)
//
// This ordering is deliberately a superset-compatible extension of the
// pre-Phase-2 behavior (score DESC, then earlier-completion-wins) — see
// the Phase 2 report's "Official Ranking Policy" section for the full
// reasoning on why correctAnswers was added as a secondary factor rather
// than left out or given a different priority.

export interface RankableParticipant {
  id:              string;   // uid / doc id — final, deterministic tie-break
  score:           number;
  correctAnswers?: number;   // absent on pre-Phase-1 historical docs
  quizCompletedAt: number;   // epoch millis; 0 for docs that somehow lack it (sorts last among true ties)
}

/** The one true comparator — ascending-friendly (Array.prototype.sort). */
export function compareParticipants(a: RankableParticipant, b: RankableParticipant): number {
  if (b.score !== a.score) return b.score - a.score;
  const aCorrect = a.correctAnswers ?? 0;
  const bCorrect = b.correctAnswers ?? 0;
  if (bCorrect !== aCorrect) return bCorrect - aCorrect;
  if (a.quizCompletedAt !== b.quizCompletedAt) return a.quizCompletedAt - b.quizCompletedAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Sorts (does not mutate) and returns [{...item, finalRank}]. */
export function assignRanks<T extends RankableParticipant>(items: T[]): (T & { finalRank: number })[] {
  return [...items].sort(compareParticipants).map((item, i) => ({ ...item, finalRank: i + 1 }));
}

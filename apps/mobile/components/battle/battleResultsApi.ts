// PATH: components/battle/battleResultsApi.ts
//
// Phase 2D-6 — Results + Winners + Rewards: thin, typed wrappers around
// Phase 2C's ACTUAL award/achievement data (verified against
// functions/src/battleRewards.ts and functions/src/battleSkillboardIntegration.ts
// before writing this file — nothing here is a guessed schema).
//
// Rank/score/isWinner for "my result" are NOT re-fetched here — this
// module reuses fetchMyBattleRank from battleCompetitionApi.ts (Phase
// 2D-5), which already reads the same authoritative battleResults doc.
// This file only adds what Phase 2D-5 didn't need: award status and
// achievement flags.
//
// AWARD FLOW — verified, not assumed: claimBattleReward (battleRewards.ts)
// is the ONLY path that ever credits VCoins or writes a battleAwards doc
// for the canonical engine — there is no automatic/scheduled crediting.
// It reserves-then-credits inside one transaction keyed on the
// deterministic doc battleAwards/{battleId}_{uid} (checked as the FIRST
// read), so calling it twice — a retry, a duplicate tap, a re-mount — is
// safe by construction: the second call sees the doc already exists and
// returns the same result without crediting twice. It is also always safe
// to call for a non-winner or a non-participant: it returns
// {totalCredited: 0} rather than erroring. This file therefore treats
// "auto-claim on Results screen load" as reading real, idempotent
// backend state, not inventing a client-side award decision.

import { db, functions } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

// ─── claimBattleReward ───────────────────────────────────────────────────
export interface ClaimRewardResult {
  totalCredited: number;
  alreadyClaimed: boolean;
}

export async function claimReward(battleId: string): Promise<ClaimRewardResult> {
  const res = await httpsCallable<{ battleId: string }, ClaimRewardResult>(
    functions,
    "claimBattleReward"
  )({ battleId });
  return res.data;
}

// ─── battleAwards/{battleId}_{uid} — direct, own-doc-only read ──────────
// firestore.rules: allow read only when request.auth.uid == resource.data.uid
// (or admin) — a student can only ever read their OWN award doc this way,
// verified by reading the actual rule before relying on it.
export interface MyAward {
  status: "reserved" | "credited" | string;
  coins: number;
  totalCredited?: number;
  rank: number;
  isWinner: boolean;
}

export async function fetchMyAward(battleId: string, uid: string): Promise<MyAward | null> {
  const snap = await getDoc(doc(db, "battleAwards", `${battleId}_${uid}`));
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  return {
    status: typeof d.status === "string" ? d.status : "reserved",
    coins: typeof d.coins === "number" ? d.coins : 0,
    totalCredited: typeof d.totalCredited === "number" ? d.totalCredited : undefined,
    rank: typeof d.rank === "number" ? d.rank : 0,
    isWinner: d.isWinner === true,
  };
}

// ─── achievementEvents/{battleId}_{studentId}_{ruleId} ──────────────────
// Deterministic IDs (functions/src/battleSkillboardIntegration.ts's
// achievementRulesForEntry/buildSkillBoardWrites) — a bounded set of 4
// direct doc reads, not a query, same "read an authoritative fact by its
// own deterministic ID" posture as Phase 2D-5's like-state check. Only
// ever reads this student's own battle-scoped achievement docs.
const ACHIEVEMENT_RULE_IDS = ["participated", "top10", "top3", "winner"] as const;
export type AchievementRuleId = (typeof ACHIEVEMENT_RULE_IDS)[number];

export async function fetchMyAchievements(battleId: string, uid: string): Promise<AchievementRuleId[]> {
  const results = await Promise.all(
    ACHIEVEMENT_RULE_IDS.map(async (ruleId) => {
      const snap = await getDoc(doc(db, "achievementEvents", `${battleId}_${uid}_${ruleId}`));
      return snap.exists() ? ruleId : null;
    })
  );
  return results.filter((r): r is AchievementRuleId => r !== null);
}

export const ACHIEVEMENT_LABELS: Record<AchievementRuleId, string> = {
  participated: "✅ Participated",
  top10: "🏅 Top 10",
  top3: "🥉 Top 3",
  winner: "🏆 Winner",
};

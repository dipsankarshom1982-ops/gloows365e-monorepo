// PATH: functions/src/battleSkillboardIntegration.ts
//
// Phase 2C — Battle Engine: SkillBoard backend integration (§26-28 of the
// brief). Backend/domain only — no SkillBoard UI exists to consume this
// yet, same "engine before UI" posture as the rest of this phase.
//
// HARD RULE (§26): only a LOCKED battleResults entry ever reaches here —
// this module is called exclusively from battleFinalization.ts, after
// RESULT_LOCKED, never from live/provisional battleScoreEntries. A
// provisional rank can never leak into permanent SkillBoard reputation.
//
// Points are RANK-BASED, not a copy of the raw battle score (Phase 2A
// blueprint's explicit recommendation, §11/§12 of that document) — a
// battle with unusually high engagement shouldn't be worth more
// reputation than an equally-competitive battle with less, and a raw-
// score sum would let one popular battle dominate a student's SkillBoard
// forever. This table is deliberately simple (§27: "do not finalize an
// elaborate long-term reputation formula unless required") — refinable
// later without touching the immutable battleResults it reads from.

import * as admin from "firebase-admin";

const db = admin.firestore();

export interface FinalizedEntry {
  studentId: string;
  submissionId: string;
  score: number;
  rank: number;
  isWinner: boolean;
}

export function pointsForRank(rank: number): number {
  if (rank === 1) return 100;
  if (rank === 2) return 60;
  if (rank === 3) return 40;
  if (rank <= 10) return 20;
  return 5; // participation floor — every ranked (i.e. approved) entrant earns something
}

// Minimum achievement set from the Phase 2C brief §28 — "category
// champion" needs cross-battle aggregation this phase doesn't build
// (flagged as a follow-up in the final report, not implemented here).
export function achievementRulesForEntry(entry: FinalizedEntry): string[] {
  const rules = ["participated"];
  if (entry.rank <= 10) rules.push("top10");
  if (entry.rank <= 3) rules.push("top3");
  if (entry.isWinner) rules.push("winner");
  return rules;
}

// One write set per entry: a skillPoints increment (idempotency: the
// caller must ensure this whole write set only ever executes once per
// (battleId, studentId) — battleFinalization.ts guarantees that by
// construction, see its header) + one achievementEvents doc per earned
// rule, deterministic ID so a redundant re-application (if it were ever
// attempted) would harmlessly overwrite identical content rather than
// double-count.
export function buildSkillBoardWrites(
  battleId: string,
  skillId: string,
  entry: FinalizedEntry
): Array<{ ref: admin.firestore.DocumentReference; data: Record<string, unknown>; merge: boolean; increment?: boolean }> {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const writes: Array<{ ref: admin.firestore.DocumentReference; data: Record<string, unknown>; merge: boolean; increment?: boolean }> = [];

  const points = pointsForRank(entry.rank);
  writes.push({
    ref: db.doc(`skillPoints/${entry.studentId}_${skillId}`),
    data: {
      studentId: entry.studentId,
      skillId,
      totalPoints: admin.firestore.FieldValue.increment(points),
      battlesParticipated: admin.firestore.FieldValue.increment(1),
      lastUpdatedAt: now,
    },
    merge: true,
  });

  for (const ruleId of achievementRulesForEntry(entry)) {
    writes.push({
      ref: db.doc(`achievementEvents/${battleId}_${entry.studentId}_${ruleId}`),
      data: {
        studentId: entry.studentId,
        battleId,
        skillId,
        ruleId,
        rank: entry.rank,
        earnedAt: now,
      },
      merge: false,
    });
  }

  return writes;
}

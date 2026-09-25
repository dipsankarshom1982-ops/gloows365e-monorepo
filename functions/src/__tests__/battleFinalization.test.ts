// PATH: functions/src/__tests__/battleFinalization.test.ts

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "./helpers/mockFirebaseAdmin";

const BATTLE_ID = "battle_1";
const SKILL_ID = "singing";
const ADMIN_CTX = { auth: { uid: "admin_1", token: { admin: true } } };
const STUDENT_CTX = { auth: { uid: "s1", token: {} } };

function seedFinalizingBattle(overrides: Record<string, unknown> = {}) {
  fakeDb.seed(`skillBattles/${BATTLE_ID}`, { state: "RANKING_FINALIZATION", skillId: SKILL_ID, winnerCount: 2, ...overrides });
}
function seedEntry(studentId: string, score: number, rawEngagement = 0, approvedAtMillis = 1000) {
  fakeDb.seed(`battleScoreEntries/${BATTLE_ID}_${studentId}`, {
    battleId: BATTLE_ID, studentId, submissionId: `${BATTLE_ID}_${studentId}`,
    score, rawEngagement, approvedAtMillis, verifiedLikes: 0, verifiedViews: 0,
  });
}

beforeEach(() => { fakeDb.reset(); });

describe("finalizeBattleResults — authorization", () => {
  test("Attack: a non-admin cannot finalize a battle", async () => {
    seedFinalizingBattle();
    const { finalizeBattleResults } = require("../battleFinalization");
    await expect(finalizeBattleResults.run({ battleId: BATTLE_ID }, STUDENT_CTX))
      .rejects.toMatchObject({ code: "permission-denied" });
    expect(fakeDb.peek(`battleResults/${BATTLE_ID}`)).toBeUndefined();
  });

  test("rejects an unauthenticated request", async () => {
    const { finalizeBattleResults } = require("../battleFinalization");
    await expect(finalizeBattleResults.run({ battleId: BATTLE_ID }, {}))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });
});

describe("finalizeBattleResults — deterministic ranking + winner resolution", () => {
  test("ranks entries by score descending and marks the top winnerCount as winners", async () => {
    seedFinalizingBattle({ winnerCount: 2 });
    seedEntry("bronze", 30);
    seedEntry("gold", 90);
    seedEntry("silver", 60);

    const { finalizeBattleResults } = require("../battleFinalization");
    const result = await finalizeBattleResults.run({ battleId: BATTLE_ID }, ADMIN_CTX);

    const byId = Object.fromEntries(result.entries.map((e: any) => [e.studentId, e]));
    expect(byId.gold.rank).toBe(1);   expect(byId.gold.isWinner).toBe(true);
    expect(byId.silver.rank).toBe(2); expect(byId.silver.isWinner).toBe(true);
    expect(byId.bronze.rank).toBe(3); expect(byId.bronze.isWinner).toBe(false);
  });

  test("tied scores are broken deterministically via the full tie-break chain, no shared ranks", async () => {
    seedFinalizingBattle({ winnerCount: 1 });
    seedEntry("moreEngaged", 50, 20, 1000);
    seedEntry("lessEngaged", 50, 5, 1000);

    const { finalizeBattleResults } = require("../battleFinalization");
    const result = await finalizeBattleResults.run({ battleId: BATTLE_ID }, ADMIN_CTX);

    const byId = Object.fromEntries(result.entries.map((e: any) => [e.studentId, e]));
    expect(byId.moreEngaged.rank).toBe(1);
    expect(byId.lessEngaged.rank).toBe(2);
    expect(new Set(result.entries.map((e: any) => e.rank)).size).toBe(result.entries.length); // no duplicate ranks
  });

  test("Attack 9/10/11: finalization ignores any client-supplied score/rank/winner data — there's no field to pass them in", async () => {
    seedFinalizingBattle({ winnerCount: 1 });
    seedEntry("s1", 10);
    const { finalizeBattleResults } = require("../battleFinalization");
    // finalizeBattleResults.run's data param only reads battleId — extra
    // fields are simply never looked at.
    const result = await finalizeBattleResults.run(
      { battleId: BATTLE_ID, score: 99999, rank: 1, winner: true } as any, ADMIN_CTX
    );
    expect(result.entries[0].score).toBe(10); // the server-computed score, not 99999
  });
});

describe("finalizeBattleResults — RESULT_LOCKED enforcement (§22, mandatory)", () => {
  test("rejects finalizing a battle not in RANKING_FINALIZATION", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, { state: "OPEN", skillId: SKILL_ID });
    const { finalizeBattleResults } = require("../battleFinalization");
    await expect(finalizeBattleResults.run({ battleId: BATTLE_ID }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("locks the battle's state to RESULT_LOCKED as part of finalization", async () => {
    seedFinalizingBattle();
    seedEntry("s1", 10);
    const { finalizeBattleResults } = require("../battleFinalization");
    await finalizeBattleResults.run({ battleId: BATTLE_ID }, ADMIN_CTX);
    expect(fakeDb.peek(`skillBattles/${BATTLE_ID}`)?.state).toBe("RESULT_LOCKED");
  });

  test("Attack 12: calling finalize again after lock does NOT recompute or change the result", async () => {
    seedFinalizingBattle();
    seedEntry("s1", 10);
    const { finalizeBattleResults } = require("../battleFinalization");
    const first = await finalizeBattleResults.run({ battleId: BATTLE_ID }, ADMIN_CTX);

    // Attacker adds a new, higher-scoring entry after the lock, then
    // retries finalize hoping it recomputes in their favor.
    seedEntry("attacker", 99999);
    const second = await finalizeBattleResults.run({ battleId: BATTLE_ID }, ADMIN_CTX);

    expect(second.alreadyFinalized).toBe(true);
    expect(second.entries).toEqual(first.entries); // byte-for-byte identical, attacker's entry never considered
  });

  test("idempotent finalization: calling it twice never produces two different results (§20)", async () => {
    seedFinalizingBattle();
    seedEntry("s1", 10);
    seedEntry("s2", 20);
    const { finalizeBattleResults } = require("../battleFinalization");
    const first = await finalizeBattleResults.run({ battleId: BATTLE_ID }, ADMIN_CTX);
    const second = await finalizeBattleResults.run({ battleId: BATTLE_ID }, ADMIN_CTX);
    expect(second.entries).toEqual(first.entries);
  });
});

describe("finalizeBattleResults — SkillBoard integration only from finalized results (§26)", () => {
  test("finalizing writes skillPoints and achievementEvents, derived only from the locked result", async () => {
    seedFinalizingBattle({ winnerCount: 1 });
    seedEntry("winner", 100);
    seedEntry("participant", 10);

    const { finalizeBattleResults } = require("../battleFinalization");
    await finalizeBattleResults.run({ battleId: BATTLE_ID }, ADMIN_CTX);

    const winnerPoints = fakeDb.peek(`skillPoints/winner_${SKILL_ID}`);
    expect(winnerPoints?.totalPoints).toBe(100); // pointsForRank(1)
    expect(fakeDb.peek(`achievementEvents/${BATTLE_ID}_winner_winner`)).toBeTruthy();
    expect(fakeDb.peek(`achievementEvents/${BATTLE_ID}_winner_top3`)).toBeTruthy();
    expect(fakeDb.peek(`achievementEvents/${BATTLE_ID}_winner_participated`)).toBeTruthy();

    // pointsForRank is graduated by RANK, independent of winnerCount/
    // isWinner — rank 2 earns 60 points here even though winnerCount:1
    // means this entrant isn't a "winner". Only ranks past 10 fall to
    // the flat participation floor (5) — see battleSkillboardIntegration.ts.
    const participantPoints = fakeDb.peek(`skillPoints/participant_${SKILL_ID}`);
    expect(participantPoints?.totalPoints).toBe(60); // pointsForRank(2)
    expect(fakeDb.peek(`achievementEvents/${BATTLE_ID}_participant_winner`)).toBeUndefined();
  });

  test("a second (idempotent-return) finalize call does not double-award skill points", async () => {
    seedFinalizingBattle();
    seedEntry("s1", 100);
    const { finalizeBattleResults } = require("../battleFinalization");
    await finalizeBattleResults.run({ battleId: BATTLE_ID }, ADMIN_CTX);
    await finalizeBattleResults.run({ battleId: BATTLE_ID }, ADMIN_CTX);
    // Points are a merge-increment write applied once per real finalize;
    // the second call returns early (alreadyFinalized) before reaching
    // the SkillBoard step at all, so this must still read exactly one
    // award's worth of points.
    expect(fakeDb.peek(`skillPoints/s1_${SKILL_ID}`)?.totalPoints).toBe(100);
  });
});

describe("finalizeBattleResults — battle isolation (Attack 15)", () => {
  test("finalizing one battle never touches another battle's entries or results", async () => {
    const OTHER = "battle_2";
    seedFinalizingBattle();
    seedEntry("s1", 10);
    fakeDb.seed(`skillBattles/${OTHER}`, { state: "RANKING_FINALIZATION", skillId: SKILL_ID, winnerCount: 1 });
    fakeDb.seed(`battleScoreEntries/${OTHER}_s2`, { battleId: OTHER, studentId: "s2", submissionId: "x", score: 500, rawEngagement: 0, approvedAtMillis: 1 });

    const { finalizeBattleResults } = require("../battleFinalization");
    await finalizeBattleResults.run({ battleId: BATTLE_ID }, ADMIN_CTX);

    expect(fakeDb.peek(`battleResults/${OTHER}`)).toBeUndefined();
    expect(fakeDb.peek(`skillBattles/${OTHER}`)?.state).toBe("RANKING_FINALIZATION"); // untouched
  });
});

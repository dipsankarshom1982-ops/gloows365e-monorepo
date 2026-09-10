// PATH: functions/src/__tests__/battleRanking.test.ts

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "./helpers/mockFirebaseAdmin";

const BATTLE_ID = "battle_1";
const OTHER_BATTLE_ID = "battle_2";

function seedBattle(id: string, overrides: Record<string, unknown> = {}) {
  fakeDb.seed(`skillBattles/${id}`, { state: "OPEN", ...overrides });
}
function seedSubmission(battleId: string, studentId: string, status: string, approvedAt?: number) {
  const id = `${battleId}_${studentId}`;
  fakeDb.seed(`submissions/${id}`, {
    studentId, battleId, status,
    approvedAt: approvedAt !== undefined ? { toMillis: () => approvedAt } : null,
  });
  return id;
}
function seedEngagement(submissionId: string, type: "like" | "view", engagerUid: string) {
  fakeDb.seed(`submissions/${submissionId}/engagements/${type}_${engagerUid}`, { studentId: engagerUid, type });
}

beforeEach(() => { fakeDb.reset(); });

describe("recomputeSubmissionScore — moderation gating (§31 Moderation)", () => {
  test("a PENDING_MODERATION submission gets no score entry", async () => {
    const id = seedSubmission(BATTLE_ID, "s1", "PENDING_MODERATION");
    seedBattle(BATTLE_ID);
    const { recomputeSubmissionScore } = require("../battleRanking");
    await recomputeSubmissionScore(id);
    expect(fakeDb.peek(`battleScoreEntries/${BATTLE_ID}_s1`)).toBeUndefined();
  });

  test("a REJECTED submission gets no score entry", async () => {
    const id = seedSubmission(BATTLE_ID, "s1", "REJECTED");
    seedBattle(BATTLE_ID);
    const { recomputeSubmissionScore } = require("../battleRanking");
    await recomputeSubmissionScore(id);
    expect(fakeDb.peek(`battleScoreEntries/${BATTLE_ID}_s1`)).toBeUndefined();
  });

  test("an APPROVED submission DOES get a score entry", async () => {
    const id = seedSubmission(BATTLE_ID, "s1", "APPROVED", Date.now());
    seedBattle(BATTLE_ID);
    const { recomputeSubmissionScore } = require("../battleRanking");
    await recomputeSubmissionScore(id);
    expect(fakeDb.peek(`battleScoreEntries/${BATTLE_ID}_s1`)).toBeTruthy();
  });

  test("a REMOVED submission (was approved, then taken down) loses its score entry", async () => {
    const id = seedSubmission(BATTLE_ID, "s1", "APPROVED", Date.now());
    seedBattle(BATTLE_ID);
    const { recomputeSubmissionScore } = require("../battleRanking");
    await recomputeSubmissionScore(id); // creates the entry while approved
    expect(fakeDb.peek(`battleScoreEntries/${BATTLE_ID}_s1`)).toBeTruthy();

    fakeDb.seed(`submissions/${id}`, { studentId: "s1", battleId: BATTLE_ID, status: "REMOVED" });
    await recomputeSubmissionScore(id); // recompute after removal
    expect(fakeDb.peek(`battleScoreEntries/${BATTLE_ID}_s1`)).toBeUndefined();
  });

  test("Attack 12 / result-lock enforcement: recompute is a no-op once the battle is RESULT_LOCKED", async () => {
    const id = seedSubmission(BATTLE_ID, "s1", "APPROVED", Date.now());
    seedBattle(BATTLE_ID, { state: "RESULT_LOCKED" });
    const { recomputeSubmissionScore } = require("../battleRanking");
    await recomputeSubmissionScore(id);
    // No entry should have been created/updated — the battle is frozen.
    expect(fakeDb.peek(`battleScoreEntries/${BATTLE_ID}_s1`)).toBeUndefined();
  });
});

describe("recomputeSubmissionScore — score reflects only verified engagement", () => {
  test("likes and views are counted from engagement docs, not any client field", async () => {
    const id = seedSubmission(BATTLE_ID, "s1", "APPROVED", 1000);
    seedBattle(BATTLE_ID);
    seedEngagement(id, "like", "eng1");
    seedEngagement(id, "like", "eng2");
    seedEngagement(id, "view", "eng3");

    const { recomputeSubmissionScore } = require("../battleRanking");
    await recomputeSubmissionScore(id);

    const entry = fakeDb.peek(`battleScoreEntries/${BATTLE_ID}_s1`);
    expect(entry?.verifiedLikes).toBe(2);
    expect(entry?.verifiedViews).toBe(1);
    expect(entry?.score).toBe(2 * 5 + 1 * 1 + 10); // DEFAULT_SCORING_PROFILE
  });

  test("a battle-specific scoringProfile overrides the default weights", async () => {
    const id = seedSubmission(BATTLE_ID, "s1", "APPROVED", 1000);
    seedBattle(BATTLE_ID, { scoringProfile: { likeWeight: 1000, viewWeight: 0, participationBonus: 0 } });
    seedEngagement(id, "like", "eng1");

    const { recomputeSubmissionScore } = require("../battleRanking");
    await recomputeSubmissionScore(id);
    expect(fakeDb.peek(`battleScoreEntries/${BATTLE_ID}_s1`)?.score).toBe(1000);
  });
});

describe("getMyBattleRank — battle isolation, O(1) lookup", () => {
  test("battle isolation: identical students/scores in two DIFFERENT battles rank independently", async () => {
    seedBattle(BATTLE_ID); seedBattle(OTHER_BATTLE_ID);
    fakeDb.seed(`battleScoreEntries/${BATTLE_ID}_s1`, { battleId: BATTLE_ID, studentId: "s1", score: 100 });
    fakeDb.seed(`battleScoreEntries/${BATTLE_ID}_s2`, { battleId: BATTLE_ID, studentId: "s2", score: 200 });
    // s1 is #1 in the OTHER battle despite being #2 in BATTLE_ID.
    fakeDb.seed(`battleScoreEntries/${OTHER_BATTLE_ID}_s1`, { battleId: OTHER_BATTLE_ID, studentId: "s1", score: 999 });

    const { getMyBattleRank } = require("../battleRanking");
    const inBattle1 = await getMyBattleRank.run({ battleId: BATTLE_ID }, { auth: { uid: "s1" } });
    const inBattle2 = await getMyBattleRank.run({ battleId: OTHER_BATTLE_ID }, { auth: { uid: "s1" } });

    expect(inBattle1.rank).toBe(2);
    expect(inBattle2.rank).toBe(1);
  });

  test("a student with no entry in this battle gets rank 0, not an error", async () => {
    seedBattle(BATTLE_ID);
    const { getMyBattleRank } = require("../battleRanking");
    const result = await getMyBattleRank.run({ battleId: BATTLE_ID }, { auth: { uid: "nobody" } });
    expect(result.rank).toBe(0);
    expect(result.score).toBe(0);
  });

  test("after RESULT_LOCKED, getMyBattleRank reads the definitive tie-broken rank from battleResults, not live entries", async () => {
    fakeDb.seed(`battleResults/${BATTLE_ID}`, {
      battleId: BATTLE_ID, status: "locked",
      entries: [{ studentId: "s1", submissionId: "x", score: 100, rank: 1, isWinner: true }],
    });
    const { getMyBattleRank } = require("../battleRanking");
    const result = await getMyBattleRank.run({ battleId: BATTLE_ID }, { auth: { uid: "s1" } });
    expect(result.final).toBe(true);
    expect(result.rank).toBe(1);
    expect(result.isWinner).toBe(true);
  });
});

describe("getBattleLeaderboardPage — pagination, ordering, battle isolation", () => {
  test("returns entries ordered by score descending", async () => {
    seedBattle(BATTLE_ID);
    fakeDb.seed(`battleScoreEntries/${BATTLE_ID}_low`,  { battleId: BATTLE_ID, studentId: "low",  submissionId: "x", score: 10 });
    fakeDb.seed(`battleScoreEntries/${BATTLE_ID}_high`, { battleId: BATTLE_ID, studentId: "high", submissionId: "x", score: 90 });
    fakeDb.seed(`battleScoreEntries/${BATTLE_ID}_mid`,  { battleId: BATTLE_ID, studentId: "mid",  submissionId: "x", score: 50 });

    const { getBattleLeaderboardPage } = require("../battleRanking");
    const page = await getBattleLeaderboardPage.run({ battleId: BATTLE_ID, pageSize: 10 }, { auth: { uid: "viewer" } });
    expect(page.entries.map((e: any) => e.studentId)).toEqual(["high", "mid", "low"]);
  });

  test("pagination: page size is respected and a nextCursor is returned when more exist", async () => {
    seedBattle(BATTLE_ID);
    for (let i = 0; i < 5; i++) {
      fakeDb.seed(`battleScoreEntries/${BATTLE_ID}_s${i}`, { battleId: BATTLE_ID, studentId: `s${i}`, submissionId: "x", score: 100 - i });
    }
    const { getBattleLeaderboardPage } = require("../battleRanking");
    const page1 = await getBattleLeaderboardPage.run({ battleId: BATTLE_ID, pageSize: 2 }, { auth: { uid: "viewer" } });
    expect(page1.entries).toHaveLength(2);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await getBattleLeaderboardPage.run({ battleId: BATTLE_ID, pageSize: 2, cursorStudentId: page1.nextCursor }, { auth: { uid: "viewer" } });
    expect(page2.entries).toHaveLength(2);
    expect(page2.entries[0].studentId).not.toBe(page1.entries[0].studentId);
  });

  test("battle isolation: only entries for the requested battleId are returned", async () => {
    seedBattle(BATTLE_ID); seedBattle(OTHER_BATTLE_ID);
    fakeDb.seed(`battleScoreEntries/${BATTLE_ID}_a`, { battleId: BATTLE_ID, studentId: "a", submissionId: "x", score: 50 });
    fakeDb.seed(`battleScoreEntries/${OTHER_BATTLE_ID}_b`, { battleId: OTHER_BATTLE_ID, studentId: "b", submissionId: "x", score: 999 });

    const { getBattleLeaderboardPage } = require("../battleRanking");
    const page = await getBattleLeaderboardPage.run({ battleId: BATTLE_ID }, { auth: { uid: "viewer" } });
    expect(page.entries).toHaveLength(1);
    expect(page.entries[0].studentId).toBe("a");
  });

  test("after RESULT_LOCKED, the leaderboard reads the frozen, tie-broken battleResults entries", async () => {
    fakeDb.seed(`battleResults/${BATTLE_ID}`, {
      battleId: BATTLE_ID, status: "locked",
      entries: [
        { studentId: "winner", submissionId: "x", score: 100, rank: 1, isWinner: true },
        { studentId: "runnerup", submissionId: "y", score: 90, rank: 2, isWinner: false },
      ],
    });
    const { getBattleLeaderboardPage } = require("../battleRanking");
    const page = await getBattleLeaderboardPage.run({ battleId: BATTLE_ID, pageSize: 10 }, { auth: { uid: "viewer" } });
    expect(page.final).toBe(true);
    expect(page.entries.map((e: any) => e.studentId)).toEqual(["winner", "runnerup"]);
  });

  test("Attack: unauthenticated leaderboard request", async () => {
    seedBattle(BATTLE_ID);
    const { getBattleLeaderboardPage } = require("../battleRanking");
    await expect(getBattleLeaderboardPage.run({ battleId: BATTLE_ID }, {}))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });
});

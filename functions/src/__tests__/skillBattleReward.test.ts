// PATH: functions/src/__tests__/skillBattleReward.test.ts
//
// Offline unit tests for the SkillBattle trust-boundary remediation
// (SB-P0-03/SB-P0-04) — run directly against the REAL module via the v1
// callable's `.run(data, context)` testing hook, firebase-admin mocked onto
// an in-memory FakeFirestore (see helpers/fakeFirestore.ts), same pattern
// as submitVidyastarContestQuiz.test.ts.
//
// The headline thing under test: claimSkillBattleReward now accepts ONLY
// {battleId} from the client — rank, reward pool, and reward percentage
// are all resolved server-side from skillBattles/{battleId} and
// skillboard/{battleId}_{class}_{uid} (written by updateSkillboard). These
// tests seed those trusted docs directly and confirm the function ignores
// any client-supplied rank/pool values entirely (there's nowhere left in
// its signature to even pass them).

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "./helpers/mockFirebaseAdmin";

const BATTLE_ID = "battle_1";
const UID       = "student_1";
const CTX       = { auth: { uid: UID } };
const CLASS     = "8";

const ENDED_BATTLE = {
  month: "2026-08",
  endDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // ended yesterday
  vcoin_india: 1000, vcoin_state: 500, vcoin_district: 200, vcoin_local: 100,
};
const LIVE_BATTLE = {
  ...ENDED_BATTLE,
  endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // ends tomorrow
};

function seedStudent() {
  fakeDb.seed(`students/${UID}`, { name: "Test Student", class: CLASS, location: { state: "MH" } });
}
function seedUser() {
  fakeDb.seed(`users/${UID}`, { role: "student", vCoinsBalance: 0 });
}
function seedSkillboard(ranks: Partial<{ india: number; state: number; district: number; local: number }>) {
  fakeDb.seed(`skillboard/${BATTLE_ID}_${CLASS}_${UID}`, {
    userId: UID, battleId: BATTLE_ID, class: CLASS,
    totalScore: 500,
    ranks: { india: 0, state: 0, district: 0, local: 0, ...ranks },
  });
}

beforeEach(() => {
  fakeDb.reset();
});

describe("getMySkillBattleStanding — server-computed standing, client never supplies rank", () => {
  test("returns the server-computed rank/score/estimatedReward for a rank-1-everywhere student", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, ENDED_BATTLE);
    seedStudent();
    seedSkillboard({ india: 1, state: 1, district: 1, local: 1 });

    const { getMySkillBattleStanding } = require("../vcoins");
    const result = await getMySkillBattleStanding.run({ battleId: BATTLE_ID }, CTX);

    expect(result.class).toBe(CLASS);
    expect(result.totalScore).toBe(500);
    expect(result.ranks).toEqual({ india: 1, state: 1, district: 1, local: 1 });
    // Rank 1 = 50% of pool (functions/src/vcoins.ts's VCOIN_DIST_PCT[0]).
    expect(result.estimatedReward.india).toBe(500);    // 50% of 1000
    expect(result.estimatedReward.state).toBe(250);    // 50% of 500
    expect(result.battleEnded).toBe(true);
  });

  test("a student with no skillboard doc for this battle sees rank 0 / zero reward everywhere, no crash", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, ENDED_BATTLE);
    seedStudent();
    // No skillboard doc seeded.

    const { getMySkillBattleStanding } = require("../vcoins");
    const result = await getMySkillBattleStanding.run({ battleId: BATTLE_ID }, CTX);

    expect(result.ranks).toEqual({ india: 0, state: 0, district: 0, local: 0 });
    expect(Object.values(result.estimatedReward)).toEqual([0, 0, 0, 0]);
  });

  test("throws not-found for a battleId that doesn't reference a real skillBattles doc", async () => {
    seedStudent();
    const { getMySkillBattleStanding } = require("../vcoins");
    await expect(getMySkillBattleStanding.run({ battleId: "fake_battle_xyz" }, CTX))
      .rejects.toMatchObject({ code: "not-found" });
  });

  test("throws unauthenticated with no auth context", async () => {
    const { getMySkillBattleStanding } = require("../vcoins");
    await expect(getMySkillBattleStanding.run({ battleId: BATTLE_ID }, {}))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });
});

describe("claimSkillBattleReward — server-authoritative rank/pool/amount (SB-P0-03)", () => {
  test("client payload has no rank/vcoins fields to smuggle — signature accepts only battleId", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, ENDED_BATTLE);
    seedStudent();
    seedUser();
    seedSkillboard({ india: 1, state: 2, district: 3, local: 0 });

    const { claimSkillBattleReward } = require("../vcoins");

    // Attacker-style payload: tries to smuggle a fabricated rank/pool
    // alongside battleId. These extra fields are simply not read anywhere
    // in the implementation (it destructures only { battleId }), so the
    // credited amount must come out exactly as the server's own
    // rank(1,2,3,0) x pool(1000,500,200,100) computation dictates —
    // 500 (india rank1: 50%) + 150 (state rank2: 30%) + 24 (district
    // rank3: 20% of 200 rounds to 40 — see below) — computed precisely
    // below rather than asserted as a magic number to keep the intent
    // legible.
    const attackerPayload = {
      battleId: BATTLE_ID,
      ranks:  { india: 1, state: 1, district: 1, local: 1 },       // ignored
      vcoins: { vcoin_india: 999999, vcoin_state: 999999, vcoin_district: 999999, vcoin_local: 999999 }, // ignored
    };

    const result = await claimSkillBattleReward.run(attackerPayload, CTX);

    const expectedIndia    = Math.round(1000 * 50 / 100); // rank 1 -> 500
    const expectedState    = Math.round(500  * 30 / 100); // rank 2 -> 150
    const expectedDistrict = Math.round(200  * 20 / 100); // rank 3 -> 40
    // local rank 0 -> not credited (getSkillBattleCoinForRank rejects rank<1)
    expect(result.totalCredited).toBe(expectedIndia + expectedState + expectedDistrict);
    expect(result.totalCredited).not.toBe(999999 * 4); // sanity: nowhere near the attacker's forged pool

    const user = fakeDb.peek(`users/${UID}`);
    expect(user?.vCoinsBalance).toBe(result.totalCredited);
  });

  test("rejects a claim for a battle that hasn't ended yet", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, LIVE_BATTLE);
    seedStudent();
    seedUser();
    seedSkillboard({ india: 1 });

    const { claimSkillBattleReward } = require("../vcoins");
    await expect(claimSkillBattleReward.run({ battleId: BATTLE_ID }, CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });

    // No VCoins should have moved.
    expect(fakeDb.peek(`users/${UID}`)?.vCoinsBalance).toBe(0);
  });

  test("a second claim for the same battle returns alreadyClaimed and does NOT double-credit", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, ENDED_BATTLE);
    seedStudent();
    seedUser();
    seedSkillboard({ india: 1 });

    const { claimSkillBattleReward } = require("../vcoins");
    const first  = await claimSkillBattleReward.run({ battleId: BATTLE_ID }, CTX);
    const second = await claimSkillBattleReward.run({ battleId: BATTLE_ID }, CTX);

    expect(first.alreadyClaimed).toBe(false);
    expect(second.alreadyClaimed).toBe(true);
    expect(second.totalCredited).toBe(first.totalCredited);

    // Balance reflects exactly one credit, not two.
    expect(fakeDb.peek(`users/${UID}`)?.vCoinsBalance).toBe(first.totalCredited);
  });

  test("writes an immutable skillBattleAwards record a student can only read, never write", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, ENDED_BATTLE);
    seedStudent();
    seedUser();
    seedSkillboard({ india: 1, state: 1, district: 1, local: 1 });

    const { claimSkillBattleReward } = require("../vcoins");
    await claimSkillBattleReward.run({ battleId: BATTLE_ID }, CTX);

    const award = fakeDb.peek(`skillBattleAwards/${BATTLE_ID}_${UID}`);
    expect(award?.status).toBe("credited");
    expect(award?.uid).toBe(UID);
    expect((award?.breakdown as any)?.india?.rank).toBe(1);
    // Firestore rules (firestore.rules) separately deny ALL client writes
    // to this collection unconditionally (`allow write: if false`) — that
    // half is covered by the rules-emulator suite, not this offline test.
  });

  test("a student with no class on record cannot claim (no standing, no crash)", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, ENDED_BATTLE);
    // No students/{uid} doc seeded at all.
    seedUser();

    const { claimSkillBattleReward } = require("../vcoins");
    const result = await claimSkillBattleReward.run({ battleId: BATTLE_ID }, CTX);

    expect(result.totalCredited).toBe(0);
    expect(fakeDb.peek(`users/${UID}`)?.vCoinsBalance).toBe(0);
  });

  test("throws not-found for a fabricated battleId with no matching skillBattles doc", async () => {
    seedStudent();
    seedUser();
    const { claimSkillBattleReward } = require("../vcoins");
    await expect(claimSkillBattleReward.run({ battleId: "totally-made-up" }, CTX))
      .rejects.toMatchObject({ code: "not-found" });
  });

  test("throws unauthenticated with no auth context", async () => {
    const { claimSkillBattleReward } = require("../vcoins");
    await expect(claimSkillBattleReward.run({ battleId: BATTLE_ID }, {}))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });
});

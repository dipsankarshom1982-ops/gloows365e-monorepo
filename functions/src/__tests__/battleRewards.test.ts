// PATH: functions/src/__tests__/battleRewards.test.ts
//
// Phase B §9/§10: claimBattleReward now requires a prior moderator
// winner verification (see ../moderation/winnerVerification.ts) before
// any crediting happens — seedVerifiedWinner() below seeds that record
// so the pre-existing reward-calculation tests keep exercising exactly
// what they always did. A new describe block covers the gate itself.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "./helpers/mockFirebaseAdmin";

const BATTLE_ID = "battle_1";
const WINNER_UID = "winner_1";
const OTHER_UID = "other_1";

function seedLockedResults(entries: Array<{ studentId: string; rank: number; isWinner: boolean }>) {
  fakeDb.seed(`battleResults/${BATTLE_ID}`, {
    battleId: BATTLE_ID, status: "locked",
    entries: entries.map((e) => ({ ...e, submissionId: `${BATTLE_ID}_${e.studentId}`, score: 100 - e.rank })),
  });
}
function seedPool(vcoinsPool: number) {
  fakeDb.seed(`skillBattles/${BATTLE_ID}`, { vcoinsPool });
}
function seedUser(uid: string) {
  fakeDb.seed(`users/${uid}`, { role: "student", vCoinsBalance: 0 });
}
function seedVerifiedWinner(uid: string, battleId = BATTLE_ID) {
  fakeDb.seed(`winnerVerifications/${battleId}_${uid}`, {
    battleId, uid, engine: "canonical", winnerStatus: "WINNER_VERIFIED", prizeStatus: "PRIZE_PENDING",
  });
}

beforeEach(() => { fakeDb.reset(); });

describe("claimBattleReward — winner verification gate (Phase B §9/§10)", () => {
  test("first claim attempt with no prior verification is rejected and creates a WINNER_PENDING_REVIEW record", async () => {
    seedLockedResults([{ studentId: WINNER_UID, rank: 1, isWinner: true }]);
    seedPool(1000);
    seedUser(WINNER_UID);

    const { claimBattleReward } = require("../battleRewards");
    await expect(claimBattleReward.run({ battleId: BATTLE_ID }, { auth: { uid: WINNER_UID } }))
      .rejects.toMatchObject({ code: "failed-precondition" });

    // No VCoins were credited — the gate rejected before any crediting logic ran.
    expect(fakeDb.peek(`users/${WINNER_UID}`)?.vCoinsBalance).toBe(0);
    const verification = fakeDb.peek(`winnerVerifications/${BATTLE_ID}_${WINNER_UID}`);
    expect(verification?.winnerStatus).toBe("WINNER_PENDING_REVIEW");
  });

  test("a claim while still WINNER_PENDING_REVIEW (moderator hasn't acted yet) keeps being rejected, never silently approved", async () => {
    seedLockedResults([{ studentId: WINNER_UID, rank: 1, isWinner: true }]);
    seedPool(1000);
    seedUser(WINNER_UID);

    const { claimBattleReward } = require("../battleRewards");
    // First call also throws — it's the one that CREATES the
    // WINNER_PENDING_REVIEW record (requireVerifiedWinner's "no doc yet"
    // branch), and creating that record is itself a disallow, not a
    // silent success. See winnerVerification.ts's requireVerifiedWinner.
    await expect(claimBattleReward.run({ battleId: BATTLE_ID }, { auth: { uid: WINNER_UID } }))
      .rejects.toMatchObject({ code: "failed-precondition" });
    await expect(claimBattleReward.run({ battleId: BATTLE_ID }, { auth: { uid: WINNER_UID } }))
      .rejects.toMatchObject({ code: "failed-precondition" });
    expect(fakeDb.peek(`users/${WINNER_UID}`)?.vCoinsBalance).toBe(0);
  });

  test("a WINNER_REJECTED verification permanently blocks the claim", async () => {
    seedLockedResults([{ studentId: WINNER_UID, rank: 1, isWinner: true }]);
    seedPool(1000);
    seedUser(WINNER_UID);
    fakeDb.seed(`winnerVerifications/${BATTLE_ID}_${WINNER_UID}`, {
      battleId: BATTLE_ID, uid: WINNER_UID, winnerStatus: "WINNER_REJECTED", prizeStatus: "PRIZE_REJECTED",
    });

    const { claimBattleReward } = require("../battleRewards");
    await expect(claimBattleReward.run({ battleId: BATTLE_ID }, { auth: { uid: WINNER_UID } }))
      .rejects.toMatchObject({ code: "failed-precondition" });
    expect(fakeDb.peek(`users/${WINNER_UID}`)?.vCoinsBalance).toBe(0);
  });

  test("client cannot forge WINNER_VERIFIED — there is no field on this callable's input for it", async () => {
    seedLockedResults([{ studentId: WINNER_UID, rank: 1, isWinner: true }]);
    seedPool(1000);
    seedUser(WINNER_UID);

    const { claimBattleReward } = require("../battleRewards");
    await expect(claimBattleReward.run(
      { battleId: BATTLE_ID, winnerStatus: "WINNER_VERIFIED", prizeStatus: "PRIZE_APPROVED" } as any,
      { auth: { uid: WINNER_UID } }
    )).rejects.toMatchObject({ code: "failed-precondition" }); // forged fields are simply never read
    expect(fakeDb.peek(`users/${WINNER_UID}`)?.vCoinsBalance).toBe(0);
  });
});

describe("claimBattleReward — server-resolved amount (requires prior verification)", () => {
  test("a rank-1 winner is credited the correct VCOIN_DIST_PCT share of the configured pool", async () => {
    seedLockedResults([{ studentId: WINNER_UID, rank: 1, isWinner: true }]);
    seedPool(1000);
    seedUser(WINNER_UID);
    seedVerifiedWinner(WINNER_UID);

    const { claimBattleReward } = require("../battleRewards");
    const result = await claimBattleReward.run({ battleId: BATTLE_ID }, { auth: { uid: WINNER_UID } });

    expect(result.totalCredited).toBe(500); // rank 1 = 50% of 1000, functions/src/vcoins.ts's VCOIN_DIST_PCT
    expect(fakeDb.peek(`users/${WINNER_UID}`)?.vCoinsBalance).toBe(500);
  });

  test("Attack: client-supplied battleId is the only input — there's no rank/pool field to smuggle", async () => {
    seedLockedResults([{ studentId: WINNER_UID, rank: 1, isWinner: true }]);
    seedPool(1000);
    seedUser(WINNER_UID);
    seedVerifiedWinner(WINNER_UID);

    const { claimBattleReward } = require("../battleRewards");
    const result = await claimBattleReward.run(
      { battleId: BATTLE_ID, rank: 1, vcoinsPool: 999999999 } as any, { auth: { uid: WINNER_UID } }
    );
    expect(result.totalCredited).toBe(500); // the forged fields are simply never read
  });

  test("a student not present in the locked results gets nothing, no error (and no verification doc is even created)", async () => {
    seedLockedResults([{ studentId: WINNER_UID, rank: 1, isWinner: true }]);
    seedPool(1000);
    const { claimBattleReward } = require("../battleRewards");
    const result = await claimBattleReward.run({ battleId: BATTLE_ID }, { auth: { uid: "never_submitted" } });
    expect(result.totalCredited).toBe(0);
    // The gate only ever applies to an actual entry — a non-entrant
    // returns early before reaching it, so no queue-clutter is created.
    expect(fakeDb.peek(`winnerVerifications/${BATTLE_ID}_never_submitted`)).toBeUndefined();
  });

  test("rejects a claim before results are finalized", async () => {
    seedPool(1000);
    const { claimBattleReward } = require("../battleRewards");
    await expect(claimBattleReward.run({ battleId: BATTLE_ID }, { auth: { uid: WINNER_UID } }))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("rejects an unauthenticated claim", async () => {
    const { claimBattleReward } = require("../battleRewards");
    await expect(claimBattleReward.run({ battleId: BATTLE_ID }, {}))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });
});

describe("claimBattleReward — Attack 13: duplicate claim prevention", () => {
  test("a second claim returns alreadyClaimed and does not double-credit", async () => {
    seedLockedResults([{ studentId: WINNER_UID, rank: 1, isWinner: true }]);
    seedPool(1000);
    seedUser(WINNER_UID);
    seedVerifiedWinner(WINNER_UID);

    const { claimBattleReward } = require("../battleRewards");
    const first = await claimBattleReward.run({ battleId: BATTLE_ID }, { auth: { uid: WINNER_UID } });
    const second = await claimBattleReward.run({ battleId: BATTLE_ID }, { auth: { uid: WINNER_UID } });

    expect(first.alreadyClaimed).toBe(false);
    expect(second.alreadyClaimed).toBe(true);
    expect(second.totalCredited).toBe(first.totalCredited);
    expect(fakeDb.peek(`users/${WINNER_UID}`)?.vCoinsBalance).toBe(first.totalCredited);
  });
});

describe("claimBattleReward — Attack 14: cannot claim another student's reward", () => {
  test("there is no field to target another student — the caller always claims only their own entry", async () => {
    seedLockedResults([
      { studentId: WINNER_UID, rank: 1, isWinner: true },
      { studentId: OTHER_UID, rank: 2, isWinner: false },
    ]);
    seedPool(1000);
    seedUser(WINNER_UID);
    seedUser(OTHER_UID);
    seedVerifiedWinner(WINNER_UID);
    seedVerifiedWinner(OTHER_UID);

    const { claimBattleReward } = require("../battleRewards");
    // OTHER_UID calls the function — even if they somehow knew and tried
    // to reference WINNER_UID, there's no parameter for it; the callable
    // only reads context.auth.uid.
    const result = await claimBattleReward.run({ battleId: BATTLE_ID }, { auth: { uid: OTHER_UID } });

    expect(result.totalCredited).toBe(300); // rank 2 = 30% of 1000
    expect(fakeDb.peek(`users/${WINNER_UID}`)?.vCoinsBalance).toBe(0); // winner's balance untouched by other's claim
    expect(fakeDb.peek(`users/${OTHER_UID}`)?.vCoinsBalance).toBe(300);
  });
});

describe("claimBattleReward — battle isolation", () => {
  test("an incorrect/nonexistent battleId is rejected, not silently defaulted", async () => {
    const { claimBattleReward } = require("../battleRewards");
    await expect(claimBattleReward.run({ battleId: "totally_made_up" }, { auth: { uid: WINNER_UID } }))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });
});

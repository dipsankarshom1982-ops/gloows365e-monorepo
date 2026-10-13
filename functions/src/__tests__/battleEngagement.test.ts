// PATH: functions/src/__tests__/battleEngagement.test.ts

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "./helpers/mockFirebaseAdmin";

const BATTLE_ID = "battle_1";
const SUBMISSION_ID = `${BATTLE_ID}_owner_1`;
const OWNER_UID = "owner_1";
const ENGAGER_UID = "engager_1";
const ENGAGER_CTX = { auth: { uid: ENGAGER_UID } };
const OWNER_CTX = { auth: { uid: OWNER_UID } };

function seedLiveSubmission(overrides: Record<string, unknown> = {}) {
  fakeDb.seed(`submissions/${SUBMISSION_ID}`, { studentId: OWNER_UID, battleId: BATTLE_ID, status: "APPROVED", ...overrides });
}
function seedOpenBattle(state = "OPEN") {
  fakeDb.seed(`skillBattles/${BATTLE_ID}`, { state });
}

beforeEach(() => { fakeDb.reset(); });

describe("engageBattleSubmission — valid engagement", () => {
  test("a like is recorded once", async () => {
    seedLiveSubmission(); seedOpenBattle();
    const { engageBattleSubmission } = require("../battleEngagement");
    const result = await engageBattleSubmission.run({ submissionId: SUBMISSION_ID, type: "like" }, ENGAGER_CTX);
    expect(result.recorded).toBe(true);
    expect(fakeDb.peek(`submissions/${SUBMISSION_ID}/engagements/like_${ENGAGER_UID}`)).toBeTruthy();
  });

  test("a view is recorded once, independently of likes", async () => {
    seedLiveSubmission(); seedOpenBattle();
    const { engageBattleSubmission } = require("../battleEngagement");
    await engageBattleSubmission.run({ submissionId: SUBMISSION_ID, type: "view" }, ENGAGER_CTX);
    expect(fakeDb.peek(`submissions/${SUBMISSION_ID}/engagements/view_${ENGAGER_UID}`)).toBeTruthy();
    expect(fakeDb.peek(`submissions/${SUBMISSION_ID}/engagements/like_${ENGAGER_UID}`)).toBeUndefined();
  });

  test("rejects an unrecognized engagement type", async () => {
    seedLiveSubmission(); seedOpenBattle();
    const { engageBattleSubmission } = require("../battleEngagement");
    await expect(engageBattleSubmission.run({ submissionId: SUBMISSION_ID, type: "superlike" }, ENGAGER_CTX))
      .rejects.toMatchObject({ code: "invalid-argument" });
  });
});

describe("engageBattleSubmission — Attack 7/8: duplicate engagement cannot inflate score", () => {
  test("the SAME student liking the SAME submission twice records only one engagement doc", async () => {
    seedLiveSubmission(); seedOpenBattle();
    const { engageBattleSubmission } = require("../battleEngagement");

    const first = await engageBattleSubmission.run({ submissionId: SUBMISSION_ID, type: "like" }, ENGAGER_CTX);
    const second = await engageBattleSubmission.run({ submissionId: SUBMISSION_ID, type: "like" }, ENGAGER_CTX);

    expect(first.recorded).toBe(true);
    expect(second.recorded).toBe(false);
    expect(second.alreadyEngaged).toBe(true);

    const { recomputeSubmissionScore } = require("../battleRanking");
    await recomputeSubmissionScore(SUBMISSION_ID);
    expect(fakeDb.peek(`battleScoreEntries/${BATTLE_ID}_${OWNER_UID}`)?.verifiedLikes).toBe(1);
  });
});

describe("engageBattleSubmission — self-engagement rule (§13)", () => {
  test("the submission's own owner cannot like it", async () => {
    seedLiveSubmission(); seedOpenBattle();
    const { engageBattleSubmission } = require("../battleEngagement");
    await expect(engageBattleSubmission.run({ submissionId: SUBMISSION_ID, type: "like" }, OWNER_CTX))
      .rejects.toMatchObject({ code: "permission-denied" });
  });

  test("the submission's own owner cannot view it either — no passive-view carve-out", async () => {
    seedLiveSubmission(); seedOpenBattle();
    const { engageBattleSubmission } = require("../battleEngagement");
    await expect(engageBattleSubmission.run({ submissionId: SUBMISSION_ID, type: "view" }, OWNER_CTX))
      .rejects.toMatchObject({ code: "permission-denied" });
  });
});

describe("engageBattleSubmission — cutoff and eligibility", () => {
  test("Attack: engagement after battle cutoff (state no longer OPEN) fails", async () => {
    seedLiveSubmission(); seedOpenBattle("SUBMISSION_CLOSED");
    const { engageBattleSubmission } = require("../battleEngagement");
    await expect(engageBattleSubmission.run({ submissionId: SUBMISSION_ID, type: "like" }, ENGAGER_CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("cannot engage with a submission that is not APPROVED (still pending moderation)", async () => {
    seedLiveSubmission({ status: "PENDING_MODERATION" }); seedOpenBattle();
    const { engageBattleSubmission } = require("../battleEngagement");
    await expect(engageBattleSubmission.run({ submissionId: SUBMISSION_ID, type: "like" }, ENGAGER_CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("cannot engage with a submission that doesn't exist", async () => {
    seedOpenBattle();
    const { engageBattleSubmission } = require("../battleEngagement");
    await expect(engageBattleSubmission.run({ submissionId: "fake_id", type: "like" }, ENGAGER_CTX))
      .rejects.toMatchObject({ code: "not-found" });
  });

  test("Attack: unauthorized (unauthenticated) engagement request", async () => {
    seedLiveSubmission(); seedOpenBattle();
    const { engageBattleSubmission } = require("../battleEngagement");
    await expect(engageBattleSubmission.run({ submissionId: SUBMISSION_ID, type: "like" }, {}))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });

  // NOTE on true concurrent engagement (§14 "concurrent requests"): same
  // reasoning as battleSubmissions.test.ts's note — the structural
  // guarantee (deterministic engagement doc ID `{type}_{uid}`, checked
  // transactionally) is what real Firestore's transaction semantics
  // serialize correctly; the offline fake here doesn't model that
  // interleaving, so it isn't asserted via a race-simulation unit test.
});

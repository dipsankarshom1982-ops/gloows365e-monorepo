// PATH: functions/src/__tests__/moderation/winnerVerification.test.ts
//
// Offline unit tests for verifyBattleWinner (the moderator-facing
// callable) and requireVerifiedWinner (the gate both claim functions
// call — also exercised end-to-end in skillBattleReward.test.ts /
// battleRewards.test.ts).

jest.mock("firebase-admin", () => require("../helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "../helpers/mockFirebaseAdmin";
import { requireVerifiedWinner } from "../../moderation/winnerVerification";

const BATTLE_ID = "battle_1";
const UID = "student_1";
const ADMIN_CTX = { auth: { uid: "admin_1", token: { admin: true } } };
const STUDENT_CTX = { auth: { uid: UID, token: {} } };

beforeEach(() => { fakeDb.reset(); });

describe("requireVerifiedWinner — the gate itself", () => {
  test("no verification doc yet: creates WINNER_PENDING_REVIEW and disallows", async () => {
    const result = await requireVerifiedWinner("legacy", BATTLE_ID, UID);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe("WINNER_PENDING_REVIEW");
    expect(fakeDb.peek(`winnerVerifications/${BATTLE_ID}_${UID}`)?.winnerStatus).toBe("WINNER_PENDING_REVIEW");
  });

  test("WINNER_VERIFIED allows", async () => {
    fakeDb.seed(`winnerVerifications/${BATTLE_ID}_${UID}`, { winnerStatus: "WINNER_VERIFIED" });
    const result = await requireVerifiedWinner("legacy", BATTLE_ID, UID);
    expect(result.allowed).toBe(true);
  });

  test("WINNER_REJECTED disallows permanently", async () => {
    fakeDb.seed(`winnerVerifications/${BATTLE_ID}_${UID}`, { winnerStatus: "WINNER_REJECTED" });
    const result = await requireVerifiedWinner("legacy", BATTLE_ID, UID);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe("WINNER_REJECTED");
  });
});

describe("verifyBattleWinner — authorization", () => {
  test("rejects an unauthenticated caller", async () => {
    const { verifyBattleWinner } = require("../../moderation/winnerVerification");
    await expect(verifyBattleWinner.run({ engine: "legacy", battleId: BATTLE_ID, uid: UID, decision: "VERIFIED" }, {}))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("rejects a non-admin, including the student themselves", async () => {
    const { verifyBattleWinner } = require("../../moderation/winnerVerification");
    await expect(verifyBattleWinner.run({ engine: "legacy", battleId: BATTLE_ID, uid: UID, decision: "VERIFIED" }, STUDENT_CTX))
      .rejects.toMatchObject({ code: "permission-denied" });
  });
});

describe("verifyBattleWinner — objective eligibility gates (canonical engine)", () => {
  test("cannot mark VERIFIED if the submission was never approved", async () => {
    fakeDb.seed(`submissions/${BATTLE_ID}_${UID}`, { status: "PENDING_HUMAN_REVIEW", declarationAccepted: true });
    const { verifyBattleWinner } = require("../../moderation/winnerVerification");
    await expect(verifyBattleWinner.run({ engine: "canonical", battleId: BATTLE_ID, uid: UID, decision: "VERIFIED" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("cannot mark VERIFIED if the originality declaration was never accepted", async () => {
    fakeDb.seed(`submissions/${BATTLE_ID}_${UID}`, { status: "APPROVED", declarationAccepted: false });
    const { verifyBattleWinner } = require("../../moderation/winnerVerification");
    await expect(verifyBattleWinner.run({ engine: "canonical", battleId: BATTLE_ID, uid: UID, decision: "VERIFIED" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("cannot mark VERIFIED while an unresolved (OPEN) report exists", async () => {
    fakeDb.seed(`submissions/${BATTLE_ID}_${UID}`, { status: "APPROVED", declarationAccepted: true });
    fakeDb.seed(`skillBattleReports/report_1`, { contentType: "submission", contentId: `${BATTLE_ID}_${UID}`, status: "OPEN" });
    const { verifyBattleWinner } = require("../../moderation/winnerVerification");
    await expect(verifyBattleWinner.run({ engine: "canonical", battleId: BATTLE_ID, uid: UID, decision: "VERIFIED" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("a RESOLVED report does not block verification", async () => {
    fakeDb.seed(`submissions/${BATTLE_ID}_${UID}`, { status: "APPROVED", declarationAccepted: true });
    fakeDb.seed(`skillBattleReports/report_1`, { contentType: "submission", contentId: `${BATTLE_ID}_${UID}`, status: "RESOLVED" });
    const { verifyBattleWinner } = require("../../moderation/winnerVerification");
    const result = await verifyBattleWinner.run({ engine: "canonical", battleId: BATTLE_ID, uid: UID, decision: "VERIFIED" }, ADMIN_CTX);
    expect(result.winnerStatus).toBe("WINNER_VERIFIED");
  });

  test("all objective checks passing allows VERIFIED, and unlocks the claim gate", async () => {
    fakeDb.seed(`submissions/${BATTLE_ID}_${UID}`, { status: "APPROVED", declarationAccepted: true });
    const { verifyBattleWinner } = require("../../moderation/winnerVerification");
    const result = await verifyBattleWinner.run({ engine: "canonical", battleId: BATTLE_ID, uid: UID, decision: "VERIFIED" }, ADMIN_CTX);
    expect(result.winnerStatus).toBe("WINNER_VERIFIED");
    expect(result.checklist).toMatchObject({ hasApprovedContent: true, declarationAccepted: true, noUnresolvedReports: true });

    const gate = await requireVerifiedWinner("canonical", BATTLE_ID, UID);
    expect(gate.allowed).toBe(true);
  });

  test("Phase C §14: cannot mark VERIFIED while the safety check is mid-re-run (STALE_MODERATION)", async () => {
    fakeDb.seed(`submissions/${BATTLE_ID}_${UID}`, {
      status: "APPROVED", declarationAccepted: true,
      safetyModeration: { status: "PROCESSING" },
    });
    const { verifyBattleWinner } = require("../../moderation/winnerVerification");
    await expect(verifyBattleWinner.run({ engine: "canonical", battleId: BATTLE_ID, uid: UID, decision: "VERIFIED" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("Phase C §14: a COMPLETED safety check (no re-run in flight) does not block verification", async () => {
    fakeDb.seed(`submissions/${BATTLE_ID}_${UID}`, {
      status: "APPROVED", declarationAccepted: true,
      safetyModeration: { status: "COMPLETED" },
    });
    const { verifyBattleWinner } = require("../../moderation/winnerVerification");
    const result = await verifyBattleWinner.run({ engine: "canonical", battleId: BATTLE_ID, uid: UID, decision: "VERIFIED" }, ADMIN_CTX);
    expect(result.winnerStatus).toBe("WINNER_VERIFIED");
  });

  test("a moderator can always mark REJECTED regardless of the objective checklist", async () => {
    fakeDb.seed(`submissions/${BATTLE_ID}_${UID}`, { status: "PENDING_HUMAN_REVIEW", declarationAccepted: false });
    const { verifyBattleWinner } = require("../../moderation/winnerVerification");
    const result = await verifyBattleWinner.run({ engine: "canonical", battleId: BATTLE_ID, uid: UID, decision: "REJECTED", reason: "not eligible" }, ADMIN_CTX);
    expect(result.winnerStatus).toBe("WINNER_REJECTED");
  });
});

describe("verifyBattleWinner — legacy engine (multiple posts per battle)", () => {
  test("eligible if AT LEAST ONE of the student's posts for this battle is approved+declared", async () => {
    fakeDb.seed("posts/post_a", { userId: UID, battleId: BATTLE_ID, isSkillBattle: true, status: "rejected", declarationAccepted: true });
    fakeDb.seed("posts/post_b", { userId: UID, battleId: BATTLE_ID, isSkillBattle: true, status: "approved", declarationAccepted: true });
    const { verifyBattleWinner } = require("../../moderation/winnerVerification");
    const result = await verifyBattleWinner.run({ engine: "legacy", battleId: BATTLE_ID, uid: UID, decision: "VERIFIED" }, ADMIN_CTX);
    expect(result.winnerStatus).toBe("WINNER_VERIFIED");
  });

  test("not eligible if none of the student's posts for this battle are approved", async () => {
    fakeDb.seed("posts/post_a", { userId: UID, battleId: BATTLE_ID, isSkillBattle: true, status: "rejected", declarationAccepted: true });
    const { verifyBattleWinner } = require("../../moderation/winnerVerification");
    await expect(verifyBattleWinner.run({ engine: "legacy", battleId: BATTLE_ID, uid: UID, decision: "VERIFIED" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("Phase C §14: an approved post mid-re-moderation blocks VERIFIED even though it's currently 'approved'", async () => {
    fakeDb.seed("posts/post_a", {
      userId: UID, battleId: BATTLE_ID, isSkillBattle: true, status: "approved", declarationAccepted: true,
      safetyModeration: { status: "PROCESSING" },
    });
    const { verifyBattleWinner } = require("../../moderation/winnerVerification");
    await expect(verifyBattleWinner.run({ engine: "legacy", battleId: BATTLE_ID, uid: UID, decision: "VERIFIED" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });
});

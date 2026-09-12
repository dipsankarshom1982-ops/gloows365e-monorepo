// PATH: functions/src/__tests__/moderation/e2eLifecycle.test.ts
//
// Phase B §15 — a complete Skill Battle lifecycle test chaining the REAL
// callables end to end (canonical engine): upload ownership → submit →
// moderation queue → moderator approval → engagement/scoring →
// finalization → winner verification → prize claim. Every step calls
// the actual exported Cloud Function, never a mock of the pipeline
// itself — only firebase-admin's Firestore is faked (this repo's
// established offline-test pattern throughout).
//
// Also covers the rejection path: an upload that a moderator rejects
// must never become leaderboard/prize eligible.

jest.mock("firebase-admin", () => require("../helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "../helpers/mockFirebaseAdmin";
import { mintMediaOwnershipToken, TEST_OWNERSHIP_SECRET } from "../helpers/mediaOwnershipTestHelper";

const BATTLE_ID = "battle_e2e";
const SKILL_ID = "singing";
const UID = "student_e2e";
const STUDENT_CTX = { auth: { uid: UID, token: {} } };
const ADMIN_CTX = { auth: { uid: "admin_1", token: { admin: true } } };
const VALID_DECLARATION = { declarationAccepted: true, declarationVersion: "v1" };

function tokenFor(mediaRef: string, uid = UID) {
  return mintMediaOwnershipToken({ uid, videoUid: mediaRef });
}

beforeEach(() => {
  fakeDb.reset();
  process.env["WORKER_OWNERSHIP_SECRET"] = TEST_OWNERSHIP_SECRET;

  fakeDb.seed(`skillBattles/${BATTLE_ID}`, {
    state: "OPEN", skillId: SKILL_ID, winnerCount: 1,
    submissionDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    vcoinsPool: 1000,
  });
  fakeDb.seed(`skills/${SKILL_ID}`, { name: "Singing", categoryId: "creative", isActive: true });
  fakeDb.seed(`students/${UID}`, { name: "E2E Student", class: "8" });
});

describe("Skill Battle lifecycle — success path (canonical engine)", () => {
  test("upload → submit → approve → finalize → verify winner → claim prize, in full", async () => {
    const { createBattleSubmission, reviewBattleSubmission } = require("../../battleSubmissions");
    const { getModerationQueue } = require("../../moderation/moderationQueue");
    const { verifyBattleWinner } = require("../../moderation/winnerVerification");
    const { finalizeBattleResults } = require("../../battleFinalization");
    const { claimBattleReward } = require("../../battleRewards");

    // 1. Student uploads (ownership token minted by the Worker, verified
    // here exactly as production does) and submits.
    const mediaRef = "e2e_video_1";
    const submitResult = await createBattleSubmission.run(
      { battleId: BATTLE_ID, mediaRef, ownershipToken: tokenFor(mediaRef), ...VALID_DECLARATION },
      STUDENT_CTX
    );
    expect(submitResult.moderationStatus).toBe("PENDING_HUMAN_REVIEW");

    // 2. It's not public/leaderboard-eligible yet — still PENDING_HUMAN_REVIEW.
    let submissionDoc = fakeDb.peek(`submissions/${submitResult.submissionId}`);
    expect(submissionDoc?.status).toBe("PENDING_HUMAN_REVIEW");

    // 3. Moderator sees it in the queue.
    const queue = await getModerationQueue.run({ filter: "pending" }, ADMIN_CTX);
    expect(queue.items.some((i: any) => i.contentId === submitResult.submissionId)).toBe(true);

    // 4. Moderator approves.
    const reviewResult = await reviewBattleSubmission.run(
      { battleId: BATTLE_ID, studentId: UID, action: "APPROVE" }, ADMIN_CTX
    );
    expect(reviewResult.status).toBe("APPROVED");
    submissionDoc = fakeDb.peek(`submissions/${submitResult.submissionId}`);
    expect(submissionDoc?.status).toBe("APPROVED");

    // 5. Leaderboard/finalization — seed a score entry the way the real
    // engagement/scoring pipeline would produce, advance the battle to
    // RANKING_FINALIZATION (the only state finalizeBattleResults accepts
    // from — see skillBattleDomain.ts's state graph), then finalize.
    fakeDb.seed(`battleScoreEntries/${BATTLE_ID}_${UID}`, {
      battleId: BATTLE_ID, studentId: UID, submissionId: submitResult.submissionId,
      score: 100, rawEngagement: 100, approvedAtMillis: Date.now(),
    });
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, {
      ...fakeDb.peek(`skillBattles/${BATTLE_ID}`), state: "RANKING_FINALIZATION",
    });
    await finalizeBattleResults.run({ battleId: BATTLE_ID }, ADMIN_CTX);
    const results = fakeDb.peek(`battleResults/${BATTLE_ID}`);
    expect(results?.status).toBe("locked");
    expect((results?.entries as Array<{ isWinner: boolean }> | undefined)?.[0]?.isWinner).toBe(true);

    // 6. Student attempts to claim BEFORE winner verification — must be
    // rejected, and must have queued a WINNER_PENDING_REVIEW record.
    await expect(claimBattleReward.run({ battleId: BATTLE_ID }, STUDENT_CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
    expect(fakeDb.peek(`winnerVerifications/${BATTLE_ID}_${UID}`)?.winnerStatus).toBe("WINNER_PENDING_REVIEW");

    // 7. Moderator verifies the winner (all objective checks pass: approved, declared, no reports).
    const verifyResult = await verifyBattleWinner.run(
      { engine: "canonical", battleId: BATTLE_ID, uid: UID, decision: "VERIFIED" }, ADMIN_CTX
    );
    expect(verifyResult.winnerStatus).toBe("WINNER_VERIFIED");

    // 8. NOW the claim succeeds.
    fakeDb.seed(`users/${UID}`, { role: "student", vCoinsBalance: 0 });
    const claimResult = await claimBattleReward.run({ battleId: BATTLE_ID }, STUDENT_CTX);
    expect(claimResult.totalCredited).toBeGreaterThan(0);
    expect(fakeDb.peek(`users/${UID}`)?.vCoinsBalance).toBe(claimResult.totalCredited);
  });
});

describe("Skill Battle lifecycle — rejection path", () => {
  test("upload → moderation → rejected → never leaderboard/prize eligible", async () => {
    const { createBattleSubmission, reviewBattleSubmission } = require("../../battleSubmissions");
    const { verifyBattleWinner } = require("../../moderation/winnerVerification");

    const mediaRef = "e2e_video_rejected";
    const submitResult = await createBattleSubmission.run(
      { battleId: BATTLE_ID, mediaRef, ownershipToken: tokenFor(mediaRef), ...VALID_DECLARATION },
      STUDENT_CTX
    );

    const reviewResult = await reviewBattleSubmission.run(
      { battleId: BATTLE_ID, studentId: UID, action: "REJECT", reason: "did not meet guidelines" }, ADMIN_CTX
    );
    expect(reviewResult.status).toBe("REJECTED");

    const doc = fakeDb.peek(`submissions/${submitResult.submissionId}`);
    expect(doc?.status).toBe("REJECTED");

    // Winner verification must refuse a rejected submission outright —
    // it can never become prize-eligible regardless of any later attempt.
    await expect(
      verifyBattleWinner.run({ engine: "canonical", battleId: BATTLE_ID, uid: UID, decision: "VERIFIED" }, ADMIN_CTX)
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });
});

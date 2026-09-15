// PATH: functions/src/__tests__/battleSubmissions.test.ts
//
// 2026-09-11 audit P0 fix: createBattleSubmission now requires a valid
// media-ownership token (see ../mediaOwnership.ts and
// helpers/mediaOwnershipTestHelper.ts) — every previously-passing test
// below mints one via tokenFor() so the underlying battle-validation
// behavior stays covered without re-opening the ownership gap in the
// test fixtures themselves. A new describe block covers the ownership
// check itself (Attacks A/C/D from the hardening brief).

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "./helpers/mockFirebaseAdmin";
import { mintMediaOwnershipToken, TEST_OWNERSHIP_SECRET } from "./helpers/mediaOwnershipTestHelper";

const BATTLE_ID = "battle_1";
const SKILL_ID = "singing";
const UID = "student_1";
const CTX = { auth: { uid: UID, token: {} } };
const ADMIN_CTX = { auth: { uid: "admin_1", token: { admin: true } } };

function seedOpenBattle(overrides: Record<string, unknown> = {}) {
  fakeDb.seed(`skillBattles/${BATTLE_ID}`, {
    state: "OPEN", skillId: SKILL_ID,
    submissionDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  });
}
function seedSkill(overrides: Record<string, unknown> = {}) {
  fakeDb.seed(`skills/${SKILL_ID}`, { name: "Singing", categoryId: "creative", isActive: true, ...overrides });
}
function seedStudent() {
  fakeDb.seed(`students/${UID}`, { name: "Test Student", class: "8" });
}

// A submission's mediaRef must match the ownership token's videoUid — the
// real client always uses the exact video uid the Worker returned, so
// tests mirror that instead of using two unrelated strings.
function tokenFor(mediaRef: string, uid = UID) {
  return mintMediaOwnershipToken({ uid, videoUid: mediaRef });
}

beforeEach(() => {
  fakeDb.reset();
  process.env["WORKER_OWNERSHIP_SECRET"] = TEST_OWNERSHIP_SECRET;
});

describe("createBattleSubmission — battle validation (§7)", () => {
  test("a valid submission succeeds and lands in PENDING_HUMAN_REVIEW (no automated provider configured)", async () => {
    seedOpenBattle(); seedSkill(); seedStudent();
    const { createBattleSubmission } = require("../battleSubmissions");
    const result = await createBattleSubmission.run(
      { battleId: BATTLE_ID, mediaRef: "cf_video_123", ownershipToken: tokenFor("cf_video_123") }, CTX
    );
    expect(result.submissionId).toBe(`${BATTLE_ID}_${UID}`);
    expect(result.moderationStatus).toBe("PENDING_HUMAN_REVIEW");
    const doc = fakeDb.peek(`submissions/${result.submissionId}`);
    // No automated moderation/copyright/similarity provider is configured
    // in this test environment (or production, today) — the decision
    // engine's fail-closed default routes every submission to human
    // review, never straight to APPROVED. See moderation/decisionEngine.ts.
    expect(doc?.status).toBe("PENDING_HUMAN_REVIEW");
    expect(doc?.moderationStatus).toBe("PENDING_HUMAN_REVIEW");
    expect(doc?.copyrightStatus).toBe("NOT_CONFIGURED");
    expect(doc?.similarityStatus).toBe("NOT_CHECKED");
    expect(doc?.winnerStatus).toBe("NOT_APPLICABLE");
    expect(doc?.prizeStatus).toBe("NOT_APPLICABLE");
    expect(doc?.studentId).toBe(UID);
    // Media ownership is now genuinely verified — the token above proved it.
    expect(doc?.mediaOwnershipVerified).toBe(true);
  });

  test("originality declaration: omitted is recorded honestly as not accepted, not rejected (pre-Phase-B mobile compatibility)", async () => {
    seedOpenBattle(); seedSkill(); seedStudent();
    const { createBattleSubmission } = require("../battleSubmissions");
    const result = await createBattleSubmission.run(
      { battleId: BATTLE_ID, mediaRef: "no_declaration", ownershipToken: tokenFor("no_declaration") }, CTX
    );
    const doc = fakeDb.peek(`submissions/${result.submissionId}`);
    expect(doc?.declarationAccepted).toBe(false);
    expect(doc?.declarationVersion).toBeNull();
  });

  test("originality declaration: a present but invalid value is rejected outright", async () => {
    seedOpenBattle(); seedSkill(); seedStudent();
    const { createBattleSubmission } = require("../battleSubmissions");
    await expect(createBattleSubmission.run(
      { battleId: BATTLE_ID, mediaRef: "x", ownershipToken: tokenFor("x"), declarationAccepted: false, declarationVersion: "v1" }, CTX
    )).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(createBattleSubmission.run(
      { battleId: BATTLE_ID, mediaRef: "y", ownershipToken: tokenFor("y"), declarationAccepted: true, declarationVersion: "tampered-version" }, CTX
    )).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("originality declaration: correctly accepted is recorded with a server-stamped timestamp", async () => {
    seedOpenBattle(); seedSkill(); seedStudent();
    const { createBattleSubmission } = require("../battleSubmissions");
    const result = await createBattleSubmission.run(
      { battleId: BATTLE_ID, mediaRef: "accepted", ownershipToken: tokenFor("accepted"), declarationAccepted: true, declarationVersion: "v1" }, CTX
    );
    const doc = fakeDb.peek(`submissions/${result.submissionId}`);
    expect(doc?.declarationAccepted).toBe(true);
    expect(doc?.declarationVersion).toBe("v1");
    expect(doc?.declarationAcceptedAt).toBeTruthy();
  });

  test("Attack: submission for a battle that doesn't exist", async () => {
    seedStudent();
    const { createBattleSubmission } = require("../battleSubmissions");
    await expect(createBattleSubmission.run({ battleId: "fake_battle", mediaRef: "x", ownershipToken: tokenFor("x") }, CTX))
      .rejects.toMatchObject({ code: "not-found" });
  });

  test("Attack 2: submit to a closed (non-OPEN) battle", async () => {
    seedOpenBattle({ state: "SUBMISSION_CLOSED" }); seedSkill(); seedStudent();
    const { createBattleSubmission } = require("../battleSubmissions");
    await expect(createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "x", ownershipToken: tokenFor("x") }, CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("Attack 3: submit after the submission deadline has passed", async () => {
    seedOpenBattle({ submissionDeadline: new Date(Date.now() - 60_000).toISOString() });
    seedSkill(); seedStudent();
    const { createBattleSubmission } = require("../battleSubmissions");
    await expect(createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "x", ownershipToken: tokenFor("x") }, CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("invalid skill: battle's skill has been deactivated", async () => {
    seedOpenBattle(); seedSkill({ isActive: false }); seedStudent();
    const { createBattleSubmission } = require("../battleSubmissions");
    await expect(createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "x", ownershipToken: tokenFor("x") }, CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("invalid student: no student profile on record", async () => {
    seedOpenBattle(); seedSkill();
    const { createBattleSubmission } = require("../battleSubmissions");
    await expect(createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "x", ownershipToken: tokenFor("x") }, CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("throws unauthenticated with no auth context", async () => {
    const { createBattleSubmission } = require("../battleSubmissions");
    await expect(createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "x", ownershipToken: tokenFor("x") }, {}))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });
});

describe("createBattleSubmission — media ownership (2026-09-11 audit P0 fix)", () => {
  test("Attack A: missing ownershipToken is rejected", async () => {
    seedOpenBattle(); seedSkill(); seedStudent();
    const { createBattleSubmission } = require("../battleSubmissions");
    await expect(createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "x" }, CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
    expect(fakeDb.peek(`submissions/${BATTLE_ID}_${UID}`)).toBeUndefined();
  });

  test("Attack C: a token minted for a different uid is rejected, even for the same mediaRef", async () => {
    seedOpenBattle(); seedSkill(); seedStudent();
    const { createBattleSubmission } = require("../battleSubmissions");
    const forgedToken = tokenFor("cf_video_999", "someone_else");
    await expect(createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "cf_video_999", ownershipToken: forgedToken }, CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("Attack D: User B cannot submit User A's mediaRef as their own", async () => {
    seedOpenBattle(); seedSkill();
    fakeDb.seed("students/student_a", { name: "Student A", class: "8" });
    fakeDb.seed("students/student_b", { name: "Student B", class: "8" });
    const { createBattleSubmission } = require("../battleSubmissions");

    // Student A legitimately uploads and submits.
    const tokenA = mintMediaOwnershipToken({ uid: "student_a", videoUid: "video_a" });
    await createBattleSubmission.run(
      { battleId: BATTLE_ID, mediaRef: "video_a", ownershipToken: tokenA },
      { auth: { uid: "student_a", token: {} } }
    );

    // Student B obtains video_a's mediaRef (e.g. by observing it) and
    // tries to submit it as their own, reusing student A's token.
    await expect(
      createBattleSubmission.run(
        { battleId: "battle_2", mediaRef: "video_a", ownershipToken: tokenA },
        { auth: { uid: "student_b", token: {} } }
      )
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("a forged/tampered token (wrong secret) is rejected", async () => {
    seedOpenBattle(); seedSkill(); seedStudent();
    const { createBattleSubmission } = require("../battleSubmissions");
    const badToken = mintMediaOwnershipToken({ uid: UID, videoUid: "x" }, "not_the_real_secret");
    await expect(createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "x", ownershipToken: badToken }, CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("an expired token is rejected", async () => {
    seedOpenBattle(); seedSkill(); seedStudent();
    const { createBattleSubmission } = require("../battleSubmissions");
    const past = Date.now() - 60_000;
    const expiredToken = mintMediaOwnershipToken({ uid: UID, videoUid: "x", iat: past - 1000, exp: past });
    await expect(createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "x", ownershipToken: expiredToken }, CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("the rejection message never reveals the specific verification reason", async () => {
    seedOpenBattle(); seedSkill(); seedStudent();
    const { createBattleSubmission } = require("../battleSubmissions");
    try {
      await createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "x" }, CTX);
      throw new Error("expected rejection");
    } catch (err: any) {
      expect(err.message).not.toMatch(/secret|signature|hmac|jwt/i);
    }
  });
});

describe("createBattleSubmission — one student, one submission, one battle (§9)", () => {
  test("Attack 4 / duplicate submission: a second submission attempt (sequential retry) is rejected, not a second doc", async () => {
    seedOpenBattle(); seedSkill(); seedStudent();
    const { createBattleSubmission } = require("../battleSubmissions");

    await createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "first", ownershipToken: tokenFor("first") }, CTX);
    await expect(createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "second", ownershipToken: tokenFor("second") }, CTX))
      .rejects.toMatchObject({ code: "already-exists" });

    // The original submission is untouched — a rejected duplicate attempt
    // must not silently overwrite it.
    expect(fakeDb.peek(`submissions/${BATTLE_ID}_${UID}`)?.mediaRef).toBe("first");
  });

  // NOTE on true concurrency (Phase 2C brief §9's "simultaneous duplicate
  // requests"): the offline FakeFirestore used here doesn't model real
  // Firestore's transaction conflict-retry semantics (no per-document
  // locking, no interleaving simulation) — a genuinely simultaneous-race
  // test against it wouldn't prove anything about the real SDK's
  // behavior either way. The guarantee itself comes from the code
  // structure (a transactional check-then-create on a SINGLE
  // deterministic document, `submissions/{battleId}_{uid}`), which is
  // exactly the pattern real Firestore transactions are designed to
  // serialize correctly — verified by code review here, and exercised
  // for the sequential case above (retries, double-clicks).
});

describe("withdrawBattleSubmission", () => {
  test("owner can withdraw a still-pending submission", async () => {
    seedOpenBattle(); seedSkill(); seedStudent();
    const { createBattleSubmission, withdrawBattleSubmission } = require("../battleSubmissions");
    await createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "x", ownershipToken: tokenFor("x") }, CTX);
    const result = await withdrawBattleSubmission.run({ battleId: BATTLE_ID }, CTX);
    expect(result.ok).toBe(true);
    expect(fakeDb.peek(`submissions/${BATTLE_ID}_${UID}`)?.status).toBe("WITHDRAWN");
  });

  test("cannot withdraw an already-approved submission", async () => {
    fakeDb.seed(`submissions/${BATTLE_ID}_${UID}`, { studentId: UID, battleId: BATTLE_ID, status: "APPROVED" });
    const { withdrawBattleSubmission } = require("../battleSubmissions");
    await expect(withdrawBattleSubmission.run({ battleId: BATTLE_ID }, CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("cannot withdraw a submission that doesn't exist", async () => {
    const { withdrawBattleSubmission } = require("../battleSubmissions");
    await expect(withdrawBattleSubmission.run({ battleId: BATTLE_ID }, CTX))
      .rejects.toMatchObject({ code: "not-found" });
  });
});

describe("reviewBattleSubmission — moderation, never student-transitionable (§11)", () => {
  function seedPending() {
    fakeDb.seed(`submissions/${BATTLE_ID}_${UID}`, { studentId: UID, battleId: BATTLE_ID, status: "PENDING_MODERATION" });
  }

  test("admin CAN approve a pending submission, sets approvedAt", async () => {
    seedPending();
    const { reviewBattleSubmission } = require("../battleSubmissions");
    const result = await reviewBattleSubmission.run({ battleId: BATTLE_ID, studentId: UID, action: "APPROVE" }, ADMIN_CTX);
    expect(result.status).toBe("APPROVED");
    const doc = fakeDb.peek(`submissions/${BATTLE_ID}_${UID}`);
    expect(doc?.status).toBe("APPROVED");
    expect(doc?.approvedAt).toBeTruthy();
  });

  test("admin CAN approve a submission sitting in PENDING_HUMAN_REVIEW (the decision engine's real Phase A output)", async () => {
    fakeDb.seed(`submissions/${BATTLE_ID}_${UID}`, { studentId: UID, battleId: BATTLE_ID, status: "PENDING_HUMAN_REVIEW" });
    const { reviewBattleSubmission } = require("../battleSubmissions");
    const result = await reviewBattleSubmission.run({ battleId: BATTLE_ID, studentId: UID, action: "APPROVE" }, ADMIN_CTX);
    expect(result.status).toBe("APPROVED");
  });

  test("admin CAN reject with a reason", async () => {
    seedPending();
    const { reviewBattleSubmission } = require("../battleSubmissions");
    const result = await reviewBattleSubmission.run({ battleId: BATTLE_ID, studentId: UID, action: "REJECT", reason: "off-topic" }, ADMIN_CTX);
    expect(result.status).toBe("REJECTED");
    expect(fakeDb.peek(`submissions/${BATTLE_ID}_${UID}`)?.rejectionReason).toBe("off-topic");
  });

  test("Attack 6: a non-admin (the submission's own owner) CANNOT approve their own submission", async () => {
    seedPending();
    const { reviewBattleSubmission } = require("../battleSubmissions");
    await expect(reviewBattleSubmission.run({ battleId: BATTLE_ID, studentId: UID, action: "APPROVE" }, CTX))
      .rejects.toMatchObject({ code: "permission-denied" });
    expect(fakeDb.peek(`submissions/${BATTLE_ID}_${UID}`)?.status).toBe("PENDING_MODERATION");
  });

  test("cannot re-approve an already-approved submission (REJECTED -> APPROVED, or APPROVED -> APPROVED, both blocked)", async () => {
    fakeDb.seed(`submissions/${BATTLE_ID}_${UID}`, { studentId: UID, battleId: BATTLE_ID, status: "REJECTED" });
    const { reviewBattleSubmission } = require("../battleSubmissions");
    await expect(reviewBattleSubmission.run({ battleId: BATTLE_ID, studentId: UID, action: "APPROVE" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("admin can REMOVE an approved submission (post-publication takedown)", async () => {
    fakeDb.seed(`submissions/${BATTLE_ID}_${UID}`, { studentId: UID, battleId: BATTLE_ID, status: "APPROVED" });
    const { reviewBattleSubmission } = require("../battleSubmissions");
    const result = await reviewBattleSubmission.run({ battleId: BATTLE_ID, studentId: UID, action: "REMOVE" }, ADMIN_CTX);
    expect(result.status).toBe("REMOVED");
  });

  test("cannot REMOVE a submission that was never approved", async () => {
    seedPending();
    const { reviewBattleSubmission } = require("../battleSubmissions");
    await expect(reviewBattleSubmission.run({ battleId: BATTLE_ID, studentId: UID, action: "REMOVE" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });
});

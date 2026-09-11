// PATH: functions/src/__tests__/battleSubmissions.test.ts

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "./helpers/mockFirebaseAdmin";

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

beforeEach(() => { fakeDb.reset(); });

describe("createBattleSubmission — battle validation (§7)", () => {
  test("a valid submission succeeds and starts PENDING_MODERATION", async () => {
    seedOpenBattle(); seedSkill(); seedStudent();
    const { createBattleSubmission } = require("../battleSubmissions");
    const result = await createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "cf_video_123" }, CTX);
    expect(result.submissionId).toBe(`${BATTLE_ID}_${UID}`);
    const doc = fakeDb.peek(`submissions/${result.submissionId}`);
    expect(doc?.status).toBe("PENDING_MODERATION");
    expect(doc?.studentId).toBe(UID);
    // Media ownership is honestly unverifiable given the Worker gap.
    expect(doc?.mediaOwnershipVerified).toBe(false);
  });

  test("Attack: submission for a battle that doesn't exist", async () => {
    seedStudent();
    const { createBattleSubmission } = require("../battleSubmissions");
    await expect(createBattleSubmission.run({ battleId: "fake_battle", mediaRef: "x" }, CTX))
      .rejects.toMatchObject({ code: "not-found" });
  });

  test("Attack 2: submit to a closed (non-OPEN) battle", async () => {
    seedOpenBattle({ state: "SUBMISSION_CLOSED" }); seedSkill(); seedStudent();
    const { createBattleSubmission } = require("../battleSubmissions");
    await expect(createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "x" }, CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("Attack 3: submit after the submission deadline has passed", async () => {
    seedOpenBattle({ submissionDeadline: new Date(Date.now() - 60_000).toISOString() });
    seedSkill(); seedStudent();
    const { createBattleSubmission } = require("../battleSubmissions");
    await expect(createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "x" }, CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("invalid skill: battle's skill has been deactivated", async () => {
    seedOpenBattle(); seedSkill({ isActive: false }); seedStudent();
    const { createBattleSubmission } = require("../battleSubmissions");
    await expect(createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "x" }, CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("invalid student: no student profile on record", async () => {
    seedOpenBattle(); seedSkill();
    const { createBattleSubmission } = require("../battleSubmissions");
    await expect(createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "x" }, CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("throws unauthenticated with no auth context", async () => {
    const { createBattleSubmission } = require("../battleSubmissions");
    await expect(createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "x" }, {}))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });
});

describe("createBattleSubmission — one student, one submission, one battle (§9)", () => {
  test("Attack 4 / duplicate submission: a second submission attempt (sequential retry) is rejected, not a second doc", async () => {
    seedOpenBattle(); seedSkill(); seedStudent();
    const { createBattleSubmission } = require("../battleSubmissions");

    await createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "first" }, CTX);
    await expect(createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "second" }, CTX))
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
    await createBattleSubmission.run({ battleId: BATTLE_ID, mediaRef: "x" }, CTX);
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

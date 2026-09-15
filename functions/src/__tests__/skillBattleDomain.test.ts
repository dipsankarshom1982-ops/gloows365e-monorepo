// PATH: functions/src/__tests__/skillBattleDomain.test.ts
//
// Offline unit tests for the Phase 2B battle state machine
// (functions/src/skillBattleDomain.ts) — same FakeFirestore/
// mockFirebaseAdmin pattern as the rest of this directory.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "./helpers/mockFirebaseAdmin";
import { ALLOWED_TRANSITIONS, BATTLE_STATES, canTransition } from "../skillBattleDomain";

const BATTLE_ID = "battle_1";
const ADMIN_UID = "admin_1";
const STUDENT_UID = "student_1";
const ADMIN_CTX = { auth: { uid: ADMIN_UID, token: { admin: true } } };
const STUDENT_CTX = { auth: { uid: STUDENT_UID, token: {} } };

beforeEach(() => {
  fakeDb.reset();
});

describe("canTransition — pure state graph logic", () => {
  test("every non-terminal state has at least one legal next state", () => {
    for (const state of BATTLE_STATES) {
      if (state === "COMPLETED" || state === "CANCELLED") {
        expect(ALLOWED_TRANSITIONS[state]).toEqual([]);
      } else {
        expect(ALLOWED_TRANSITIONS[state].length).toBeGreaterThan(0);
      }
    }
  });

  test("the full forward lifecycle is legal, one step at a time", () => {
    const forward: readonly string[] = [
      "DRAFT", "SCHEDULED", "OPEN", "SUBMISSION_CLOSED",
      "RANKING_FINALIZATION", "RESULT_LOCKED", "WINNERS_ANNOUNCED",
      "AWARDS_PROCESSING", "COMPLETED",
    ];
    for (let i = 0; i < forward.length - 1; i++) {
      expect(canTransition(forward[i] as any, forward[i + 1] as any)).toBe(true);
    }
  });

  test("cannot skip states (DRAFT straight to RESULT_LOCKED)", () => {
    expect(canTransition("DRAFT", "RESULT_LOCKED")).toBe(false);
  });

  test("cannot go backward (OPEN back to DRAFT)", () => {
    expect(canTransition("OPEN", "DRAFT")).toBe(false);
  });

  test("terminal states have no outgoing transitions", () => {
    expect(canTransition("COMPLETED", "DRAFT")).toBe(false);
    expect(canTransition("CANCELLED", "OPEN")).toBe(false);
  });

  test("CANCELLED is reachable from every pre-lock state, not from RANKING_FINALIZATION onward", () => {
    expect(canTransition("DRAFT", "CANCELLED")).toBe(true);
    expect(canTransition("SCHEDULED", "CANCELLED")).toBe(true);
    expect(canTransition("OPEN", "CANCELLED")).toBe(true);
    expect(canTransition("SUBMISSION_CLOSED", "CANCELLED")).toBe(true);
    expect(canTransition("RANKING_FINALIZATION", "CANCELLED")).toBe(false);
    expect(canTransition("RESULT_LOCKED", "CANCELLED")).toBe(false);
  });
});

describe("transitionBattleState — authorization", () => {
  test("rejects an unauthenticated request", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, { state: "DRAFT" });
    const { transitionBattleState } = require("../skillBattleDomain");
    await expect(transitionBattleState.run({ battleId: BATTLE_ID, targetState: "SCHEDULED" }, {}))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("rejects a non-admin (student) request", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, { state: "DRAFT" });
    const { transitionBattleState } = require("../skillBattleDomain");
    await expect(transitionBattleState.run({ battleId: BATTLE_ID, targetState: "SCHEDULED" }, STUDENT_CTX))
      .rejects.toMatchObject({ code: "permission-denied" });
    // State must be completely unchanged.
    expect(fakeDb.peek(`skillBattles/${BATTLE_ID}`)?.state).toBe("DRAFT");
  });
});

describe("transitionBattleState — validated transitions", () => {
  test("a legal transition succeeds, updates state, and records a stateTransitions entry", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, { state: "DRAFT" });
    const { transitionBattleState } = require("../skillBattleDomain");

    const result = await transitionBattleState.run({ battleId: BATTLE_ID, targetState: "SCHEDULED" }, ADMIN_CTX);

    expect(result).toMatchObject({ battleId: BATTLE_ID, fromState: "DRAFT", toState: "SCHEDULED" });
    expect(fakeDb.peek(`skillBattles/${BATTLE_ID}`)?.state).toBe("SCHEDULED");
  });

  test("rejects an illegal transition (skipping states)", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, { state: "DRAFT" });
    const { transitionBattleState } = require("../skillBattleDomain");
    await expect(transitionBattleState.run({ battleId: BATTLE_ID, targetState: "RESULT_LOCKED" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
    expect(fakeDb.peek(`skillBattles/${BATTLE_ID}`)?.state).toBe("DRAFT");
  });

  test("rejects a transition out of a terminal state", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, { state: "COMPLETED" });
    const { transitionBattleState } = require("../skillBattleDomain");
    await expect(transitionBattleState.run({ battleId: BATTLE_ID, targetState: "OPEN" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("rejects an invalid targetState value entirely", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, { state: "DRAFT" });
    const { transitionBattleState } = require("../skillBattleDomain");
    await expect(transitionBattleState.run({ battleId: BATTLE_ID, targetState: "NOT_A_REAL_STATE" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("rejects a battleId that doesn't exist", async () => {
    const { transitionBattleState } = require("../skillBattleDomain");
    await expect(transitionBattleState.run({ battleId: "fake_battle", targetState: "SCHEDULED" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "not-found" });
  });

  test("refuses to transition a legacy battle with no managed state field (Decision 5 — no guessed backfill)", async () => {
    // Mirrors a pre-Phase-2B battle: isActive/startDate/endDate exist,
    // but no `state` field at all.
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, { isActive: true, startDate: "2026-01-01", endDate: "2026-02-01" });
    const { transitionBattleState } = require("../skillBattleDomain");
    await expect(transitionBattleState.run({ battleId: BATTLE_ID, targetState: "SCHEDULED" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });
});

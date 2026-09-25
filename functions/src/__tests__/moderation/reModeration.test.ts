// PATH: functions/src/__tests__/moderation/reModeration.test.ts
//
// Offline unit tests for requestReModeration (admin callable) and
// triggerReModerationAfterReport (internal helper reporting.ts calls).

jest.mock("firebase-admin", () => require("../helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "../helpers/mockFirebaseAdmin";

const ADMIN_CTX = { auth: { uid: "admin_1", token: { admin: true } } };
const STUDENT_CTX = { auth: { uid: "student_1", token: {} } };
const ORIGINAL_FETCH = global.fetch;

beforeEach(() => {
  fakeDb.reset();
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, json: async () => null });
});
afterAll(() => { global.fetch = ORIGINAL_FETCH; });

describe("requestReModeration — authorization", () => {
  test("rejects an unauthenticated caller", async () => {
    const { requestReModeration } = require("../../moderation/reModeration");
    await expect(requestReModeration.run({ engine: "canonical", docId: "x" }, {}))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });
  test("rejects a non-admin caller", async () => {
    const { requestReModeration } = require("../../moderation/reModeration");
    await expect(requestReModeration.run({ engine: "canonical", docId: "x" }, STUDENT_CTX))
      .rejects.toMatchObject({ code: "permission-denied" });
  });
  test("rejects an invalid engine value", async () => {
    const { requestReModeration } = require("../../moderation/reModeration");
    await expect(requestReModeration.run({ engine: "made_up", docId: "x" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "invalid-argument" });
  });
});

describe("requestReModeration — preconditions", () => {
  test("rejects a submission that was never processed by Phase C (no streamVideoUid on file)", async () => {
    fakeDb.seed("submissions/battle_1_student_1", { battleId: "battle_1", status: "APPROVED" });
    const { requestReModeration } = require("../../moderation/reModeration");
    await expect(requestReModeration.run({ engine: "canonical", docId: "battle_1_student_1" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });
  test("rejects a docId that doesn't exist", async () => {
    const { requestReModeration } = require("../../moderation/reModeration");
    await expect(requestReModeration.run({ engine: "canonical", docId: "nope" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "not-found" });
  });
});

describe("triggerReModerationAfterReport — cost control (Phase C §19)", () => {
  test("skips a recheck within the cooldown window rather than re-triggering a fresh (billable) provider run", async () => {
    fakeDb.seed("submissions/battle_1_student_1", {
      battleId: "battle_1", status: "PENDING_HUMAN_REVIEW", streamVideoUid: "cfuid1", mediaRef: "https://x/y.m3u8",
      moderationProcessingVersion: 3,
      lastAutomatedModerationAt: { toMillis: () => Date.now() - 1000 }, // 1s ago, well inside the 5min cooldown
    });
    const { triggerReModerationAfterReport } = require("../../moderation/reModeration");
    await triggerReModerationAfterReport("canonical", "battle_1_student_1");
    // Version unchanged — the pipeline never actually ran a second time.
    expect(fakeDb.peek("submissions/battle_1_student_1")?.moderationProcessingVersion).toBe(3);
  });

  test("does re-run once the cooldown has elapsed", async () => {
    fakeDb.seed("submissions/battle_1_student_1", {
      battleId: "battle_1", status: "PENDING_HUMAN_REVIEW", streamVideoUid: "cfuid1", mediaRef: "https://x/y.m3u8",
      moderationProcessingVersion: 3,
      lastAutomatedModerationAt: { toMillis: () => Date.now() - 10 * 60 * 1000 }, // 10 minutes ago
    });
    const { triggerReModerationAfterReport } = require("../../moderation/reModeration");
    await triggerReModerationAfterReport("canonical", "battle_1_student_1");
    expect(fakeDb.peek("submissions/battle_1_student_1")?.moderationProcessingVersion).toBe(4);
  });

  test("never throws — a failure here must not block the report/quarantine flow that called it", async () => {
    const { triggerReModerationAfterReport } = require("../../moderation/reModeration");
    await expect(triggerReModerationAfterReport("canonical", "does_not_exist")).resolves.toBeUndefined();
  });
});

describe("requestReModeration — successful recheck", () => {
  test("re-runs the pipeline and advances moderationProcessingVersion without discarding history", async () => {
    fakeDb.seed("submissions/battle_1_student_1", {
      battleId: "battle_1", status: "APPROVED", streamVideoUid: "cfuid1", mediaRef: "https://x/y.m3u8",
      moderationProcessingVersion: 1, moderationStatus: "APPROVED",
    });
    const { requestReModeration } = require("../../moderation/reModeration");
    const result = await requestReModeration.run({ engine: "canonical", docId: "battle_1_student_1", reason: "provider swap" }, ADMIN_CTX);
    expect(result.ok).toBe(true);
    const doc = fakeDb.peek("submissions/battle_1_student_1");
    expect(doc?.moderationProcessingVersion).toBe(2);
    expect(doc?.status).toBe("APPROVED"); // human decision preserved
    expect(fakeDb.peek("submissions/battle_1_student_1/moderationHistory/v1")).toBeDefined();
  });
});

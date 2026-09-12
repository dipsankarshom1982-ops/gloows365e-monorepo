// PATH: functions/src/__tests__/moderation/moderationQueue.test.ts
//
// Offline unit tests for getModerationQueue — the admin queue's backing
// callable.

jest.mock("firebase-admin", () => require("../helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "../helpers/mockFirebaseAdmin";

const ADMIN_CTX = { auth: { uid: "admin_1", token: { admin: true } } };
const STUDENT_CTX = { auth: { uid: "student_1", token: {} } };

function seedPost(id: string, overrides: Record<string, unknown> = {}) {
  fakeDb.seed(`posts/${id}`, {
    userId: "student_1", battleId: "battle_1", isSkillBattle: true,
    status: "pending", moderationStatus: "PENDING_HUMAN_REVIEW",
    createdAt: { toDate: () => new Date() }, reportCount: 0,
    ...overrides,
  });
}

beforeEach(() => { fakeDb.reset(); });

describe("getModerationQueue — authorization", () => {
  test("rejects an unauthenticated caller", async () => {
    const { getModerationQueue } = require("../../moderation/moderationQueue");
    await expect(getModerationQueue.run({}, {})).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("rejects a non-admin caller", async () => {
    const { getModerationQueue } = require("../../moderation/moderationQueue");
    await expect(getModerationQueue.run({}, STUDENT_CTX)).rejects.toMatchObject({ code: "permission-denied" });
  });
});

describe("getModerationQueue — filters", () => {
  test("pending filter returns only PENDING_HUMAN_REVIEW/PENDING_MODERATION items", async () => {
    seedPost("post_pending", { moderationStatus: "PENDING_HUMAN_REVIEW" });
    seedPost("post_approved", { status: "approved", moderationStatus: "APPROVED" });
    const { getModerationQueue } = require("../../moderation/moderationQueue");
    const result = await getModerationQueue.run({ filter: "pending" }, ADMIN_CTX);
    expect(result.items.map((i: any) => i.contentId)).toEqual(["post_pending"]);
  });

  test("high_risk filter returns only HIGH_RISK items", async () => {
    seedPost("post_high", { moderationRiskLevel: "HIGH_RISK" });
    seedPost("post_low", { moderationRiskLevel: "LOW_RISK" });
    const { getModerationQueue } = require("../../moderation/moderationQueue");
    const result = await getModerationQueue.run({ filter: "high_risk" }, ADMIN_CTX);
    expect(result.items.map((i: any) => i.contentId)).toEqual(["post_high"]);
  });

  test("reported filter returns only items with reportCount > 0", async () => {
    seedPost("post_reported", { reportCount: 2 });
    seedPost("post_clean", { reportCount: 0 });
    const { getModerationQueue } = require("../../moderation/moderationQueue");
    const result = await getModerationQueue.run({ filter: "reported" }, ADMIN_CTX);
    expect(result.items.map((i: any) => i.contentId)).toEqual(["post_reported"]);
  });

  test("duplicate_suspected filter returns only HIGH_SIMILARITY items", async () => {
    seedPost("post_dup", { similarityStatus: "HIGH_SIMILARITY" });
    seedPost("post_unique", { similarityStatus: "NO_MATCH" });
    const { getModerationQueue } = require("../../moderation/moderationQueue");
    const result = await getModerationQueue.run({ filter: "duplicate_suspected" }, ADMIN_CTX);
    expect(result.items.map((i: any) => i.contentId)).toEqual(["post_dup"]);
  });

  test("copyright_flagged filter matches POSSIBLE_MATCH/CONFIRMED_MATCH/LICENSE_INFORMATION_REQUIRED", async () => {
    seedPost("post_match", { copyrightStatus: "CONFIRMED_MATCH" });
    seedPost("post_clean", { copyrightStatus: "NO_MATCH" });
    const { getModerationQueue } = require("../../moderation/moderationQueue");
    const result = await getModerationQueue.run({ filter: "copyright_flagged" }, ADMIN_CTX);
    expect(result.items.map((i: any) => i.contentId)).toEqual(["post_match"]);
  });
});

describe("getModerationQueue — never exposes unnecessary private student data", () => {
  test("item shape carries only studentUid/studentName, no phone/email/location", async () => {
    seedPost("post_1", { userId: "student_1", name: "Test Student" });
    const { getModerationQueue } = require("../../moderation/moderationQueue");
    const result = await getModerationQueue.run({ filter: "pending" }, ADMIN_CTX);
    const item = result.items[0];
    expect(item).not.toHaveProperty("phone");
    expect(item).not.toHaveProperty("email");
    expect(item).not.toHaveProperty("location");
  });
});

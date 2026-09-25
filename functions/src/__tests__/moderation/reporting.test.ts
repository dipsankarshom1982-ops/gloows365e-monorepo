// PATH: functions/src/__tests__/moderation/reporting.test.ts
//
// Offline unit tests for the Skill Battle user-reporting system
// (reportSkillBattleContent / resolveSkillBattleReport).

jest.mock("firebase-admin", () => require("../helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "../helpers/mockFirebaseAdmin";

const OWNER_UID = "owner_1";
const REPORTER_UID = "reporter_1";
const ADMIN_CTX = { auth: { uid: "admin_1", token: { admin: true } } };
const REPORTER_CTX = { auth: { uid: REPORTER_UID, token: {} } };

function seedApprovedPost(id = "post_1") {
  fakeDb.seed(`posts/${id}`, { userId: OWNER_UID, battleId: "battle_1", isSkillBattle: true, status: "approved", reportCount: 0 });
  return id;
}

beforeEach(() => { fakeDb.reset(); });

describe("reportSkillBattleContent — validation & authorization", () => {
  test("rejects an unauthenticated report", async () => {
    const { reportSkillBattleContent } = require("../../moderation/reporting");
    await expect(reportSkillBattleContent.run({ contentType: "post", contentId: "x", battleId: "b", category: "spam" }, {}))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("rejects an invalid category", async () => {
    const postId = seedApprovedPost();
    const { reportSkillBattleContent } = require("../../moderation/reporting");
    await expect(reportSkillBattleContent.run({ contentType: "post", contentId: postId, battleId: "battle_1", category: "not_a_real_category" }, REPORTER_CTX))
      .rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("rejects reporting content that doesn't exist", async () => {
    const { reportSkillBattleContent } = require("../../moderation/reporting");
    await expect(reportSkillBattleContent.run({ contentType: "post", contentId: "nope", battleId: "battle_1", category: "spam" }, REPORTER_CTX))
      .rejects.toMatchObject({ code: "not-found" });
  });
});

describe("reportSkillBattleContent — happy path & duplicate prevention", () => {
  test("a valid report is filed and increments the content's reportCount", async () => {
    const postId = seedApprovedPost();
    const { reportSkillBattleContent } = require("../../moderation/reporting");
    const result = await reportSkillBattleContent.run({ contentType: "post", contentId: postId, battleId: "battle_1", category: "spam", note: "looks like spam" }, REPORTER_CTX);
    expect(result.reportId).toBeTruthy();
    expect(fakeDb.peek(`posts/${postId}`)?.reportCount).toBe(1);
    const report = fakeDb.peek(`skillBattleReports/${result.reportId}`);
    expect(report?.status).toBe("OPEN");
    expect(report?.reporterUid).toBe(REPORTER_UID);
    expect(report?.reportedUid).toBe(OWNER_UID);
  });

  test("the same reporter cannot file a second report on the same content", async () => {
    const postId = seedApprovedPost();
    const { reportSkillBattleContent } = require("../../moderation/reporting");
    await reportSkillBattleContent.run({ contentType: "post", contentId: postId, battleId: "battle_1", category: "spam" }, REPORTER_CTX);
    await expect(reportSkillBattleContent.run({ contentType: "post", contentId: postId, battleId: "battle_1", category: "other" }, REPORTER_CTX))
      .rejects.toMatchObject({ code: "already-exists" });
    // Not double-counted.
    expect(fakeDb.peek(`posts/${postId}`)?.reportCount).toBe(1);
  });

  test("two different reporters on the same content both succeed, count reflects both", async () => {
    const postId = seedApprovedPost();
    const { reportSkillBattleContent } = require("../../moderation/reporting");
    await reportSkillBattleContent.run({ contentType: "post", contentId: postId, battleId: "battle_1", category: "spam" }, REPORTER_CTX);
    await reportSkillBattleContent.run({ contentType: "post", contentId: postId, battleId: "battle_1", category: "copyright" }, { auth: { uid: "reporter_2", token: {} } });
    expect(fakeDb.peek(`posts/${postId}`)?.reportCount).toBe(2);
  });
});

describe("reportSkillBattleContent — severe-category immediate quarantine", () => {
  test("a harassment report on an approved post pulls it back to pending, without deleting it", async () => {
    const postId = seedApprovedPost();
    const { reportSkillBattleContent } = require("../../moderation/reporting");
    const result = await reportSkillBattleContent.run({ contentType: "post", contentId: postId, battleId: "battle_1", category: "harassment" }, REPORTER_CTX);
    expect(result.quarantined).toBe(true);
    const post = fakeDb.peek(`posts/${postId}`);
    expect(post?.status).toBe("pending");
    expect(post?.moderationStatus).toBe("PENDING_HUMAN_REVIEW");
    // The post still exists — quarantine is not deletion.
    expect(post).toBeDefined();
  });

  test("a non-severe category (spam) does NOT quarantine an approved post", async () => {
    const postId = seedApprovedPost();
    const { reportSkillBattleContent } = require("../../moderation/reporting");
    const result = await reportSkillBattleContent.run({ contentType: "post", contentId: postId, battleId: "battle_1", category: "spam" }, REPORTER_CTX);
    expect(result.quarantined).toBe(false);
    expect(fakeDb.peek(`posts/${postId}`)?.status).toBe("approved");
  });
});

describe("resolveSkillBattleReport — moderator-only", () => {
  async function fileReport() {
    const postId = seedApprovedPost();
    const { reportSkillBattleContent } = require("../../moderation/reporting");
    const result = await reportSkillBattleContent.run({ contentType: "post", contentId: postId, battleId: "battle_1", category: "spam" }, REPORTER_CTX);
    return result.reportId as string;
  }

  test("rejects a non-admin resolving a report, including the reporter themselves", async () => {
    const reportId = await fileReport();
    const { resolveSkillBattleReport } = require("../../moderation/reporting");
    await expect(resolveSkillBattleReport.run({ reportId, resolution: "NO_ACTION" }, REPORTER_CTX))
      .rejects.toMatchObject({ code: "permission-denied" });
  });

  test("admin can resolve an open report", async () => {
    const reportId = await fileReport();
    const { resolveSkillBattleReport } = require("../../moderation/reporting");
    const result = await resolveSkillBattleReport.run({ reportId, resolution: "NO_ACTION", note: "checked, fine" }, ADMIN_CTX);
    expect(result.ok).toBe(true);
    const report = fakeDb.peek(`skillBattleReports/${reportId}`);
    expect(report?.status).toBe("RESOLVED");
    expect(report?.resolvedBy).toBe("admin_1");
  });

  test("cannot resolve an already-resolved report twice", async () => {
    const reportId = await fileReport();
    const { resolveSkillBattleReport } = require("../../moderation/reporting");
    await resolveSkillBattleReport.run({ reportId, resolution: "NO_ACTION" }, ADMIN_CTX);
    await expect(resolveSkillBattleReport.run({ reportId, resolution: "NO_ACTION" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("rejects an invalid resolution value", async () => {
    const reportId = await fileReport();
    const { resolveSkillBattleReport } = require("../../moderation/reporting");
    await expect(resolveSkillBattleReport.run({ reportId, resolution: "MADE_UP" as any }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "invalid-argument" });
  });
});

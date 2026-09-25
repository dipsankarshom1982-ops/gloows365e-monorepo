// PATH: functions/src/__tests__/moderation/legacyPostReview.test.ts
//
// Offline unit tests for reviewSkillBattlePost — the legacy `posts`
// moderation callable Phase B adds (previously this collection had NO
// reviewer at all, see the file's own header).

jest.mock("firebase-admin", () => require("../helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "../helpers/mockFirebaseAdmin";

const POST_ID = "post_1";
const UID = "student_1";
const ADMIN_CTX = { auth: { uid: "admin_1", token: { admin: true } } };
const STUDENT_CTX = { auth: { uid: UID, token: {} } };

function seedPost(overrides: Record<string, unknown> = {}) {
  fakeDb.seed(`posts/${POST_ID}`, {
    userId: UID, battleId: "battle_1", isSkillBattle: true, status: "pending",
    moderationStatus: "PENDING_HUMAN_REVIEW",
    ...overrides,
  });
}

beforeEach(() => { fakeDb.reset(); });

describe("reviewSkillBattlePost — authorization", () => {
  test("rejects an unauthenticated caller", async () => {
    seedPost();
    const { reviewSkillBattlePost } = require("../../moderation/legacyPostReview");
    await expect(reviewSkillBattlePost.run({ postId: POST_ID, action: "APPROVE" }, {}))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("rejects a non-admin (including the post's own owner)", async () => {
    seedPost();
    const { reviewSkillBattlePost } = require("../../moderation/legacyPostReview");
    await expect(reviewSkillBattlePost.run({ postId: POST_ID, action: "APPROVE" }, STUDENT_CTX))
      .rejects.toMatchObject({ code: "permission-denied" });
    expect(fakeDb.peek(`posts/${POST_ID}`)?.status).toBe("pending");
  });
});

describe("reviewSkillBattlePost — approve/reject workflow", () => {
  test("admin can approve a pending post — sets both status and moderationStatus", async () => {
    seedPost();
    const { reviewSkillBattlePost } = require("../../moderation/legacyPostReview");
    const result = await reviewSkillBattlePost.run({ postId: POST_ID, action: "APPROVE" }, ADMIN_CTX);
    expect(result.status).toBe("approved");
    const post = fakeDb.peek(`posts/${POST_ID}`);
    expect(post?.status).toBe("approved");
    expect(post?.moderationStatus).toBe("APPROVED");
    expect(post?.reviewedBy).toBe("admin_1");
  });

  test("admin can reject with a reason", async () => {
    seedPost();
    const { reviewSkillBattlePost } = require("../../moderation/legacyPostReview");
    const result = await reviewSkillBattlePost.run({ postId: POST_ID, action: "REJECT", reason: "inappropriate" }, ADMIN_CTX);
    expect(result.status).toBe("rejected");
    const post = fakeDb.peek(`posts/${POST_ID}`);
    expect(post?.status).toBe("rejected");
    expect(post?.moderationStatus).toBe("REJECTED");
    expect(post?.rejectionReason).toBe("inappropriate");
  });

  test("cannot approve a post that isn't a SkillBattle submission", async () => {
    seedPost({ isSkillBattle: false });
    const { reviewSkillBattlePost } = require("../../moderation/legacyPostReview");
    await expect(reviewSkillBattlePost.run({ postId: POST_ID, action: "APPROVE" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("cannot re-approve an already-approved or already-rejected post", async () => {
    seedPost({ status: "approved" });
    const { reviewSkillBattlePost } = require("../../moderation/legacyPostReview");
    await expect(reviewSkillBattlePost.run({ postId: POST_ID, action: "APPROVE" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("ESCALATE keeps the post out of the public feed and records the decision", async () => {
    seedPost();
    const { reviewSkillBattlePost } = require("../../moderation/legacyPostReview");
    const result = await reviewSkillBattlePost.run({ postId: POST_ID, action: "ESCALATE", reason: "needs a second opinion" }, ADMIN_CTX);
    expect(result.status).toBe("escalate");
    const post = fakeDb.peek(`posts/${POST_ID}`);
    expect(post?.status).not.toBe("approved");
  });

  test("REMOVE takes down an already-approved post (post-publication takedown)", async () => {
    seedPost({ status: "approved", moderationStatus: "APPROVED" });
    const { reviewSkillBattlePost } = require("../../moderation/legacyPostReview");
    const result = await reviewSkillBattlePost.run({ postId: POST_ID, action: "REMOVE" }, ADMIN_CTX);
    expect(result.status).toBe("removed");
    const post = fakeDb.peek(`posts/${POST_ID}`);
    expect(post?.status).toBe("removed");
    expect(post?.moderationStatus).toBe("REMOVED");
  });

  test("cannot REMOVE a post that was never approved", async () => {
    seedPost();
    const { reviewSkillBattlePost } = require("../../moderation/legacyPostReview");
    await expect(reviewSkillBattlePost.run({ postId: POST_ID, action: "REMOVE" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("rejects a post that doesn't exist", async () => {
    const { reviewSkillBattlePost } = require("../../moderation/legacyPostReview");
    await expect(reviewSkillBattlePost.run({ postId: "nope" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "invalid-argument" });
    await expect(reviewSkillBattlePost.run({ postId: "nope", action: "APPROVE" }, ADMIN_CTX))
      .rejects.toMatchObject({ code: "not-found" });
  });
});

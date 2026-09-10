// PATH: functions/src/__tests__/skillBattleSubmission.test.ts
//
// Offline unit tests for the SkillBattle submission trust-boundary fix
// (SB-P0-02/SB-P1-03) — same FakeFirestore/mockFirebaseAdmin pattern as
// the rest of this directory. Covers: forced-safe-initial-state fields,
// per-battle submission cap enforced server-side (not just the client's
// pre-flight check), and the battle-window checks (not started / ended /
// inactive).

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "./helpers/mockFirebaseAdmin";

const BATTLE_ID = "battle_1";
const UID       = "student_1";
const CTX       = { auth: { uid: UID } };

const LIVE_BATTLE = {
  isActive: true,
  startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  endDate:   new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

function seedStudent() {
  fakeDb.seed(`students/${UID}`, {
    name: "Test Student", school: "Test School", class: "8", profilePic: "",
    preferredLanguage: "English",
    location: { city: "Pune", district: "Pune", state: "MH", pincode: "411001" },
  });
}

const basePayload = {
  battleId: BATTLE_ID, battleTitle: "Test Battle", battleType: "sponsored", month: "2026-08",
  caption: "my reel", mediaUrl: "https://example.com/v.m3u8", thumbnail: "",
};

beforeEach(() => {
  fakeDb.reset();
});

describe("submitSkillBattleReel — forced safe initial state (SB-P0-02)", () => {
  test("creates a post with status:pending and zeroed engagement, regardless of what's asked for", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, LIVE_BATTLE);
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");

    const result = await submitSkillBattleReel.run(basePayload, CTX);
    const post = fakeDb.peek(`posts/${result.postId}`);

    expect(post?.status).toBe("pending");
    expect(post?.likes).toBe(0);
    expect(post?.views).toBe(0);
    expect(post?.isSkillBattle).toBe(true);
    expect(post?.userId).toBe(UID);
    // There's nowhere in the input type to even pass status/likes/etc —
    // this asserts the function doesn't silently accept extra properties
    // on the input object and pass them through either.
    const result2 = await submitSkillBattleReel.run(
      { ...basePayload, status: "approved", likes: 999999 } as any, CTX
    );
    const post2 = fakeDb.peek(`posts/${result2.postId}`);
    expect(post2?.status).toBe("pending");
    expect(post2?.likes).toBe(0);
  });

  test("rejects a submission with no mediaUrl", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, LIVE_BATTLE);
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");
    await expect(submitSkillBattleReel.run({ ...basePayload, mediaUrl: undefined }, CTX))
      .rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("rejects an unauthenticated request", async () => {
    const { submitSkillBattleReel } = require("../skillBattleSubmission");
    await expect(submitSkillBattleReel.run(basePayload, {}))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });
});

describe("submitSkillBattleReel — battle window enforced server-side", () => {
  test("rejects a submission to a battle that hasn't started yet", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, { ...LIVE_BATTLE, startDate: new Date(Date.now() + 60_000).toISOString() });
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");
    await expect(submitSkillBattleReel.run(basePayload, CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("rejects a submission to a battle that has already ended", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, { ...LIVE_BATTLE, endDate: new Date(Date.now() - 60_000).toISOString() });
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");
    await expect(submitSkillBattleReel.run(basePayload, CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("rejects a submission to an inactive battle", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, { ...LIVE_BATTLE, isActive: false });
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");
    await expect(submitSkillBattleReel.run(basePayload, CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("rejects a submission to a battleId that doesn't exist", async () => {
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");
    await expect(submitSkillBattleReel.run({ ...basePayload, battleId: "fake_battle" }, CTX))
      .rejects.toMatchObject({ code: "not-found" });
  });
});

describe("submitSkillBattleReel — per-battle submission cap, server-enforced (SB-P1-03)", () => {
  test("allows up to 4 non-rejected submissions, then rejects the 5th", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, LIVE_BATTLE);
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");

    for (let i = 0; i < 4; i++) {
      await expect(submitSkillBattleReel.run(basePayload, CTX)).resolves.toHaveProperty("postId");
    }
    await expect(submitSkillBattleReel.run(basePayload, CTX))
      .rejects.toMatchObject({ code: "resource-exhausted" });
  });

  test("rejected submissions don't count against the cap", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, LIVE_BATTLE);
    seedStudent();
    // Seed 4 already-rejected posts directly — none of these should count.
    for (let i = 0; i < 4; i++) {
      fakeDb.seed(`posts/rejected_${i}`, { userId: UID, battleId: BATTLE_ID, status: "rejected" });
    }
    const { submitSkillBattleReel } = require("../skillBattleSubmission");
    await expect(submitSkillBattleReel.run(basePayload, CTX)).resolves.toHaveProperty("postId");
  });

  test("the cap is per-battle, per-student — a different battle isn't affected", async () => {
    const OTHER_BATTLE = "battle_2";
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, LIVE_BATTLE);
    fakeDb.seed(`skillBattles/${OTHER_BATTLE}`, LIVE_BATTLE);
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");

    for (let i = 0; i < 4; i++) {
      await submitSkillBattleReel.run(basePayload, CTX);
    }
    await expect(submitSkillBattleReel.run({ ...basePayload, battleId: OTHER_BATTLE }, CTX))
      .resolves.toHaveProperty("postId");
  });
});

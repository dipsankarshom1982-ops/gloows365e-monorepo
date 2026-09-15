// PATH: functions/src/__tests__/skillBattleSubmission.test.ts
//
// Offline unit tests for the SkillBattle submission trust-boundary fix
// (SB-P0-02/SB-P1-03) — same FakeFirestore/mockFirebaseAdmin pattern as
// the rest of this directory. Covers: forced-safe-initial-state fields,
// per-battle submission cap enforced server-side (not just the client's
// pre-flight check), and the battle-window checks (not started / ended /
// inactive).
//
// 2026-09-11 audit P0 fix: submitSkillBattleReel now requires a valid
// media-ownership token (see ../mediaOwnership.ts) — makeBasePayload()
// mints ONE FRESH TO NOW token every time it's called (never a
// module-level constant reused across the whole file) so every
// pre-existing test below still exercises the SAME battle-window/cap
// behavior it always did. This matters in this offline suite because
// this environment can take many minutes to run the full file — a
// token minted once at module-load and reused by the LAST test in the
// file could otherwise legitimately expire before that test runs,
// which is a test-timing artifact, not a real product bug (in
// production the token is minted and consumed within one request, not
// minutes apart). A dedicated describe block below covers the ownership
// check itself.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "./helpers/mockFirebaseAdmin";
import { mintMediaOwnershipToken, TEST_OWNERSHIP_SECRET } from "./helpers/mediaOwnershipTestHelper";

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

// Real Cloudflare playback URLs embed the video uid as a path segment
// (see lib/cloudflareStream.ts's streamPlaybackUrl) — mirrored here so
// the ownership check's "videoUid must appear in mediaUrl" rule has
// something realistic to match against.
const VIDEO_UID = "cfvid1234567890abcdef1234567890ab";
const MEDIA_URL = `https://example.com/${VIDEO_UID}/v.m3u8`;

function tokenFor(mediaUrl: string, uid = UID) {
  const match = mediaUrl.match(/([a-zA-Z0-9]{16,})/);
  return mintMediaOwnershipToken({ uid, videoUid: match ? match[1] : mediaUrl });
}

// A fresh payload (fresh ownershipToken included) every call — see this
// file's header on why the token must never be baked into a shared
// module-level constant here.
function makeBasePayload() {
  return {
    battleId: BATTLE_ID, battleTitle: "Test Battle", battleType: "sponsored", month: "2026-08",
    caption: "my reel", mediaUrl: MEDIA_URL, thumbnail: "",
    ownershipToken: tokenFor(MEDIA_URL),
  };
}

beforeEach(() => {
  fakeDb.reset();
  process.env["WORKER_OWNERSHIP_SECRET"] = TEST_OWNERSHIP_SECRET;
});

describe("submitSkillBattleReel — forced safe initial state (SB-P0-02)", () => {
  test("creates a post with status:pending and zeroed engagement, regardless of what's asked for", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, LIVE_BATTLE);
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");

    const result = await submitSkillBattleReel.run(makeBasePayload(), CTX);
    const post = fakeDb.peek(`posts/${result.postId}`);

    expect(post?.status).toBe("pending");
    expect(post?.likes).toBe(0);
    expect(post?.views).toBe(0);
    expect(post?.isSkillBattle).toBe(true);
    expect(post?.userId).toBe(UID);
    // Media ownership is now genuinely verified — the fresh token above
    // proved it, so this is real, not a hardcoded/assumed value.
    expect(post?.mediaOwnershipVerified).toBe(true);
    // Video moderation/copyright pipeline (Phase A) — added ALONGSIDE the
    // existing `status` field (unchanged, still "pending"), never
    // replacing it. No automated provider is configured, so the decision
    // engine's fail-closed default routes every submission to human
    // review. See moderation/decisionEngine.ts.
    expect(post?.moderationStatus).toBe("PENDING_HUMAN_REVIEW");
    expect(post?.copyrightStatus).toBe("NOT_CONFIGURED");
    expect(post?.similarityStatus).toBe("NOT_CHECKED");
    expect(post?.winnerStatus).toBe("NOT_APPLICABLE");
    expect(post?.prizeStatus).toBe("NOT_APPLICABLE");
    // There's nowhere in the input type to even pass status/likes/etc —
    // this asserts the function doesn't silently accept extra properties
    // on the input object and pass them through either.
    const result2 = await submitSkillBattleReel.run(
      { ...makeBasePayload(), status: "approved", likes: 999999 } as any, CTX
    );
    const post2 = fakeDb.peek(`posts/${result2.postId}`);
    expect(post2?.status).toBe("pending");
    expect(post2?.likes).toBe(0);
  });

  test("rejects a submission with no mediaUrl", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, LIVE_BATTLE);
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");
    await expect(submitSkillBattleReel.run({ ...makeBasePayload(), mediaUrl: undefined }, CTX))
      .rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("rejects an unauthenticated request", async () => {
    const { submitSkillBattleReel } = require("../skillBattleSubmission");
    await expect(submitSkillBattleReel.run(makeBasePayload(), {}))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });
});

describe("submitSkillBattleReel — battle window enforced server-side", () => {
  test("rejects a submission to a battle that hasn't started yet", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, { ...LIVE_BATTLE, startDate: new Date(Date.now() + 60_000).toISOString() });
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");
    await expect(submitSkillBattleReel.run(makeBasePayload(), CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("rejects a submission to a battle that has already ended", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, { ...LIVE_BATTLE, endDate: new Date(Date.now() - 60_000).toISOString() });
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");
    await expect(submitSkillBattleReel.run(makeBasePayload(), CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("rejects a submission to an inactive battle", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, { ...LIVE_BATTLE, isActive: false });
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");
    await expect(submitSkillBattleReel.run(makeBasePayload(), CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("rejects a submission to a battleId that doesn't exist", async () => {
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");
    await expect(submitSkillBattleReel.run({ ...makeBasePayload(), battleId: "fake_battle" }, CTX))
      .rejects.toMatchObject({ code: "not-found" });
  });
});

describe("submitSkillBattleReel — per-battle submission cap, server-enforced (SB-P1-03)", () => {
  test("allows up to 4 non-rejected submissions, then rejects the 5th", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, LIVE_BATTLE);
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");

    for (let i = 0; i < 4; i++) {
      await expect(submitSkillBattleReel.run(makeBasePayload(), CTX)).resolves.toHaveProperty("postId");
    }
    await expect(submitSkillBattleReel.run(makeBasePayload(), CTX))
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
    await expect(submitSkillBattleReel.run(makeBasePayload(), CTX)).resolves.toHaveProperty("postId");
  });

  test("the cap is per-battle, per-student — a different battle isn't affected", async () => {
    const OTHER_BATTLE = "battle_2";
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, LIVE_BATTLE);
    fakeDb.seed(`skillBattles/${OTHER_BATTLE}`, LIVE_BATTLE);
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");

    for (let i = 0; i < 4; i++) {
      await submitSkillBattleReel.run(makeBasePayload(), CTX);
    }
    await expect(submitSkillBattleReel.run({ ...makeBasePayload(), battleId: OTHER_BATTLE }, CTX))
      .resolves.toHaveProperty("postId");
  });
});

describe("submitSkillBattleReel — media ownership (2026-09-11 audit P0 fix)", () => {
  test("Attack A: missing ownershipToken is rejected", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, LIVE_BATTLE);
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");
    const noToken: Record<string, unknown> = { ...makeBasePayload() };
    delete noToken.ownershipToken;
    await expect(submitSkillBattleReel.run(noToken as any, CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("Attack C: a token minted for a different uid is rejected", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, LIVE_BATTLE);
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");
    const forgedToken = tokenFor(MEDIA_URL, "someone_else");
    await expect(submitSkillBattleReel.run({ ...makeBasePayload(), ownershipToken: forgedToken }, CTX))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("Attack D: User B cannot submit User A's mediaUrl as their own", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, LIVE_BATTLE);
    fakeDb.seed("students/student_a", { name: "Student A", class: "8", location: {} });
    fakeDb.seed("students/student_b", { name: "Student B", class: "8", location: {} });
    const { submitSkillBattleReel } = require("../skillBattleSubmission");

    const videoAUrl = `https://example.com/${VIDEO_UID}/a.m3u8`;
    const tokenA = tokenFor(videoAUrl, "student_a");
    await submitSkillBattleReel.run(
      { ...makeBasePayload(), mediaUrl: videoAUrl, ownershipToken: tokenA },
      { auth: { uid: "student_a" } }
    );

    // Student B tries to reuse student A's token/mediaUrl as their own.
    await expect(
      submitSkillBattleReel.run(
        { ...makeBasePayload(), mediaUrl: videoAUrl, ownershipToken: tokenA },
        { auth: { uid: "student_b" } }
      )
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("a mediaUrl that doesn't match the token's videoUid is rejected (tampered request)", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, LIVE_BATTLE);
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");
    // Valid token for MEDIA_URL, but the request claims a different video.
    await expect(
      submitSkillBattleReel.run(
        { ...makeBasePayload(), mediaUrl: "https://example.com/someOtherVideoUidHere/x.m3u8" },
        CTX
      )
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });
});

describe("submitSkillBattleReel — originality declaration (video moderation pipeline, Phase A)", () => {
  test("omitted entirely is recorded honestly as not accepted, not rejected (pre-Phase-B mobile compatibility)", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, LIVE_BATTLE);
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");
    const result = await submitSkillBattleReel.run(makeBasePayload(), CTX);
    const post = fakeDb.peek(`posts/${result.postId}`);
    expect(post?.declarationAccepted).toBe(false);
    expect(post?.declarationVersion).toBeNull();
  });

  test("a present but invalid value is rejected outright", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, LIVE_BATTLE);
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");
    await expect(submitSkillBattleReel.run(
      { ...makeBasePayload(), declarationAccepted: false, declarationVersion: "v1" }, CTX
    )).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(submitSkillBattleReel.run(
      { ...makeBasePayload(), declarationAccepted: true, declarationVersion: "tampered" }, CTX
    )).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("correctly accepted is recorded with a server-stamped timestamp", async () => {
    fakeDb.seed(`skillBattles/${BATTLE_ID}`, LIVE_BATTLE);
    seedStudent();
    const { submitSkillBattleReel } = require("../skillBattleSubmission");
    const result = await submitSkillBattleReel.run(
      { ...makeBasePayload(), declarationAccepted: true, declarationVersion: "v1" }, CTX
    );
    const post = fakeDb.peek(`posts/${result.postId}`);
    expect(post?.declarationAccepted).toBe(true);
    expect(post?.declarationVersion).toBe("v1");
    expect(post?.declarationAcceptedAt).toBeTruthy();
  });
});

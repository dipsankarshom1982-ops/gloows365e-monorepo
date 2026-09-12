// PATH: functions/src/__tests__/moderation/streamWebhook.test.ts
//
// Offline integration-style test for handleCloudflareStreamWebhook — a
// v1 onRequest export, directly callable as (req, res) with no `.run()`
// shim (confirmed against firebase-functions v1's own source: the
// exported cloudFunction is a plain (req,res)=>... value, same shape as
// the v2 pattern razorpayWebhook.test.ts already uses in this repo).

jest.mock("firebase-admin", () => require("../helpers/mockFirebaseAdmin").mockAdminModule);

import * as crypto from "crypto";
import { fakeDb } from "../helpers/mockFirebaseAdmin";

const WEBHOOK_SECRET = "test_stream_webhook_secret";
const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

function signedReq(body: unknown, opts: { badSig?: boolean; noSig?: boolean } = {}) {
  const rawBody = Buffer.from(JSON.stringify(body));
  const time = Math.floor(Date.now() / 1000).toString();
  const sig1 = opts.badSig
    ? "0".repeat(64)
    : crypto.createHmac("sha256", WEBHOOK_SECRET).update(`${time}.${rawBody.toString("utf8")}`).digest("hex");
  const header = opts.noSig ? undefined : `time=${time},sig1=${sig1}`;
  return {
    rawBody,
    get: (name: string) => (name === "Webhook-Signature" ? header : undefined),
  };
}

function makeRes() {
  const res: { status: jest.Mock; send: jest.Mock } = { status: jest.fn(), send: jest.fn() };
  res.status.mockImplementation(() => res);
  res.send.mockImplementation(() => res);
  return res;
}

beforeEach(() => {
  fakeDb.reset();
  process.env = { ...ORIGINAL_ENV, CLOUDFLARE_STREAM_WEBHOOK_SECRET: WEBHOOK_SECRET, CLOUDFLARE_ACCOUNT_ID: "acct1", CLOUDFLARE_API_TOKEN: "tok1" };
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, json: async () => null }); // default: audio download unavailable
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
  global.fetch = ORIGINAL_FETCH;
});

describe("handleCloudflareStreamWebhook — signature verification (security)", () => {
  test("rejects a request with no signature header", async () => {
    const { handleCloudflareStreamWebhook } = require("../../moderation/streamWebhook");
    const req = signedReq({ uid: "cfuid1" }, { noSig: true });
    const res = makeRes();
    await handleCloudflareStreamWebhook(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("rejects a forged/incorrect signature", async () => {
    const { handleCloudflareStreamWebhook } = require("../../moderation/streamWebhook");
    const req = signedReq({ uid: "cfuid1" }, { badSig: true });
    const res = makeRes();
    await handleCloudflareStreamWebhook(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("500s fail-closed when the secret itself isn't configured, never accepting unverified requests", async () => {
    delete process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
    const { handleCloudflareStreamWebhook } = require("../../moderation/streamWebhook");
    const req = signedReq({ uid: "cfuid1" });
    const res = makeRes();
    await handleCloudflareStreamWebhook(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("handleCloudflareStreamWebhook — lookup & lifecycle", () => {
  test("a uid with no matching submission is a safe no-op (200)", async () => {
    const { handleCloudflareStreamWebhook } = require("../../moderation/streamWebhook");
    const req = signedReq({ uid: "cfuid_unknown", readyToStream: true, status: { state: "ready" } });
    const res = makeRes();
    await handleCloudflareStreamWebhook(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("a video still processing (not ready) is a no-op, does not run any checks", async () => {
    fakeDb.seed("submissions/battle_1_student_1", { battleId: "battle_1", streamVideoUid: "cfuid1", status: "PENDING_HUMAN_REVIEW" });
    const { handleCloudflareStreamWebhook } = require("../../moderation/streamWebhook");
    const req = signedReq({ uid: "cfuid1", readyToStream: false, status: { state: "inprogress" } });
    const res = makeRes();
    await handleCloudflareStreamWebhook(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(fakeDb.peek("submissions/battle_1_student_1")?.moderationProcessingVersion).toBeUndefined();
  });

  test("a video error state is recorded as an honest failure reason, not silently dropped", async () => {
    fakeDb.seed("submissions/battle_1_student_1", { battleId: "battle_1", streamVideoUid: "cfuid1", status: "PENDING_HUMAN_REVIEW" });
    const { handleCloudflareStreamWebhook } = require("../../moderation/streamWebhook");
    const req = signedReq({ uid: "cfuid1", readyToStream: false, status: { state: "error", errReasonCode: "ERR_NON_VIDEO" } });
    const res = makeRes();
    await handleCloudflareStreamWebhook(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(200);
    const doc = fakeDb.peek("submissions/battle_1_student_1") as any;
    expect(doc?.moderationReasons?.[0]).toContain("ERR_NON_VIDEO");
  });

  test("a ready video runs the pipeline and advances moderationProcessingVersion", async () => {
    fakeDb.seed("submissions/battle_1_student_1", {
      battleId: "battle_1", streamVideoUid: "cfuid1", status: "PENDING_HUMAN_REVIEW", mediaRef: "https://x/y.m3u8",
      moderationProcessingVersion: 0,
    });
    const { handleCloudflareStreamWebhook } = require("../../moderation/streamWebhook");
    const req = signedReq({ uid: "cfuid1", readyToStream: true, status: { state: "ready" }, modified: "2026-01-01T00:00:00Z" });
    const res = makeRes();
    await handleCloudflareStreamWebhook(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(200);
    const doc = fakeDb.peek("submissions/battle_1_student_1");
    expect(doc?.moderationProcessingVersion).toBe(1);
    // No history to snapshot on the very first run (previousVersion was 0).
    expect(fakeDb.peek("submissions/battle_1_student_1/moderationHistory/v0")).toBeUndefined();
  });

  test("idempotency: a replayed webhook with the same uid+modified is a no-op the second time", async () => {
    fakeDb.seed("submissions/battle_1_student_1", {
      battleId: "battle_1", streamVideoUid: "cfuid1", status: "PENDING_HUMAN_REVIEW", mediaRef: "https://x/y.m3u8",
    });
    const { handleCloudflareStreamWebhook } = require("../../moderation/streamWebhook");
    const payload = { uid: "cfuid1", readyToStream: true, status: { state: "ready" }, modified: "2026-01-01T00:00:00Z" };

    await handleCloudflareStreamWebhook(signedReq(payload) as any, makeRes() as any);
    const versionAfterFirst = fakeDb.peek("submissions/battle_1_student_1")?.moderationProcessingVersion;

    const res2 = makeRes();
    await handleCloudflareStreamWebhook(signedReq(payload) as any, res2 as any);
    expect(res2.status).toHaveBeenCalledWith(200);
    expect(fakeDb.peek("submissions/battle_1_student_1")?.moderationProcessingVersion).toBe(versionAfterFirst); // unchanged
  });

  test("§7: a late automated result never overwrites a human moderator's decision", async () => {
    fakeDb.seed("submissions/battle_1_student_1", {
      battleId: "battle_1", streamVideoUid: "cfuid1", status: "REJECTED", mediaRef: "https://x/y.m3u8",
      moderationProcessingVersion: 0,
    });
    const { handleCloudflareStreamWebhook } = require("../../moderation/streamWebhook");
    const req = signedReq({ uid: "cfuid1", readyToStream: true, status: { state: "ready" } });
    const res = makeRes();
    await handleCloudflareStreamWebhook(req as any, res as any);
    // status stays REJECTED — the moderator's decision is preserved —
    // even though new automated data was stored underneath it.
    expect(fakeDb.peek("submissions/battle_1_student_1")?.status).toBe("REJECTED");
  });

  test("engine detection: also matches legacy posts by streamVideoUid", async () => {
    fakeDb.seed("posts/legacy_post_1", {
      battleId: "battle_1", streamVideoUid: "cfuid_legacy", isSkillBattle: true, status: "pending", mediaUrl: "https://x/y.m3u8",
    });
    const { handleCloudflareStreamWebhook } = require("../../moderation/streamWebhook");
    const req = signedReq({ uid: "cfuid_legacy", readyToStream: true, status: { state: "ready" } });
    const res = makeRes();
    await handleCloudflareStreamWebhook(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(fakeDb.peek("posts/legacy_post_1")?.moderationProcessingVersion).toBe(1);
  });
});

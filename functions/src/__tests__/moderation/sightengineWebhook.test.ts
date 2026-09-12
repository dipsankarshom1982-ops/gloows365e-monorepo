// PATH: functions/src/__tests__/moderation/sightengineWebhook.test.ts
//
// Offline integration-style test for handleSightengineCallback — same
// directly-callable-(req,res) pattern as streamWebhook.test.ts.

jest.mock("firebase-admin", () => require("../helpers/mockFirebaseAdmin").mockAdminModule);

import * as crypto from "crypto";
import { fakeDb } from "../helpers/mockFirebaseAdmin";

const SIGNING_SECRET = "casec_test_secret";
const ORIGINAL_ENV = { ...process.env };

function signedReq(body: unknown, opts: { badSig?: boolean; noSig?: boolean } = {}) {
  const rawBody = Buffer.from(JSON.stringify(body));
  const t = Math.floor(Date.now() / 1000).toString();
  const v1 = opts.badSig
    ? "0".repeat(64)
    : crypto.createHmac("sha256", SIGNING_SECRET).update(`${t}.${rawBody.toString("utf8")}`).digest("hex");
  const header = opts.noSig ? undefined : `t=${t},v1=${v1}`;
  return {
    rawBody,
    get: (name: string) => (name === "Sightengine-Signature" ? header : undefined),
  };
}

function makeRes() {
  const res: { status: jest.Mock; send: jest.Mock } = { status: jest.fn(), send: jest.fn() };
  res.status.mockImplementation(() => res);
  res.send.mockImplementation(() => res);
  return res;
}

// fakeDb.peek() returns DocData (Record<string, unknown>) — nested
// property access needs a loose type for test-assertion convenience,
// same pattern used elsewhere in this repo's test suite.
function peekAny(path: string): any {
  return fakeDb.peek(path);
}

beforeEach(() => {
  fakeDb.reset();
  process.env = { ...ORIGINAL_ENV, SIGHTENGINE_CALLBACK_SIGNING_SECRET: SIGNING_SECRET };
});
afterAll(() => { process.env = ORIGINAL_ENV; });

describe("handleSightengineCallback — signature verification (security)", () => {
  test("rejects a missing signature", async () => {
    const { handleSightengineCallback } = require("../../moderation/sightengineWebhook");
    const res = makeRes();
    await handleSightengineCallback(signedReq({ media: { id: "med_1" } }, { noSig: true }) as any, res as any);
    expect(res.status).toHaveBeenCalledWith(401);
  });
  test("rejects a forged signature", async () => {
    const { handleSightengineCallback } = require("../../moderation/sightengineWebhook");
    const res = makeRes();
    await handleSightengineCallback(signedReq({ media: { id: "med_1" } }, { badSig: true }) as any, res as any);
    expect(res.status).toHaveBeenCalledWith(401);
  });
  test("500s fail-closed when not configured", async () => {
    delete process.env.SIGHTENGINE_CALLBACK_SIGNING_SECRET;
    const { handleSightengineCallback } = require("../../moderation/sightengineWebhook");
    const res = makeRes();
    await handleSightengineCallback(signedReq({ media: { id: "med_1" } }) as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("handleSightengineCallback — lookup & lifecycle", () => {
  test("an 'ongoing' status is acknowledged without changing anything", async () => {
    fakeDb.seed("submissions/battle_1_student_1", { battleId: "battle_1", safetyModerationJobId: "med_1", safetyModeration: { status: "PROCESSING" } });
    const { handleSightengineCallback } = require("../../moderation/sightengineWebhook");
    const res = makeRes();
    await handleSightengineCallback(signedReq({ media: { id: "med_1" }, status: "ongoing" }) as any, res as any);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(peekAny("submissions/battle_1_student_1")?.safetyModeration?.status).toBe("PROCESSING");
  });

  test("no submission matches the job id -> safe no-op", async () => {
    const { handleSightengineCallback } = require("../../moderation/sightengineWebhook");
    const res = makeRes();
    await handleSightengineCallback(signedReq({ media: { id: "med_unknown" }, status: "finished", data: {} }) as any, res as any);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("a 'finished' callback marks safety COMPLETED and re-runs the decision engine", async () => {
    fakeDb.seed("submissions/battle_1_student_1", {
      battleId: "battle_1", status: "PENDING_HUMAN_REVIEW", safetyModerationJobId: "med_1",
      safetyModeration: { provider: "sightengine", status: "PROCESSING", jobId: "med_1", labels: [], processedAt: null, error: null },
    });
    const { handleSightengineCallback } = require("../../moderation/sightengineWebhook");
    const res = makeRes();
    await handleSightengineCallback(signedReq({ media: { id: "med_1" }, status: "finished", data: { nudity: { raw: 0.01 } } }) as any, res as any);
    expect(res.status).toHaveBeenCalledWith(200);
    const doc = peekAny("submissions/battle_1_student_1");
    expect(doc?.safetyModeration?.status).toBe("COMPLETED");
    // Still PENDING_HUMAN_REVIEW — AUTO_APPROVE_LOW_RISK is off by default,
    // so even a clean read never auto-publishes.
    expect(doc?.status).toBe("PENDING_HUMAN_REVIEW");
    expect(doc?.moderationProcessingVersion).toBe(1);
  });

  test("a 'failure' callback marks safety FAILED, never treated as a pass", async () => {
    fakeDb.seed("submissions/battle_1_student_1", {
      battleId: "battle_1", status: "PENDING_HUMAN_REVIEW", safetyModerationJobId: "med_2",
      safetyModeration: { status: "PROCESSING" },
    });
    const { handleSightengineCallback } = require("../../moderation/sightengineWebhook");
    const res = makeRes();
    await handleSightengineCallback(signedReq({ media: { id: "med_2" }, status: "failure" }) as any, res as any);
    expect(peekAny("submissions/battle_1_student_1")?.safetyModeration?.status).toBe("FAILED");
  });

  test("idempotency: a duplicate 'finished' callback for an already-COMPLETED job is a no-op", async () => {
    fakeDb.seed("submissions/battle_1_student_1", {
      battleId: "battle_1", status: "PENDING_HUMAN_REVIEW", safetyModerationJobId: "med_1",
      safetyModeration: { status: "COMPLETED", labels: [] }, moderationProcessingVersion: 1,
    });
    const { handleSightengineCallback } = require("../../moderation/sightengineWebhook");
    const res = makeRes();
    await handleSightengineCallback(signedReq({ media: { id: "med_1" }, status: "finished", data: {} }) as any, res as any);
    expect(fakeDb.peek("submissions/battle_1_student_1")?.moderationProcessingVersion).toBe(1); // unchanged
  });

  test("§7: a late callback never overwrites an already-approved/rejected submission's visible status", async () => {
    fakeDb.seed("submissions/battle_1_student_1", {
      battleId: "battle_1", status: "APPROVED", safetyModerationJobId: "med_1",
      safetyModeration: { status: "PROCESSING" },
    });
    const { handleSightengineCallback } = require("../../moderation/sightengineWebhook");
    const res = makeRes();
    await handleSightengineCallback(signedReq({ media: { id: "med_1" }, status: "finished", data: { violence: { raw: 0.99 } } }) as any, res as any);
    // Status is preserved even though the (hypothetically alarming) new
    // safety data is stored for audit purposes.
    expect(fakeDb.peek("submissions/battle_1_student_1")?.status).toBe("APPROVED");
    expect(peekAny("submissions/battle_1_student_1")?.safetyModeration?.status).toBe("COMPLETED");
  });

  test("engine detection: also matches legacy posts by safetyModerationJobId, uses the lowercase status vocabulary", async () => {
    fakeDb.seed("posts/legacy_post_1", {
      battleId: "battle_1", isSkillBattle: true, status: "pending", safetyModerationJobId: "med_3",
      safetyModeration: { status: "PROCESSING" },
    });
    const { handleSightengineCallback } = require("../../moderation/sightengineWebhook");
    const res = makeRes();
    await handleSightengineCallback(signedReq({ media: { id: "med_3" }, status: "finished", data: {} }) as any, res as any);
    const doc = fakeDb.peek("posts/legacy_post_1");
    expect(doc?.status).toBe("pending"); // lowercase, not "PENDING_HUMAN_REVIEW"
    expect(doc?.moderationStatus).toBe("PENDING_HUMAN_REVIEW");
  });
});

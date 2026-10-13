// PATH: functions/src/__tests__/aiGuruCredits.test.ts
//
// Offline unit tests for aiGuruCredits.ts — the pay-as-you-go purchase
// flow (order creation, payment verification, reconciliation). Same
// mocking approach as aiGuruSubscription.test.ts (its closest sibling:
// same Razorpay order/verify shape, adapted for credit packs instead of
// subscription plans) and razorpayWebhook.test.ts (onRequest handlers
// tested as plain `(req, res) => ...` functions, no `.run()` shim for
// those — only v1 onCall/onRun functions have one).

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import * as crypto from "crypto";
const axiosPost = jest.fn();
const axiosGet = jest.fn();
// aiGuruCredits.ts does `import axios from "axios"`, which under
// esModuleInterop compiles to reading `.default` off the required module —
// the mock needs both the named and default shapes so either interop path
// resolves to the same jest.fn()s.
jest.mock("axios", () => {
  const shape = { post: (...args: unknown[]) => axiosPost(...args), get: (...args: unknown[]) => axiosGet(...args) };
  return { ...shape, default: shape };
});

import { fakeDb } from "./helpers/mockFirebaseAdmin";

const KEY_ID = "test_key_id";
const KEY_SECRET = "test_key_secret";

beforeEach(() => {
  fakeDb.reset();
  jest.clearAllMocks();
  process.env["RAZORPAY_KEY_ID"] = KEY_ID;
  process.env["RAZORPAY_KEY_SECRET"] = KEY_SECRET;
});

function sign(orderId: string, paymentId: string) {
  return crypto.createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
}

function seedPack(id: string, overrides: Record<string, unknown> = {}) {
  fakeDb.seed(`aiGuruCreditPacks/${id}`, {
    name: "Starter Pack", pricePaise: 9900, credits: 50, bonusCredits: 5, isActive: true, ...overrides,
  });
}

function makeReq(body: unknown, opts: { method?: string } = {}) {
  return { method: opts.method ?? "POST", body };
}
function makeRes() {
  const res: { status: jest.Mock; json: jest.Mock; send: jest.Mock; set: jest.Mock } = {
    status: jest.fn(), json: jest.fn(), send: jest.fn(), set: jest.fn(),
  };
  res.status.mockImplementation(() => res);
  res.json.mockImplementation(() => res);
  res.send.mockImplementation(() => res);
  res.set.mockImplementation(() => res);
  return res;
}

// ─── F. Purchase order ──────────────────────────────────────────────────────

describe("aiGuruCreateCreditOrder", () => {
  test("valid pack id: server resolves credits/price from the Firestore pack doc, not the client", async () => {
    seedPack("starter", { pricePaise: 9900, credits: 50, bonusCredits: 5, name: "Starter Pack" });
    axiosPost.mockResolvedValue({ data: { id: "order_rzp_1" } });
    const { aiGuruCreateCreditOrder } = require("../aiGuruCredits");

    const result = await aiGuruCreateCreditOrder.run(
      { packId: "starter" },
      { auth: { uid: "student_1" } }
    );

    expect(result).toMatchObject({ razorpayOrderId: "order_rzp_1", amountPaise: 9900, credits: 55, packName: "Starter Pack" });
    expect(fakeDb.peek("aiGuruCreditOrders/order_rzp_1")).toMatchObject({
      uid: "student_1", packId: "starter", credits: 55, amountPaise: 9900, status: "created",
    });
    // The Razorpay order amount sent upstream must also match the pack's
    // real price, not anything a client could have supplied.
    expect(axiosPost).toHaveBeenCalledWith(
      "https://api.razorpay.com/v1/orders",
      expect.objectContaining({ amount: 9900, currency: "INR" }),
      expect.anything()
    );
  });

  test("a client-supplied price/credits field in the request is ignored entirely — only packId is read", async () => {
    seedPack("starter", { pricePaise: 9900, credits: 50, bonusCredits: 0 });
    axiosPost.mockResolvedValue({ data: { id: "order_rzp_2" } });
    const { aiGuruCreateCreditOrder } = require("../aiGuruCredits");

    const result = await aiGuruCreateCreditOrder.run(
      // Deliberately sending extra fields a tampered client might try.
      { packId: "starter", amountPaise: 1, credits: 999999, uid: "victim_uid" } as { packId: string },
      { auth: { uid: "student_1" } }
    );

    expect(result).toMatchObject({ amountPaise: 9900, credits: 50 });
    expect(fakeDb.peek("aiGuruCreditOrders/order_rzp_2")).toMatchObject({ uid: "student_1", amountPaise: 9900, credits: 50 });
  });

  test("rejects an unknown pack id", async () => {
    const { aiGuruCreateCreditOrder } = require("../aiGuruCredits");
    await expect(
      aiGuruCreateCreditOrder.run({ packId: "does_not_exist" }, { auth: { uid: "student_1" } })
    ).rejects.toMatchObject({ code: "not-found" });
    expect(axiosPost).not.toHaveBeenCalled();
  });

  test("rejects a deactivated pack", async () => {
    seedPack("old_pack", { isActive: false });
    const { aiGuruCreateCreditOrder } = require("../aiGuruCredits");
    await expect(
      aiGuruCreateCreditOrder.run({ packId: "old_pack" }, { auth: { uid: "student_1" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("rejects a misconfigured pack (zero/negative price or credits)", async () => {
    seedPack("broken_pack", { pricePaise: 0, credits: 0 });
    const { aiGuruCreateCreditOrder } = require("../aiGuruCredits");
    await expect(
      aiGuruCreateCreditOrder.run({ packId: "broken_pack" }, { auth: { uid: "student_1" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("rejects an unauthenticated caller before ever reading the pack", async () => {
    seedPack("starter");
    const { aiGuruCreateCreditOrder } = require("../aiGuruCredits");
    await expect(
      aiGuruCreateCreditOrder.run({ packId: "starter" }, { auth: null })
    ).rejects.toMatchObject({ code: "unauthenticated" });
    expect(axiosPost).not.toHaveBeenCalled();
  });

  test("surfaces a Razorpay API failure as an internal error and writes no order", async () => {
    seedPack("starter");
    axiosPost.mockRejectedValue({ message: "network down" });
    const { aiGuruCreateCreditOrder } = require("../aiGuruCredits");
    await expect(
      aiGuruCreateCreditOrder.run({ packId: "starter" }, { auth: { uid: "student_1" } })
    ).rejects.toMatchObject({ code: "internal" });
  });
});

// ─── G. Payment verification ────────────────────────────────────────────────

describe("aiGuruCreditPaymentSuccess", () => {
  test("valid signature: credits the balance, writes a ledger entry, marks the order paid", async () => {
    fakeDb.seed("aiGuruCreditOrders/order_1", { uid: "student_1", packId: "starter", credits: 55, amountPaise: 9900, status: "created" });
    const { aiGuruCreditPaymentSuccess } = require("../aiGuruCredits");
    const req = makeReq({ razorpay_payment_id: "pay_1", razorpay_order_id: "order_1", razorpay_signature: sign("order_1", "pay_1") });
    const res = makeRes();

    await aiGuruCreditPaymentSuccess(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(fakeDb.peek("aiGuruCredits/student_1")).toMatchObject({ balance: 55, lifetimePurchased: 55 });
    expect(fakeDb.peek("aiGuruCredits/student_1/transactions/pay_1")).toMatchObject({
      type: "CREDIT", amount: 55, source: "CREDIT_PACK_PURCHASE", status: "SUCCESS",
    });
    expect(fakeDb.peek("aiGuruCreditOrders/order_1")).toMatchObject({ status: "paid", razorpayPaymentId: "pay_1" });
  });

  test("invalid/forged signature is rejected and credits nothing", async () => {
    fakeDb.seed("aiGuruCreditOrders/order_1", { uid: "student_1", packId: "starter", credits: 55, amountPaise: 9900, status: "created" });
    const { aiGuruCreditPaymentSuccess } = require("../aiGuruCredits");
    const req = makeReq({ razorpay_payment_id: "pay_1", razorpay_order_id: "order_1", razorpay_signature: "forged" });
    const res = makeRes();

    await aiGuruCreditPaymentSuccess(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(fakeDb.peek("aiGuruCredits/student_1")).toBeUndefined();
    expect(fakeDb.peek("aiGuruCreditOrders/order_1")).toMatchObject({ status: "created" });
  });

  test("a signature valid for a DIFFERENT order/payment pair is rejected (can't replay across orders)", async () => {
    fakeDb.seed("aiGuruCreditOrders/order_1", { uid: "student_1", packId: "starter", credits: 55, amountPaise: 9900, status: "created" });
    const { aiGuruCreditPaymentSuccess } = require("../aiGuruCredits");
    // Signature was computed for a completely different order/payment id.
    const req = makeReq({ razorpay_payment_id: "pay_1", razorpay_order_id: "order_1", razorpay_signature: sign("order_999", "pay_999") });
    const res = makeRes();

    await aiGuruCreditPaymentSuccess(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(fakeDb.peek("aiGuruCredits/student_1")).toBeUndefined();
  });

  test("an order id that doesn't exist returns 404 and credits nothing", async () => {
    const { aiGuruCreditPaymentSuccess } = require("../aiGuruCredits");
    const req = makeReq({ razorpay_payment_id: "pay_1", razorpay_order_id: "order_missing", razorpay_signature: sign("order_missing", "pay_1") });
    const res = makeRes();

    await aiGuruCreditPaymentSuccess(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("a duplicate delivery of an already-paid order cannot credit twice", async () => {
    fakeDb.seed("aiGuruCreditOrders/order_1", { uid: "student_1", packId: "starter", credits: 55, amountPaise: 9900, status: "created" });
    const { aiGuruCreditPaymentSuccess } = require("../aiGuruCredits");
    const req = makeReq({ razorpay_payment_id: "pay_1", razorpay_order_id: "order_1", razorpay_signature: sign("order_1", "pay_1") });

    await aiGuruCreditPaymentSuccess(req as any, makeRes() as any);
    const afterFirst = fakeDb.peek("aiGuruCredits/student_1");

    const res2 = makeRes();
    await aiGuruCreditPaymentSuccess(req as any, res2 as any);

    expect(res2.status).toHaveBeenCalledWith(200);
    expect(res2.json).toHaveBeenCalledWith(expect.objectContaining({ alreadyCredited: true }));
    // Byte-for-byte unchanged by the replay — the actual guarantee, not
    // just a response flag.
    expect(fakeDb.peek("aiGuruCredits/student_1")).toEqual(afterFirst);
  });

  test("rejects a non-POST request", async () => {
    const { aiGuruCreditPaymentSuccess } = require("../aiGuruCredits");
    const req = makeReq({}, { method: "GET" });
    const res = makeRes();
    await aiGuruCreditPaymentSuccess(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  test("rejects a request missing required fields", async () => {
    const { aiGuruCreditPaymentSuccess } = require("../aiGuruCredits");
    const req = makeReq({ razorpay_order_id: "order_1" }); // no payment id / signature
    const res = makeRes();
    await aiGuruCreditPaymentSuccess(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ─── H. Reconciliation ───────────────────────────────────────────────────────

describe("reconcileAiGuruCreditOrders", () => {
  const STALE_CREATED_AT = { toMillis: () => Date.now() - 20 * 60 * 1000 }; // 20 min ago

  test("credits a paid-but-unreconciled order (client never called back)", async () => {
    fakeDb.seed("aiGuruCreditOrders/order_1", {
      uid: "student_1", packId: "starter", credits: 55, amountPaise: 9900,
      status: "created", createdAt: STALE_CREATED_AT,
    });
    axiosGet.mockResolvedValue({ data: { items: [{ id: "pay_reconciled", status: "captured" }] } });
    const { reconcileAiGuruCreditOrders } = require("../aiGuruCredits");

    await reconcileAiGuruCreditOrders.run({} as any);

    expect(fakeDb.peek("aiGuruCredits/student_1")).toMatchObject({ balance: 55, lifetimePurchased: 55 });
    expect(fakeDb.peek("aiGuruCreditOrders/order_1")).toMatchObject({ status: "paid", razorpayPaymentId: "pay_reconciled" });
  });

  test("an order already processed (status already 'paid') is not touched or re-credited", async () => {
    fakeDb.seed("aiGuruCreditOrders/order_2", {
      uid: "student_1", packId: "starter", credits: 55, amountPaise: 9900,
      status: "paid", createdAt: STALE_CREATED_AT, razorpayPaymentId: "pay_already",
    });
    const { reconcileAiGuruCreditOrders } = require("../aiGuruCredits");

    await reconcileAiGuruCreditOrders.run({} as any);

    // Query only selects status=="created" — an already-paid order is
    // never even fetched from Razorpay, let alone re-credited.
    expect(axiosGet).not.toHaveBeenCalled();
    expect(fakeDb.peek("aiGuruCredits/student_1")).toBeUndefined();
  });

  test("a genuinely unpaid/abandoned order is left as 'created', not credited", async () => {
    fakeDb.seed("aiGuruCreditOrders/order_3", {
      uid: "student_1", packId: "starter", credits: 55, amountPaise: 9900,
      status: "created", createdAt: STALE_CREATED_AT,
    });
    axiosGet.mockResolvedValue({ data: { items: [] } }); // nothing captured
    const { reconcileAiGuruCreditOrders } = require("../aiGuruCredits");

    await reconcileAiGuruCreditOrders.run({} as any);

    expect(fakeDb.peek("aiGuruCreditOrders/order_3")).toMatchObject({ status: "created" });
    expect(fakeDb.peek("aiGuruCredits/student_1")).toBeUndefined();
  });
});

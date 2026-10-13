// PATH: functions/src/__tests__/razorpayWebhook.test.ts
//
// Offline integration-style test for functions/src/razorpayWebhook.ts —
// the v2 onRequest export is directly callable as `(req, res) => ...`
// (confirmed against firebase-functions' own HttpsFunction type: a plain
// function value with a couple of extra properties attached, no `.run()`
// testing shim the way v1 onCall functions have), so it's exercised here
// with lightweight mock req/res objects and the same
// jest.mock("firebase-admin", ...) + FakeFirestore harness every other
// offline function test in this repo already uses.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import * as crypto from "crypto";
import { fakeDb } from "./helpers/mockFirebaseAdmin";
import { razorpayWebhook } from "../razorpayWebhook";

const SECRET = "whsec_test";

beforeEach(() => {
  fakeDb.reset();
  process.env["RAZORPAY_WEBHOOK_SECRET"] = SECRET;
});

function makeReq(body: unknown, opts: { eventId?: string; signature?: string; method?: string } = {}) {
  const rawBody = Buffer.from(JSON.stringify(body));
  const signature = opts.signature ?? crypto.createHmac("sha256", SECRET).update(rawBody).digest("hex");
  return {
    method: opts.method ?? "POST",
    headers: {
      "x-razorpay-signature": signature,
      "x-razorpay-event-id": "eventId" in opts ? opts.eventId : "evt_test123",
    },
    body,
    rawBody,
  };
}

function makeRes() {
  const res: { status: jest.Mock; json: jest.Mock; send: jest.Mock } = {
    status: jest.fn(),
    json: jest.fn(),
    send: jest.fn(),
  };
  res.status.mockImplementation(() => res);
  res.json.mockImplementation(() => res);
  res.send.mockImplementation(() => res);
  return res;
}

describe("razorpayWebhook", () => {
  test("rejects a non-POST request", async () => {
    const req = makeReq({ event: "payment.captured" }, { method: "GET" });
    const res = makeRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await razorpayWebhook(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  test("responds 500 when RAZORPAY_WEBHOOK_SECRET is not configured", async () => {
    delete process.env["RAZORPAY_WEBHOOK_SECRET"];
    const req = makeReq({ event: "payment.captured" });
    const res = makeRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await razorpayWebhook(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test("rejects an invalid signature and writes nothing", async () => {
    const req = makeReq({ event: "payment.captured" }, { signature: "0".repeat(64) });
    const res = makeRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await razorpayWebhook(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fakeDb.peek("webhookEvents/evt_test123")).toBeUndefined();
  });

  test("verifies, records, and 200s a well-formed payment.captured delivery", async () => {
    const body = {
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_1", order_id: "order_1", status: "captured" } } },
      created_at: 1700000000,
    };
    const req = makeReq(body, { eventId: "evt_abc" });
    const res = makeRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await razorpayWebhook(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    const stored = fakeDb.peek("webhookEvents/evt_abc");
    expect(stored).toBeDefined();
    expect(stored?.["eventType"]).toBe("payment.captured");
    expect(stored?.["orderId"]).toBe("order_1");
    expect(stored?.["paymentId"]).toBe("pay_1");
    expect(stored?.["verified"]).toBe(true);
    // order_1 doesn't match any bookingPaymentOrders doc in this test (no
    // such doc seeded) — legacy-flow-shaped traffic stays record-only,
    // `processed` stays false, byte-for-byte the original Phase B behavior.
    expect(stored?.["processed"]).toBe(false);
  });

  test("does not touch any existing payment/order/earnings collection", async () => {
    const body = { event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_1" } } } };
    const req = makeReq(body, { eventId: "evt_no_side_effects" });
    const res = makeRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await razorpayWebhook(req as any, res as any);

    expect(fakeDb.peek("tutorCreditOrders/order_1")).toBeUndefined();
    expect(fakeDb.peek("aiGuruSubscriptionOrders/order_1")).toBeUndefined();
    expect(fakeDb.peek("tutorEarnings/order_1")).toBeUndefined();
  });

  test("is idempotent — a duplicate delivery of an already-recorded event id is a no-op 200", async () => {
    const body = { event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_1" } } } };
    const firstReq = makeReq(body, { eventId: "evt_dup" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await razorpayWebhook(firstReq as any, makeRes() as any);
    const before = fakeDb.peek("webhookEvents/evt_dup");

    const secondReq = makeReq(body, { eventId: "evt_dup" });
    const secondRes = makeRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await razorpayWebhook(secondReq as any, secondRes as any);

    expect(secondRes.status).toHaveBeenCalledWith(200);
    expect(secondRes.json).toHaveBeenCalledWith({ status: "duplicate" });
    expect(fakeDb.peek("webhookEvents/evt_dup")).toEqual(before); // untouched, not overwritten
  });

  test("rejects a malformed event payload even behind a valid signature", async () => {
    const body = { payload: {} }; // missing required `event` field
    const req = makeReq(body);
    const res = makeRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await razorpayWebhook(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("rejects a request with no event-id header", async () => {
    const req = makeReq({ event: "payment.captured" }, { eventId: undefined });
    const res = makeRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await razorpayWebhook(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // ── Phase C+D — dispatches to bookingPayment.ts's
  // confirmBookingPaymentFromWebhook when the event's orderId matches a
  // bookingPaymentOrders doc ─────────────────────────────────────────────
  describe("booking payment confirmation dispatch", () => {
    test("confirms a matching booking payment order and marks the webhook event processed:true", async () => {
      fakeDb.seed("bookingPaymentOrders/order_booking1", {
        bookingId: "booking_1", studentUid: "student_1", tutorUid: "tutor_1",
        grossAmountPaise: 50000, commissionRate: 10, status: "created",
      });
      fakeDb.seed("bookings/booking_1", { studentUid: "student_1", tutorUid: "tutor_1", status: "accepted", sessionFee: 500 });

      const body = {
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_booking1", order_id: "order_booking1", status: "captured" } } },
      };
      const req = makeReq(body, { eventId: "evt_booking_confirm" });
      const res = makeRes();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await razorpayWebhook(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(fakeDb.peek("webhookEvents/evt_booking_confirm")?.["processed"]).toBe(true);
      expect(fakeDb.peek("bookingPaymentOrders/order_booking1")?.["status"]).toBe("paid");
      expect(fakeDb.peek("bookings/booking_1")?.["financialStatus"]).toBe("payment_confirmed");
      expect(fakeDb.peek("tutorEarnings/tutor_1")?.["heldBalance"]).toBe(450);
    });

    test("a legacy-flow-shaped payment.captured event (no matching bookingPaymentOrders doc) stays processed:false", async () => {
      const body = {
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_legacy", order_id: "order_from_aiguru_subscription", status: "captured" } } },
      };
      const req = makeReq(body, { eventId: "evt_legacy" });
      const res = makeRes();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await razorpayWebhook(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(fakeDb.peek("webhookEvents/evt_legacy")?.["processed"]).toBe(false);
    });

    test("still 200s and keeps the event recorded even if confirmBookingPaymentFromWebhook throws", async () => {
      // A booking order exists but its booking doc is missing — this
      // shouldn't happen in practice, but the endpoint must degrade
      // gracefully (log + stay recorded) rather than fail the whole
      // webhook delivery.
      fakeDb.seed("bookingPaymentOrders/order_broken", {
        bookingId: "booking_missing", tutorUid: "tutor_1", grossAmountPaise: 50000, commissionRate: 10, status: "created",
      });
      const body = {
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_broken", order_id: "order_broken", status: "captured" } } },
      };
      const req = makeReq(body, { eventId: "evt_broken" });
      const res = makeRes();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await razorpayWebhook(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(fakeDb.peek("webhookEvents/evt_broken")).toBeDefined();
      expect(fakeDb.peek("webhookEvents/evt_broken")?.["processed"]).toBe(false);
    });

    test("a payment.failed event for a matching booking order sets payment_failed", async () => {
      fakeDb.seed("bookingPaymentOrders/order_fail1", {
        bookingId: "booking_2", tutorUid: "tutor_1", grossAmountPaise: 50000, commissionRate: 10, status: "created",
      });
      fakeDb.seed("bookings/booking_2", { studentUid: "student_1", tutorUid: "tutor_1", status: "accepted", sessionFee: 500 });

      const body = {
        event: "payment.failed",
        payload: { payment: { entity: { id: "pay_fail1", order_id: "order_fail1", status: "failed" } } },
      };
      const req = makeReq(body, { eventId: "evt_fail1" });
      const res = makeRes();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await razorpayWebhook(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(fakeDb.peek("bookingPaymentOrders/order_fail1")?.["status"]).toBe("failed");
      expect(fakeDb.peek("bookings/booking_2")?.["financialStatus"]).toBe("payment_failed");
      expect(fakeDb.peek("webhookEvents/evt_fail1")?.["processed"]).toBe(true);
    });
  });
});

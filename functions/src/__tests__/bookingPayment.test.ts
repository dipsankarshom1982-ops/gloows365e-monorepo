// PATH: functions/src/__tests__/bookingPayment.test.ts
//
// Offline tests for functions/src/bookingPayment.ts — same
// jest.mock("firebase-admin"/"axios") + FakeFirestore harness as
// refunds.test.ts/aiGuruSubscription.test.ts, run directly against the
// real module via each callable's `.run(data, context)` hook.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);
jest.mock("axios", () => ({ __esModule: true, default: { post: jest.fn(), get: jest.fn() } }));

import axios from "axios";
import { fakeDb } from "./helpers/mockFirebaseAdmin";

const mockedAxios = axios as unknown as { post: jest.Mock; get: jest.Mock };
const STUDENT_CONTEXT = { auth: { uid: "student_1", token: {} } };

beforeEach(() => {
  fakeDb.reset();
  mockedAxios.post.mockReset();
  process.env["RAZORPAY_KEY_ID"] = "test_key_id";
  process.env["RAZORPAY_KEY_SECRET"] = "test_key_secret";
});

function seedAcceptedBooking(overrides: Partial<Record<string, unknown>> = {}) {
  fakeDb.seed("bookings/booking_1", {
    studentUid: "student_1",
    tutorUid: "tutor_1",
    subject: "Math",
    sessionType: "regular",
    requestedDate: "2026-01-01",
    requestedStartTime: "10:00",
    requestedEndTime: "11:00",
    sessionFee: 500,
    status: "accepted",
    ...overrides,
  });
}

describe("createBookingPaymentOrder", () => {
  test("creates a Razorpay order and writes bookingPaymentOrders + booking.financialStatus", async () => {
    seedAcceptedBooking();
    mockedAxios.post.mockResolvedValueOnce({ data: { id: "order_test1" } });
    const { createBookingPaymentOrder } = require("../bookingPayment");

    const result = await createBookingPaymentOrder.run({ bookingId: "booking_1" }, STUDENT_CONTEXT);

    expect(result.razorpayOrderId).toBe("order_test1");
    expect(result.grossAmountPaise).toBe(50000);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://api.razorpay.com/v1/orders",
      expect.objectContaining({ amount: 50000, currency: "INR" }),
      expect.objectContaining({ auth: { username: "test_key_id", password: "test_key_secret" } }),
    );

    const order = fakeDb.peek("bookingPaymentOrders/order_test1");
    expect(order?.["bookingId"]).toBe("booking_1");
    expect(order?.["studentUid"]).toBe("student_1");
    expect(order?.["tutorUid"]).toBe("tutor_1");
    expect(order?.["grossAmountPaise"]).toBe(50000);
    expect(order?.["commissionRate"]).toBe(10); // default, no bookingPaymentConfig/settings doc seeded
    expect(order?.["status"]).toBe("created");

    const booking = fakeDb.peek("bookings/booking_1");
    expect(booking?.["financialStatus"]).toBe("payment_pending");
    expect(booking?.["paymentExpiresAt"]).toBeDefined();
    // Workflow status untouched.
    expect(booking?.["status"]).toBe("accepted");
  });

  test("rejects an unauthenticated caller", async () => {
    seedAcceptedBooking();
    const { createBookingPaymentOrder } = require("../bookingPayment");
    await expect(createBookingPaymentOrder.run({ bookingId: "booking_1" }, { auth: null })).rejects.toThrow();
  });

  test("rejects a caller who isn't the booking's own student", async () => {
    seedAcceptedBooking();
    const { createBookingPaymentOrder } = require("../bookingPayment");
    await expect(
      createBookingPaymentOrder.run({ bookingId: "booking_1" }, { auth: { uid: "someone_else", token: {} } }),
    ).rejects.toThrow(/doesn't belong to you/);
  });

  test("rejects a booking that isn't in accepted status", async () => {
    seedAcceptedBooking({ status: "requested" });
    const { createBookingPaymentOrder } = require("../bookingPayment");
    await expect(createBookingPaymentOrder.run({ bookingId: "booking_1" }, STUDENT_CONTEXT)).rejects.toThrow(/must be "accepted"/);
  });

  test("rejects a booking that's already payment_confirmed (duplicate-settlement guard)", async () => {
    seedAcceptedBooking({ financialStatus: "payment_confirmed" });
    const { createBookingPaymentOrder } = require("../bookingPayment");
    await expect(createBookingPaymentOrder.run({ bookingId: "booking_1" }, STUDENT_CONTEXT)).rejects.toThrow();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  test("rejects a second attempt while one is already in flight", async () => {
    seedAcceptedBooking({ financialStatus: "payment_pending" });
    fakeDb.seed("bookingPaymentOrders/order_inflight", { bookingId: "booking_1", status: "created" });
    const { createBookingPaymentOrder } = require("../bookingPayment");
    await expect(createBookingPaymentOrder.run({ bookingId: "booking_1" }, STUDENT_CONTEXT)).rejects.toThrow(/already in progress/);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  test("expires a stale payment_pending booking + its in-flight order, then allows a fresh attempt", async () => {
    const pastMillis = Date.now() - 60_000;
    seedAcceptedBooking({ financialStatus: "payment_pending", paymentExpiresAt: { toMillis: () => pastMillis } });
    fakeDb.seed("bookingPaymentOrders/order_stale", { bookingId: "booking_1", status: "created" });
    mockedAxios.post.mockResolvedValueOnce({ data: { id: "order_fresh" } });
    const { createBookingPaymentOrder } = require("../bookingPayment");

    const result = await createBookingPaymentOrder.run({ bookingId: "booking_1" }, STUDENT_CONTEXT);

    expect(result.razorpayOrderId).toBe("order_fresh");
    expect(fakeDb.peek("bookingPaymentOrders/order_stale")?.["status"]).toBe("expired");
    expect(fakeDb.peek("bookingPaymentOrders/order_fresh")?.["status"]).toBe("created");
  });

  test("uses a custom bookingPaymentConfig/settings commissionRate when present", async () => {
    fakeDb.seed("bookingPaymentConfig/settings", { commissionRate: 15 });
    seedAcceptedBooking();
    mockedAxios.post.mockResolvedValueOnce({ data: { id: "order_custom" } });
    const { createBookingPaymentOrder } = require("../bookingPayment");
    await createBookingPaymentOrder.run({ bookingId: "booking_1" }, STUDENT_CONTEXT);
    expect(fakeDb.peek("bookingPaymentOrders/order_custom")?.["commissionRate"]).toBe(15);
  });

  test("never trusts a client-sent amount — always uses booking.sessionFee", async () => {
    seedAcceptedBooking({ sessionFee: 750 });
    mockedAxios.post.mockResolvedValueOnce({ data: { id: "order_x" } });
    const { createBookingPaymentOrder } = require("../bookingPayment");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await createBookingPaymentOrder.run({ bookingId: "booking_1", amount: 1, grossAmountPaise: 1 } as any, STUDENT_CONTEXT);
    expect(result.grossAmountPaise).toBe(75000);
  });

  test("surfaces a Razorpay API error as an internal HttpsError", async () => {
    seedAcceptedBooking();
    mockedAxios.post.mockRejectedValueOnce({ response: { data: { error: { code: "BAD_REQUEST", description: "boom" } } } });
    const { createBookingPaymentOrder } = require("../bookingPayment");
    await expect(createBookingPaymentOrder.run({ bookingId: "booking_1" }, STUDENT_CONTEXT)).rejects.toThrow(/Razorpay error/);
    expect(fakeDb.peek("bookings/booking_1")?.["financialStatus"]).toBeUndefined();
  });
});

describe("confirmBookingPaymentFromWebhook", () => {
  function seedOrder(overrides: Partial<Record<string, unknown>> = {}) {
    fakeDb.seed("bookingPaymentOrders/order_1", {
      bookingId: "booking_1",
      studentUid: "student_1",
      tutorUid: "tutor_1",
      razorpayOrderId: "order_1",
      grossAmountPaise: 50000,
      commissionRate: 10,
      status: "created",
      ...overrides,
    });
  }
  function seedBooking(overrides: Partial<Record<string, unknown>> = {}) {
    fakeDb.seed("bookings/booking_1", {
      studentUid: "student_1",
      tutorUid: "tutor_1",
      status: "accepted",
      sessionFee: 500,
      ...overrides,
    });
  }

  test("confirms payment.captured: freezes commission, credits heldBalance (held), sets financialStatus", async () => {
    seedOrder();
    seedBooking();
    const { confirmBookingPaymentFromWebhook } = require("../bookingPayment");

    const result = await confirmBookingPaymentFromWebhook({
      eventId: "evt_1",
      eventType: "payment.captured",
      orderId: "order_1",
      paymentId: "pay_1",
    });
    expect(result.acted).toBe(true);

    const order = fakeDb.peek("bookingPaymentOrders/order_1");
    expect(order?.["status"]).toBe("paid");
    expect(order?.["razorpayPaymentId"]).toBe("pay_1");
    expect(order?.["commissionAmountPaise"]).toBe(5000);
    expect(order?.["tutorNetAmountPaise"]).toBe(45000);
    expect(order?.["commissionSnapshotVersion"]).toBe("v1");

    const booking = fakeDb.peek("bookings/booking_1");
    expect(booking?.["financialStatus"]).toBe("payment_confirmed");
    // Workflow status untouched.
    expect(booking?.["status"]).toBe("accepted");

    const earnings = fakeDb.peek("tutorEarnings/tutor_1");
    expect(earnings?.["heldBalance"]).toBe(450); // 45000 paise -> 450 rupees
    // instantHelp's own field is never touched by this path.
    expect(earnings?.["balance"]).toBeUndefined();
    // Architecture review requirement: no marketplace-specific wallet/
    // balance field is ever written — heldBalance is the ONLY new field,
    // shared/unified, never "marketplaceHeldBalance"/"marketplaceBalance".
    expect(earnings).not.toHaveProperty("marketplaceHeldBalance");
    expect(earnings).not.toHaveProperty("marketplaceBalance");
    expect(Object.keys(earnings ?? {}).some((k) => k.toLowerCase().startsWith("marketplace"))).toBe(false);
  });

  test("accumulates heldBalance and never touches the existing Instant-Help `balance` field", async () => {
    fakeDb.seed("tutorEarnings/tutor_1", { heldBalance: 100, balance: 999, lifetimeEarned: 999 });
    seedOrder();
    seedBooking();
    const { confirmBookingPaymentFromWebhook } = require("../bookingPayment");
    await confirmBookingPaymentFromWebhook({ eventId: "evt_1", eventType: "payment.captured", orderId: "order_1", paymentId: "pay_1" });

    const earnings = fakeDb.peek("tutorEarnings/tutor_1");
    expect(earnings?.["heldBalance"]).toBe(550); // 100 + 450
    expect(earnings?.["balance"]).toBe(999);
    expect(earnings?.["lifetimeEarned"]).toBe(999);
  });

  test("handles payment.failed: order -> failed, booking.financialStatus -> payment_failed, no earnings touched", async () => {
    seedOrder();
    seedBooking();
    const { confirmBookingPaymentFromWebhook } = require("../bookingPayment");
    const result = await confirmBookingPaymentFromWebhook({ eventId: "evt_2", eventType: "payment.failed", orderId: "order_1" });
    expect(result.acted).toBe(true);
    expect(fakeDb.peek("bookingPaymentOrders/order_1")?.["status"]).toBe("failed");
    expect(fakeDb.peek("bookings/booking_1")?.["financialStatus"]).toBe("payment_failed");
    expect(fakeDb.peek("tutorEarnings/tutor_1")).toBeUndefined();
  });

  test("no-ops for an event whose orderId doesn't match any booking payment order (legacy-flow traffic)", async () => {
    const { confirmBookingPaymentFromWebhook } = require("../bookingPayment");
    const result = await confirmBookingPaymentFromWebhook({
      eventId: "evt_3",
      eventType: "payment.captured",
      orderId: "order_from_some_legacy_flow",
    });
    expect(result.acted).toBe(false);
  });

  test("no-ops for an event with no orderId at all", async () => {
    const { confirmBookingPaymentFromWebhook } = require("../bookingPayment");
    const result = await confirmBookingPaymentFromWebhook({ eventId: "evt_none", eventType: "refund.processed" });
    expect(result.acted).toBe(false);
  });

  test("no-ops (does not re-process) when the order is already resolved", async () => {
    seedOrder({ status: "paid" });
    seedBooking({ financialStatus: "payment_confirmed" });
    const { confirmBookingPaymentFromWebhook } = require("../bookingPayment");
    const result = await confirmBookingPaymentFromWebhook({
      eventId: "evt_4",
      eventType: "payment.captured",
      orderId: "order_1",
      paymentId: "pay_retry",
    });
    expect(result.acted).toBe(false);
    expect(fakeDb.peek("tutorEarnings/tutor_1")).toBeUndefined();
  });

  test("flags, but does not credit, a second successful payment on a DIFFERENT order for an already-confirmed booking", async () => {
    // Order A already settled this booking.
    fakeDb.seed("bookingPaymentOrders/order_A", {
      bookingId: "booking_1", tutorUid: "tutor_1", grossAmountPaise: 50000, commissionRate: 10, status: "paid",
    });
    seedBooking({ financialStatus: "payment_confirmed" });
    // Order B is a second, distinct attempt that somehow also got captured.
    fakeDb.seed("bookingPaymentOrders/order_B", {
      bookingId: "booking_1", tutorUid: "tutor_1", grossAmountPaise: 50000, commissionRate: 10, status: "created",
    });
    const { confirmBookingPaymentFromWebhook } = require("../bookingPayment");

    const result = await confirmBookingPaymentFromWebhook({
      eventId: "evt_5", eventType: "payment.captured", orderId: "order_B", paymentId: "pay_B",
    });

    expect(result.acted).toBe(true);
    expect(result.reason).toMatch(/duplicate/);
    const orderB = fakeDb.peek("bookingPaymentOrders/order_B");
    expect(orderB?.["status"]).toBe("paid");
    expect(orderB?.["duplicateSettlement"]).toBe(true);
    // Earnings must NOT have been credited from order B — no tutorEarnings doc at all.
    expect(fakeDb.peek("tutorEarnings/tutor_1")).toBeUndefined();
  });
});

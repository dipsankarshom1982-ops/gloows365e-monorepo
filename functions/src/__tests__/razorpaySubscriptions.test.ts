// PATH: functions/src/__tests__/razorpaySubscriptions.test.ts
// Offline tests for functions/src/razorpaySubscriptions.ts — same
// jest.mock("firebase-admin"/"axios") + FakeFirestore harness as the rest
// of the offline suite (see bookingPayment.test.ts).

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

describe("createRazorpaySubscription", () => {
  test("rejects an unauthenticated caller", async () => {
    const { createRazorpaySubscription } = require("../razorpaySubscriptions");
    await expect(
      createRazorpaySubscription.run({ planId: "plan_pro", totalCount: 12 }, { auth: null }),
    ).rejects.toThrow();
  });

  test("rejects a plan with no razorpayPlanId configured — the documented manual dependency", async () => {
    fakeDb.seed("subscriptionPlans/plan_pro", { monthlyPrice: 499, isActive: true }); // no razorpayPlanId
    const { createRazorpaySubscription } = require("../razorpaySubscriptions");
    await expect(
      createRazorpaySubscription.run({ planId: "plan_pro", totalCount: 12 }, STUDENT_CONTEXT),
    ).rejects.toThrow(/not configured for native Razorpay Subscriptions/);
  });

  test("creates a subscription and writes the razorpaySubscriptions mapping doc", async () => {
    fakeDb.seed("subscriptionPlans/plan_pro", { razorpayPlanId: "plan_rzp_123", isActive: true });
    mockedAxios.post.mockResolvedValueOnce({ data: { id: "sub_test1", short_url: "https://rzp.io/i/abc" } });
    const { createRazorpaySubscription } = require("../razorpaySubscriptions");

    const result = await createRazorpaySubscription.run({ planId: "plan_pro", totalCount: 12 }, STUDENT_CONTEXT);

    expect(result.razorpaySubscriptionId).toBe("sub_test1");
    expect(result.shortUrl).toBe("https://rzp.io/i/abc");
    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://api.razorpay.com/v1/subscriptions",
      expect.objectContaining({ plan_id: "plan_rzp_123", total_count: 12 }),
      expect.objectContaining({ auth: { username: "test_key_id", password: "test_key_secret" } }),
    );

    const mapping = fakeDb.peek("razorpaySubscriptions/sub_test1");
    expect(mapping).toMatchObject({ uid: "student_1", planId: "plan_pro", status: "created" });
  });
});

describe("confirmSubscriptionInvoiceFromWebhook", () => {
  function seedSubscription(overrides: Partial<Record<string, unknown>> = {}) {
    fakeDb.seed("razorpaySubscriptions/sub_test1", {
      razorpaySubscriptionId: "sub_test1",
      uid: "student_1",
      planId: "plan_pro",
      status: "created",
      ...overrides,
    });
  }

  test("no-ops for an event whose subscription_id doesn't match any doc this app created", async () => {
    const { confirmSubscriptionInvoiceFromWebhook } = require("../razorpaySubscriptions");
    const result = await confirmSubscriptionInvoiceFromWebhook({
      eventId: "evt_1",
      eventType: "subscription.activated",
      subscriptionId: "sub_unknown",
    });
    expect(result.acted).toBe(false);
  });

  test("no-ops for an event that carries no subscription_id at all", async () => {
    const { confirmSubscriptionInvoiceFromWebhook } = require("../razorpaySubscriptions");
    const result = await confirmSubscriptionInvoiceFromWebhook({ eventId: "evt_1", eventType: "invoice.paid" });
    expect(result.acted).toBe(false);
  });

  test("subscription.activated flips the mapping doc's status to active", async () => {
    seedSubscription();
    const { confirmSubscriptionInvoiceFromWebhook } = require("../razorpaySubscriptions");
    const result = await confirmSubscriptionInvoiceFromWebhook({
      eventId: "evt_1",
      eventType: "subscription.activated",
      subscriptionId: "sub_test1",
    });
    expect(result.acted).toBe(true);
    expect(fakeDb.peek("razorpaySubscriptions/sub_test1")?.["status"]).toBe("active");
  });

  test("subscription.cancelled flips status to cancelled", async () => {
    seedSubscription({ status: "active" });
    const { confirmSubscriptionInvoiceFromWebhook } = require("../razorpaySubscriptions");
    await confirmSubscriptionInvoiceFromWebhook({
      eventId: "evt_1",
      eventType: "subscription.cancelled",
      subscriptionId: "sub_test1",
    });
    expect(fakeDb.peek("razorpaySubscriptions/sub_test1")?.["status"]).toBe("cancelled");
  });

  test("invoice.paid persists a real Razorpay invoice keyed by its own razorpay invoice id", async () => {
    seedSubscription({ status: "active" });
    const { confirmSubscriptionInvoiceFromWebhook } = require("../razorpaySubscriptions");
    const result = await confirmSubscriptionInvoiceFromWebhook({
      eventId: "evt_1",
      eventType: "invoice.paid",
      subscriptionId: "sub_test1",
      invoiceEntity: {
        id: "inv_rzp_1",
        order_id: "order_1",
        payment_id: "pay_1",
        amount: 49900,
        currency: "INR",
        invoice_pdf: "https://razorpay.com/invoice.pdf",
        short_url: "https://rzp.io/i/inv1",
      },
    });
    expect(result.acted).toBe(true);
    const doc = fakeDb.peek("invoices/inv_rzp_1");
    expect(doc).toMatchObject({
      invoiceId: "inv_rzp_1",
      source: "razorpay_native_subscription",
      razorpayInvoiceId: "inv_rzp_1",
      razorpaySubscriptionId: "sub_test1",
      razorpayOrderId: "order_1",
      razorpayPaymentId: "pay_1",
      uid: "student_1",
      status: "paid",
      planId: "plan_pro",
      totalAmountPaise: 49900,
      invoiceUrl: "https://razorpay.com/invoice.pdf",
      shortUrl: "https://rzp.io/i/inv1",
    });
  });

  test("invoice.paid twice (retried webhook delivery) never creates a second invoice doc", async () => {
    seedSubscription({ status: "active" });
    const { confirmSubscriptionInvoiceFromWebhook } = require("../razorpaySubscriptions");
    const event = {
      eventId: "evt_1",
      eventType: "invoice.paid",
      subscriptionId: "sub_test1",
      invoiceEntity: { id: "inv_rzp_1", amount: 49900, currency: "INR" },
    };
    await confirmSubscriptionInvoiceFromWebhook(event);
    await confirmSubscriptionInvoiceFromWebhook(event);
    expect(fakeDb.peek("invoices/inv_rzp_1")?.["totalAmountPaise"]).toBe(49900);
  });

  test("invoice.paid with no usable invoice entity is a safe no-op, not a crash", async () => {
    seedSubscription();
    const { confirmSubscriptionInvoiceFromWebhook } = require("../razorpaySubscriptions");
    const result = await confirmSubscriptionInvoiceFromWebhook({
      eventId: "evt_1",
      eventType: "invoice.paid",
      subscriptionId: "sub_test1",
    });
    expect(result.acted).toBe(false);
  });
});

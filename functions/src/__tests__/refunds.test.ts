// PATH: functions/src/__tests__/refunds.test.ts
//
// Offline unit tests for functions/src/refunds.ts — the Task 7 refund +
// reconciliation system — run directly against the REAL module (not a
// reimplementation of its logic) via each callable's `.run(data, context)`
// testing hook (firebase-functions v1's Runnable interface), with
// firebase-admin mocked onto an in-memory FakeFirestore (see
// helpers/fakeFirestore.ts's header for why: this machine's Java is too
// old for the emulator-backed suite) and axios mocked for the Razorpay
// calls. Covers, per the approved Task 8 priorities: duplicate refund
// prevention, entitlement clawback logic (incl. tutorEarnings never being
// touched), the "newer entitlement active" no-op branch, and terminal-
// status handling in the scheduled reconciler.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);
jest.mock("axios", () => ({ __esModule: true, default: { post: jest.fn(), get: jest.fn() } }));

import axios from "axios";
import { fakeDb } from "./helpers/mockFirebaseAdmin";

const mockedAxios = axios as unknown as { post: jest.Mock; get: jest.Mock };

const ADMIN_CONTEXT = { auth: { uid: "admin_1", token: { admin: true } } };

beforeEach(() => {
  fakeDb.reset();
  mockedAxios.post.mockReset();
  mockedAxios.get.mockReset();
  process.env["RAZORPAY_KEY_ID"] = "test_key_id";
  process.env["RAZORPAY_KEY_SECRET"] = "test_key_secret";
});

function seedAiGuruOrder(overrides: Partial<Record<string, unknown>> = {}) {
  fakeDb.seed("aiGuruSubscriptionOrders/order_1", {
    uid: "student_1",
    planId: "pro",
    cycle: "monthly",
    amountPaise: 19900,
    status: "paid",
    razorpayPaymentId: "pay_1",
    paidAt: "seed",
    ...overrides,
  });
}

describe("processRefund — permission + validation", () => {
  test("rejects a non-admin caller", async () => {
    const { processRefund } = require("../refunds");
    await expect(
      processRefund.run({ flow: "aiGuruSubscription", razorpayPaymentId: "pay_1", reason: "x" }, { auth: { uid: "u1", token: {} } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("rejects a missing reason", async () => {
    const { processRefund } = require("../refunds");
    await expect(
      processRefund.run({ flow: "aiGuruSubscription", razorpayPaymentId: "pay_1" }, ADMIN_CONTEXT)
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("rejects an order that isn't in 'paid' status", async () => {
    seedAiGuruOrder({ status: "created" });
    const { processRefund } = require("../refunds");
    await expect(
      processRefund.run({ flow: "aiGuruSubscription", razorpayPaymentId: "pay_1", reason: "test" }, ADMIN_CONTEXT)
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });
});

describe("processRefund — duplicate prevention", () => {
  test("a second refund attempt on an already-succeeded payment is rejected BEFORE calling Razorpay again", async () => {
    seedAiGuruOrder();
    fakeDb.seed("subscriptions/student_1", { status: "active", razorpayOrderId: "order_1" });
    mockedAxios.post.mockResolvedValueOnce({ data: { id: "rfnd_1", status: "processed" } });

    const { processRefund } = require("../refunds");
    const first = await processRefund.run(
      { flow: "aiGuruSubscription", razorpayPaymentId: "pay_1", reason: "customer request" },
      ADMIN_CONTEXT
    );
    expect(first.success).toBe(true);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);

    // The first success already flipped the order to "refunded", so this
    // retry is actually caught by the earlier order.status !== "paid"
    // guard, not the refunds/{id} duplicate-doc guard (that guard is what
    // catches a retry that arrives WHILE a refund is still "processing" —
    // covered separately below). Both paths converge on the same outcome:
    // Razorpay is never called a second time.
    await expect(
      processRefund.run({ flow: "aiGuruSubscription", razorpayPaymentId: "pay_1", reason: "retry" }, ADMIN_CONTEXT)
    ).rejects.toMatchObject({ code: "failed-precondition" });

    // The critical assertion: Razorpay was NOT called a second time.
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  test("a same-payment retry while the order is still 'paid' (refund doc already 'succeeded') is rejected by the duplicate-doc guard itself", async () => {
    seedAiGuruOrder(); // order stays "paid" — simulating the refund doc getting ahead of the order write somehow
    fakeDb.seed("refunds/aiGuruSubscription_pay_1", { status: "succeeded" });

    const { processRefund } = require("../refunds");
    await expect(
      processRefund.run({ flow: "aiGuruSubscription", razorpayPaymentId: "pay_1", reason: "retry" }, ADMIN_CONTEXT)
    ).rejects.toMatchObject({ code: "already-exists" });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  test("a refund left 'processing' (e.g. a crashed prior attempt) blocks a concurrent retry", async () => {
    seedAiGuruOrder();
    fakeDb.seed("refunds/aiGuruSubscription_pay_1", { status: "processing" });

    const { processRefund } = require("../refunds");
    await expect(
      processRefund.run({ flow: "aiGuruSubscription", razorpayPaymentId: "pay_1", reason: "retry" }, ADMIN_CONTEXT)
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  test("a refund flagged 'needs_reconciliation' hard-blocks retries until resolved", async () => {
    seedAiGuruOrder();
    fakeDb.seed("refunds/aiGuruSubscription_pay_1", { status: "needs_reconciliation" });

    const { processRefund } = require("../refunds");
    await expect(
      processRefund.run({ flow: "aiGuruSubscription", razorpayPaymentId: "pay_1", reason: "retry" }, ADMIN_CONTEXT)
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  test("a previously-'failed' refund CAN be retried", async () => {
    seedAiGuruOrder();
    fakeDb.seed("subscriptions/student_1", { status: "active", razorpayOrderId: "order_1" });
    fakeDb.seed("refunds/aiGuruSubscription_pay_1", { status: "failed" });
    mockedAxios.post.mockResolvedValueOnce({ data: { id: "rfnd_1", status: "processed" } });

    const { processRefund } = require("../refunds");
    const result = await processRefund.run(
      { flow: "aiGuruSubscription", razorpayPaymentId: "pay_1", reason: "retry after fix" },
      ADMIN_CONTEXT
    );
    expect(result.success).toBe(true);
  });
});

describe("processRefund — subscription entitlement resolution", () => {
  test("revokes the subscription when the refunded order is the one currently backing access", async () => {
    seedAiGuruOrder();
    fakeDb.seed("subscriptions/student_1", { status: "active", razorpayOrderId: "order_1" });
    mockedAxios.post.mockResolvedValueOnce({ data: { id: "rfnd_1", status: "processed" } });

    const { processRefund } = require("../refunds");
    const result = await processRefund.run(
      { flow: "aiGuruSubscription", razorpayPaymentId: "pay_1", reason: "customer request" },
      ADMIN_CONTEXT
    );

    expect(result.entitlementAction.type).toBe("revoked");
    const sub = fakeDb.peek("subscriptions/student_1")!;
    expect(sub.status).toBe("refunded");
  });

  test("leaves a newer, currently-active subscription untouched when it's backed by a DIFFERENT order", async () => {
    seedAiGuruOrder(); // order_1, pay_1
    // The user renewed since — a different order now backs their access.
    fakeDb.seed("subscriptions/student_1", { status: "active", razorpayOrderId: "order_2_newer" });
    mockedAxios.post.mockResolvedValueOnce({ data: { id: "rfnd_1", status: "processed" } });

    const { processRefund } = require("../refunds");
    const result = await processRefund.run(
      { flow: "aiGuruSubscription", razorpayPaymentId: "pay_1", reason: "customer request" },
      ADMIN_CONTEXT
    );

    expect(result.entitlementAction.type).toBe("no_action_newer_entitlement_active");
    const sub = fakeDb.peek("subscriptions/student_1")!;
    // Still active, still pointing at the newer order — untouched.
    expect(sub.status).toBe("active");
    expect(sub.razorpayOrderId).toBe("order_2_newer");
  });
});

describe("processRefund — credit pool clawback (aiGuruCredits / tutorCredits)", () => {
  test("claws back the full purchased credits when the balance covers it", async () => {
    fakeDb.seed("aiGuruCreditOrders/order_2", {
      uid: "student_1", packId: "pack_50", credits: 50, amountPaise: 9900,
      status: "paid", razorpayPaymentId: "pay_2", paidAt: "seed",
    });
    fakeDb.seed("aiGuruCredits/student_1", { balance: 80 });
    mockedAxios.post.mockResolvedValueOnce({ data: { id: "rfnd_2", status: "processed" } });

    const { processRefund } = require("../refunds");
    const result = await processRefund.run(
      { flow: "aiGuruCredits", razorpayPaymentId: "pay_2", reason: "unused credits" },
      ADMIN_CONTEXT
    );

    expect(result.entitlementAction).toMatchObject({ type: "clawed_back_credits", creditsClawedBack: 50 });
    expect(fakeDb.peek("aiGuruCredits/student_1")!.balance).toBe(30);
  });

  test("claws back only what's left in the pool when most of the purchase was already spent — and NEVER touches tutorEarnings", async () => {
    fakeDb.seed("tutorCreditOrders/order_3", {
      uid: "tutor_student_1", packId: "pack_100", credits: 100, amountPaise: 19900,
      status: "paid", razorpayPaymentId: "pay_3", paidAt: "seed",
    });
    fakeDb.seed("tutorCredits/tutor_student_1", { balance: 12 }); // most of the 100 already spent
    // Simulate a tutor who already got paid from those spent credits and
    // already withdrew — this doc must be provably untouched afterwards.
    fakeDb.seed("tutorEarnings/some_tutor_uid", { availableBalance: 5000, withdrawnTotal: 3000 });
    mockedAxios.post.mockResolvedValueOnce({ data: { id: "rfnd_3", status: "processed" } });

    const { processRefund } = require("../refunds");
    const result = await processRefund.run(
      { flow: "tutorCredits", razorpayPaymentId: "pay_3", reason: "unused credits" },
      ADMIN_CONTEXT
    );

    expect(result.entitlementAction).toMatchObject({ type: "clawed_back_credits", creditsClawedBack: 12 });
    expect(fakeDb.peek("tutorCredits/tutor_student_1")!.balance).toBe(0);
    // The critical financial-safety assertion for this flow: a tutor's
    // real (possibly already-withdrawn) earnings are never auto-reversed.
    expect(fakeDb.peek("tutorEarnings/some_tutor_uid")).toEqual({ availableBalance: 5000, withdrawnTotal: 3000 });
  });

  test("claws back nothing (but still succeeds) when the whole pool was already spent", async () => {
    fakeDb.seed("aiGuruCreditOrders/order_4", {
      uid: "student_1", packId: "pack_50", credits: 50, amountPaise: 9900,
      status: "paid", razorpayPaymentId: "pay_4", paidAt: "seed",
    });
    fakeDb.seed("aiGuruCredits/student_1", { balance: 0 });
    mockedAxios.post.mockResolvedValueOnce({ data: { id: "rfnd_4", status: "processed" } });

    const { processRefund } = require("../refunds");
    const result = await processRefund.run(
      { flow: "aiGuruCredits", razorpayPaymentId: "pay_4", reason: "unused credits" },
      ADMIN_CONTEXT
    );

    expect(result.entitlementAction).toMatchObject({ type: "clawed_back_credits", creditsClawedBack: 0 });
    expect(fakeDb.peek("aiGuruCredits/student_1")!.balance).toBe(0);
  });
});

describe("processRefund — Razorpay 'already refunded' edge case", () => {
  test("flags needs_reconciliation instead of guessing, and leaves the order/entitlement untouched", async () => {
    seedAiGuruOrder();
    fakeDb.seed("subscriptions/student_1", { status: "active", razorpayOrderId: "order_1" });
    mockedAxios.post.mockRejectedValueOnce({
      response: { data: { error: { description: "The payment has already been fully refunded" } } },
    });
    mockedAxios.get.mockResolvedValueOnce({ data: { items: [{ id: "rfnd_existing", status: "processed" }] } });

    const { processRefund } = require("../refunds");
    await expect(
      processRefund.run({ flow: "aiGuruSubscription", razorpayPaymentId: "pay_1", reason: "customer request" }, ADMIN_CONTEXT)
    ).rejects.toMatchObject({ code: "failed-precondition" });

    expect(fakeDb.peek("refunds/aiGuruSubscription_pay_1")!.status).toBe("needs_reconciliation");
    // Order and subscription must be untouched — we don't know the real
    // external state yet, so nothing here is guessed at.
    expect(fakeDb.peek("aiGuruSubscriptionOrders/order_1")!.status).toBe("paid");
    expect(fakeDb.peek("subscriptions/student_1")!.status).toBe("active");
  });

  test("a plain Razorpay failure (not an already-refunded signature) is recorded as 'failed', not 'needs_reconciliation'", async () => {
    seedAiGuruOrder();
    mockedAxios.post.mockRejectedValueOnce({ response: { data: { error: { description: "Gateway timeout" } } } });

    const { processRefund } = require("../refunds");
    await expect(
      processRefund.run({ flow: "aiGuruSubscription", razorpayPaymentId: "pay_1", reason: "customer request" }, ADMIN_CONTEXT)
    ).rejects.toMatchObject({ code: "internal" });

    expect(fakeDb.peek("refunds/aiGuruSubscription_pay_1")!.status).toBe("failed");
  });
});

describe("resolveRefundReconciliation", () => {
  test("'not_actually_refunded' clears the flag back to failed so a normal retry can proceed", async () => {
    fakeDb.seed("refunds/aiGuruSubscription_pay_1", { status: "needs_reconciliation", flow: "aiGuruSubscription", razorpayPaymentId: "pay_1" });

    const { resolveRefundReconciliation } = require("../refunds");
    const result = await resolveRefundReconciliation.run(
      { refundId: "aiGuruSubscription_pay_1", resolution: "not_actually_refunded", note: "false alarm" },
      ADMIN_CONTEXT
    );

    expect(result.status).toBe("failed");
    expect(fakeDb.peek("refunds/aiGuruSubscription_pay_1")!.status).toBe("failed");
  });

  test("'confirmed_refunded' applies the same entitlement resolution as a normal success", async () => {
    seedAiGuruOrder(); // order_1 still "paid" — the manual refund happened outside this system
    fakeDb.seed("subscriptions/student_1", { status: "active", razorpayOrderId: "order_1" });
    fakeDb.seed("refunds/aiGuruSubscription_pay_1", {
      status: "needs_reconciliation", flow: "aiGuruSubscription", razorpayPaymentId: "pay_1", orderCollection: "aiGuruSubscriptionOrders",
    });

    const { resolveRefundReconciliation } = require("../refunds");
    const result = await resolveRefundReconciliation.run(
      { refundId: "aiGuruSubscription_pay_1", resolution: "confirmed_refunded", note: "verified in Razorpay dashboard" },
      ADMIN_CONTEXT
    );

    expect(result.status).toBe("succeeded");
    expect(result.entitlementAction.type).toBe("revoked");
    expect(fakeDb.peek("subscriptions/student_1")!.status).toBe("refunded");
    expect(fakeDb.peek("aiGuruSubscriptionOrders/order_1")!.status).toBe("refunded");
  });

  test("rejects resolving a refund that isn't in needs_reconciliation", async () => {
    fakeDb.seed("refunds/aiGuruSubscription_pay_1", { status: "succeeded" });
    const { resolveRefundReconciliation } = require("../refunds");
    await expect(
      resolveRefundReconciliation.run({ refundId: "aiGuruSubscription_pay_1", resolution: "not_actually_refunded" }, ADMIN_CONTEXT)
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });
});

describe("reconcileRefundStatuses — scheduled status sync", () => {
  test("skips refunds already in a terminal razorpayRefundStatus", async () => {
    fakeDb.seed("refunds/x_1", { status: "succeeded", razorpayRefundStatus: "processed", razorpayPaymentId: "pay_a", razorpayRefundId: "rfnd_a" });

    const { reconcileRefundStatuses } = require("../refunds");
    await reconcileRefundStatuses.run({}, {});

    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  test("updates a non-terminal refund status to what Razorpay currently reports", async () => {
    fakeDb.seed("refunds/x_2", { status: "succeeded", razorpayRefundStatus: "pending", razorpayPaymentId: "pay_b", razorpayRefundId: "rfnd_b" });
    mockedAxios.get.mockResolvedValueOnce({ data: { status: "processed" } });

    const { reconcileRefundStatuses } = require("../refunds");
    await reconcileRefundStatuses.run({}, {});

    expect(fakeDb.peek("refunds/x_2")!.razorpayRefundStatus).toBe("processed");
  });

  test("never touches a refund that isn't in 'succeeded' status", async () => {
    fakeDb.seed("refunds/x_3", { status: "needs_reconciliation", razorpayRefundStatus: "pending", razorpayPaymentId: "pay_c", razorpayRefundId: "rfnd_c" });

    const { reconcileRefundStatuses } = require("../refunds");
    await reconcileRefundStatuses.run({}, {});

    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(fakeDb.peek("refunds/x_3")!.razorpayRefundStatus).toBe("pending");
  });
});

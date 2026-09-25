// PATH: functions/src/__tests__/aiGuruSubscription.test.ts
//
// Offline unit tests for aiGuruCreateSubscription's verify-payment path —
// the client-to-Cloud-Function payment idempotency contract. See
// refunds.test.ts's header for the mocking approach (real module, mocked
// firebase-admin via FakeFirestore, no emulator).

import * as crypto from "crypto";

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "./helpers/mockFirebaseAdmin";

const KEY_SECRET = "test_key_secret";

beforeEach(() => {
  fakeDb.reset();
  process.env["RAZORPAY_KEY_ID"] = "test_key_id";
  process.env["RAZORPAY_KEY_SECRET"] = KEY_SECRET;
});

function sign(orderId: string, paymentId: string) {
  return crypto.createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
}

const AUTH_CTX = { auth: { uid: "student_1" } };

describe("aiGuruCreateSubscription — verify-payment idempotency", () => {
  test("first verify activates the subscription and marks the order paid", async () => {
    fakeDb.seed("aiGuruSubscriptionOrders/order_1", { uid: "student_1", planId: "pro", cycle: "monthly", status: "created" });
    const { aiGuruCreateSubscription } = require("../aiGuruSubscription");

    const result = await aiGuruCreateSubscription.run(
      { razorpayPaymentId: "pay_1", razorpayOrderId: "order_1", razorpaySignature: sign("order_1", "pay_1") },
      AUTH_CTX
    );

    expect(result).toMatchObject({ success: true, planId: "pro", cycle: "monthly" });
    expect(fakeDb.peek("aiGuruSubscriptionOrders/order_1")!.status).toBe("paid");
    expect(fakeDb.peek("subscriptions/student_1")).toMatchObject({ status: "active", planId: "pro" });
  });

  test("a second verify on the same order is a no-op — reports alreadyActivated, does not re-write the subscription", async () => {
    fakeDb.seed("aiGuruSubscriptionOrders/order_1", { uid: "student_1", planId: "pro", cycle: "monthly", status: "created" });
    const { aiGuruCreateSubscription } = require("../aiGuruSubscription");

    await aiGuruCreateSubscription.run(
      { razorpayPaymentId: "pay_1", razorpayOrderId: "order_1", razorpaySignature: sign("order_1", "pay_1") },
      AUTH_CTX
    );
    const subAfterFirst = fakeDb.peek("subscriptions/student_1");

    const second = await aiGuruCreateSubscription.run(
      { razorpayPaymentId: "pay_1", razorpayOrderId: "order_1", razorpaySignature: sign("order_1", "pay_1") },
      AUTH_CTX
    );

    expect(second).toMatchObject({ success: true, planId: "pro", cycle: "monthly" });
    // The subscription doc must be byte-for-byte unchanged by the replay —
    // this is the actual idempotency guarantee, not just a status flag.
    expect(fakeDb.peek("subscriptions/student_1")).toEqual(subAfterFirst);
  });

  test("rejects a bad/forged signature", async () => {
    fakeDb.seed("aiGuruSubscriptionOrders/order_1", { uid: "student_1", planId: "pro", cycle: "monthly", status: "created" });
    const { aiGuruCreateSubscription } = require("../aiGuruSubscription");

    await expect(
      aiGuruCreateSubscription.run(
        { razorpayPaymentId: "pay_1", razorpayOrderId: "order_1", razorpaySignature: "forged" },
        AUTH_CTX
      )
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(fakeDb.peek("subscriptions/student_1")).toBeUndefined();
  });

  test("rejects verifying an order that belongs to a different uid", async () => {
    fakeDb.seed("aiGuruSubscriptionOrders/order_1", { uid: "someone_else", planId: "pro", cycle: "monthly", status: "created" });
    const { aiGuruCreateSubscription } = require("../aiGuruSubscription");

    await expect(
      aiGuruCreateSubscription.run(
        { razorpayPaymentId: "pay_1", razorpayOrderId: "order_1", razorpaySignature: sign("order_1", "pay_1") },
        AUTH_CTX
      )
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("rejects an unauthenticated caller", async () => {
    const { aiGuruCreateSubscription } = require("../aiGuruSubscription");
    await expect(
      aiGuruCreateSubscription.run(
        { razorpayPaymentId: "pay_1", razorpayOrderId: "order_1", razorpaySignature: sign("order_1", "pay_1") },
        { auth: null }
      )
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });
});

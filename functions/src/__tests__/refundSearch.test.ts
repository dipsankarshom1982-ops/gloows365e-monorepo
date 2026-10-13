// PATH: functions/src/__tests__/refundSearch.test.ts
//
// Offline unit tests for functions/src/refundSearch.ts -- searchPaymentOrders
// and getPaymentDetail, backing the Payment Management admin section. Same
// mocking approach as refunds.test.ts (real module, mocked firebase-admin
// via FakeFirestore, no emulator). Covers the superAdmin-only permission
// gate, every lookup path (razorpayOrderId, razorpayPaymentId, studentId,
// uid, email, name-prefix), cursor pagination, status/date filters, the
// Seekho flow's userId-vs-uid field-name mapping, and getPaymentDetail's
// consolidated order+student+entitlement+refund payload including the
// "does the current entitlement still belong to this order" distinction.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb, seedAuthUser, resetAuthUsers } from "./helpers/mockFirebaseAdmin";
import { FakeTimestamp } from "./helpers/fakeFirestore";

function ts(dateStr: string) {
  return FakeTimestamp.fromMillis(new Date(dateStr).getTime());
}

const SUPERADMIN_CONTEXT = { auth: { uid: "superadmin_1", token: { admin: true, superAdmin: true } } };
const ADMIN_ONLY_CONTEXT = { auth: { uid: "admin_1", token: { admin: true } } }; // admin, NOT superAdmin
const STUDENT_CONTEXT = { auth: { uid: "student_1", token: {} } };

beforeEach(() => {
  fakeDb.reset();
  resetAuthUsers();
});

function seedOrder(id: string, data: Record<string, unknown>) {
  fakeDb.seed(`aiGuruSubscriptionOrders/${id}`, data);
}
function seedStudent(uid: string, data: Record<string, unknown>) {
  fakeDb.seed(`students/${uid}`, data);
}

describe("searchPaymentOrders — permission gate", () => {
  test("rejects a non-admin caller", async () => {
    const { searchPaymentOrders } = require("../refundSearch");
    await expect(
      searchPaymentOrders.run({ flow: "aiGuruSubscription", razorpayPaymentId: "pay_1" }, STUDENT_CONTEXT)
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("rejects an admin who is NOT a superAdmin — this surface is stricter than processRefund", async () => {
    const { searchPaymentOrders } = require("../refundSearch");
    await expect(
      searchPaymentOrders.run({ flow: "aiGuruSubscription", razorpayPaymentId: "pay_1" }, ADMIN_ONLY_CONTEXT)
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("rejects an invalid flow", async () => {
    const { searchPaymentOrders } = require("../refundSearch");
    await expect(
      searchPaymentOrders.run({ flow: "notARealFlow" }, SUPERADMIN_CONTEXT)
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });
});

describe("searchPaymentOrders — direct lookups", () => {
  test("razorpayOrderId finds the exact order and attaches student display info", async () => {
    seedOrder("order_1", { uid: "student_1", status: "paid", amountPaise: 1000, razorpayPaymentId: "pay_1" });
    seedStudent("student_1", { studentId: "GLS000123", name: "Asha Verma", email: "asha@example.com" });
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", razorpayOrderId: "order_1" }, SUPERADMIN_CONTEXT
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      id: "order_1", status: "paid", razorpayPaymentId: "pay_1",
      studentId: "GLS000123", studentName: "Asha Verma", studentEmail: "asha@example.com",
    });
  });

  test("razorpayOrderId for a non-existent order returns empty, not an error", async () => {
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", razorpayOrderId: "order_nope" }, SUPERADMIN_CONTEXT
    );
    expect(result.rows).toEqual([]);
  });

  test("razorpayPaymentId finds the order via the same query processRefund itself uses", async () => {
    seedOrder("order_2", { uid: "student_1", status: "paid", amountPaise: 1000, razorpayPaymentId: "pay_2" });
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", razorpayPaymentId: "pay_2" }, SUPERADMIN_CONTEXT
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe("order_2");
  });
});

describe("searchPaymentOrders — studentId / uid / email lookup", () => {
  test("studentId (GLS######) resolves to a uid via students/{uid}, then scopes results", async () => {
    seedStudent("student_1", { studentId: "GLS000123", name: "Asha Verma" });
    seedOrder("order_a", { uid: "student_1", status: "paid", amountPaise: 1000, createdAt: ts("2026-01-01") });
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", studentId: "gls000123" }, SUPERADMIN_CONTEXT // lowercase input, must still match
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe("order_a");
  });

  test("uid scopes results to that user's orders only", async () => {
    seedOrder("order_a", { uid: "student_1", status: "paid", amountPaise: 1000, createdAt: ts("2026-01-01") });
    seedOrder("order_b", { uid: "student_2", status: "paid", amountPaise: 2000, createdAt: ts("2026-01-02") });
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", uid: "student_1" }, SUPERADMIN_CONTEXT
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe("order_a");
  });

  test("email resolves to uid via Auth before searching, and populates studentEmail on results", async () => {
    seedAuthUser("student_1", "student@example.com");
    seedOrder("order_a", { uid: "student_1", status: "paid", amountPaise: 1000, createdAt: ts("2026-01-01") });
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", email: "student@example.com" }, SUPERADMIN_CONTEXT
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].studentEmail).toBe("student@example.com");
  });

  test("an email with no matching Auth user returns empty, not an error", async () => {
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", email: "nobody@example.com" }, SUPERADMIN_CONTEXT
    );
    expect(result.rows).toEqual([]);
  });

  test("a name prefix resolves to matching students' orders (case-insensitive)", async () => {
    seedStudent("student_1", { name: "Asha Verma" });
    seedStudent("student_2", { name: "Rohan Gupta" });
    seedOrder("order_a", { uid: "student_1", status: "paid", amountPaise: 1000, createdAt: ts("2026-01-01") });
    seedOrder("order_b", { uid: "student_2", status: "paid", amountPaise: 1000, createdAt: ts("2026-01-02") });
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", name: "asha" }, SUPERADMIN_CONTEXT
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe("order_a");
  });
});

describe("searchPaymentOrders — general browse: filters and pagination", () => {
  test("status filter narrows a browse to only matching orders", async () => {
    seedOrder("order_a", { uid: "student_1", status: "paid", amountPaise: 1000, createdAt: ts("2026-01-01") });
    seedOrder("order_b", { uid: "student_2", status: "created", amountPaise: 1000, createdAt: ts("2026-01-02") });
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", status: "paid" }, SUPERADMIN_CONTEXT
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe("order_a");
  });

  test("date-range filter excludes orders outside the window", async () => {
    seedOrder("order_jan", { uid: "student_1", status: "paid", amountPaise: 1000, createdAt: ts("2026-01-15") });
    seedOrder("order_mar", { uid: "student_1", status: "paid", amountPaise: 1000, createdAt: ts("2026-03-15") });
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", startDate: "2026-02-01", endDate: "2026-02-28" }, SUPERADMIN_CONTEXT
    );
    expect(result.rows).toEqual([]);

    const result2 = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", startDate: "2026-01-01", endDate: "2026-01-31" }, SUPERADMIN_CONTEXT
    );
    expect(result2.rows).toHaveLength(1);
    expect(result2.rows[0].id).toBe("order_jan");
  });

  test("amount-range filter (min/max, both inclusive) narrows a browse", async () => {
    seedOrder("order_cheap", { uid: "student_1", status: "paid", amountPaise: 500, createdAt: ts("2026-01-01") });
    seedOrder("order_mid", { uid: "student_1", status: "paid", amountPaise: 1000, createdAt: ts("2026-01-02") });
    seedOrder("order_expensive", { uid: "student_1", status: "paid", amountPaise: 5000, createdAt: ts("2026-01-03") });
    const { searchPaymentOrders } = require("../refundSearch");

    const result = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", minAmountPaise: 800, maxAmountPaise: 2000 }, SUPERADMIN_CONTEXT
    );
    expect(result.rows.map((r: any) => r.id)).toEqual(["order_mid"]);

    // Boundary values are inclusive on both ends.
    const boundary = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", minAmountPaise: 500, maxAmountPaise: 1000 }, SUPERADMIN_CONTEXT
    );
    expect(boundary.rows.map((r: any) => r.id).sort()).toEqual(["order_cheap", "order_mid"]);

    const onlyMin = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", minAmountPaise: 1000 }, SUPERADMIN_CONTEXT
    );
    expect(onlyMin.rows.map((r: any) => r.id).sort()).toEqual(["order_expensive", "order_mid"]);
  });

  test("browse orders newest-first", async () => {
    seedOrder("order_old", { uid: "student_1", status: "paid", amountPaise: 1000, createdAt: ts("2026-01-01") });
    seedOrder("order_new", { uid: "student_1", status: "paid", amountPaise: 1000, createdAt: ts("2026-06-01") });
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run({ flow: "aiGuruSubscription" }, SUPERADMIN_CONTEXT);
    expect(result.rows.map((r: any) => r.id)).toEqual(["order_new", "order_old"]);
  });

  test("pageSize + cursor page through results without repeats or gaps", async () => {
    seedOrder("order_1", { uid: "student_1", status: "paid", amountPaise: 100, createdAt: ts("2026-01-01") });
    seedOrder("order_2", { uid: "student_1", status: "paid", amountPaise: 100, createdAt: ts("2026-01-02") });
    seedOrder("order_3", { uid: "student_1", status: "paid", amountPaise: 100, createdAt: ts("2026-01-03") });
    const { searchPaymentOrders } = require("../refundSearch");

    const page1 = await searchPaymentOrders.run({ flow: "aiGuruSubscription", pageSize: 2 }, SUPERADMIN_CONTEXT);
    expect(page1.rows.map((r: any) => r.id)).toEqual(["order_3", "order_2"]);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", pageSize: 2, cursor: page1.nextCursor }, SUPERADMIN_CONTEXT
    );
    expect(page2.rows.map((r: any) => r.id)).toEqual(["order_1"]);
    expect(page2.nextCursor).toBeNull(); // fewer rows than pageSize -> no further page
  });
});

describe("searchPaymentOrders — flow mapping", () => {
  test("seekhoSubscription flow queries seekho_subscription_orders keyed by userId, not uid", async () => {
    fakeDb.seed("seekho_subscription_orders/order_seekho_1", {
      userId: "student_1", status: "paid", amountPaise: 500, createdAt: ts("2026-01-01"),
    });
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run(
      { flow: "seekhoSubscription", uid: "student_1" }, SUPERADMIN_CONTEXT
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].uid).toBe("student_1");
  });
});

describe("getPaymentDetail", () => {
  test("rejects a non-superAdmin caller", async () => {
    const { getPaymentDetail } = require("../refundSearch");
    await expect(
      getPaymentDetail.run({ flow: "aiGuruSubscription", orderId: "order_1" }, ADMIN_ONLY_CONTEXT)
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("rejects a non-existent order", async () => {
    const { getPaymentDetail } = require("../refundSearch");
    await expect(
      getPaymentDetail.run({ flow: "aiGuruSubscription", orderId: "order_nope" }, SUPERADMIN_CONTEXT)
    ).rejects.toMatchObject({ code: "not-found" });
  });

  test("returns order + student + entitlement + refund, with entitlementBelongsToThisOrder true when they match", async () => {
    seedOrder("order_1", {
      uid: "student_1", planId: "pro", cycle: "monthly", status: "refunded",
      amountPaise: 1000, razorpayPaymentId: "pay_1", createdAt: ts("2026-01-01"), paidAt: ts("2026-01-01"), refundedAt: ts("2026-01-05"),
    });
    seedStudent("student_1", { studentId: "GLS000123", name: "Asha Verma", email: "asha@example.com", phone: "9876543210" });
    fakeDb.seed("subscriptions/student_1", { status: "refunded", razorpayOrderId: "order_1", planId: "pro" });
    fakeDb.seed("refunds/aiGuruSubscription_pay_1", { status: "succeeded", reason: "customer request", requestedBy: "admin_1" });

    const { getPaymentDetail } = require("../refundSearch");
    const result = await getPaymentDetail.run({ flow: "aiGuruSubscription", orderId: "order_1" }, SUPERADMIN_CONTEXT);

    expect(result.order).toMatchObject({ id: "order_1", status: "refunded", razorpayPaymentId: "pay_1", planId: "pro" });
    expect(result.student).toMatchObject({ studentId: "GLS000123", name: "Asha Verma", email: "asha@example.com" });
    expect(result.entitlement).toMatchObject({ status: "refunded", razorpayOrderId: "order_1" });
    expect(result.entitlementBelongsToThisOrder).toBe(true);
    expect(result.refund).toMatchObject({ status: "succeeded", reason: "customer request" });
  });

  test("entitlementBelongsToThisOrder is false when a newer order now backs the subscription", async () => {
    seedOrder("order_1", { uid: "student_1", planId: "pro", cycle: "monthly", status: "paid", amountPaise: 1000, razorpayPaymentId: "pay_1" });
    fakeDb.seed("subscriptions/student_1", { status: "active", razorpayOrderId: "order_2_newer" });

    const { getPaymentDetail } = require("../refundSearch");
    const result = await getPaymentDetail.run({ flow: "aiGuruSubscription", orderId: "order_1" }, SUPERADMIN_CONTEXT);

    expect(result.entitlementBelongsToThisOrder).toBe(false);
  });

  test("entitlementBelongsToThisOrder is null for a credit-pool flow (shared balance, no owning order)", async () => {
    fakeDb.seed("aiGuruCreditOrders/order_c1", { uid: "student_1", packId: "pack_50", credits: 50, status: "paid", amountPaise: 1000, razorpayPaymentId: "pay_c1" });
    fakeDb.seed("aiGuruCredits/student_1", { balance: 30 });

    const { getPaymentDetail } = require("../refundSearch");
    const result = await getPaymentDetail.run({ flow: "aiGuruCredits", orderId: "order_c1" }, SUPERADMIN_CONTEXT);

    expect(result.entitlement).toMatchObject({ balance: 30 });
    expect(result.entitlementBelongsToThisOrder).toBeNull();
  });

  test("refund is null when the payment was never refunded", async () => {
    seedOrder("order_1", { uid: "student_1", status: "paid", amountPaise: 1000, razorpayPaymentId: "pay_1" });
    const { getPaymentDetail } = require("../refundSearch");
    const result = await getPaymentDetail.run({ flow: "aiGuruSubscription", orderId: "order_1" }, SUPERADMIN_CONTEXT);
    expect(result.refund).toBeNull();
  });

  test("falls back to Auth email when there's no students/{uid} doc (e.g. a tutor buying tutor credits)", async () => {
    fakeDb.seed("tutorCreditOrders/order_t1", { uid: "tutor_1", packId: "pack_100", credits: 100, status: "paid", amountPaise: 2000 });
    seedAuthUser("tutor_1", "tutor@example.com");

    const { getPaymentDetail } = require("../refundSearch");
    const result = await getPaymentDetail.run({ flow: "tutorCredits", orderId: "order_t1" }, SUPERADMIN_CONTEXT);

    expect(result.student).toMatchObject({ studentId: null, email: "tutor@example.com" });
  });
});

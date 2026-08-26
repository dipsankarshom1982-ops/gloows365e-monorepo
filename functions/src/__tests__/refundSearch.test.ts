// PATH: functions/src/__tests__/refundSearch.test.ts
//
// Offline unit tests for functions/src/refundSearch.ts's searchPaymentOrders
// — the read-only admin lookup added alongside the Refund Management UI's
// "Find Payment" panel. Same mocking approach as refunds.test.ts (real
// module, mocked firebase-admin via FakeFirestore, no emulator). Covers the
// permission gate and every lookup path: razorpayOrderId, razorpayPaymentId,
// uid, email→uid resolution, and status/date-range filtering on a general
// browse.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb, seedAuthUser, resetAuthUsers } from "./helpers/mockFirebaseAdmin";
import { FakeTimestamp } from "./helpers/fakeFirestore";

function ts(dateStr: string) {
  return FakeTimestamp.fromMillis(new Date(dateStr).getTime());
}

const ADMIN_CONTEXT = { auth: { uid: "admin_1", token: { admin: true } } };
const STUDENT_CONTEXT = { auth: { uid: "student_1", token: {} } };

beforeEach(() => {
  fakeDb.reset();
  resetAuthUsers();
});

function seedOrder(id: string, data: Record<string, unknown>) {
  fakeDb.seed(`aiGuruSubscriptionOrders/${id}`, data);
}

describe("searchPaymentOrders — permission gate", () => {
  test("rejects a non-admin caller", async () => {
    const { searchPaymentOrders } = require("../refundSearch");
    await expect(
      searchPaymentOrders.run({ flow: "aiGuruSubscription", razorpayPaymentId: "pay_1" }, STUDENT_CONTEXT)
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("rejects an invalid flow", async () => {
    const { searchPaymentOrders } = require("../refundSearch");
    await expect(
      searchPaymentOrders.run({ flow: "notARealFlow" }, ADMIN_CONTEXT)
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });
});

describe("searchPaymentOrders — direct lookups", () => {
  test("razorpayOrderId finds the exact order (it's the doc ID)", async () => {
    seedOrder("order_1", { uid: "student_1", status: "paid", amountPaise: 1000, razorpayPaymentId: "pay_1" });
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", razorpayOrderId: "order_1" }, ADMIN_CONTEXT
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ id: "order_1", status: "paid", razorpayPaymentId: "pay_1" });
  });

  test("razorpayOrderId for a non-existent order returns empty, not an error", async () => {
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", razorpayOrderId: "order_nope" }, ADMIN_CONTEXT
    );
    expect(result.rows).toEqual([]);
  });

  test("razorpayPaymentId finds the order via the same query processRefund itself uses", async () => {
    seedOrder("order_2", { uid: "student_1", status: "paid", amountPaise: 1000, razorpayPaymentId: "pay_2" });
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", razorpayPaymentId: "pay_2" }, ADMIN_CONTEXT
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe("order_2");
  });
});

describe("searchPaymentOrders — uid / email lookup", () => {
  test("uid scopes results to that user's orders only", async () => {
    seedOrder("order_a", { uid: "student_1", status: "paid", amountPaise: 1000, createdAt: ts("2026-01-01") });
    seedOrder("order_b", { uid: "student_2", status: "paid", amountPaise: 2000, createdAt: ts("2026-01-02") });
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", uid: "student_1" }, ADMIN_CONTEXT
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe("order_a");
  });

  test("email resolves to uid via Auth before searching, and populates userEmail on results", async () => {
    seedAuthUser("student_1", "student@example.com");
    seedOrder("order_a", { uid: "student_1", status: "paid", amountPaise: 1000, createdAt: ts("2026-01-01") });
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", email: "student@example.com" }, ADMIN_CONTEXT
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].userEmail).toBe("student@example.com");
  });

  test("an email with no matching Auth user returns empty, not an error", async () => {
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", email: "nobody@example.com" }, ADMIN_CONTEXT
    );
    expect(result.rows).toEqual([]);
  });
});

describe("searchPaymentOrders — general browse with in-memory filters", () => {
  test("status filter narrows a browse to only matching orders", async () => {
    seedOrder("order_a", { uid: "student_1", status: "paid", amountPaise: 1000, createdAt: ts("2026-01-01") });
    seedOrder("order_b", { uid: "student_2", status: "created", amountPaise: 1000, createdAt: ts("2026-01-02") });
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", status: "paid" }, ADMIN_CONTEXT
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe("order_a");
  });

  test("date-range filter excludes orders outside the window", async () => {
    seedOrder("order_jan", { uid: "student_1", status: "paid", amountPaise: 1000, createdAt: ts("2026-01-15") });
    seedOrder("order_mar", { uid: "student_1", status: "paid", amountPaise: 1000, createdAt: ts("2026-03-15") });
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", startDate: "2026-02-01", endDate: "2026-02-28" }, ADMIN_CONTEXT
    );
    expect(result.rows).toEqual([]);

    const result2 = await searchPaymentOrders.run(
      { flow: "aiGuruSubscription", startDate: "2026-01-01", endDate: "2026-01-31" }, ADMIN_CONTEXT
    );
    expect(result2.rows).toHaveLength(1);
    expect(result2.rows[0].id).toBe("order_jan");
  });

  test("browse orders newest-first", async () => {
    seedOrder("order_old", { uid: "student_1", status: "paid", amountPaise: 1000, createdAt: ts("2026-01-01") });
    seedOrder("order_new", { uid: "student_1", status: "paid", amountPaise: 1000, createdAt: ts("2026-06-01") });
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run({ flow: "aiGuruSubscription" }, ADMIN_CONTEXT);
    expect(result.rows.map((r: any) => r.id)).toEqual(["order_new", "order_old"]);
  });
});

describe("searchPaymentOrders — flow mapping", () => {
  test("seekhoSubscription flow queries seekho_subscription_orders keyed by userId, not uid", async () => {
    fakeDb.seed("seekho_subscription_orders/order_seekho_1", {
      userId: "student_1", status: "paid", amountPaise: 500, createdAt: ts("2026-01-01"),
    });
    const { searchPaymentOrders } = require("../refundSearch");
    const result = await searchPaymentOrders.run(
      { flow: "seekhoSubscription", uid: "student_1" }, ADMIN_CONTEXT
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].uid).toBe("student_1");
  });
});

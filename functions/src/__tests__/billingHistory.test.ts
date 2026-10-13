// PATH: functions/src/__tests__/billingHistory.test.ts
// Offline tests for functions/src/billingHistory.ts — same FakeFirestore
// harness as the rest of the offline suite.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "./helpers/mockFirebaseAdmin";

const STUDENT_A = { auth: { uid: "student_a", token: {} } };

beforeEach(() => {
  fakeDb.reset();
});

function seedInvoice(id: string, uid: string, createdAtMs: number, overrides: Partial<Record<string, unknown>> = {}) {
  fakeDb.seed(`invoices/${id}`, {
    invoiceId: id,
    uid,
    source: "aiguru_subscription",
    status: "paid",
    planId: "plan_pro",
    currency: "INR",
    totalAmountPaise: 49900,
    createdAt: { toMillis: () => createdAtMs },
    ...overrides,
  });
}

describe("getMyInvoices", () => {
  test("rejects an unauthenticated caller", async () => {
    const { getMyInvoices } = require("../billingHistory");
    await expect(getMyInvoices.run({}, { auth: null })).rejects.toThrow();
  });

  test("returns only the caller's own invoices, never another student's", async () => {
    seedInvoice("inv_a1", "student_a", 1000);
    seedInvoice("inv_b1", "student_b", 2000);
    const { getMyInvoices } = require("../billingHistory");

    const result = await getMyInvoices.run({}, STUDENT_A);

    expect(result.invoices).toHaveLength(1);
    expect(result.invoices[0].invoiceId).toBe("inv_a1");
  });

  test("ignores a uid/target-user supplied in the payload — always uses context.auth.uid", async () => {
    seedInvoice("inv_a1", "student_a", 1000);
    seedInvoice("inv_b1", "student_b", 2000);
    const { getMyInvoices } = require("../billingHistory");

    // Student A tries to ask for Student B's invoices by smuggling a uid
    // in the payload — must still only get their own.
    const result = await getMyInvoices.run({ uid: "student_b" } as any, STUDENT_A);

    expect(result.invoices.map((i: any) => i.invoiceId)).toEqual(["inv_a1"]);
  });

  test("newest first, bounded by pageSize", async () => {
    seedInvoice("inv_old", "student_a", 1000);
    seedInvoice("inv_mid", "student_a", 2000);
    seedInvoice("inv_new", "student_a", 3000);
    const { getMyInvoices } = require("../billingHistory");

    const result = await getMyInvoices.run({ pageSize: 2 }, STUDENT_A);

    expect(result.invoices.map((i: any) => i.invoiceId)).toEqual(["inv_new", "inv_mid"]);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("inv_mid");
  });

  test("pageSize is clamped to the documented maximum", async () => {
    for (let i = 0; i < 25; i++) seedInvoice(`inv_${i}`, "student_a", i);
    const { getMyInvoices } = require("../billingHistory");

    const result = await getMyInvoices.run({ pageSize: 999 }, STUDENT_A);

    expect(result.invoices.length).toBeLessThanOrEqual(20);
  });

  test("rejects a pagination cursor that belongs to another student", async () => {
    seedInvoice("inv_a1", "student_a", 1000);
    seedInvoice("inv_b1", "student_b", 2000);
    const { getMyInvoices } = require("../billingHistory");

    await expect(
      getMyInvoices.run({ startAfterInvoiceId: "inv_b1" }, STUDENT_A),
    ).rejects.toThrow(/Invalid pagination cursor/);
  });

  test("does not leak internal Razorpay identifiers not part of the documented response shape", async () => {
    seedInvoice("inv_a1", "student_a", 1000, { razorpayOrderId: "order_1", razorpayPaymentId: "pay_1" });
    const { getMyInvoices } = require("../billingHistory");

    const result = await getMyInvoices.run({}, STUDENT_A);

    expect(result.invoices[0]).not.toHaveProperty("razorpayOrderId");
    expect(result.invoices[0]).not.toHaveProperty("razorpayPaymentId");
    expect(result.invoices[0]).not.toHaveProperty("uid");
  });
});

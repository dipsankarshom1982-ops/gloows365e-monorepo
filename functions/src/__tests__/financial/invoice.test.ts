// PATH: functions/src/__tests__/financial/invoice.test.ts
// Offline tests for functions/src/financial/invoice.ts — same FakeFirestore
// harness as the rest of the offline suite.

jest.mock("firebase-admin", () => require("../helpers/mockFirebaseAdmin").mockAdminModule);

import * as admin from "firebase-admin";
import { fakeDb } from "../helpers/mockFirebaseAdmin";
import { writeSyntheticInvoice } from "../../financial/invoice";

beforeEach(() => {
  fakeDb.reset();
});

async function writeOne(overrides: Partial<Parameters<typeof writeSyntheticInvoice>[2]> = {}) {
  const periodStart = admin.firestore.Timestamp.now();
  const periodEnd = admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 24 * 3600 * 1000);
  return fakeDb.runTransaction(async (tx: any) => {
    return writeSyntheticInvoice(tx as any, fakeDb as any, {
      source: "aiguru_subscription",
      uid: "student_1",
      razorpayOrderId: "order_abc",
      razorpayPaymentId: "pay_abc",
      amountPaise: 49900,
      planId: "plan_pro",
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      ...overrides,
    });
  });
}

describe("writeSyntheticInvoice", () => {
  test("writes a normalized, immutable-shaped invoice record", async () => {
    const invoiceId = await writeOne();
    expect(invoiceId).toBe("inv_order_abc");

    const doc = fakeDb.peek(`invoices/${invoiceId}`);
    expect(doc).toMatchObject({
      invoiceId: "inv_order_abc",
      source: "aiguru_subscription",
      razorpayInvoiceId: null,
      razorpayOrderId: "order_abc",
      razorpayPaymentId: "pay_abc",
      uid: "student_1",
      status: "paid",
      planId: "plan_pro",
      currency: "INR",
      totalAmountPaise: 49900,
    });
  });

  test("invoiceId is deterministic from razorpayOrderId — same order never produces two invoices", async () => {
    const first = await writeOne();
    const second = await writeOne({ razorpayPaymentId: "pay_retry_attempt" });
    expect(first).toBe(second);
    // Only one document ever exists at that path — a second write with
    // merge:true lands on the SAME doc, it doesn't create a sibling.
    expect(fakeDb.peek(`invoices/${first}`)?.["razorpayOrderId"]).toBe("order_abc");
  });

  test("defaults planName to planId and currency to INR when not supplied", async () => {
    const invoiceId = await writeOne();
    const doc = fakeDb.peek(`invoices/${invoiceId}`);
    expect(doc?.["planName"]).toBe("plan_pro");
    expect(doc?.["currency"]).toBe("INR");
  });

  test("no tax fields are invented — GST fields are simply absent, not zeroed/guessed", async () => {
    const invoiceId = await writeOne();
    const doc = fakeDb.peek(`invoices/${invoiceId}`);
    expect(doc).not.toHaveProperty("cgst");
    expect(doc).not.toHaveProperty("sgst");
    expect(doc).not.toHaveProperty("igst");
    expect(doc).not.toHaveProperty("gstin");
    expect(doc).not.toHaveProperty("hsnCode");
  });
});

// PATH: functions/src/__tests__/invoiceSearch.test.ts
//
// Offline unit tests for functions/src/invoiceSearch.ts -- searchInvoices,
// backing the Admin Billing & Invoice Panel V1. Same mocking approach as
// refundSearch.test.ts (real module, mocked firebase-admin via
// FakeFirestore, no emulator). Covers the superAdmin-only permission gate,
// uid/status/planId/date-range/amount-range filters, cursor pagination,
// student-display resolution, and that no invented field (URL, tax) ever
// appears when the source data doesn't have it.

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

function seedInvoice(id: string, data: Record<string, unknown>) {
  fakeDb.seed(`invoices/${id}`, {
    invoiceId: id,
    source: "aiguru_subscription",
    status: "paid",
    currency: "INR",
    totalAmountPaise: 1000,
    createdAt: ts("2026-01-01"),
    ...data,
  });
}
function seedStudent(uid: string, data: Record<string, unknown>) {
  fakeDb.seed(`students/${uid}`, data);
}

describe("searchInvoices — permission gate", () => {
  test("rejects an unauthenticated caller", async () => {
    const { searchInvoices } = require("../invoiceSearch");
    await expect(
      searchInvoices.run({}, { auth: null })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("rejects a normal (non-admin) caller", async () => {
    const { searchInvoices } = require("../invoiceSearch");
    await expect(
      searchInvoices.run({}, STUDENT_CONTEXT)
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("rejects an admin who is NOT a superAdmin — matches Payment Management's bar", async () => {
    const { searchInvoices } = require("../invoiceSearch");
    await expect(
      searchInvoices.run({}, ADMIN_ONLY_CONTEXT)
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("allows a superAdmin caller", async () => {
    const { searchInvoices } = require("../invoiceSearch");
    await expect(searchInvoices.run({}, SUPERADMIN_CONTEXT)).resolves.toBeDefined();
  });
});

describe("searchInvoices — uid filter and student display", () => {
  test("uid scopes results to that user's invoices only, and attaches student display info", async () => {
    seedInvoice("inv_a", { uid: "student_1", createdAt: ts("2026-01-01") });
    seedInvoice("inv_b", { uid: "student_2", createdAt: ts("2026-01-02") });
    seedStudent("student_1", { studentId: "GLS000123", name: "Asha Verma", email: "asha@example.com" });

    const { searchInvoices } = require("../invoiceSearch");
    const result = await searchInvoices.run({ uid: "student_1" }, SUPERADMIN_CONTEXT);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      invoiceId: "inv_a", studentId: "GLS000123", studentName: "Asha Verma", studentEmail: "asha@example.com",
    });
  });

  test("falls back to Auth email when there's no students/{uid} doc", async () => {
    seedInvoice("inv_a", { uid: "tutor_1", createdAt: ts("2026-01-01") });
    seedAuthUser("tutor_1", "tutor@example.com");

    const { searchInvoices } = require("../invoiceSearch");
    const result = await searchInvoices.run({ uid: "tutor_1" }, SUPERADMIN_CONTEXT);

    expect(result.rows[0]).toMatchObject({ studentId: null, studentEmail: "tutor@example.com" });
  });
});

describe("searchInvoices — general browse: filters and pagination", () => {
  test("browses newest-first when no uid is given", async () => {
    seedInvoice("inv_old", { uid: "student_1", createdAt: ts("2026-01-01") });
    seedInvoice("inv_new", { uid: "student_1", createdAt: ts("2026-06-01") });

    const { searchInvoices } = require("../invoiceSearch");
    const result = await searchInvoices.run({}, SUPERADMIN_CONTEXT);

    expect(result.rows.map((r: any) => r.invoiceId)).toEqual(["inv_new", "inv_old"]);
  });

  test("status filter narrows to only matching invoices", async () => {
    seedInvoice("inv_paid", { uid: "student_1", status: "paid", createdAt: ts("2026-01-01") });
    seedInvoice("inv_failed", { uid: "student_1", status: "failed", createdAt: ts("2026-01-02") });

    const { searchInvoices } = require("../invoiceSearch");
    const result = await searchInvoices.run({ status: "failed" }, SUPERADMIN_CONTEXT);

    expect(result.rows.map((r: any) => r.invoiceId)).toEqual(["inv_failed"]);
  });

  test("planId filter narrows to only matching invoices", async () => {
    seedInvoice("inv_pro", { uid: "student_1", planId: "plan_pro", createdAt: ts("2026-01-01") });
    seedInvoice("inv_basic", { uid: "student_1", planId: "plan_basic", createdAt: ts("2026-01-02") });

    const { searchInvoices } = require("../invoiceSearch");
    const result = await searchInvoices.run({ planId: "plan_basic" }, SUPERADMIN_CONTEXT);

    expect(result.rows.map((r: any) => r.invoiceId)).toEqual(["inv_basic"]);
  });

  test("date-range filter excludes invoices outside the window", async () => {
    seedInvoice("inv_jan", { uid: "student_1", createdAt: ts("2026-01-15") });
    seedInvoice("inv_mar", { uid: "student_1", createdAt: ts("2026-03-15") });

    const { searchInvoices } = require("../invoiceSearch");
    const outside = await searchInvoices.run({ startDate: "2026-02-01", endDate: "2026-02-28" }, SUPERADMIN_CONTEXT);
    expect(outside.rows).toEqual([]);

    const inside = await searchInvoices.run({ startDate: "2026-01-01", endDate: "2026-01-31" }, SUPERADMIN_CONTEXT);
    expect(inside.rows.map((r: any) => r.invoiceId)).toEqual(["inv_jan"]);
  });

  test("amount-range filter (min/max, both inclusive) narrows a browse", async () => {
    seedInvoice("inv_cheap", { uid: "student_1", totalAmountPaise: 500, createdAt: ts("2026-01-01") });
    seedInvoice("inv_mid", { uid: "student_1", totalAmountPaise: 1000, createdAt: ts("2026-01-02") });
    seedInvoice("inv_expensive", { uid: "student_1", totalAmountPaise: 5000, createdAt: ts("2026-01-03") });

    const { searchInvoices } = require("../invoiceSearch");
    const result = await searchInvoices.run({ minAmountPaise: 800, maxAmountPaise: 2000 }, SUPERADMIN_CONTEXT);
    expect(result.rows.map((r: any) => r.invoiceId)).toEqual(["inv_mid"]);

    const boundary = await searchInvoices.run({ minAmountPaise: 500, maxAmountPaise: 1000 }, SUPERADMIN_CONTEXT);
    expect(boundary.rows.map((r: any) => r.invoiceId).sort()).toEqual(["inv_cheap", "inv_mid"]);
  });

  test("default page size is 20", async () => {
    for (let i = 0; i < 25; i++) seedInvoice(`inv_${i}`, { uid: "student_1", createdAt: ts(`2026-01-${(i % 28) + 1}`) });

    const { searchInvoices } = require("../invoiceSearch");
    const result = await searchInvoices.run({}, SUPERADMIN_CONTEXT);

    expect(result.rows.length).toBeLessThanOrEqual(20);
  });

  test("pageSize is clamped to the documented maximum", async () => {
    for (let i = 0; i < 5; i++) seedInvoice(`inv_${i}`, { uid: "student_1", createdAt: ts(`2026-01-0${i + 1}`) });

    const { searchInvoices } = require("../invoiceSearch");
    const result = await searchInvoices.run({ pageSize: 99999 }, SUPERADMIN_CONTEXT);

    expect(result.rows.length).toBe(5); // all seeded rows fit under MAX_PAGE_SIZE=100
  });

  test("pageSize + cursor page through results without repeats or gaps", async () => {
    seedInvoice("inv_1", { uid: "student_1", createdAt: ts("2026-01-01") });
    seedInvoice("inv_2", { uid: "student_1", createdAt: ts("2026-01-02") });
    seedInvoice("inv_3", { uid: "student_1", createdAt: ts("2026-01-03") });

    const { searchInvoices } = require("../invoiceSearch");
    const page1 = await searchInvoices.run({ pageSize: 2 }, SUPERADMIN_CONTEXT);
    expect(page1.rows.map((r: any) => r.invoiceId)).toEqual(["inv_3", "inv_2"]);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await searchInvoices.run({ pageSize: 2, cursor: page1.nextCursor }, SUPERADMIN_CONTEXT);
    expect(page2.rows.map((r: any) => r.invoiceId)).toEqual(["inv_1"]);
    expect(page2.nextCursor).toBeNull(); // fewer rows than pageSize -> no further page
  });

  test("an unparsable cursor is ignored rather than throwing", async () => {
    seedInvoice("inv_1", { uid: "student_1", createdAt: ts("2026-01-01") });

    const { searchInvoices } = require("../invoiceSearch");
    await expect(
      searchInvoices.run({ cursor: "not-a-date" }, SUPERADMIN_CONTEXT)
    ).resolves.toBeDefined();
  });

  test("running the same search twice returns the same result (idempotent, no side effects)", async () => {
    seedInvoice("inv_1", { uid: "student_1", status: "paid", createdAt: ts("2026-01-01") });

    const { searchInvoices } = require("../invoiceSearch");
    const first = await searchInvoices.run({ uid: "student_1" }, SUPERADMIN_CONTEXT);
    const second = await searchInvoices.run({ uid: "student_1" }, SUPERADMIN_CONTEXT);

    expect(first.rows).toEqual(second.rows);
  });
});

describe("searchInvoices — field correctness, no invented data", () => {
  test("invoiceUrl/shortUrl are null when the source doc has no URL — never fabricated", async () => {
    seedInvoice("inv_1", { uid: "student_1", createdAt: ts("2026-01-01") });

    const { searchInvoices } = require("../invoiceSearch");
    const result = await searchInvoices.run({}, SUPERADMIN_CONTEXT);

    expect(result.rows[0].invoiceUrl).toBeNull();
    expect(result.rows[0].shortUrl).toBeNull();
  });

  test("invoiceUrl/shortUrl are passed through verbatim when present (native-Subscription invoice)", async () => {
    seedInvoice("inv_1", {
      uid: "student_1", createdAt: ts("2026-01-01"),
      invoiceUrl: "https://razorpay.com/invoice/xyz", shortUrl: "https://rzp.io/i/abc",
      razorpayInvoiceId: "inv_rzp_1", razorpaySubscriptionId: "sub_rzp_1",
    });

    const { searchInvoices } = require("../invoiceSearch");
    const result = await searchInvoices.run({}, SUPERADMIN_CONTEXT);

    expect(result.rows[0]).toMatchObject({
      invoiceUrl: "https://razorpay.com/invoice/xyz",
      shortUrl: "https://rzp.io/i/abc",
      razorpayInvoiceId: "inv_rzp_1",
      razorpaySubscriptionId: "sub_rzp_1",
    });
  });

  test("does not invent a tax/GST field on the response", async () => {
    seedInvoice("inv_1", { uid: "student_1", createdAt: ts("2026-01-01") });

    const { searchInvoices } = require("../invoiceSearch");
    const result = await searchInvoices.run({}, SUPERADMIN_CONTEXT);

    expect(result.rows[0]).not.toHaveProperty("gst");
    expect(result.rows[0]).not.toHaveProperty("tax");
    expect(result.rows[0]).not.toHaveProperty("taxAmountPaise");
  });
});

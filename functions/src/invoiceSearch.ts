// PATH: functions/src/invoiceSearch.ts
//
// Read-only admin lookup backing the Invoices admin section (Admin Billing
// & Invoice Panel V1). Modeled directly on functions/src/refundSearch.ts's
// searchPaymentOrders — same authorization bar (requireSuperAdmin), same
// error-wrapping (guarded), same bulk student-display resolution
// (resolveStudentDisplay), all reused (imported), never duplicated.
//
// invoices/{invoiceId} is closed to client reads except "own doc, own uid"
// (see firestore.rules) — there is no client-side "list all invoices" or
// "list invoices for uid X" path. This callable is the only way an admin
// can browse or search invoices across users.
//
// One callable, not two (searchPaymentOrders + getPaymentDetail's split):
// invoice records are small, flat, and self-contained — there's no
// separate entitlement/refund join needed the way payment orders require.
// A search result row IS the full invoice detail; there is nothing further
// a "getInvoiceDetail" call would add. Selecting a row in Invoices.tsx just
// opens a detail panel using data already in hand from the search response.
//
// Query strategy, matching searchPaymentOrders's documented approach:
//   - uid given -> where("uid","==",uid).orderBy("createdAt","desc"),
//     covered by the existing composite index (invoices: uid ASC,
//     createdAt DESC, __name__ DESC — added in 812d4bb for getMyInvoices,
//     re-used here as-is). No new index required.
//   - uid not given -> general browse: orderBy("createdAt","desc") alone,
//     auto-indexed by Firestore (single-field orderBy needs no composite
//     index). status/planId/date-range/amount-range filtered in-memory,
//     same documented V1 simplification searchPaymentOrders already uses —
//     fine at this app's current invoice volume; if that changes, the fix
//     is real composite indexes + query-level filters, not a shape change
//     here.
// Cursor pagination uses the invoice's own createdAt (an ISO string
// produced by toIso), matching the field the orderBy sorts on — same
// pattern as searchPaymentOrders's cursor, not billingHistory.ts's
// doc-fetch-based cursor (that one exists to double as an ownership check
// on a client-supplied cursor; an admin-only surface with no ownership
// boundary to check doesn't need it).

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { requireSuperAdmin, guarded, resolveStudentDisplay } from "./refundSearch";

const db = admin.firestore();

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

type InvoiceStatus = "paid" | "pending" | "failed";

interface SearchInvoicesRequest {
  uid?: string;
  status?: InvoiceStatus;
  planId?: string;
  startDate?: string; // ISO date, inclusive, compared against createdAt
  endDate?: string;   // ISO date, inclusive, compared against createdAt
  minAmountPaise?: number; // inclusive
  maxAmountPaise?: number; // inclusive
  cursor?: string;    // ISO createdAt of the last row from a previous page
  pageSize?: number;  // default 20, capped at 100
}

interface InvoiceRow {
  invoiceId: string;
  source: string;
  uid: string;
  studentId: string | null;
  studentName: string | null;
  studentEmail: string | null;
  status: string;
  planId: string | null;
  planName: string | null;
  currency: string;
  totalAmountPaise: number;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  razorpayInvoiceId: string | null;
  razorpaySubscriptionId: string | null;
  invoiceUrl: string | null;
  shortUrl: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function toIso(v: unknown): string | null {
  if (v && typeof (v as FirebaseFirestore.Timestamp).toDate === "function") {
    return (v as FirebaseFirestore.Timestamp).toDate().toISOString();
  }
  return null;
}

function toRow(doc: FirebaseFirestore.QueryDocumentSnapshot): InvoiceRow {
  const d = doc.data();
  return {
    invoiceId: String(d.invoiceId ?? doc.id),
    source: String(d.source ?? "unknown"),
    uid: String(d.uid ?? ""),
    studentId: null, studentName: null, studentEmail: null, // resolved in bulk below
    status: String(d.status ?? "unknown"),
    planId: d.planId ?? null,
    planName: d.planName ?? null,
    currency: d.currency ?? "INR",
    totalAmountPaise: Number(d.totalAmountPaise) || 0,
    billingPeriodStart: toIso(d.billingPeriodStart),
    billingPeriodEnd: toIso(d.billingPeriodEnd),
    razorpayOrderId: d.razorpayOrderId ?? null,
    razorpayPaymentId: d.razorpayPaymentId ?? null,
    razorpayInvoiceId: d.razorpayInvoiceId ?? null,
    razorpaySubscriptionId: d.razorpaySubscriptionId ?? null,
    invoiceUrl: d.invoiceUrl ?? null,
    shortUrl: d.shortUrl ?? null,
    issuedAt: toIso(d.issuedAt),
    paidAt: toIso(d.paidAt),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
}

async function attachStudentDisplay(rows: InvoiceRow[]): Promise<void> {
  const uniqueUids = [...new Set(rows.map((r) => r.uid).filter(Boolean))];
  const display = await resolveStudentDisplay(uniqueUids);
  for (const r of rows) {
    const d = display.get(r.uid);
    r.studentId = d?.studentId ?? null;
    r.studentName = d?.name ?? null;
    r.studentEmail = d?.email ?? null;
  }
}

export const searchInvoices = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "256MB" })
  .https.onCall(async (data: SearchInvoicesRequest, context) => {
    requireSuperAdmin(context);
    return guarded("searchInvoices", async () => {
      const { status, planId, startDate, endDate, cursor } = data ?? {};
      const uid = data?.uid?.trim();
      const pageSize = Math.min(Math.max(data?.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

      let baseQuery: FirebaseFirestore.Query = uid
        ? db.collection("invoices").where("uid", "==", uid).orderBy("createdAt", "desc")
        : db.collection("invoices").orderBy("createdAt", "desc");

      if (cursor) {
        const cursorDate = new Date(cursor);
        if (!isNaN(cursorDate.getTime())) {
          baseQuery = baseQuery.startAfter(admin.firestore.Timestamp.fromDate(cursorDate));
        }
      }

      const snap = await baseQuery.limit(pageSize).get();
      let rows = snap.docs.map((d) => toRow(d));

      // In-memory filters -- same documented V1 approach as
      // searchPaymentOrders (see this file's header).
      if (status) rows = rows.filter((r) => r.status === status);
      if (planId) rows = rows.filter((r) => r.planId === planId);
      if (startDate) {
        const start = new Date(startDate).getTime();
        rows = rows.filter((r) => r.createdAt && new Date(r.createdAt).getTime() >= start);
      }
      if (endDate) {
        const end = new Date(endDate).getTime();
        rows = rows.filter((r) => r.createdAt && new Date(r.createdAt).getTime() <= end);
      }
      if (data?.minAmountPaise !== undefined) rows = rows.filter((r) => r.totalAmountPaise >= data.minAmountPaise!);
      if (data?.maxAmountPaise !== undefined) rows = rows.filter((r) => r.totalAmountPaise <= data.maxAmountPaise!);

      await attachStudentDisplay(rows);

      const nextCursor = snap.docs.length === pageSize ? rows[rows.length - 1]?.createdAt ?? null : null;
      return { rows, nextCursor };
    });
  });

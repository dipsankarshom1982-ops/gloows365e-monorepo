// PATH: services/billingService.ts
//
// Typed bindings for the getMyInvoices callable (functions/src/billingHistory.ts).
// Same httpsCallable(functions, ...) pattern as services/dataRightsService.ts,
// services/adService.ts, etc. — see functions/src/billingHistory.ts's own
// header for why this is the ONLY path to a student's invoice list (no
// direct client Firestore query against invoices/ is possible; see
// firestore.rules).
//
// This file does not write anything — invoices are Admin-SDK-only,
// immutable financial records (functions/src/financial/invoice.ts). It
// only reads via the one trusted, owner-scoped callable.

import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

/** Matches whatever shape a Firestore Timestamp round-trips as through a
 *  Cloud Functions httpsCallable response — usually {_seconds,
 *  _nanoseconds}, but tolerant of a plain ISO string or {seconds,...} too
 *  since the exact serialization isn't a documented, load-bearing
 *  contract. Never assume a Date instance arrives directly. */
export type InvoiceTimestamp =
  | { _seconds: number; _nanoseconds?: number }
  | { seconds: number; nanoseconds?: number }
  | string
  | null;

// Mirrors exactly what functions/src/billingHistory.ts's getMyInvoices
// actually returns — no razorpayOrderId/razorpayPaymentId/uid, because the
// backend deliberately doesn't send them to the client (see that file's
// own "does not leak internal Razorpay identifiers" test). Do not add
// fields here that the backend doesn't send; that would just produce
// `undefined` at runtime, not real data.
export interface InvoiceRecord {
  invoiceId: string;
  source: string;
  status: string;
  planId: string | null;
  planName: string | null;
  currency: string;
  totalAmountPaise: number | null;
  billingPeriodStart: InvoiceTimestamp;
  billingPeriodEnd: InvoiceTimestamp;
  invoiceUrl: string | null;
  shortUrl: string | null;
  issuedAt: InvoiceTimestamp;
  paidAt: InvoiceTimestamp;
}

export interface GetMyInvoicesResult {
  invoices: InvoiceRecord[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface GetMyInvoicesPayload {
  pageSize?: number;
  startAfterInvoiceId?: string;
}

const getMyInvoicesCF = httpsCallable<GetMyInvoicesPayload, GetMyInvoicesResult>(
  functions,
  "getMyInvoices"
);

/** Fetches one page of the CALLING user's own billing history — the
 *  backend always scopes this to context.auth.uid; there is no uid
 *  parameter to pass here on purpose (see billingHistory.ts's header). */
export async function getMyInvoices(payload: GetMyInvoicesPayload = {}): Promise<GetMyInvoicesResult> {
  const res = await getMyInvoicesCF(payload);
  return res.data;
}

// ── Display helpers ─────────────────────────────────────────────────────

export function invoiceTimestampToDate(ts: InvoiceTimestamp): Date | null {
  if (!ts) return null;
  if (typeof ts === "string") {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  const seconds = "_seconds" in ts ? ts._seconds : "seconds" in ts ? ts.seconds : undefined;
  if (typeof seconds !== "number") return null;
  return new Date(seconds * 1000);
}

export function formatInvoiceDate(ts: InvoiceTimestamp): string {
  const d = invoiceTimestampToDate(ts);
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatInvoiceAmount(paise: number | null, currency: string): string {
  if (paise == null) return "—";
  const amount = paise / 100;
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  return `${symbol}${amount.toLocaleString("en-IN", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Neutral, accessible label — never relies on a checkmark/color alone,
 *  and never invents a status the backend didn't actually send. */
export function invoiceStatusLabel(status: string): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "pending":
      return "Pending";
    case "failed":
      return "Failed";
    default:
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown";
  }
}

export function planDisplayName(invoice: Pick<InvoiceRecord, "planName" | "planId">): string {
  return invoice.planName ?? invoice.planId ?? "Subscription";
}

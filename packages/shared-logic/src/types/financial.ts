// PATH: packages/shared-logic/src/types/financial.ts
//
// Phase A1 — Financial Domain Foundation. Frontend-facing type vocabulary
// and display-only helpers for the future Tutor Marketplace payment work.
// Nothing here is wired into any live UI yet — no component/hook in this
// phase reads or writes any of these shapes.
//
// ── Why these are DUPLICATED, not imported, from functions/src/financial ──
// `functions/` is a separate deployment unit (its own package.json, built
// and deployed independently via `firebase deploy --only functions`) and is
// NOT a pnpm workspace dependency of this package — confirmed at Phase A1
// discovery time: functions/package.json does not depend on
// @gloows/shared-logic, and functions/ isn't matched by pnpm-workspace.yaml's
// `packages: [apps/*, packages/*]` glob at all. Introducing a new cross-
// project dependency edge just to share ~15 lines of pure math is exactly
// the kind of infrastructure change this foundation phase is scoped to
// avoid (build tooling, functions' predeploy bundling, and TS project
// references would all need touching). The status string unions and the
// two display helpers below are therefore intentionally byte-identical
// mirrors of functions/src/financial/statuses.ts and money.ts — if one
// changes, the other must be updated to match (documented here and there).
//
// Only the FRONTEND-SAFE subset is mirrored: status vocabulary (for typing
// future UI state) and pure, non-authoritative DISPLAY formatting. The
// authoritative commission-snapshot calculation and the financial audit
// event shape are deliberately NOT duplicated here — they are backend-only
// by design (a client must never be able to compute, or even locally
// fabricate the shape of, a "trustworthy-looking" commission snapshot or
// audit record).

// ─── Status vocabulary (mirrors functions/src/financial/statuses.ts) ───────
export const PAYMENT_STATUSES = [
  "pending",
  "created",
  "processing",
  "paid",
  "failed",
  "expired",
  "cancelled",
  "refunded",
  "partially_refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const MARKETPLACE_EARNING_STATUSES = [
  "held",
  "available",
  "payout_requested",
  "paid_out",
  "reversed",
  "negative_adjustment",
] as const;
export type MarketplaceEarningStatus = (typeof MARKETPLACE_EARNING_STATUSES)[number];

export const BOOKING_FINANCIAL_STATUSES = [
  "not_required",
  "payment_pending",
  "payment_processing",
  "payment_confirmed",
  "payment_failed",
  "payment_expired",
  "refunded",
] as const;
export type BookingFinancialStatus = (typeof BOOKING_FINANCIAL_STATUSES)[number];

export const EARNING_TYPES = ["instant_help", "marketplace_booking", "manual_adjustment"] as const;
export type EarningType = (typeof EARNING_TYPES)[number];

// ─── Stable financial relationships ─────────────────────────────────────
// Safe to share as-is — plain id fields, no authority/security logic.
export interface MarketplaceFinancialReference {
  bookingId?: string;
  studentId?: string;
  tutorId?: string;
  paymentId?: string;
  paymentAttemptId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  earningId?: string;
  refundId?: string;
  payoutId?: string;
  financialAuditId?: string;
}

// ─── Display-only paise helpers ─────────────────────────────────────────
// NEVER use these to compute a value that gets persisted or sent to a
// backend callable as an authoritative amount — they exist purely so a
// future UI can render a `xxxPaise` field consistently without every
// component re-implementing its own rounding. Same rounding policy as
// functions/src/financial/money.ts (Math.round, applied once).

/** integer paise -> rupees (may carry up to 2 decimals), for display only. */
export function paiseToRupeesDisplay(paise: number): number {
  if (typeof paise !== "number" || !Number.isFinite(paise) || !Number.isInteger(paise)) {
    throw new Error(`paiseToRupeesDisplay: paise must be an integer, got ${String(paise)}`);
  }
  return Number((paise / 100).toFixed(2));
}

/** integer paise -> "₹500.00"-style display string. Locale-agnostic
 *  (plain fixed 2-decimal formatting) — matches the ₹-prefixed plain-text
 *  style already used throughout the existing booking UI (e.g.
 *  apps/web/.../shikshahub/bookings/page.tsx renders `₹{sessionFee}`
 *  directly), not a new currency-formatting convention. */
export function formatPaiseAsRupees(paise: number): string {
  return `₹${paiseToRupeesDisplay(paise).toFixed(2)}`;
}

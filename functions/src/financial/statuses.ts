// PATH: functions/src/financial/statuses.ts
//
// Phase A1 — Financial Domain Foundation. Centralized financial status/type
// vocabulary for the future Tutor Marketplace payment work (see the
// approved "GLOOWS365 FINANCIAL ECOSYSTEM ARCHITECTURE" blueprint). Nothing
// in this file is wired into any live code path yet — no callable, trigger,
// or existing collection references these types this phase. They exist so
// later phases (booking payment orders, commission snapshots, earnings
// hold/release) share one vocabulary instead of scattering raw strings.
//
// Collision check performed against the existing repository before adding
// any of these (Phase A1 discovery requirement):
//   • bookings/{id}.status ("requested"|"accepted"|"declined"|"cancelled"|
//     "completed", declared locally in tutorBooking.ts, not exported) is a
//     WORKFLOW status — did the tutor accept, has the session happened.
//     BookingFinancialStatus below is a deliberately separate, additive
//     concept (has the booking been paid for) — a future booking doc would
//     carry BOTH fields side by side, never one replacing the other. This
//     file does not touch bookings/{id}.status.
//   • PayoutRequestStatus (packages/shared-logic/src/types/payout.ts) —
//     "pending"|"approved"|"rejected"|"paid"|"cancelled" — a payout
//     REQUEST's own lifecycle, distinct from a MARKETPLACE EARNING's hold/
//     release lifecycle (MarketplaceEarningStatus below). No name overlap.
//   • InstantHelpRequestStatus/InstantHelpSessionStatus (packages/
//     shared-logic/src/types/instantHelp.ts) — request/session lifecycle,
//     unrelated to payment/earning status. No name overlap.
//   • No existing "PaymentStatus" type exists anywhere in the repository
//     today (functions/src/tutorCredits.ts, aiGuruSubscription.ts, etc. use
//     ad-hoc "created"/"paid" string literals inline, never a shared enum).

// ─── Payment status ─────────────────────────────────────────────────────────
// The lifecycle of one payment/order record (a future bookingPaymentOrders/
// {razorpayOrderId} doc — not created this phase). Mirrors, and slightly
// extends, the "created"→"paid" shape already used ad-hoc by the 4 existing
// Razorpay order collections (tutorCreditOrders, aiGuruSubscriptionOrders,
// aiGuruCreditOrders, seekho_subscription_orders) so a future migration of
// those onto this vocabulary — if ever approved — would be additive, not a
// rename.
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

// ─── Marketplace earning status ─────────────────────────────────────────────
// The hold/release lifecycle of ONE marketplace-booking-sourced earnings
// ledger entry (see the locked "Earnings Hold & Release" decision). Deliber-
// ately scoped to earnings that originate from marketplace bookings —
// existing Instant Help earnings (functions/src/instantHelp.ts's
// settleInstantHelpSession) remain immediately credited/available and are
// NOT retrofitted onto this status vocabulary in this or any future phase
// unless separately approved.
export const MARKETPLACE_EARNING_STATUSES = [
  "held",
  "available",
  "payout_requested",
  "paid_out",
  "reversed",
  "negative_adjustment",
] as const;
export type MarketplaceEarningStatus = (typeof MARKETPLACE_EARNING_STATUSES)[number];

// ─── Booking financial status ───────────────────────────────────────────────
// A NEW, additive companion concept to bookings/{id}.status — never a
// replacement. "not_required" covers every booking that predates payment
// support (or any future booking type that stays free/unpaid), so existing
// booking documents remain valid without a migration: an absent field reads
// the same as an explicit "not_required" wherever this is consulted later.
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

// ─── Earning type ───────────────────────────────────────────────────────────
// Distinguishes WHICH revenue stream a tutorEarnings ledger entry came from.
// "instant_help" describes the existing, unmodified Instant Help settlement
// path retroactively (existing ledger entries have no `earningType` field at
// all today — its absence is intentionally treated as "instant_help" by any
// future reader, so no backfill/migration is required). "marketplace_booking"
// and "manual_adjustment" are new, not yet produced by any live code path.
export const EARNING_TYPES = [
  "instant_help",
  "marketplace_booking",
  "manual_adjustment",
] as const;
export type EarningType = (typeof EARNING_TYPES)[number];

// ─── Financial audit action ─────────────────────────────────────────────────
// The full set of event names the audit foundation (see ./audit.ts) is
// designed to support. Only a subset is actually producible today — none of
// these are emitted by any live code path yet (Phase A1 builds the helper
// and vocabulary only, not the call sites; see the implementation report's
// "Audit Logging Architecture" section).
export const FINANCIAL_AUDIT_ACTIONS = [
  "PAYMENT_ORDER_CREATED",
  "PAYMENT_ATTEMPTED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_FAILED",
  "PAYMENT_EXPIRED",

  "COMMISSION_SNAPSHOTTED",

  "EARNING_CREATED",
  "EARNING_HELD",
  "EARNING_AVAILABLE",
  "EARNING_REVERSED",

  "REFUND_INITIATED",
  "REFUND_COMPLETED",

  "PAYOUT_REQUESTED",
  "PAYOUT_APPROVED",
  "PAYOUT_REJECTED",
  "PAYOUT_COMPLETED",

  "FINANCIAL_ADJUSTMENT_CREATED",

  "ADMIN_FINANCIAL_OVERRIDE",

  "COMMISSION_CONFIGURATION_CHANGED",
] as const;
export type FinancialAuditAction = (typeof FINANCIAL_AUDIT_ACTIONS)[number];

// ─── Guards ──────────────────────────────────────────────────────────────
// Runtime membership checks, used by ./validation.ts and ./audit.ts to
// defend against malformed input (a bad string from a caller, not from a
// client — every function in this module is backend-only or pure).
export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && (PAYMENT_STATUSES as readonly string[]).includes(value);
}
export function isMarketplaceEarningStatus(value: unknown): value is MarketplaceEarningStatus {
  return typeof value === "string" && (MARKETPLACE_EARNING_STATUSES as readonly string[]).includes(value);
}
export function isBookingFinancialStatus(value: unknown): value is BookingFinancialStatus {
  return typeof value === "string" && (BOOKING_FINANCIAL_STATUSES as readonly string[]).includes(value);
}
export function isEarningType(value: unknown): value is EarningType {
  return typeof value === "string" && (EARNING_TYPES as readonly string[]).includes(value);
}
export function isFinancialAuditAction(value: unknown): value is FinancialAuditAction {
  return typeof value === "string" && (FINANCIAL_AUDIT_ACTIONS as readonly string[]).includes(value);
}

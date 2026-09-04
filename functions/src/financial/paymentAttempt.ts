// PATH: functions/src/financial/paymentAttempt.ts
//
// Phase A2 — Booking Payment Configuration & Domain Model Completion.
// Pure decision functions implementing the locked "Multiple Payment
// Attempts" rules (Decision 7): a booking may have several payment
// attempts, but only one may ever financially settle it, and a second
// "paid" event for an already-settled booking must be treated as a
// duplicate requiring review — never a second earnings credit.
//
// Deliberately NOT wired into functions/src/tutorBooking.ts or any live
// callable this phase — these are the decision rules a future Phase C/D
// order-creation/confirmation handler will call, extracted now so they're
// independently specified and unit-tested ahead of that integration.

import type { BookingFinancialStatus, PaymentStatus } from "./statuses";

/** Minimal shape a future bookingPaymentOrders/{id} doc reduces to for
 *  these decisions — deliberately narrower than MarketplacePaymentAttempt
 *  (types.ts) so this module doesn't need to know that type's full shape. */
export interface PaymentAttemptSummary {
  status: PaymentStatus;
}

export interface PaymentAttemptDecision {
  allowed: boolean;
  reason?: string; // present only when allowed === false
}

/** A booking that has ever reached one of these financial statuses has
 *  already been financially settled at least once — any further "paid"
 *  confirmation for the SAME booking is a duplicate, never a fresh
 *  settlement (see isDuplicateSettlement below). Kept as a named constant
 *  so the two functions in this file can't silently drift out of sync on
 *  what "already settled" means. */
const ALREADY_SETTLED_STATUSES: readonly BookingFinancialStatus[] = ["payment_confirmed", "refunded"];

/** A payment attempt in one of these states is still "live" — a second
 *  attempt must not be started while one is already in flight, to avoid
 *  two simultaneously-open Razorpay orders for the same booking. */
const IN_FLIGHT_PAYMENT_STATUSES: readonly PaymentStatus[] = ["pending", "created", "processing"];

export const DEFAULT_MAX_PAYMENT_ATTEMPTS = 10;

/**
 * Decides whether a NEW payment attempt (a new Razorpay order) may be
 * created for a booking, given its current financial status and the
 * attempts already on record. Pure — takes plain data, returns a decision,
 * no Firestore access.
 *
 * Rules (in order):
 *   1. A booking that has already settled (payment_confirmed or refunded)
 *      never gets a new attempt — there's nothing left to pay for.
 *   2. A booking with an in-flight attempt (pending/created/processing)
 *      never gets a second concurrent attempt — the caller must wait for
 *      that one to resolve (succeed/fail/expire) first.
 *   3. A defensive cap on total attempts (default 10) prevents unbounded
 *      retry loops from ever reaching a live payment-order-creation
 *      function in a future phase.
 *   4. Otherwise, allowed.
 */
export function canCreateNewPaymentAttempt(input: {
  bookingFinancialStatus: BookingFinancialStatus;
  existingAttempts: PaymentAttemptSummary[];
  maxAttempts?: number;
}): PaymentAttemptDecision {
  const { bookingFinancialStatus, existingAttempts } = input;
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_PAYMENT_ATTEMPTS;

  if (ALREADY_SETTLED_STATUSES.includes(bookingFinancialStatus)) {
    return { allowed: false, reason: `Booking financial status is already "${bookingFinancialStatus}" — no new payment attempt is needed.` };
  }

  const inFlight = existingAttempts.some((a) => IN_FLIGHT_PAYMENT_STATUSES.includes(a.status));
  if (inFlight) {
    return { allowed: false, reason: "A payment attempt is already in progress for this booking." };
  }

  if (existingAttempts.length >= maxAttempts) {
    return { allowed: false, reason: `Maximum payment attempts (${maxAttempts}) reached for this booking.` };
  }

  return { allowed: true };
}

/**
 * Decides whether a "paid" event for a booking is a DUPLICATE settlement
 * — i.e. this booking has already been confirmed (or refunded) once
 * before, so this second "paid" event must NOT trigger a second earnings
 * credit and must instead be routed to a financial-safety-review path (see
 * the locked "Multiple Payment Attempts" decision's explicit requirement:
 * "multiple paid attempts for the same booking must trigger a financial
 * safety review/refund path rather than double-crediting earnings").
 *
 * A future confirmation handler calls this BEFORE crediting any earnings,
 * using the booking's financial status as read at the start of that
 * handler's own transaction (never a cached/stale value).
 */
export function isDuplicateSettlement(bookingFinancialStatus: BookingFinancialStatus): boolean {
  return ALREADY_SETTLED_STATUSES.includes(bookingFinancialStatus);
}

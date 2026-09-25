// PATH: functions/src/financial/bookingPaymentConfig.ts
//
// Phase A2 — Booking Payment Configuration & Domain Model Completion.
// Type + pure defaults-resolver for a future bookingPaymentConfig/settings
// singleton doc (Decision 6 — Payment Expiry, Decision 3 — Commission
// Snapshot rate source). No document is created, seeded, or read from
// Firestore by this phase — this file is a type + a pure function only.
//
// Mirrors the existing payoutConfig/settings convention exactly (see
// packages/shared-logic/src/types/payout.ts's PayoutConfig and
// functions/src/tutorPayouts.ts's updatePayoutConfig/requestPayout):
// admin-managed singleton doc, "absent field means use the default" rule,
// `updatedAt`/`updatedBy` audit trail fields set only by a future admin
// callable (not built this phase). A future admin callable would validate
// on WRITE (0-100 range, positive minutes) exactly like
// updatePayoutConfig already does for commissionPercent/minimumPayoutAmount
// — this resolver is the READ-side counterpart, used wherever a future
// booking-payment function needs the effective config.

import { FinancialValidationError } from "./validation";

export const DEFAULT_PAYMENT_EXPIRY_MINUTES = 30;
export const DEFAULT_BOOKING_COMMISSION_RATE = 10; // percent, matches payoutConfig's own default commission rate

/** bookingPaymentConfig/settings — shape only, not persisted this phase. */
export interface BookingPaymentConfig {
  paymentExpiryMinutes?: number; // > 0, defaults to DEFAULT_PAYMENT_EXPIRY_MINUTES if missing
  commissionRate?: number; // 0-100, defaults to DEFAULT_BOOKING_COMMISSION_RATE if missing
  updatedAt?: unknown; // Firestore Timestamp — set only by a future admin callable
  updatedBy?: string; // admin uid
}

export interface ResolvedBookingPaymentConfig {
  paymentExpiryMinutes: number;
  commissionRate: number;
}

/**
 * Applies the "absent field -> default" rule to a (possibly partial, possibly
 * entirely missing) bookingPaymentConfig/settings doc. Pure — no Firestore
 * access; a future call site does `resolveBookingPaymentConfig(snapshot.data())`.
 *
 * A PRESENT field is validated defensively (a future admin callable is the
 * real gatekeeper on write, but this resolver doesn't blindly trust
 * whatever ends up in the document either — same "defend the invariant,
 * don't just hope the data is clean" convention used throughout this
 * codebase's config resolvers, e.g. tutorPayouts.ts's requestPayout
 * re-validating payoutConfig.commissionPercent before using it).
 */
export function resolveBookingPaymentConfig(
  doc: Partial<BookingPaymentConfig> | null | undefined,
): ResolvedBookingPaymentConfig {
  const paymentExpiryMinutesRaw = doc?.paymentExpiryMinutes;
  let paymentExpiryMinutes = DEFAULT_PAYMENT_EXPIRY_MINUTES;
  if (paymentExpiryMinutesRaw !== undefined) {
    if (typeof paymentExpiryMinutesRaw !== "number" || !Number.isFinite(paymentExpiryMinutesRaw) || paymentExpiryMinutesRaw <= 0) {
      throw new FinancialValidationError(
        `bookingPaymentConfig.paymentExpiryMinutes must be a positive number, got ${String(paymentExpiryMinutesRaw)}`,
      );
    }
    paymentExpiryMinutes = paymentExpiryMinutesRaw;
  }

  const commissionRateRaw = doc?.commissionRate;
  let commissionRate = DEFAULT_BOOKING_COMMISSION_RATE;
  if (commissionRateRaw !== undefined) {
    if (typeof commissionRateRaw !== "number" || !Number.isFinite(commissionRateRaw) || commissionRateRaw < 0 || commissionRateRaw > 100) {
      throw new FinancialValidationError(
        `bookingPaymentConfig.commissionRate must be between 0 and 100, got ${String(commissionRateRaw)}`,
      );
    }
    commissionRate = commissionRateRaw;
  }

  return { paymentExpiryMinutes, commissionRate };
}

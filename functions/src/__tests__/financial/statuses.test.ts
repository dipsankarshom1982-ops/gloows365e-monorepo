// PATH: functions/src/__tests__/financial/statuses.test.ts
// Runtime guard coverage for functions/src/financial/statuses.ts. The
// string-union types themselves are checked at compile time by `tsc
// --noEmit` (see the Phase A1 implementation report) — these tests cover
// the runtime membership guards, which TypeScript can't verify on its own.

import {
  isPaymentStatus,
  isMarketplaceEarningStatus,
  isBookingFinancialStatus,
  isEarningType,
  isFinancialAuditAction,
  PAYMENT_STATUSES,
  MARKETPLACE_EARNING_STATUSES,
  BOOKING_FINANCIAL_STATUSES,
  EARNING_TYPES,
  FINANCIAL_AUDIT_ACTIONS,
} from "../../financial/statuses";

describe("status guards accept every declared value", () => {
  test.each(PAYMENT_STATUSES)("isPaymentStatus(%s) === true", (v) => expect(isPaymentStatus(v)).toBe(true));
  test.each(MARKETPLACE_EARNING_STATUSES)("isMarketplaceEarningStatus(%s) === true", (v) =>
    expect(isMarketplaceEarningStatus(v)).toBe(true),
  );
  test.each(BOOKING_FINANCIAL_STATUSES)("isBookingFinancialStatus(%s) === true", (v) =>
    expect(isBookingFinancialStatus(v)).toBe(true),
  );
  test.each(EARNING_TYPES)("isEarningType(%s) === true", (v) => expect(isEarningType(v)).toBe(true));
  test.each(FINANCIAL_AUDIT_ACTIONS)("isFinancialAuditAction(%s) === true", (v) =>
    expect(isFinancialAuditAction(v)).toBe(true),
  );
});

describe("status guards reject garbage", () => {
  test("rejects unrelated strings, undefined, null, numbers, objects", () => {
    for (const bad of ["not_a_status", undefined, null, 42, {}, []]) {
      expect(isPaymentStatus(bad)).toBe(false);
      expect(isMarketplaceEarningStatus(bad)).toBe(false);
      expect(isBookingFinancialStatus(bad)).toBe(false);
      expect(isEarningType(bad)).toBe(false);
      expect(isFinancialAuditAction(bad)).toBe(false);
    }
  });
});

describe("no accidental collision with existing repository statuses", () => {
  // bookings/{id}.status (tutorBooking.ts, module-private) — workflow
  // status, must remain untouched by BookingFinancialStatus's vocabulary.
  const EXISTING_BOOKING_WORKFLOW_STATUSES = ["requested", "accepted", "declined", "cancelled", "completed"];
  test("BOOKING_FINANCIAL_STATUSES shares no value with bookings/{id}.status", () => {
    for (const s of EXISTING_BOOKING_WORKFLOW_STATUSES) {
      expect((BOOKING_FINANCIAL_STATUSES as readonly string[]).includes(s)).toBe(false);
    }
  });

  // PayoutRequestStatus (packages/shared-logic/src/types/payout.ts) — a
  // payout REQUEST's lifecycle, distinct from MarketplaceEarningStatus.
  const EXISTING_PAYOUT_REQUEST_STATUSES = ["pending", "approved", "rejected", "paid", "cancelled"];
  test("MARKETPLACE_EARNING_STATUSES shares no value with PayoutRequestStatus", () => {
    for (const s of EXISTING_PAYOUT_REQUEST_STATUSES) {
      expect((MARKETPLACE_EARNING_STATUSES as readonly string[]).includes(s)).toBe(false);
    }
  });
});

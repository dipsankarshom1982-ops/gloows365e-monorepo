// PATH: functions/src/__tests__/financial/paymentAttempt.test.ts
// Offline unit tests for functions/src/financial/paymentAttempt.ts — pure
// decision functions, no firebase-admin mocking needed.

import {
  canCreateNewPaymentAttempt,
  isDuplicateSettlement,
  DEFAULT_MAX_PAYMENT_ATTEMPTS,
} from "../../financial/paymentAttempt";
import type { BookingFinancialStatus } from "../../financial/statuses";

describe("canCreateNewPaymentAttempt", () => {
  test("allows a first attempt on a fresh payment_pending booking", () => {
    const decision = canCreateNewPaymentAttempt({ bookingFinancialStatus: "payment_pending", existingAttempts: [] });
    expect(decision).toEqual({ allowed: true });
  });

  test("allows a retry after a failed attempt", () => {
    const decision = canCreateNewPaymentAttempt({
      bookingFinancialStatus: "payment_pending",
      existingAttempts: [{ status: "failed" }],
    });
    expect(decision.allowed).toBe(true);
  });

  test("allows a retry after an expired attempt", () => {
    const decision = canCreateNewPaymentAttempt({
      bookingFinancialStatus: "payment_expired",
      existingAttempts: [{ status: "expired" }],
    });
    expect(decision.allowed).toBe(true);
  });

  test("blocks a new attempt when the booking is already payment_confirmed", () => {
    const decision = canCreateNewPaymentAttempt({
      bookingFinancialStatus: "payment_confirmed",
      existingAttempts: [{ status: "paid" }],
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/payment_confirmed/);
  });

  test("blocks a new attempt when the booking has been refunded", () => {
    const decision = canCreateNewPaymentAttempt({ bookingFinancialStatus: "refunded", existingAttempts: [] });
    expect(decision.allowed).toBe(false);
  });

  test.each(["pending", "created", "processing"] as const)(
    "blocks a new attempt while one is already %s (in flight)",
    (inFlightStatus) => {
      const decision = canCreateNewPaymentAttempt({
        bookingFinancialStatus: "payment_processing",
        existingAttempts: [{ status: inFlightStatus }],
      });
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toMatch(/already in progress/);
    },
  );

  test("does not block on a failed attempt sitting alongside others (not in-flight)", () => {
    const decision = canCreateNewPaymentAttempt({
      bookingFinancialStatus: "payment_pending",
      existingAttempts: [{ status: "failed" }, { status: "expired" }, { status: "cancelled" }],
    });
    expect(decision.allowed).toBe(true);
  });

  test("enforces the default max-attempts cap", () => {
    const existingAttempts = Array.from({ length: DEFAULT_MAX_PAYMENT_ATTEMPTS }, () => ({ status: "failed" as const }));
    const decision = canCreateNewPaymentAttempt({ bookingFinancialStatus: "payment_pending", existingAttempts });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/Maximum payment attempts/);
  });

  test("allows exactly one below the cap", () => {
    const existingAttempts = Array.from({ length: DEFAULT_MAX_PAYMENT_ATTEMPTS - 1 }, () => ({ status: "failed" as const }));
    const decision = canCreateNewPaymentAttempt({ bookingFinancialStatus: "payment_pending", existingAttempts });
    expect(decision.allowed).toBe(true);
  });

  test("honors a custom maxAttempts override", () => {
    const decision = canCreateNewPaymentAttempt({
      bookingFinancialStatus: "payment_pending",
      existingAttempts: [{ status: "failed" }, { status: "failed" }],
      maxAttempts: 2,
    });
    expect(decision.allowed).toBe(false);
  });
});

describe("isDuplicateSettlement", () => {
  const ALL_STATUSES: BookingFinancialStatus[] = [
    "not_required",
    "payment_pending",
    "payment_processing",
    "payment_confirmed",
    "payment_failed",
    "payment_expired",
    "refunded",
  ];

  test("true for payment_confirmed and refunded", () => {
    expect(isDuplicateSettlement("payment_confirmed")).toBe(true);
    expect(isDuplicateSettlement("refunded")).toBe(true);
  });

  test("false for every other status", () => {
    for (const status of ALL_STATUSES) {
      if (status === "payment_confirmed" || status === "refunded") continue;
      expect(isDuplicateSettlement(status)).toBe(false);
    }
  });
});

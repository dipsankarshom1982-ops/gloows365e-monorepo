// PATH: functions/src/__tests__/financial/bookingPaymentConfig.test.ts
// Offline unit tests for functions/src/financial/bookingPaymentConfig.ts —
// pure functions, no firebase-admin mocking needed.

import {
  resolveBookingPaymentConfig,
  DEFAULT_PAYMENT_EXPIRY_MINUTES,
  DEFAULT_BOOKING_COMMISSION_RATE,
} from "../../financial/bookingPaymentConfig";
import { FinancialValidationError } from "../../financial/validation";

describe("resolveBookingPaymentConfig", () => {
  test("missing doc entirely resolves to full defaults", () => {
    expect(resolveBookingPaymentConfig(undefined)).toEqual({
      paymentExpiryMinutes: DEFAULT_PAYMENT_EXPIRY_MINUTES,
      commissionRate: DEFAULT_BOOKING_COMMISSION_RATE,
    });
    expect(resolveBookingPaymentConfig(null)).toEqual({
      paymentExpiryMinutes: DEFAULT_PAYMENT_EXPIRY_MINUTES,
      commissionRate: DEFAULT_BOOKING_COMMISSION_RATE,
    });
  });

  test("empty doc resolves to full defaults", () => {
    expect(resolveBookingPaymentConfig({})).toEqual({
      paymentExpiryMinutes: DEFAULT_PAYMENT_EXPIRY_MINUTES,
      commissionRate: DEFAULT_BOOKING_COMMISSION_RATE,
    });
  });

  test("a present paymentExpiryMinutes overrides the default", () => {
    expect(resolveBookingPaymentConfig({ paymentExpiryMinutes: 45 })).toEqual({
      paymentExpiryMinutes: 45,
      commissionRate: DEFAULT_BOOKING_COMMISSION_RATE,
    });
  });

  test("a present commissionRate overrides the default", () => {
    expect(resolveBookingPaymentConfig({ commissionRate: 15 })).toEqual({
      paymentExpiryMinutes: DEFAULT_PAYMENT_EXPIRY_MINUTES,
      commissionRate: 15,
    });
  });

  test("both fields present override both defaults", () => {
    expect(resolveBookingPaymentConfig({ paymentExpiryMinutes: 60, commissionRate: 0 })).toEqual({
      paymentExpiryMinutes: 60,
      commissionRate: 0,
    });
  });

  test("rejects a zero or negative paymentExpiryMinutes", () => {
    expect(() => resolveBookingPaymentConfig({ paymentExpiryMinutes: 0 })).toThrow(FinancialValidationError);
    expect(() => resolveBookingPaymentConfig({ paymentExpiryMinutes: -5 })).toThrow(FinancialValidationError);
  });

  test("rejects a non-finite paymentExpiryMinutes", () => {
    expect(() => resolveBookingPaymentConfig({ paymentExpiryMinutes: NaN })).toThrow(FinancialValidationError);
  });

  test("rejects a commissionRate outside [0, 100]", () => {
    expect(() => resolveBookingPaymentConfig({ commissionRate: -1 })).toThrow(FinancialValidationError);
    expect(() => resolveBookingPaymentConfig({ commissionRate: 100.01 })).toThrow(FinancialValidationError);
  });

  test("accepts commissionRate boundary values 0 and 100", () => {
    expect(resolveBookingPaymentConfig({ commissionRate: 0 }).commissionRate).toBe(0);
    expect(resolveBookingPaymentConfig({ commissionRate: 100 }).commissionRate).toBe(100);
  });
});

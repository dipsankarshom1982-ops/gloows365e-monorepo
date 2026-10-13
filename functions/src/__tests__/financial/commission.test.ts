// PATH: functions/src/__tests__/financial/commission.test.ts
// Offline unit tests for functions/src/financial/commission.ts — pure,
// deterministic. Covers every case Phase A1 requires: 0/10/100/>100%
// commission, small amounts, rounding edge cases, and the unconditional
// commission + net === gross invariant.

import { buildCommissionSnapshot, InvalidCommissionInputError, COMMISSION_SNAPSHOT_VERSION } from "../../financial/commission";

const FIXED_NOW = 1_700_000_000_000;

describe("buildCommissionSnapshot", () => {
  test("0% commission -> full gross goes to tutor", () => {
    const snap = buildCommissionSnapshot({ grossAmountPaise: 50000, commissionRate: 0, now: FIXED_NOW });
    expect(snap.commissionAmountPaise).toBe(0);
    expect(snap.tutorNetAmountPaise).toBe(50000);
  });

  test("10% commission on ₹500 (50000 paise)", () => {
    const snap = buildCommissionSnapshot({ grossAmountPaise: 50000, commissionRate: 10, now: FIXED_NOW });
    expect(snap.grossAmountPaise).toBe(50000);
    expect(snap.commissionRate).toBe(10);
    expect(snap.commissionAmountPaise).toBe(5000);
    expect(snap.tutorNetAmountPaise).toBe(45000);
  });

  test("100% commission -> tutor net is 0", () => {
    const snap = buildCommissionSnapshot({ grossAmountPaise: 50000, commissionRate: 100, now: FIXED_NOW });
    expect(snap.commissionAmountPaise).toBe(50000);
    expect(snap.tutorNetAmountPaise).toBe(0);
  });

  test("rejects commission rate > 100", () => {
    expect(() => buildCommissionSnapshot({ grossAmountPaise: 50000, commissionRate: 100.01, now: FIXED_NOW })).toThrow(
      InvalidCommissionInputError,
    );
  });

  test("rejects negative commission rate", () => {
    expect(() => buildCommissionSnapshot({ grossAmountPaise: 50000, commissionRate: -1, now: FIXED_NOW })).toThrow(
      InvalidCommissionInputError,
    );
  });

  test("rejects negative gross amount", () => {
    expect(() => buildCommissionSnapshot({ grossAmountPaise: -1, commissionRate: 10, now: FIXED_NOW })).toThrow();
  });

  test("rejects a non-integer gross amount (paise must be integer)", () => {
    expect(() => buildCommissionSnapshot({ grossAmountPaise: 500.5, commissionRate: 10, now: FIXED_NOW })).toThrow();
  });

  test("small amount: ₹1 (100 paise) at 10%", () => {
    const snap = buildCommissionSnapshot({ grossAmountPaise: 100, commissionRate: 10, now: FIXED_NOW });
    expect(snap.commissionAmountPaise).toBe(10);
    expect(snap.tutorNetAmountPaise).toBe(90);
  });

  test("zero gross amount is valid (edge case, e.g. a free/comped booking)", () => {
    const snap = buildCommissionSnapshot({ grossAmountPaise: 0, commissionRate: 10, now: FIXED_NOW });
    expect(snap.commissionAmountPaise).toBe(0);
    expect(snap.tutorNetAmountPaise).toBe(0);
  });

  test("rounding edge case: 1 paise gross at 50% commission", () => {
    // calculatePercentagePaise(1, 50) = Math.round(0.5) = 1 -> commission
    // takes the whole paise, net is 0 — still satisfies the invariant.
    const snap = buildCommissionSnapshot({ grossAmountPaise: 1, commissionRate: 50, now: FIXED_NOW });
    expect(snap.commissionAmountPaise + snap.tutorNetAmountPaise).toBe(snap.grossAmountPaise);
  });

  test("rounding edge case: odd gross amount at a fractional commission rate", () => {
    const snap = buildCommissionSnapshot({ grossAmountPaise: 33301, commissionRate: 7.5, now: FIXED_NOW });
    expect(snap.commissionAmountPaise + snap.tutorNetAmountPaise).toBe(snap.grossAmountPaise);
  });

  test("invariant holds across a wide sweep of gross/rate combinations", () => {
    const grossValues = [0, 1, 2, 3, 7, 10, 99, 100, 101, 999, 1000, 33301, 123456789];
    const rateValues = [0, 0.5, 1, 7.5, 10, 12.34, 33.33, 50, 99.99, 100];
    for (const gross of grossValues) {
      for (const rate of rateValues) {
        const snap = buildCommissionSnapshot({ grossAmountPaise: gross, commissionRate: rate, now: FIXED_NOW });
        expect(snap.commissionAmountPaise + snap.tutorNetAmountPaise).toBe(gross);
        expect(snap.commissionAmountPaise).toBeGreaterThanOrEqual(0);
        expect(snap.tutorNetAmountPaise).toBeGreaterThanOrEqual(0);
        expect(snap.commissionAmountPaise).toBeLessThanOrEqual(gross);
      }
    }
  });

  test("defaults commissionSnapshotVersion and calculatedAt when not provided", () => {
    const snap = buildCommissionSnapshot({ grossAmountPaise: 50000, commissionRate: 10 });
    expect(snap.commissionSnapshotVersion).toBe(COMMISSION_SNAPSHOT_VERSION);
    expect(typeof snap.calculatedAt).toBe("number");
  });

  test("uses an injected now/version when provided (test determinism)", () => {
    const snap = buildCommissionSnapshot({ grossAmountPaise: 50000, commissionRate: 10, now: FIXED_NOW, snapshotVersion: "v2" });
    expect(snap.calculatedAt).toBe(FIXED_NOW);
    expect(snap.commissionSnapshotVersion).toBe("v2");
  });
});

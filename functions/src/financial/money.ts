// PATH: functions/src/financial/money.ts
//
// Phase A1 — Financial Domain Foundation. Deterministic, side-effect-free
// paise <-> rupee conversion helpers for the future Tutor Marketplace
// payment work. Not called from any live code path yet.
//
// Discovery: no equivalent conversion helper exists anywhere in the
// repository today. The 4 existing Razorpay flows each compute
// `amountPaise` inline, ad hoc, at their one call site (e.g.
// functions/src/aiGuruSubscription.ts:47 — `Math.round(priceRupees * 100)`,
// functions/src/tutorCredits.ts:57 — reads a pre-stored `pricePaise` field
// directly, no conversion needed). There is nothing to reuse; this is a new,
// small, deliberately narrow utility.
//
// ── Rounding policy (applies everywhere in this file) ──────────────────────
// Every rupee<->paise conversion uses `Math.round` (round-half-away-from-
// -zero for positive inputs — JS's built-in behaviour, e.g. 0.5 -> 1,
// 2.5 -> 3). No banker's rounding, no floor/ceil. This is a single,
// consistent policy applied at exactly one point in any calculation chain
// (see calculatePercentagePaise below) — never applied twice, and never
// applied to a value obtained by subtraction (a subtracted remainder is
// always exact given two already-rounded integers). This is what makes the
// "commission + net == gross" invariant in ./commission.ts unconditional
// rather than merely typical.
//
// ── Scope note ──────────────────────────────────────────────────────────
// These helpers operate ONLY on NEW Tutor Marketplace paise-denominated
// fields (grossAmountPaise, commissionAmountPaise, etc. — see ./types.ts).
// Existing legacy whole-rupee fields (bookings.sessionFee,
// tutorEarnings.balance, payoutRequests amounts) are untouched by this file
// and must never be routed through it during this phase — there is no
// migration, and none is implied by this module existing.

/** Thrown by every validator in this module — never a bare Error, so a
 *  caller can distinguish "bad financial input" from any other failure. */
export class InvalidMoneyInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMoneyInputError";
  }
}

function assertFiniteNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InvalidMoneyInputError(`${label} must be a finite number, got ${String(value)}`);
  }
}

/** Integer-paise guard used throughout ./commission.ts and ./validation.ts.
 *  `allowNegative` exists only for future negative-balance adjustment
 *  amounts (see the locked "Negative Balance / Post-Payout Refund" decision)
 *  — every call site added in THIS phase passes the default (false). */
export function assertIntegerPaise(
  value: unknown,
  label: string,
  opts: { allowNegative?: boolean } = {},
): asserts value is number {
  assertFiniteNumber(value, label);
  if (!Number.isInteger(value)) {
    throw new InvalidMoneyInputError(`${label} must be an integer number of paise, got ${value}`);
  }
  if (!opts.allowNegative && value < 0) {
    throw new InvalidMoneyInputError(`${label} must not be negative, got ${value}`);
  }
}

/** rupees -> integer paise. `rupees` may carry up to 2 decimal places
 *  (e.g. 499.99); anything finer is still accepted but rounded per the
 *  policy above rather than rejected, since floating-point rupee inputs
 *  routinely carry harmless representation noise (e.g. 19.1 stored as
 *  19.099999999999998). Rejects negative input by default. */
export function rupeesToPaise(rupees: unknown, opts: { allowNegative?: boolean } = {}): number {
  assertFiniteNumber(rupees, "rupees");
  if (!opts.allowNegative && rupees < 0) {
    throw new InvalidMoneyInputError(`rupees must not be negative, got ${rupees}`);
  }
  return Math.round(rupees * 100);
}

/** integer paise -> rupees, for DISPLAY purposes only (never persist the
 *  return value as a new authoritative amount — persist paise). Returns a
 *  number that may carry up to 2 decimal places (e.g. 50000 -> 500,
 *  50050 -> 500.5). */
export function paiseToRupees(paise: unknown): number {
  assertIntegerPaise(paise, "paise");
  // Round-trip through a fixed 2-decimal string to avoid re-introducing
  // binary floating-point noise on the division (e.g. 33301/100 in raw JS
  // float math is exact here, but this guards the general case).
  return Number((paise / 100).toFixed(2));
}

/** Math.round(baseAmountPaise * percent / 100) — the ONE place rounding is
 *  applied when deriving a percentage-of-an-amount. `percent` must be in
 *  [0, 100]. Used by ./commission.ts for commissionAmountPaise; also usable
 *  directly by anything else in a future phase that needs a rounded
 *  percentage-of-paise (e.g. a partial-refund percentage). */
export function calculatePercentagePaise(baseAmountPaise: unknown, percent: unknown): number {
  assertIntegerPaise(baseAmountPaise, "baseAmountPaise");
  assertFiniteNumber(percent, "percent");
  if (percent < 0 || percent > 100) {
    throw new InvalidMoneyInputError(`percent must be between 0 and 100, got ${percent}`);
  }
  return Math.round((baseAmountPaise * percent) / 100);
}

/** Thin, intention-revealing alias of calculatePercentagePaise for
 *  commission-specific call sites — same behaviour, clearer call-site
 *  reading (`calculateCommissionPaise(gross, rate)` vs. a generic
 *  percentage call). Kept here (not duplicated) so the two can never
 *  silently drift apart. */
export function calculateCommissionPaise(grossAmountPaise: unknown, commissionRate: unknown): number {
  return calculatePercentagePaise(grossAmountPaise, commissionRate);
}

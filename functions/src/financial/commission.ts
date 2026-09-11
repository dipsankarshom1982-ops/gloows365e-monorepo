// PATH: functions/src/financial/commission.ts
//
// Phase A1 — Financial Domain Foundation. Pure, deterministic commission
// snapshot builder for future Tutor Marketplace bookings. Not called from
// any live code path yet — no booking, payment, or earning is affected by
// this file existing.
//
// Discovery: the repository's one EXISTING commission calculation lives in
// functions/src/tutorPayouts.ts's requestPayout — snapshotted at PAYOUT-
// REQUEST time from payoutConfig/settings, applied to the tutor's whole
// withdrawal regardless of source. Per the locked "Commission Snapshot"
// decision, marketplace bookings use a DIFFERENT timing (snapshotted at
// booking-payment-confirmation time, not at payout time) while Instant Help
// keeps its existing payout-time model completely unchanged. This file is
// therefore intentionally new, not a refactor of tutorPayouts.ts's inline
// commission math — reusing it would incorrectly couple the two timing
// models together. See the approved architecture blueprint's §3/§14 for the
// full reconciliation of this decision against requestPayout's existing
// behaviour, which is unmodified by this phase.

import { calculateCommissionPaise, assertIntegerPaise } from "./money";
import type { MarketplaceCommissionSnapshot } from "./types";

export const COMMISSION_SNAPSHOT_VERSION = "v1";

export class InvalidCommissionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCommissionInputError";
  }
}

export interface BuildCommissionSnapshotInput {
  grossAmountPaise: number;
  commissionRate: number; // 0-100
  /** Overridable only for tests — real call sites always take the default
   *  so calculatedAt reflects the actual moment of computation. */
  now?: number; // epoch ms
  /** Overridable only if a future phase deliberately bumps the snapshot
   *  FORMULA (never the commission RATE — rate changes don't change the
   *  version, only how the formula itself computes from rate to amount). */
  snapshotVersion?: string;
}

/**
 * Builds an immutable, self-consistent commission snapshot from a gross
 * amount and a commission rate.
 *
 * Invariant GUARANTEED (not just usually true): for every valid input,
 *   commissionAmountPaise + tutorNetAmountPaise === grossAmountPaise
 * This holds unconditionally because tutorNetAmountPaise is always derived
 * by subtraction from the already-rounded commissionAmountPaise — it is
 * never independently rounded, and commissionAmountPaise is clamped to
 * [0, grossAmountPaise] before the subtraction, so the result can never go
 * negative or exceed the gross amount.
 *
 * Validation:
 *   - grossAmountPaise: non-negative integer
 *   - commissionRate: finite number in [0, 100]
 *   - (derived) commissionAmountPaise: always <= grossAmountPaise (clamped)
 *   - (derived) tutorNetAmountPaise: always >= 0
 *
 * Pure and side-effect-free — no Firestore/Admin SDK access, no I/O. A
 * future write site is responsible for persisting the result (converting
 * `calculatedAt` to a real Firestore Timestamp) and for never recalculating
 * it again once stored.
 */
export function buildCommissionSnapshot(input: BuildCommissionSnapshotInput): MarketplaceCommissionSnapshot {
  const { grossAmountPaise, commissionRate } = input;

  assertIntegerPaise(grossAmountPaise, "grossAmountPaise");

  if (typeof commissionRate !== "number" || !Number.isFinite(commissionRate)) {
    throw new InvalidCommissionInputError(`commissionRate must be a finite number, got ${String(commissionRate)}`);
  }
  if (commissionRate < 0 || commissionRate > 100) {
    throw new InvalidCommissionInputError(`commissionRate must be between 0 and 100, got ${commissionRate}`);
  }

  let commissionAmountPaise = calculateCommissionPaise(grossAmountPaise, commissionRate);
  // Defensive clamp: rate <= 100 makes this unreachable in practice (see
  // header), but the clamp is explicit rather than relied-upon-by-omission,
  // matching this codebase's existing "defend the invariant, don't just
  // hope the math works out" convention (e.g. tutorPayouts.ts's own
  // Number.isInteger validation on commission amounts).
  if (commissionAmountPaise > grossAmountPaise) commissionAmountPaise = grossAmountPaise;
  if (commissionAmountPaise < 0) commissionAmountPaise = 0;

  const tutorNetAmountPaise = grossAmountPaise - commissionAmountPaise;

  return {
    grossAmountPaise,
    commissionRate,
    commissionAmountPaise,
    tutorNetAmountPaise,
    commissionSnapshotVersion: input.snapshotVersion ?? COMMISSION_SNAPSHOT_VERSION,
    calculatedAt: input.now ?? Date.now(),
  };
}

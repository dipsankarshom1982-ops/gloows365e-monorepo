// PATH: functions/src/financial/types.ts
//
// Phase A1 — Financial Domain Foundation. Domain interfaces for the future
// Tutor Marketplace payment work. These describe entities that MAY be
// persisted in a later, separately-approved phase — none of them are
// written to Firestore by any code in this phase. No new collection is
// created by this file existing.
//
// Naming rule enforced throughout: every new marketplace financial amount
// field is suffixed "Paise" and is an integer (see ./money.ts). Existing
// legacy amount fields elsewhere in the repo (sessionFee, balance,
// requestedAmount, etc.) stay whole rupees and are never referenced here.

import type { EarningType, FinancialAuditAction } from "./statuses";

// ─── Stable financial relationships ─────────────────────────────────────
// The traceability bag described in the locked architecture's "Stable
// Financial Relationships" decision. Not every field is present on every
// record — this is a shape for "whatever subset of these IDs a given
// record legitimately carries", not a required-fields contract.
export interface MarketplaceFinancialReference {
  bookingId?: string;
  studentId?: string;
  tutorId?: string;
  paymentId?: string; // a bookingPaymentOrders/{id} doc id, once that collection exists
  paymentAttemptId?: string; // same id space as paymentId — see MarketplacePaymentAttempt below
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  earningId?: string; // a tutorEarnings/{uid}/transactions/{id} doc id
  refundId?: string;
  payoutId?: string; // a payoutRequests/{id} doc id
  financialAuditId?: string;
}

// ─── Commission snapshot ────────────────────────────────────────────────
// Produced by ./commission.ts's buildCommissionSnapshot. Frozen at
// transaction-creation time and never recalculated — see that file's
// header for the full invariant guarantee.
export interface MarketplaceCommissionSnapshot {
  grossAmountPaise: number;
  commissionRate: number; // 0-100, whole or fractional percent as configured
  commissionAmountPaise: number;
  tutorNetAmountPaise: number;
  commissionSnapshotVersion: string; // bumped only if the calculation FORMULA itself changes
  calculatedAt: number; // epoch ms — pure/deterministic; a future write site
  // converts this to a real Firestore Timestamp at persistence time. Kept
  // as a plain number here so buildCommissionSnapshot stays a pure
  // function with no firebase-admin dependency and is trivially unit-
  // testable without any Firestore mocking.
}

// ─── Payment attempt ────────────────────────────────────────────────────
// One Razorpay order tied to one booking. Multiple attempts for the same
// booking are simply multiple records sharing the same bookingId (see the
// locked "Multiple Payment Attempts" decision — no subcollection, no
// separate "attempt" entity distinct from the order record itself; a
// future bookingPaymentOrders/{razorpayOrderId} doc IS a
// MarketplacePaymentAttempt). Modeled here as its own named type only so
// call sites can express "I need one attempt" vs. "I need the resolved
// payment" without conflating the two, even though today they'd be the
// same underlying document shape.
export interface MarketplacePaymentAttempt extends MarketplaceFinancialReference {
  bookingId: string;
  razorpayOrderId: string;
  grossAmountPaise: number;
  status: import("./statuses").PaymentStatus;
  createdAt: number; // epoch ms, see MarketplaceCommissionSnapshot's note on why not a Timestamp here
  failureReason?: string;
}

// ─── Resolved marketplace payment ───────────────────────────────────────
// The ONE attempt (of possibly several) that actually settled a booking,
// carrying its frozen commission snapshot. A future confirmation handler
// produces exactly one of these per booking — never more (see the locked
// duplicate-settlement guard requirement).
export interface MarketplacePayment extends MarketplaceFinancialReference {
  bookingId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  status: import("./statuses").PaymentStatus;
  commission: MarketplaceCommissionSnapshot;
  confirmedAt: number; // epoch ms
}

// ─── Financial audit event ──────────────────────────────────────────────
// The input shape for ./audit.ts's writeFinancialAuditEvent. Deliberately
// excludes anything resembling bank details, government ID numbers, or
// payment secrets — see ./audit.ts's DENYLISTED_METADATA_KEY_PATTERN for
// the runtime guard backing this up.
export interface FinancialAuditEventInput extends MarketplaceFinancialReference {
  action: FinancialAuditAction;
  entityType: string; // e.g. "bookingPaymentOrder", "tutorEarning", "payoutRequest"
  entityId: string;
  actorId: string; // uid of the admin/system/user who caused this event
  actorRole: "admin" | "superAdmin" | "system" | "tutor" | "student";
  reason?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  earningType?: EarningType;
}

// ─── Financial audit event (persisted shape) ────────────────────────────
// What actually lands in financialAuditLogs/{id} — FinancialAuditEventInput
// plus the two fields only the backend helper itself ever sets.
export interface FinancialAuditEvent extends FinancialAuditEventInput {
  id: string;
  createdAt: unknown; // Firestore Timestamp — set via FieldValue.serverTimestamp()
}

// packages/shared-logic/src/types/tutorCredits.ts
// ShikshaHub Phase 4 — the dedicated currency that funds Instant Help
// per-minute billing. Deliberately separate from aiGuruCredits/{uid} (AI
// Guru's own pay-as-you-go credits) and vCoins (a free, non-purchasable
// gamification currency) — see functions/src/tutorCredits.ts's header
// comment for why. Purchase flow is a near-exact mirror of
// aiGuruCredits.ts's Razorpay order/verify pattern; per-minute spend and
// the matching tutor-side earnings credit live in functions/src/
// instantHelp.ts instead of a generic debit helper, because every spend
// here is a two-sided transaction (debit student, credit tutor) rather
// than AI Guru credits' one-sided debit.

// tutorCredits/{uid} — a student's Instant Help balance. Owner+admin read
// only, Admin-SDK-only write (firestore.rules: allow write: if false) —
// every mutation goes through functions/src/tutorCredits.ts (purchases) or
// functions/src/instantHelp.ts (per-minute spend), never a direct client
// write, same reasoning aiGuruCredits/{uid} already follows.
export type TutorCreditsBalance = {
  uid?: string;
  balance: number;
  lifetimePurchased?: number;
  lifetimeSpent?: number;
  lastPurchaseAt?: unknown; // Firestore Timestamp
  updatedAt?: unknown; // Firestore Timestamp
};

// tutorCredits/{uid}/transactions/{txId} — the balance's own ledger.
export type TutorCreditTransactionType = "CREDIT" | "DEBIT";
export type TutorCreditTransactionSource =
  | "CREDIT_PACK_PURCHASE"
  | "INSTANT_HELP_SESSION"
  | "REFUND";

export type TutorCreditTransaction = {
  id?: string;
  type: TutorCreditTransactionType;
  amount: number;
  source: TutorCreditTransactionSource;
  title: string;
  description?: string;
  status: "SUCCESS" | "REVERSED";
  referenceId?: string | null; // orderId (purchase) or sessionId (spend)
  metadata?: Record<string, unknown>;
  createdAt?: unknown; // Firestore Timestamp
  updatedAt?: unknown; // Firestore Timestamp
};

// tutorCreditPacks/{packId} — purchasable packs, admin-managed
// (firestore.rules: read auth!=null, write admin only). Same shape as
// aiGuruCreditPacks/{packId}.
export type TutorCreditPack = {
  id?: string;
  name: string;
  emoji?: string;
  credits: number;
  bonusCredits?: number;
  pricePaise: number;
  description?: string;
  isActive?: boolean;
  gradient?: [string, string];
  highlight?: boolean;
};

// tutorCreditOrders/{orderId} — Razorpay order tracking, server-only
// (firestore.rules: allow read, write: if false). Same shape/role as
// aiGuruCreditOrders/{orderId} — see functions/src/tutorCredits.ts's
// header comment for the trust-model reasoning this mirrors.
export type TutorCreditOrderStatus = "created" | "paid";

export type TutorCreditOrder = {
  id?: string;
  uid: string;
  packId: string;
  credits: number;
  amountPaise: number;
  status: TutorCreditOrderStatus;
  razorpayPaymentId?: string;
  createdAt?: unknown; // Firestore Timestamp
  paidAt?: unknown; // Firestore Timestamp
};

// tutorEarnings/{tutorUid} — a tutor's accumulated Instant Help earnings.
// Owner+admin read only, Admin-SDK-only write — credited exclusively by
// functions/src/instantHelp.ts's settleInstantHelpSession(), one credit
// entry per billed minute-batch, same amount debited from the student's
// tutorCredits balance in the same transaction (no platform commission
// taken this phase — see that file's header comment). Deliberately no
// payout/withdrawal flow yet: nothing in this codebase pays out ANY
// balance to a bank account today (vCoins, aiGuruCredits, tutorEarnings
// all accumulate only) — that's explicitly later-phase scope, not
// something this type or its callables should invent unprompted.
//
// Phase C+D (booking payment confirmation) added heldBalance below — the
// held side of this SAME unified Tutor Financial Account, `balance` being
// the available side. Per the locked "One Tutor Financial Ecosystem"
// decision, this is deliberately NOT a marketplace-specific field
// (an earlier draft used marketplaceHeldBalance/marketplaceBalance —
// corrected after architecture review: those names implied a second,
// parallel balance, which the locked architecture explicitly prohibits).
// `heldBalance` is earning-type-agnostic by name and shape; today only
// marketplace bookings populate it (see functions/src/bookingPayment.ts),
// but nothing ties it to that source — WHICH source contributed is
// answered at the ledger/transaction level (earningType/bookingId/
// paymentOrderId/holdStatus on TutorEarningsTransaction below), never by
// which balance field it landed in. On release (a future phase — no
// release mechanism exists yet, so heldBalance is inert/unread by anything
// today), held funds move into the EXISTING `balance` field below, same
// field Instant Help already credits — not a second "available" bucket.
export type TutorEarningsBalance = {
  uid?: string;
  balance: number;
  lifetimeEarned?: number;
  updatedAt?: unknown; // Firestore Timestamp

  // Unified held-earnings bucket — not withdrawable, not read by
  // requestPayout (functions/src/tutorPayouts.ts) or anything else yet.
  // Absent means 0, exactly like an existing tutor document that predates
  // this phase.
  heldBalance?: number;
};

// `type`/`source` were single-literal unions describing the one earning
// kind that has ever existed (Instant Help). Phase A2 widens `source` to
// admit a second, still-hypothetical value for a future marketplace
// booking settlement — a pure additive union widen: every existing call
// site assigning `source: "INSTANT_HELP_SESSION"` still typechecks
// unchanged. `earningType`/`bookingId`/`paymentOrderId`/`holdStatus` are
// new optional fields a future marketplace-earning ledger entry would
// carry (see the locked "Marketplace Financial Ledger" decision's chosen
// hybrid design — extend this existing subcollection rather than build a
// parallel one); an existing Instant Help ledger entry simply lacks them.
export type TutorEarningsTransaction = {
  id?: string;
  type: "EARNING";
  amount: number;
  source: "INSTANT_HELP_SESSION" | "MARKETPLACE_BOOKING_PAYMENT";
  title: string;
  description?: string;
  referenceId: string; // sessionId (Instant Help) or bookingId (future marketplace)
  metadata?: Record<string, unknown>;
  createdAt?: unknown; // Firestore Timestamp

  // Marketplace-booking-sourced ledger entries only — absent on every
  // Instant Help entry that exists today and on every entry this phase
  // itself produces (nothing writes these fields yet).
  earningType?: "instant_help" | "marketplace_booking" | "manual_adjustment";
  bookingId?: string;
  paymentOrderId?: string;
  holdStatus?: "held" | "available" | "payout_requested" | "paid_out" | "reversed" | "negative_adjustment";
};

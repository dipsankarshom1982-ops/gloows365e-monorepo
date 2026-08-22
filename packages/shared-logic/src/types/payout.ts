// packages/shared-logic/src/types/payout.ts
// ShikshaHub Phase 5 — tutor earnings payout. Builds on Phase 4's
// tutorEarnings/{tutorUid} balance (functions/src/instantHelp.ts's
// settleInstantHelpSession credits it, 1 credit = ₹1 — see
// functions/src/tutorPayouts.ts's header comment) with the missing piece:
// a real way for a tutor to withdraw it.
//
// Approved Phase 5 scope: manual/admin-processed payouts, not an automated
// bank-transfer API. A tutor requests a withdrawal; an admin reviews it,
// transfers the money themselves outside the app (their own banking), then
// marks it paid — which is the one moment the balance is actually debited.
// A platform commission (admin-configurable rate) is snapshotted at
// request time and deducted from what the tutor receives, same
// snapshot-not-live-reference rule every other price in this codebase
// already follows (bookings/{id}.sessionFee, tutorServices fees, etc.).

// payoutConfig/settings — admin-managed, singleton doc (mirrors
// aiGuruCreditConfig/settings' shape/role).
export type PayoutConfig = {
  commissionPercent?: number; // 0-100, defaults to DEFAULT_COMMISSION_PERCENT if doc/field missing
  minimumPayoutAmount?: number; // credits (= ₹), defaults to DEFAULT_MINIMUM_PAYOUT if missing
  enabled?: boolean; // defaults to true if missing, same "absent means on" convention as aiGuruCreditConfig
  // Audit trail — written only by updatePayoutConfig (admin-only callable,
  // see functions/src/tutorPayouts.ts). Client writes to this doc are
  // closed in firestore.rules; this is the only place these two fields
  // are ever set.
  updatedAt?: unknown; // Firestore Timestamp
  updatedBy?: string; // admin uid
};

// tutorPayoutDetails/{tutorUid} — a tutor's saved bank/UPI details, so they
// don't re-enter them on every request. Owner+admin read only (contains
// PII — a bank account number); Admin-SDK-only write via
// saveTutorPayoutDetails, same closed-client-write pattern as every other
// server-validated collection in ShikshaHub.
export type PayoutMethod = "bank_transfer" | "upi";

export type TutorPayoutDetails = {
  tutorUid?: string;
  method: PayoutMethod;
  accountHolderName?: string;
  accountNumber?: string; // bank_transfer only
  ifsc?: string; // bank_transfer only
  upiId?: string; // upi only
  updatedAt?: unknown; // Firestore Timestamp
};

// payoutRequests/{requestId} — one withdrawal request. Client never writes
// this directly (firestore.rules: allow write: if false) —
// requestPayout/cancelPayoutRequest (tutor) and
// reviewPayoutRequest/markPayoutPaid (admin) in functions/src/
// tutorPayouts.ts are the only ways a doc here is created or changed.
export type PayoutRequestStatus = "pending" | "approved" | "rejected" | "paid" | "cancelled";

export type PayoutRequest = {
  id?: string;
  tutorUid: string;

  // requestedAmount is the FULL amount debited from tutorEarnings.balance
  // on payout — commissionAmount is deducted FROM it, not added on top
  // (request ₹500 at 10% commission → tutor receives ₹450, balance drops
  // by the full ₹500). commissionPercent/commissionAmount/payoutAmount are
  // all snapshotted at request time from payoutConfig/settings, never
  // re-derived later even if the admin-configured rate changes afterward.
  requestedAmount: number;
  commissionPercent: number;
  commissionAmount: number;
  payoutAmount: number; // requestedAmount - commissionAmount, what the tutor actually receives

  // Snapshot of tutorPayoutDetails/{tutorUid} at request time — a tutor
  // changing their saved bank details later must never retroactively alter
  // an in-flight or already-paid request, same rule sessionFee snapshots
  // already follow.
  method: PayoutMethod;
  accountHolderName?: string;
  accountNumber?: string;
  ifsc?: string;
  upiId?: string;

  status: PayoutRequestStatus;
  adminNote?: string; // rejection reason, or an admin's processing note
  reviewedBy?: string; // admin uid
  tutorName?: string; // display-only snapshot, never authoritative (tutorUid is)

  requestedAt?: unknown; // Firestore Timestamp
  reviewedAt?: unknown; // Firestore Timestamp
  paidAt?: unknown; // Firestore Timestamp
  updatedAt?: unknown; // Firestore Timestamp
};

// tutorEarnings/{tutorUid}/transactions/{txId} gets a new ledger entry type
// alongside Phase 4's "EARNING" — see packages/shared-logic/src/types/
// tutorCredits.ts's TutorEarningsTransaction, which this extends in place
// (Firestore is schemaless, no migration needed, same pattern Phase 3/4
// already used repeatedly).
export type PayoutLedgerTransaction = {
  id?: string;
  type: "PAYOUT";
  amount: number; // negative-equivalent debit — full requestedAmount
  source: "TUTOR_PAYOUT";
  title: string;
  description?: string;
  referenceId: string; // payoutRequests/{id}
  metadata?: { commissionAmount: number; payoutAmount: number; method: PayoutMethod };
  createdAt?: unknown; // Firestore Timestamp
};

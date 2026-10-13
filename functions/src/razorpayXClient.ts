// PATH: functions/src/razorpayXClient.ts
// Automated payouts phase — thin client for RazorpayX's Payout Composite
// API (POST /v1/payouts), which creates the Contact + Fund Account + the
// actual Payout in a single call directly from tutorPayoutDetails/{uid}'s
// existing bank/UPI fields — no separate Contact/Fund Account IDs to
// create or track in Firestore first (the Composite API accepts details
// inline and de-dupes on its own side rather than creating duplicates).
//
// Genuinely separate credentials from functions/src/tutorCredits.ts's
// RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET (regular Razorpay Payments,
// Orders/Checkout API) — RazorpayX is a different product with its own
// key pair (RAZORPAYX_KEY_ID/RAZORPAYX_KEY_SECRET) and its own source
// account number (RAZORPAYX_ACCOUNT_NUMBER, the RazorpayX current/virtual
// account payouts draw from — not a tutor's bank account, which lives in
// fund_account.bank_account instead). Same strict "test credentials only
// on staging, never touch production" rule the Phase 4 Razorpay
// secret-provisioning protocol already established.
//
// Idempotency: mandatory on every payout request as of March 2025 (see
// https://razorpay.com/docs/api/x/payout-composite/create/bank-account/).
// Callers pass the payoutRequests/{id} doc's own id as the idempotency
// key — one Firestore payout request can never result in two real bank
// transfers, even across retries.
//
// IP allowlisting: RazorpayX requires allowlisting the calling IP, but
// ONLY in Live Mode — Test Mode has no such requirement (confirmed via
// Razorpay's own docs), so this doesn't block building/testing against
// Test Mode. Going live later will need a static outbound IP for these
// Cloud Functions (Serverless VPC Connector + Cloud NAT) allowlisted in
// the RazorpayX dashboard — a real prerequisite, but not this phase's to
// solve, and not something that blocks anything here.

import axios from "axios";

export type RazorpayXPayoutStatus =
  | "queued" | "pending" | "processing" | "processed"
  | "reversed" | "failed" | "cancelled" | "rejected";

export type RazorpayXPayoutResult = {
  id: string;
  status: RazorpayXPayoutStatus;
  utr: string | null;
};

export type RazorpayXFundAccount =
  | { method: "bank_transfer"; accountHolderName: string; accountNumber: string; ifsc: string }
  | { method: "upi"; accountHolderName: string; upiId: string };

export class RazorpayXError extends Error {
  constructor(message: string, public readonly razorpayReason?: string) {
    super(message);
    this.name = "RazorpayXError";
  }
}

function buildFundAccountPayload(fundAccount: RazorpayXFundAccount, tutorName: string, referenceId: string) {
  const contact = {
    name: tutorName || fundAccount.accountHolderName,
    type: "vendor",
    reference_id: referenceId,
  };
  if (fundAccount.method === "bank_transfer") {
    return {
      account_type: "bank_account",
      bank_account: {
        name: fundAccount.accountHolderName,
        ifsc: fundAccount.ifsc,
        account_number: fundAccount.accountNumber,
      },
      contact,
    };
  }
  return {
    account_type: "vpa",
    vpa: { address: fundAccount.upiId },
    contact,
  };
}

/** Creates a real RazorpayX payout — this is the one place actual money
 *  movement gets initiated. Throws RazorpayXError with Razorpay's own
 *  reason on any failure (auth, validation, insufficient balance, etc.)
 *  so the caller can surface something actionable rather than a generic
 *  500. */
export async function createRazorpayXPayout(params: {
  keyId: string;
  keySecret: string;
  accountNumber: string;
  idempotencyKey: string;
  amountRupees: number;
  referenceId: string; // <= 40 chars
  narration: string;   // <= 30 chars
  tutorName: string;
  fundAccount: RazorpayXFundAccount;
}): Promise<RazorpayXPayoutResult> {
  try {
    const response = await axios.post(
      "https://api.razorpay.com/v1/payouts",
      {
        account_number: params.accountNumber,
        amount: Math.round(params.amountRupees * 100), // paise
        currency: "INR",
        mode: params.fundAccount.method === "upi" ? "UPI" : "IMPS",
        purpose: "payout",
        fund_account: buildFundAccountPayload(params.fundAccount, params.tutorName, params.referenceId),
        queue_if_low_balance: true,
        reference_id: params.referenceId.slice(0, 40),
        narration: params.narration.slice(0, 30),
      },
      {
        auth: { username: params.keyId, password: params.keySecret },
        headers: { "X-Payout-Idempotency": params.idempotencyKey },
        timeout: 15_000,
      }
    );
    return {
      id: response.data.id,
      status: response.data.status,
      utr: response.data.utr ?? null,
    };
  } catch (e: any) {
    const razorpayError = e?.response?.data?.error;
    throw new RazorpayXError(
      razorpayError?.description || e?.message || "RazorpayX payout request failed",
      razorpayError?.reason
    );
  }
}

/** Status-sync only — never used to reverse a debit that's already
 *  happened (see functions/src/tutorPayouts.ts's reconcilePayoutStatuses,
 *  the only caller). */
export async function fetchRazorpayXPayoutStatus(params: {
  keyId: string;
  keySecret: string;
  payoutId: string;
}): Promise<RazorpayXPayoutResult> {
  const response = await axios.get(
    `https://api.razorpay.com/v1/payouts/${params.payoutId}`,
    { auth: { username: params.keyId, password: params.keySecret }, timeout: 10_000 }
  );
  return {
    id: response.data.id,
    status: response.data.status,
    utr: response.data.utr ?? null,
  };
}

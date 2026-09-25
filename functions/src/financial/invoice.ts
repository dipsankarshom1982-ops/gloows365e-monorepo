// PATH: functions/src/financial/invoice.ts
//
// Synthetic (self-issued) invoice records for the existing Order-based
// subscription flows — functions/src/aiGuruSubscription.ts and
// functions/src/seekho.ts. These are deliberately NOT Razorpay-hosted
// invoices: Razorpay only auto-generates an invoice for its native
// Subscriptions product (and Payment Links with send_invoice), and every
// payment flow in this repo today — including the two "subscription"
// flows above — pays via a plain Order (`POST /v1/orders`), which never
// gets a Razorpay invoice. (See ../razorpaySubscriptions.ts for the
// separate, NOT-yet-wired-to-any-client native-Subscriptions path, which
// DOES persist a real Razorpay-issued invoice via this same collection.)
//
// Every field here is built entirely from OUR OWN trusted, server-verified
// order+payment data at the exact moment a payment is confirmed — never
// from client input. See PHASE 6 of the Razorpay subscription/invoice
// audit (2026-09-11): no GST/tax configuration exists anywhere in this
// codebase, so tax fields are deliberately omitted rather than invented.
//
// Idempotency: invoiceId is deterministic (`inv_${razorpayOrderId}`), and
// every call site uses writeSyntheticInvoice INSIDE the same Firestore
// transaction that flips the source order to "paid" and grants
// entitlement — never as a separate, standalone write. That's what makes
// this safe under the SAME conditions the entitlement write already
// relies on: a genuinely-concurrent double-verify is resolved by
// Firestore's transaction retry (the second attempt finds order.status
// already "paid" in its "alreadyActivated" branch and never reaches this
// function again), not by a second, independent idempotency check here.

import * as admin from "firebase-admin";

export type InvoiceSource = "aiguru_subscription" | "seekho_subscription" | "razorpay_native_subscription";

export interface SyntheticInvoiceInput {
  source: InvoiceSource;
  uid: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amountPaise: number;
  currency?: string;
  planId: string;
  planName?: string;
  billingPeriodStart: FirebaseFirestore.Timestamp;
  billingPeriodEnd: FirebaseFirestore.Timestamp;
}

/**
 * Writes a normalized invoice record for a just-confirmed subscription
 * payment. Must be called from inside the transaction that confirms the
 * payment/grants entitlement (`tx` is that transaction) — see this file's
 * header for why a standalone call would break the idempotency guarantee.
 */
export function writeSyntheticInvoice(
  tx: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  input: SyntheticInvoiceInput,
): string {
  const invoiceId = `inv_${input.razorpayOrderId}`;
  const now = admin.firestore.FieldValue.serverTimestamp();
  tx.set(
    db.doc(`invoices/${invoiceId}`),
    {
      invoiceId,
      source: input.source,
      // No razorpayInvoiceId — Razorpay never issues one for a plain
      // Order; this field only gets populated by the native-Subscriptions
      // path in razorpaySubscriptionEvents.ts.
      razorpayInvoiceId: null,
      razorpaySubscriptionId: null,
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId,
      uid: input.uid,
      status: "paid" as const,
      planId: input.planId,
      planName: input.planName ?? input.planId,
      billingPeriodStart: input.billingPeriodStart,
      billingPeriodEnd: input.billingPeriodEnd,
      currency: input.currency ?? "INR",
      totalAmountPaise: input.amountPaise,
      invoiceUrl: null,
      shortUrl: null,
      issuedAt: now,
      paidAt: now,
      createdAt: now,
      updatedAt: now,
    },
    // merge:true — a retried transaction attempt (Firestore's own optimistic
    // concurrency retry, not a second verify call) re-runs this exact same
    // write; merge keeps it a no-op rather than a spurious overwrite.
    { merge: true },
  );
  return invoiceId;
}

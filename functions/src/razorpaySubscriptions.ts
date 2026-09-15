// PATH: functions/src/razorpaySubscriptions.ts
//
// Native Razorpay Subscriptions (https://razorpay.com/docs/api/payments/subscriptions/)
// — a SEPARATE, NOT-YET-WIRED-TO-ANY-CLIENT-UI path from the existing
// Order-based "subscription" flows in aiGuruSubscription.ts / seekho.ts.
//
// ── Why this is a second path, not a replacement ───────────────────────────
// Every existing "subscription" in this repo is really a one-time Razorpay
// Order re-purchased each period, with the expiry self-managed in
// Firestore — see the 2026-09-11 Razorpay subscription/invoice audit.
// Razorpay only auto-generates an invoice for its native Subscriptions
// product, so THIS is the file that produces real Razorpay-issued
// invoices; ./financial/invoice.ts's writeSyntheticInvoice covers the
// existing Order-based flows instead, where no Razorpay invoice can ever
// exist. Retrofitting the existing, currently-working aiGuru/Seekho
// subscription flows onto this was explicitly out of scope for this pass
// (see the audit's decision gate) — this file is additive scaffolding for
// a future migration, exported but not called by createRazorpaySubscription
// from any mobile/admin screen yet.
//
// ── Manual dependency (cannot be done from code) ────────────────────────────
// A Razorpay Plan must exist (Dashboard → Subscriptions → Plans, or
// POST /v1/plans) before createRazorpaySubscription can be used for a
// given internal plan — its id is read from
// subscriptionPlans/{planId}.razorpayPlanId, which nothing in this repo
// currently sets. This is a real configuration gap, reported rather than
// guessed at (see the audit's PHASE 17 item 11).
//
// ── Entitlement is deliberately NOT touched here ────────────────────────────
// confirmSubscriptionInvoiceFromWebhook below persists the invoice and
// updates razorpaySubscriptions/{razorpaySubscriptionId}'s own status only
// — it does not write to subscriptions/{uid} (the existing entitlement
// doc), specifically so this inert-until-adopted path can never interact
// with the live entitlement flow. Wiring entitlement is a decision for
// whoever adopts this path for a real plan, not something to infer here.

import axios from "axios";
import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import type { ParsedRazorpayWebhookEvent } from "./financial/webhookEvent";

const db = admin.firestore();

// ── Create a Razorpay Subscription ──────────────────────────────────────────

interface CreateSubscriptionPayload {
  planId: string;
  /** Number of billing cycles Razorpay should charge before the
   *  subscription auto-expires. Razorpay requires SOME bound; there is no
   *  "forever" option — pass a large number (e.g. 120 = 10 years monthly)
   *  for an effectively-indefinite subscription. */
  totalCount: number;
}

export const createRazorpaySubscription = functionsV1
  .runWith({
    timeoutSeconds: 30,
    memory: "256MB",
    secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
  })
  .https.onCall(async (data: CreateSubscriptionPayload, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const planId = (data?.planId ?? "").trim();
    const totalCount = Number(data?.totalCount);
    if (!planId) {
      throw new functionsV1.https.HttpsError("invalid-argument", "planId is required");
    }
    if (!Number.isInteger(totalCount) || totalCount < 1) {
      throw new functionsV1.https.HttpsError("invalid-argument", "totalCount must be a positive integer");
    }

    const planSnap = await db.doc(`subscriptionPlans/${planId}`).get();
    if (!planSnap.exists) {
      throw new functionsV1.https.HttpsError("not-found", "Subscription plan not found");
    }
    const plan = planSnap.data()!;
    const razorpayPlanId = plan["razorpayPlanId"];
    if (typeof razorpayPlanId !== "string" || razorpayPlanId.length === 0) {
      // The manual dependency documented in this file's header — a plan
      // that hasn't been given a Razorpay Plan id yet cannot go through
      // this path. Failing loudly here rather than falling back to the
      // Order-based flow keeps the two paths from silently blending.
      throw new functionsV1.https.HttpsError(
        "failed-precondition",
        "This plan is not configured for native Razorpay Subscriptions (missing razorpayPlanId)",
      );
    }

    const keyId = process.env["RAZORPAY_KEY_ID"] ?? "";
    const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? "";
    if (!keyId || !keySecret) {
      console.error("createRazorpaySubscription: Razorpay secrets missing");
      throw new functionsV1.https.HttpsError("failed-precondition", "Payments aren't configured — secrets missing");
    }

    let razorpaySubscriptionId: string;
    let shortUrl: string | null;
    try {
      const response = await axios.post(
        "https://api.razorpay.com/v1/subscriptions",
        {
          plan_id: razorpayPlanId,
          total_count: totalCount,
          customer_notify: 1,
          notes: { uid, planId },
        },
        { auth: { username: keyId, password: keySecret }, timeout: 10_000 },
      );
      razorpaySubscriptionId = response.data.id;
      shortUrl = typeof response.data.short_url === "string" ? response.data.short_url : null;
    } catch (err: any) {
      const rzpError = err?.response?.data?.error;
      const detail = rzpError ? `${rzpError.code}: ${rzpError.description}` : (err?.message ?? "Unknown error");
      console.error("createRazorpaySubscription: Razorpay subscription creation failed:", detail, err?.response?.data);
      throw new functionsV1.https.HttpsError("internal", `Razorpay error: ${detail}`);
    }

    // The mapping the webhook handler below needs to resolve a
    // subscription_id back to a uid/planId — Razorpay's webhook payloads
    // never carry our own uid.
    await db.doc(`razorpaySubscriptions/${razorpaySubscriptionId}`).set({
      razorpaySubscriptionId,
      uid,
      planId,
      status: "created",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Razorpay subscription created: ${razorpaySubscriptionId} uid=${uid} plan=${planId}`);
    return { razorpaySubscriptionId, shortUrl };
  });

// ── Webhook confirmation: subscription + invoice events ─────────────────────

export interface ConfirmSubscriptionInvoiceResult {
  acted: boolean;
  reason?: string;
}

/**
 * Called by razorpayWebhook.ts for subscription.activated,
 * subscription.charged, subscription.cancelled, and invoice.paid events.
 * No-ops (acted: false) for any event whose subscription_id doesn't match
 * a razorpaySubscriptions/{id} doc — i.e. every event today, since nothing
 * calls createRazorpaySubscription yet. Once something does, this becomes
 * live without any further wiring here.
 */
export async function confirmSubscriptionInvoiceFromWebhook(
  parsed: ParsedRazorpayWebhookEvent,
): Promise<ConfirmSubscriptionInvoiceResult> {
  if (!parsed.subscriptionId) return { acted: false, reason: "event carries no subscription_id" };

  const subRef = db.doc(`razorpaySubscriptions/${parsed.subscriptionId}`);
  const subSnap = await subRef.get();
  if (!subSnap.exists) return { acted: false, reason: "not a subscription this app created" };
  const sub = subSnap.data()!;
  const now = admin.firestore.FieldValue.serverTimestamp();

  if (parsed.eventType === "subscription.activated" || parsed.eventType === "subscription.charged") {
    await subRef.update({ status: "active", updatedAt: now });
    return { acted: true };
  }

  if (parsed.eventType === "subscription.cancelled") {
    await subRef.update({ status: "cancelled", updatedAt: now });
    return { acted: true };
  }

  if (parsed.eventType === "invoice.paid") {
    const invoice = parsed.invoiceEntity;
    if (!invoice || typeof invoice["id"] !== "string") {
      return { acted: false, reason: "invoice.paid event carries no usable invoice entity" };
    }
    const razorpayInvoiceId = invoice["id"] as string;
    const invoiceRef = db.doc(`invoices/${razorpayInvoiceId}`);

    // idempotent by construction — a retried delivery finds the doc
    // already present and merges the same data back in, never duplicating.
    await invoiceRef.set(
      {
        invoiceId: razorpayInvoiceId,
        source: "razorpay_native_subscription",
        razorpayInvoiceId,
        razorpaySubscriptionId: parsed.subscriptionId,
        razorpayOrderId: typeof invoice["order_id"] === "string" ? invoice["order_id"] : null,
        razorpayPaymentId: typeof invoice["payment_id"] === "string" ? invoice["payment_id"] : null,
        uid: sub["uid"],
        status: "paid" as const,
        planId: sub["planId"] ?? null,
        currency: typeof invoice["currency"] === "string" ? invoice["currency"] : "INR",
        totalAmountPaise: typeof invoice["amount"] === "number" ? invoice["amount"] : null,
        invoiceUrl: typeof invoice["invoice_pdf"] === "string" ? invoice["invoice_pdf"] : null,
        shortUrl: typeof invoice["short_url"] === "string" ? invoice["short_url"] : null,
        issuedAt: writeInvoiceTimestamp(invoice["issued_at"]),
        paidAt: writeInvoiceTimestamp(invoice["paid_at"]),
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
    return { acted: true };
  }

  return { acted: false, reason: `event type "${parsed.eventType}" not handled here` };
}

function writeInvoiceTimestamp(unixSeconds: unknown): FirebaseFirestore.Timestamp | null {
  return typeof unixSeconds === "number" && Number.isFinite(unixSeconds)
    ? admin.firestore.Timestamp.fromMillis(unixSeconds * 1000)
    : null;
}

// PATH: functions/src/razorpayWebhook.ts
//
// Phase B (foundation) + Phase C+D (booking payment confirmation). ONE
// real, deployable Cloud Function — the first piece of the Tutor
// Marketplace payment work that's internet-reachable.
//
// ── What this endpoint still does NOT do ─────────────────────────────────
// It does not read or write tutorCreditOrders, aiGuruSubscriptionOrders,
// aiGuruCreditOrders, seekho_subscription_orders, instantHelp.ts, or
// tutorPayouts.ts. It does not call into any of the 4 existing
// *PaymentSuccess handlers' confirmation logic. The 4 existing flows keep
// confirming payments exactly as they do today, via their own
// client-callback handlers — this endpoint runs alongside them, not
// instead of them. Any webhook event whose orderId doesn't match a
// bookingPaymentOrders doc (i.e. every event from the 4 legacy flows,
// should Razorpay ever send webhooks for those too) is still purely
// recorded, never acted on — byte-for-byte the Phase B behavior.
//
// ── What it does do ──────────────────────────────────────────────────────
// 1. Verify the X-Razorpay-Signature header against the raw request body
//    using RAZORPAY_WEBHOOK_SECRET (see ./financial/webhookVerification.ts).
// 2. Parse the event into a normalized shape (see ./financial/webhookEvent.ts).
// 3. Idempotency: if webhookEvents/{eventId} already exists, respond 200
//    without writing again (Razorpay retries on non-2xx; a duplicate
//    delivery of an already-recorded event must still return 2xx so
//    Razorpay stops retrying it).
// 4. Write ONE webhookEvents/{eventId} document — the append-only record
//    of "this delivery was received and its signature verified".
// 5. Phase C+D addition: for a payment.captured/payment.failed event, ask
//    bookingPayment.ts's confirmBookingPaymentFromWebhook whether its
//    orderId belongs to a booking payment. If it does, that function is
//    now the SOLE authority that confirms a booking payment — see its own
//    header for the concurrency-safe transaction design. If it doesn't
//    (the common case — legacy-flow traffic), behavior is unchanged from
//    Phase B: recorded, `processed` stays false.
//
// A separate financialAuditLogs write is still deliberately NOT added
// here — see ./financial/audit.ts's header. The webhookEvents doc plus
// bookingPaymentOrders/bookings' own updated fields remain this phase's
// complete trail.
//
// ── firestore.rules ──────────────────────────────────────────────────────
// webhookEvents is not declared in firestore.rules — same as
// financialAuditLogs (see audit.ts's header): the rules file has no
// default-deny catch-all, so an undeclared collection is already fully
// closed to every client read/write. No rules change made or needed. This
// endpoint itself writes via the Admin SDK, which bypasses rules entirely.

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { verifyRazorpayWebhookSignature } from "./financial/webhookVerification";
import { parseRazorpayWebhookEvent } from "./financial/webhookEvent";
import { confirmBookingPaymentFromWebhook } from "./bookingPayment";

const db = admin.firestore();

function singleHeaderValue(value: string | string[] | undefined): unknown {
  return Array.isArray(value) ? value[0] : value;
}

export const razorpayWebhook = onRequest(
  {
    timeoutSeconds: 30,
    memory: "256MiB",
    secrets: ["RAZORPAY_WEBHOOK_SECRET"],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const signatureHeader = singleHeaderValue(req.headers["x-razorpay-signature"]);
    const eventIdHeader = singleHeaderValue(req.headers["x-razorpay-event-id"]);
    // Firebase Functions preserves the exact raw bytes it received
    // alongside the parsed req.body specifically for signature
    // verification — see webhookVerification.ts's header for why this
    // must be the raw body, never a re-serialized req.body.
    const rawBody = req.rawBody ? req.rawBody.toString("utf8") : "";
    const secret = process.env["RAZORPAY_WEBHOOK_SECRET"] ?? "";

    if (!secret) {
      // Misconfiguration (secret not set/bound), not a bad request —
      // logged loudly so it's caught in staging before it's ever silently
      // rejecting every real delivery.
      console.error("razorpayWebhook: RAZORPAY_WEBHOOK_SECRET is not configured");
      res.status(500).json({ error: "Webhook not configured" });
      return;
    }

    let verified = false;
    try {
      verified = verifyRazorpayWebhookSignature(rawBody, signatureHeader, secret);
    } catch (e) {
      console.error("razorpayWebhook: signature verification threw", e);
      res.status(400).json({ error: "Malformed request" });
      return;
    }

    if (!verified) {
      console.error("razorpayWebhook: signature mismatch", { eventIdHeader });
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    let parsed;
    try {
      parsed = parseRazorpayWebhookEvent(req.body, eventIdHeader);
    } catch (e) {
      console.error("razorpayWebhook: failed to parse verified event", e);
      res.status(400).json({ error: "Malformed event payload" });
      return;
    }

    const eventRef = db.doc(`webhookEvents/${parsed.eventId}`);
    const existing = await eventRef.get();
    if (existing.exists) {
      // Razorpay's own documented retry behavior — a duplicate delivery of
      // an event we've already recorded must still 2xx, or Razorpay keeps
      // retrying it indefinitely.
      res.status(200).json({ status: "duplicate" });
      return;
    }

    await eventRef.set({
      eventId: parsed.eventId,
      eventType: parsed.eventType,
      orderId: parsed.orderId ?? null,
      paymentId: parsed.paymentId ?? null,
      paymentStatus: parsed.paymentStatus ?? null,
      razorpayCreatedAt: parsed.razorpayCreatedAtMs ?? null,
      verified: true,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      // Flipped to true just below if this event turns out to be a
      // booking payment event this endpoint actually acted on.
      processed: false,
    });

    if (parsed.eventType === "payment.captured" || parsed.eventType === "payment.failed") {
      try {
        const result = await confirmBookingPaymentFromWebhook(parsed);
        if (result.acted) {
          await eventRef.update({ processed: true });
        }
      } catch (e) {
        // The event is already durably recorded above — a failure acting
        // on it must not turn into a 5xx that makes Razorpay endlessly
        // retry delivery of an event we've already got a permanent record
        // of. Logged loudly; `processed` stays false, which is itself the
        // signal that this event still needs attention.
        console.error(`razorpayWebhook: confirmBookingPaymentFromWebhook threw for event ${parsed.eventId}`, e);
      }
    }

    res.status(200).json({ status: "recorded" });
  },
);

// PATH: functions/src/financial/webhookVerification.ts
//
// Phase B — Shared Razorpay Webhook Infrastructure. Pure HMAC-SHA256
// signature verification for an incoming Razorpay WEBHOOK delivery
// (distinct from the existing client-checkout-callback signature scheme —
// see the note below). Not called from any live code path until
// functions/src/razorpayWebhook.ts (this phase) wires it into the actual
// endpoint.
//
// ── Two DIFFERENT Razorpay signature schemes exist in this repo ─────────
// 1. EXISTING, unmodified by this phase: the browser-checkout success
//    callback signature, verified inline in aiGuruSubscription.ts /
//    tutorCredits.ts's *PaymentSuccess handlers —
//    `HMAC-SHA256("${orderId}|${paymentId}", RAZORPAY_KEY_SECRET)`,
//    compared against the client-supplied `razorpay_signature` field.
// 2. NEW, this file: the server-to-server WEBHOOK signature — Razorpay
//    computes `HMAC-SHA256(<raw request body bytes>, RAZORPAY_WEBHOOK_SECRET)`
//    and sends it in the `X-Razorpay-Signature` header. Different secret
//    (RAZORPAY_WEBHOOK_SECRET, not RAZORPAY_KEY_SECRET), different signed
//    payload (the whole raw body, not an order|payment string), different
//    purpose (server-authoritative confirmation vs. an immediate UI
//    callback) — see the locked "Payment Confirmation Hierarchy" decision.
//    The two must never be confused or cross-verified.
//
// Uses the RAW body string, not a re-serialized JSON.stringify(req.body) —
// Razorpay signs the exact bytes it sent, and re-serializing parsed JSON
// can reorder keys/change whitespace and silently break verification. The
// caller (razorpayWebhook.ts) is responsible for passing
// `req.rawBody.toString("utf8")` (a buffer Firebase Functions preserves
// specifically for this purpose), never `JSON.stringify(req.body)`.

import * as crypto from "crypto";

export class InvalidWebhookSignatureInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidWebhookSignatureInputError";
  }
}

/**
 * Verifies a Razorpay webhook delivery's signature. Returns a boolean
 * rather than throwing on a MISMATCHED signature (that's an expected,
 * frequent outcome — a health-checker, a replay, or an attacker probing
 * the endpoint — not a program error); still throws
 * InvalidWebhookSignatureInputError for genuinely malformed call-site
 * input (missing secret, non-string body), since those ARE programmer
 * mistakes that should fail loudly in development/tests.
 *
 * Timing-safe comparison (crypto.timingSafeEqual) rather than `===`,
 * unlike the existing checkout-callback comparison this repo already has
 * elsewhere — deliberately stricter here because this endpoint is
 * unauthenticated and internet-reachable by design (a webhook can't carry
 * a Firebase ID token), so it's the one signature check in this codebase
 * most worth hardening against a timing side-channel.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signatureHeader: unknown,
  secret: string,
): boolean {
  if (typeof rawBody !== "string") {
    throw new InvalidWebhookSignatureInputError("rawBody must be a string (the raw request body, not a parsed object)");
  }
  if (typeof secret !== "string" || secret.length === 0) {
    throw new InvalidWebhookSignatureInputError("secret must be a non-empty string");
  }
  if (typeof signatureHeader !== "string" || signatureHeader.length === 0) {
    return false; // missing/absent header — not a program error, just an unverifiable request
  }

  const expectedHex = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expectedHex, "utf8");
  const actualBuf = Buffer.from(signatureHeader, "utf8");

  // timingSafeEqual throws if lengths differ — checked explicitly first so
  // a mismatched-length header is just "not verified", not an exception.
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

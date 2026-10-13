// PATH: functions/src/financial/checkoutSignature.ts
//
// Shared HMAC-SHA256 verification for the browser-checkout success
// callback signature — `HMAC-SHA256("${orderId}|${paymentId}", RAZORPAY_KEY_SECRET)`,
// compared against the client-supplied `razorpay_signature` field. This is
// the SAME scheme tutorCredits.ts / aiGuruCredits.ts / aiGuruSubscription.ts
// / seekho.ts's *PaymentSuccess / verify handlers already implemented
// inline (four near-identical copies) — extracted here so there's one
// implementation, not four to keep in sync.
//
// Deliberately distinct from ./webhookVerification.ts's
// verifyRazorpayWebhookSignature — different secret (RAZORPAY_KEY_SECRET,
// not RAZORPAY_WEBHOOK_SECRET), different signed payload (`order|payment`,
// not the raw webhook body), different purpose (an immediate client-
// initiated UI callback vs. the server-authoritative webhook). The two
// must never be confused or cross-verified — see webhookVerification.ts's
// header for the full "Payment Confirmation Hierarchy" reasoning.
//
// Uses crypto.timingSafeEqual (not `===`) — the four call sites this
// replaces originally used a plain string comparison; consolidating here
// also hardens all four against a timing side-channel, matching the
// timing-safe standard webhookVerification.ts already holds itself to.

import * as crypto from "crypto";

/**
 * Verifies a Razorpay checkout-callback signature. Returns a boolean
 * rather than throwing on a mismatch (an attacker probing the endpoint
 * with a guessed/replayed signature is an expected, frequent outcome, not
 * a program error) — every call site should respond 400 on `false`, never
 * treat it as an exception to catch.
 */
export function verifyRazorpayCheckoutSignature(
  orderId: unknown,
  paymentId: unknown,
  signature: unknown,
  secret: string,
): boolean {
  if (typeof orderId !== "string" || orderId.length === 0) return false;
  if (typeof paymentId !== "string" || paymentId.length === 0) return false;
  if (typeof signature !== "string" || signature.length === 0) return false;
  if (typeof secret !== "string" || secret.length === 0) return false;

  const expectedHex = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const expectedBuf = Buffer.from(expectedHex, "utf8");
  const actualBuf = Buffer.from(signature, "utf8");

  // timingSafeEqual throws if lengths differ — checked explicitly first so
  // a mismatched-length signature is just "not verified", not an exception.
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

// PATH: functions/src/__tests__/financial/webhookVerification.test.ts
// Offline unit tests for functions/src/financial/webhookVerification.ts —
// pure functions, no firebase-admin mocking needed.

import * as crypto from "crypto";
import {
  verifyRazorpayWebhookSignature,
  InvalidWebhookSignatureInputError,
} from "../../financial/webhookVerification";

const SECRET = "whsec_test_secret";

function signBody(body: string, secret = SECRET): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyRazorpayWebhookSignature", () => {
  test("accepts a correctly signed body", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    expect(verifyRazorpayWebhookSignature(body, signBody(body), SECRET)).toBe(true);
  });

  test("rejects a signature computed with the wrong secret", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    expect(verifyRazorpayWebhookSignature(body, signBody(body, "wrong_secret"), SECRET)).toBe(false);
  });

  test("rejects a tampered body (signature no longer matches)", () => {
    const originalBody = JSON.stringify({ event: "payment.captured", amount: 50000 });
    const sig = signBody(originalBody);
    const tamperedBody = JSON.stringify({ event: "payment.captured", amount: 9999900 });
    expect(verifyRazorpayWebhookSignature(tamperedBody, sig, SECRET)).toBe(false);
  });

  test("rejects a missing signature header", () => {
    const body = "{}";
    expect(verifyRazorpayWebhookSignature(body, undefined, SECRET)).toBe(false);
  });

  test("rejects an empty-string signature header", () => {
    expect(verifyRazorpayWebhookSignature("{}", "", SECRET)).toBe(false);
  });

  test("rejects a signature of the wrong length without throwing", () => {
    expect(verifyRazorpayWebhookSignature("{}", "short", SECRET)).toBe(false);
  });

  test("re-serializing the body differently breaks verification (raw-body requirement)", () => {
    // Same logical data, different key order -> different bytes -> different HMAC.
    // Demonstrates why the caller must pass the RAW body, never JSON.stringify(req.body).
    const rawBody = '{"event":"payment.captured","amount":50000}';
    const sig = signBody(rawBody);
    const reserialized = JSON.stringify({ amount: 50000, event: "payment.captured" });
    expect(verifyRazorpayWebhookSignature(reserialized, sig, SECRET)).toBe(false);
  });

  test("throws InvalidWebhookSignatureInputError for a non-string body", () => {
    expect(() => verifyRazorpayWebhookSignature(123 as unknown as string, "sig", SECRET)).toThrow(
      InvalidWebhookSignatureInputError,
    );
  });

  test("throws InvalidWebhookSignatureInputError for a missing/empty secret", () => {
    expect(() => verifyRazorpayWebhookSignature("{}", "sig", "")).toThrow(InvalidWebhookSignatureInputError);
  });
});

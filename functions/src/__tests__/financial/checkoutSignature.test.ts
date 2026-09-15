// PATH: functions/src/__tests__/financial/checkoutSignature.test.ts
// Offline unit tests for functions/src/financial/checkoutSignature.ts —
// pure function, no firebase-admin mocking needed.

import * as crypto from "crypto";
import { verifyRazorpayCheckoutSignature } from "../../financial/checkoutSignature";

const SECRET = "test_key_secret";

function sign(orderId: string, paymentId: string, secret = SECRET): string {
  return crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

describe("verifyRazorpayCheckoutSignature", () => {
  test("accepts a correctly signed order/payment pair", () => {
    const sig = sign("order_abc", "pay_xyz");
    expect(verifyRazorpayCheckoutSignature("order_abc", "pay_xyz", sig, SECRET)).toBe(true);
  });

  test("rejects a signature computed with the wrong secret", () => {
    const sig = sign("order_abc", "pay_xyz", "wrong_secret");
    expect(verifyRazorpayCheckoutSignature("order_abc", "pay_xyz", sig, SECRET)).toBe(false);
  });

  test("rejects a mismatched order id (signature reused for a different order)", () => {
    const sig = sign("order_abc", "pay_xyz");
    expect(verifyRazorpayCheckoutSignature("order_other", "pay_xyz", sig, SECRET)).toBe(false);
  });

  test("rejects a mismatched payment id", () => {
    const sig = sign("order_abc", "pay_xyz");
    expect(verifyRazorpayCheckoutSignature("order_abc", "pay_other", sig, SECRET)).toBe(false);
  });

  test("rejects a missing signature", () => {
    expect(verifyRazorpayCheckoutSignature("order_abc", "pay_xyz", undefined, SECRET)).toBe(false);
  });

  test("rejects an empty-string signature", () => {
    expect(verifyRazorpayCheckoutSignature("order_abc", "pay_xyz", "", SECRET)).toBe(false);
  });

  test("rejects a signature of the wrong length without throwing", () => {
    expect(() => verifyRazorpayCheckoutSignature("order_abc", "pay_xyz", "short", SECRET)).not.toThrow();
    expect(verifyRazorpayCheckoutSignature("order_abc", "pay_xyz", "short", SECRET)).toBe(false);
  });

  test("rejects a missing order id or payment id without throwing", () => {
    const sig = sign("order_abc", "pay_xyz");
    expect(verifyRazorpayCheckoutSignature(undefined, "pay_xyz", sig, SECRET)).toBe(false);
    expect(verifyRazorpayCheckoutSignature("order_abc", undefined, sig, SECRET)).toBe(false);
  });

  test("rejects a missing/empty secret without throwing", () => {
    const sig = sign("order_abc", "pay_xyz");
    expect(verifyRazorpayCheckoutSignature("order_abc", "pay_xyz", sig, "")).toBe(false);
  });
});

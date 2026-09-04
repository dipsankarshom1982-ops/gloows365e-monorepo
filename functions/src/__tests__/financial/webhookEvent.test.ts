// PATH: functions/src/__tests__/financial/webhookEvent.test.ts
// Offline unit tests for functions/src/financial/webhookEvent.ts — pure
// parser, no firebase-admin mocking needed.

import { parseRazorpayWebhookEvent } from "../../financial/webhookEvent";
import { FinancialValidationError } from "../../financial/validation";

const EVENT_ID = "evt_JgcUpvJDdcFLDU";

describe("parseRazorpayWebhookEvent", () => {
  test("parses a payment.captured event", () => {
    const body = {
      entity: "event",
      event: "payment.captured",
      contains: ["payment"],
      payload: {
        payment: { entity: { id: "pay_abc123", order_id: "order_xyz789", status: "captured" } },
      },
      created_at: 1700000000,
    };
    const parsed = parseRazorpayWebhookEvent(body, EVENT_ID);
    expect(parsed).toEqual({
      eventId: EVENT_ID,
      eventType: "payment.captured",
      orderId: "order_xyz789",
      paymentId: "pay_abc123",
      paymentStatus: "captured",
      razorpayCreatedAtMs: 1700000000000,
    });
  });

  test("parses a payment.failed event", () => {
    const body = {
      event: "payment.failed",
      payload: { payment: { entity: { id: "pay_fail1", order_id: "order_fail1", status: "failed" } } },
    };
    const parsed = parseRazorpayWebhookEvent(body, EVENT_ID);
    expect(parsed.eventType).toBe("payment.failed");
    expect(parsed.paymentStatus).toBe("failed");
  });

  test("falls back to the order entity's own id when no payment sub-object is present (order.paid)", () => {
    const body = {
      event: "order.paid",
      payload: { order: { entity: { id: "order_only", status: "paid" } } },
    };
    const parsed = parseRazorpayWebhookEvent(body, EVENT_ID);
    expect(parsed.orderId).toBe("order_only");
    expect(parsed.paymentId).toBeUndefined();
  });

  test("accepts an unrecognized/future event type without rejecting it", () => {
    const body = { event: "refund.processed", payload: {} };
    const parsed = parseRazorpayWebhookEvent(body, EVENT_ID);
    expect(parsed.eventType).toBe("refund.processed");
    expect(parsed.orderId).toBeUndefined();
    expect(parsed.paymentId).toBeUndefined();
  });

  test("omits optional fields entirely rather than setting them to undefined", () => {
    const body = { event: "refund.processed", payload: {} };
    const parsed = parseRazorpayWebhookEvent(body, EVENT_ID);
    expect("orderId" in parsed).toBe(false);
    expect("paymentId" in parsed).toBe(false);
    expect("razorpayCreatedAtMs" in parsed).toBe(false);
  });

  test("rejects a missing event-id header", () => {
    expect(() => parseRazorpayWebhookEvent({ event: "payment.captured" }, undefined)).toThrow(FinancialValidationError);
  });

  test("rejects an event-id header shaped like a path-traversal attempt", () => {
    expect(() => parseRazorpayWebhookEvent({ event: "payment.captured" }, "../../etc/passwd")).toThrow(
      FinancialValidationError,
    );
  });

  test("rejects a non-object body", () => {
    expect(() => parseRazorpayWebhookEvent(null, EVENT_ID)).toThrow(FinancialValidationError);
    expect(() => parseRazorpayWebhookEvent("not an object", EVENT_ID)).toThrow(FinancialValidationError);
  });

  test("rejects a body missing the event field", () => {
    expect(() => parseRazorpayWebhookEvent({ payload: {} }, EVENT_ID)).toThrow(FinancialValidationError);
  });
});

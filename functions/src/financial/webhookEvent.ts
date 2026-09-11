// PATH: functions/src/financial/webhookEvent.ts
//
// Phase B — Shared Razorpay Webhook Infrastructure. Pure parser that
// normalizes a raw Razorpay webhook delivery into a small, stable shape.
// Not called from any live code path until functions/src/razorpayWebhook.ts
// (this phase) wires it into the actual endpoint.
//
// ── Shape reference (Razorpay's documented webhook payload) ─────────────
// {
//   "entity": "event",
//   "event": "payment.captured",              // or "payment.failed", "order.paid", etc.
//   "contains": ["payment"],
//   "payload": {
//     "payment": { "entity": { "id": "pay_xxx", "order_id": "order_xxx", "status": "captured", ... } },
//     "order":   { "entity": { "id": "order_xxx", "status": "paid", ... } }   // present on order.* events
//   },
//   "created_at": 1700000000                  // unix seconds
// }
// The event's own idempotency key is NOT inside this body — Razorpay sends
// it as the `x-razorpay-event-id` HTTP header specifically so a consumer
// doesn't have to derive one. This parser accepts that header value
// alongside the body for exactly that reason; it does not fabricate an id
// from body contents.
//
// This parser deliberately accepts EVERY event type Razorpay might send
// (not just the ones this phase's 4 existing flows or a future booking
// flow care about) — Phase B's endpoint records and verifies every
// delivery; deciding which event types to actually ACT on is out of this
// phase's scope (see razorpayWebhook.ts's header).

import { assertNonEmptyString, FinancialValidationError } from "./validation";

/** Firestore-doc-id-safe AND matches Razorpay's own id format
 *  (e.g. "evt_JgcUpvJDdcFLDU") — alphanumeric plus underscore/hyphen,
 *  nothing that could be interpreted as a Firestore path separator. */
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

export interface ParsedRazorpayWebhookEvent {
  eventId: string;
  eventType: string;
  orderId?: string;
  paymentId?: string;
  paymentStatus?: string;
  /** epoch ms — converted from Razorpay's unix-seconds `created_at`. */
  razorpayCreatedAtMs?: number;
}

function safeString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Parses + validates a raw Razorpay webhook body plus its
 * `x-razorpay-event-id` header value into a normalized, stable shape.
 * Pure — no Firestore access. Throws FinancialValidationError on
 * malformed/missing required input; this is called ONLY after signature
 * verification has already succeeded (see razorpayWebhook.ts), so a thrown
 * error here means "Razorpay sent us something we don't understand," not
 * "an attacker is probing us" — the signature check already filtered that.
 */
export function parseRazorpayWebhookEvent(body: unknown, eventIdHeader: unknown): ParsedRazorpayWebhookEvent {
  if (typeof eventIdHeader !== "string" || !SAFE_ID_PATTERN.test(eventIdHeader)) {
    throw new FinancialValidationError(
      `x-razorpay-event-id header must be a non-empty id-shaped string, got ${JSON.stringify(eventIdHeader)}`,
    );
  }

  if (!body || typeof body !== "object") {
    throw new FinancialValidationError("webhook body must be a JSON object");
  }
  const b = body as Record<string, unknown>;

  const eventType = b["event"];
  assertNonEmptyString(eventType, "event", 100);

  const payload = (b["payload"] ?? {}) as Record<string, unknown>;
  const paymentEntity = ((payload["payment"] as Record<string, unknown> | undefined)?.["entity"] ?? {}) as Record<
    string,
    unknown
  >;
  const orderEntity = ((payload["order"] as Record<string, unknown> | undefined)?.["entity"] ?? {}) as Record<
    string,
    unknown
  >;

  const paymentId = safeString(paymentEntity["id"]);
  // order_id normally comes off the payment entity (present on every
  // payment.* event); fall back to the order entity's own id for an
  // order.* event that carries no payment sub-object yet.
  const orderId = safeString(paymentEntity["order_id"]) ?? safeString(orderEntity["id"]);
  const paymentStatus = safeString(paymentEntity["status"]);

  const createdAtRaw = b["created_at"];
  const razorpayCreatedAtMs = typeof createdAtRaw === "number" && Number.isFinite(createdAtRaw) ? createdAtRaw * 1000 : undefined;

  return {
    eventId: eventIdHeader,
    eventType,
    ...(orderId !== undefined ? { orderId } : {}),
    ...(paymentId !== undefined ? { paymentId } : {}),
    ...(paymentStatus !== undefined ? { paymentStatus } : {}),
    ...(razorpayCreatedAtMs !== undefined ? { razorpayCreatedAtMs } : {}),
  };
}

// PATH: functions/src/bookingPayment.ts
//
// Phase C+D — Booking Payment (Order Creation + Confirmation). Two pieces:
//
//   1. createBookingPaymentOrder (student-only callable) — creates a real
//      Razorpay order for an "accepted" booking. Mirrors
//      tutorCredits.ts's createTutorCreditOrder byte-for-byte (same
//      axios.post(".../v1/orders", ...) call, same secrets, same error
//      handling) — the only genuinely new logic is booking-specific
//      validation (Phase A2's canCreateNewPaymentAttempt/
//      isDuplicateSettlement guards) and resolving the amount from
//      bookings/{id}.sessionFee (Decision 5 — already an immutable
//      snapshot, confirmed in Phase A1, no schema change needed).
//
//   2. confirmBookingPaymentFromWebhook — called from razorpayWebhook.ts
//      (Phase B's endpoint) when a payment.captured/payment.failed event's
//      orderId matches a bookingPaymentOrders doc. This is the ONLY path
//      that ever confirms a booking payment — there is no separate
//      client-callback confirmation endpoint for bookings (unlike the 4
//      legacy flows). See razorpayWebhook.ts's header for why: Decision 1
//      requires webhook-as-primary-authority, and booking payments are a
//      brand-new flow with no legacy client-callback behavior to preserve,
//      so this is the clean place to implement that properly.
//
// Neither function touches tutorCreditOrders, aiGuruSubscriptionOrders,
// aiGuruCreditOrders, seekho_subscription_orders, instantHelp.ts, or
// tutorPayouts.ts. tutorEarnings/{uid}.balance (Instant Help's field) is
// never read or written here — only the new, earning-type-AGNOSTIC
// `heldBalance` field is touched (the held side of the same unified Tutor
// Financial Account `balance` is the available side of — never a second,
// marketplace-specific balance; see confirmBookingPaymentFromWebhook's own
// comment for the full reasoning), and only inside a transaction that also
// reads it first (never a blind increment that could race).

import axios from "axios";
import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { rupeesToPaise } from "./financial/money";
import { resolveBookingPaymentConfig, type BookingPaymentConfig } from "./financial/bookingPaymentConfig";
import { canCreateNewPaymentAttempt, isDuplicateSettlement, type PaymentAttemptSummary } from "./financial/paymentAttempt";
import { buildCommissionSnapshot } from "./financial/commission";
import type { BookingFinancialStatus, PaymentStatus } from "./financial/statuses";
import type { ParsedRazorpayWebhookEvent } from "./financial/webhookEvent";

const db = admin.firestore();

// ─── createBookingPaymentOrder ──────────────────────────────────────────────

export const createBookingPaymentOrder = functionsV1
  .runWith({
    timeoutSeconds: 60,
    // Same bump tutorCredits.ts/aiGuruSubscription.ts's Razorpay functions
    // already needed after a real OOM at 128MB — same Admin SDK + axios
    // footprint here.
    memory: "256MB",
    secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
  })
  .https.onCall(async (data: { bookingId?: string }, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const studentUid = context.auth.uid;
    const bookingId = (data?.bookingId ?? "").trim();
    if (!bookingId) {
      throw new functionsV1.https.HttpsError("invalid-argument", "bookingId is required");
    }

    const bookingRef = db.doc(`bookings/${bookingId}`);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
      throw new functionsV1.https.HttpsError("not-found", "Booking not found");
    }
    const booking = bookingSnap.data()!;

    if (booking.studentUid !== studentUid) {
      throw new functionsV1.https.HttpsError("permission-denied", "This booking doesn't belong to you");
    }
    // Workflow status (booking.status) is untouched by this phase — a
    // booking must already be tutor-accepted before payment can begin,
    // same as today's booking lifecycle.
    if (booking.status !== "accepted") {
      throw new functionsV1.https.HttpsError(
        "failed-precondition",
        `Booking must be "accepted" before payment can be started — currently "${booking.status}"`,
      );
    }

    const configSnap = await db.doc("bookingPaymentConfig/settings").get();
    let config;
    try {
      config = resolveBookingPaymentConfig(configSnap.exists ? (configSnap.data() as Partial<BookingPaymentConfig>) : undefined);
    } catch (e) {
      console.error("createBookingPaymentOrder: invalid bookingPaymentConfig/settings", e);
      throw new functionsV1.https.HttpsError("internal", "Payment configuration is invalid — contact support");
    }

    const attemptsSnap = await db.collection("bookingPaymentOrders").where("bookingId", "==", bookingId).get();
    const existingAttempts: PaymentAttemptSummary[] = attemptsSnap.docs.map((d) => ({ status: d.data()["status"] as PaymentStatus }));

    // On-demand expiry (Decision 6's minimal safe piece — no scheduled job
    // this phase): a booking still marked payment_pending from a past,
    // never-completed attempt gets flipped to payment_expired before we
    // decide whether a new attempt is allowed. Critically, this ALSO
    // flips the stale "created" order(s) themselves to "expired" — leaving
    // them at "created" would make canCreateNewPaymentAttempt's in-flight
    // check keep blocking every retry forever, since it has no visibility
    // into the booking-level expiry on its own (it only sees attempt
    // statuses).
    let financialStatus: BookingFinancialStatus = (booking.financialStatus as BookingFinancialStatus | undefined) ?? "not_required";
    const paymentExpiresAtExisting = booking.paymentExpiresAt as { toMillis?: () => number } | undefined;
    const paymentExpiresAtMs = typeof paymentExpiresAtExisting?.toMillis === "function" ? paymentExpiresAtExisting.toMillis() : undefined;
    if (financialStatus === "payment_pending" && paymentExpiresAtMs !== undefined && paymentExpiresAtMs < Date.now()) {
      financialStatus = "payment_expired";
      const now = admin.firestore.FieldValue.serverTimestamp();
      const expiryWrites: Promise<unknown>[] = [];
      attemptsSnap.docs.forEach((d, i) => {
        if (d.data()["status"] !== "created") return;
        existingAttempts[i] = { status: "expired" };
        expiryWrites.push(d.ref.update({ status: "expired" as PaymentStatus, updatedAt: now }));
      });
      await Promise.all(expiryWrites);
      await bookingRef.update({ financialStatus, updatedAt: now });
    }

    const decision = canCreateNewPaymentAttempt({ bookingFinancialStatus: financialStatus, existingAttempts });
    if (!decision.allowed) {
      throw new functionsV1.https.HttpsError("failed-precondition", decision.reason ?? "Cannot start a new payment attempt for this booking");
    }

    // Never re-derived from a tutor/service doc — booking.sessionFee is
    // the immutable snapshot taken at requestBooking time (Decision 5,
    // confirmed structurally sound in Phase A1 — no schema change here).
    const sessionFee = Number(booking.sessionFee);
    if (!Number.isInteger(sessionFee) || sessionFee <= 0) {
      throw new functionsV1.https.HttpsError("failed-precondition", "This booking has no valid session fee");
    }
    const grossAmountPaise = rupeesToPaise(sessionFee);

    const keyId = process.env["RAZORPAY_KEY_ID"] ?? "";
    const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? "";
    if (!keyId || !keySecret) {
      console.error("createBookingPaymentOrder: Razorpay secrets missing — keyId:", !!keyId, "keySecret:", !!keySecret);
      throw new functionsV1.https.HttpsError("failed-precondition", "Payments aren't configured — secrets missing");
    }

    let razorpayOrderId: string;
    try {
      // Identical shape to tutorCredits.ts's createTutorCreditOrder — same
      // endpoint, same auth, same timeout.
      const response = await axios.post(
        "https://api.razorpay.com/v1/orders",
        {
          amount: grossAmountPaise,
          currency: "INR",
          receipt: `bkp_${bookingId.slice(0, 20)}_${Date.now().toString().slice(-8)}`,
        },
        { auth: { username: keyId, password: keySecret }, timeout: 10_000 },
      );
      razorpayOrderId = response.data.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const rzpError = err?.response?.data?.error;
      const detail = rzpError ? `${rzpError.code}: ${rzpError.description}` : (err?.message ?? "Unknown error");
      console.error("createBookingPaymentOrder: Razorpay order creation failed:", detail, err?.response?.data);
      throw new functionsV1.https.HttpsError("internal", `Razorpay error: ${detail}`);
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const paymentExpiresAtMillis = Date.now() + config.paymentExpiryMinutes * 60_000;
    const paymentExpiresAt = admin.firestore.Timestamp.fromMillis(paymentExpiresAtMillis);

    await db.doc(`bookingPaymentOrders/${razorpayOrderId}`).set({
      bookingId,
      studentUid,
      tutorUid: booking.tutorUid,
      razorpayOrderId,
      grossAmountPaise,
      // Commission RATE is frozen here, at order-creation time — the
      // confirmation handler below reads THIS stored value, never
      // re-resolving bookingPaymentConfig again, so an admin changing the
      // platform rate mid-flight never retroactively alters an order a
      // student already started paying for.
      commissionRate: config.commissionRate,
      status: "created" as PaymentStatus,
      createdAt: now,
    });

    await bookingRef.update({
      financialStatus: "payment_pending" as BookingFinancialStatus,
      paymentExpiresAt,
      updatedAt: now,
    });

    console.log(
      `✅ Booking payment order created: ${razorpayOrderId} booking=${bookingId} student=${studentUid} amountPaise=${grossAmountPaise}`,
    );
    return { razorpayOrderId, grossAmountPaise, keyId, paymentExpiresAtMillis };
  });

// ─── confirmBookingPaymentFromWebhook ───────────────────────────────────────

export interface ConfirmBookingPaymentResult {
  acted: boolean;
  reason?: string;
}

/**
 * Called by razorpayWebhook.ts for a payment.captured/payment.failed event
 * whose orderId matches a bookingPaymentOrders doc. No-ops (acted: false)
 * for an event that doesn't correspond to any booking order — the caller
 * is expected to pre-check existence before calling this for efficiency,
 * but this function re-checks inside its own transaction regardless, since
 * that check being fresh (not stale) is what makes the duplicate-
 * settlement guard actually safe under concurrent webhook deliveries (see
 * below).
 *
 * Everything that matters — order.status !== "created" and
 * isDuplicateSettlement(booking.financialStatus) — is read and decided
 * INSIDE one Firestore transaction, not before it starts. This is
 * deliberate: two near-simultaneous webhook deliveries for two different
 * payment attempts on the SAME booking must never both credit earnings.
 * Reading orderRef/bookingRef via tx.get() (not a plain .get() before the
 * transaction) is what lets Firestore's optimistic concurrency control
 * catch that race — the loser transaction retries, re-reads the WINNER's
 * already-committed write, and correctly falls into the
 * isDuplicateSettlement branch instead of double-crediting. (The offline
 * FakeFirestore test harness doesn't simulate true concurrent retries —
 * see this file's test for what IS covered offline: the same logical
 * guard applied sequentially.)
 */
export async function confirmBookingPaymentFromWebhook(parsed: ParsedRazorpayWebhookEvent): Promise<ConfirmBookingPaymentResult> {
  if (!parsed.orderId) return { acted: false, reason: "event carries no orderId" };
  const orderRef = db.doc(`bookingPaymentOrders/${parsed.orderId}`);

  // Cheap pre-check outside the transaction — most webhook deliveries are
  // for the 4 legacy flows and simply won't match any bookingPaymentOrders
  // doc; no need to pay a transaction's cost to find that out. The
  // transaction below re-checks existence anyway (see header).
  const preCheck = await orderRef.get();
  if (!preCheck.exists) return { acted: false, reason: "not a booking payment order" };

  return db.runTransaction<ConfirmBookingPaymentResult>(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) return { acted: false, reason: "not a booking payment order" };
    const order = orderSnap.data()!;

    if (order["status"] !== "created") {
      // Already terminal — a retried/duplicate webhook delivery for an
      // order already resolved. Nothing left to do.
      return { acted: false, reason: `order already "${String(order["status"])}"` };
    }

    const bookingId = order["bookingId"] as string;
    const bookingRef = db.doc(`bookings/${bookingId}`);
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists) {
      console.error(`confirmBookingPaymentFromWebhook: booking ${bookingId} not found for order ${parsed.orderId}`);
      return { acted: false, reason: "booking not found" };
    }
    const booking = bookingSnap.data()!;
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (parsed.eventType === "payment.failed") {
      tx.update(orderRef, {
        status: "failed" as PaymentStatus,
        razorpayPaymentId: parsed.paymentId ?? null,
        updatedAt: now,
      });
      tx.update(bookingRef, { financialStatus: "payment_failed" as BookingFinancialStatus, updatedAt: now });
      return { acted: true };
    }

    // payment.captured from here on.
    const currentFinancialStatus: BookingFinancialStatus = (booking["financialStatus"] as BookingFinancialStatus | undefined) ?? "not_required";
    if (isDuplicateSettlement(currentFinancialStatus)) {
      // A SECOND successful payment for a booking that's already
      // confirmed/refunded — per Decision 7, this must never double-credit
      // earnings. Flagged on the order doc and logged loudly for manual
      // review; nothing else is touched.
      tx.update(orderRef, {
        status: "paid" as PaymentStatus,
        razorpayPaymentId: parsed.paymentId ?? null,
        duplicateSettlement: true,
        updatedAt: now,
      });
      console.error(
        `🚨 DUPLICATE booking payment settlement: order=${parsed.orderId} booking=${bookingId} bookingFinancialStatus was already "${currentFinancialStatus}" — earnings NOT credited, needs manual review`,
      );
      return { acted: true, reason: "duplicate settlement flagged, not credited" };
    }

    const commission = buildCommissionSnapshot({
      grossAmountPaise: Number(order["grossAmountPaise"]),
      commissionRate: Number(order["commissionRate"]),
    });
    // Paise -> rupee boundary (Phase A1 §8): rounds to the nearest whole
    // rupee to match tutorEarnings' existing integer-rupee convention —
    // any sub-rupee remainder is an intentional, documented platform
    // rounding difference, never silently dropped nor accumulated as a
    // hidden liability.
    const tutorNetRupees = Math.round(commission.tutorNetAmountPaise / 100);
    const tutorUid = order["tutorUid"] as string;
    const tutorEarningsRef = db.doc(`tutorEarnings/${tutorUid}`);

    // Held, not available — Decision 9 — using the UNIFIED tutorEarnings
    // held bucket (`heldBalance`), not a marketplace-specific field. Per
    // the locked "One Tutor Financial Ecosystem" architecture, this is the
    // held side of the SAME Tutor Financial Account instantHelp.ts's
    // existing `balance` field already represents the available side of —
    // never a second, parallel balance. `heldBalance` is earning-type-
    // agnostic by design; today only marketplace bookings populate it, but
    // nothing about its name or shape ties it to that source — WHICH
    // source contributed to it is answered at the ledger/transaction level
    // (earningType/bookingId/paymentOrderId below), never by the balance
    // field itself. instantHelp.ts's own `balance` field/settlement path
    // is never read or written here — Instant Help stays immediate/
    // available exactly as it always has.
    //
    // Release (heldBalance -> the existing `balance` field, once a
    // session completes and any dispute window elapses) is a separate,
    // not-yet-built future phase — nothing in this codebase reads
    // heldBalance for payout eligibility yet, so it is correctly inert
    // until that phase exists.
    const earningsSnap = await tx.get(tutorEarningsRef);
    const currentHeld = Number(earningsSnap.data()?.["heldBalance"] ?? 0);

    tx.set(tutorEarningsRef, { heldBalance: currentHeld + tutorNetRupees, updatedAt: now }, { merge: true });

    const ledgerRef = tutorEarningsRef.collection("transactions").doc();
    tx.set(ledgerRef, {
      type: "EARNING",
      amount: tutorNetRupees,
      source: "MARKETPLACE_BOOKING_PAYMENT",
      title: "Booking payment received",
      referenceId: bookingId,
      earningType: "marketplace_booking",
      bookingId,
      paymentOrderId: parsed.orderId,
      holdStatus: "held",
      createdAt: now,
    });

    tx.update(orderRef, {
      status: "paid" as PaymentStatus,
      razorpayPaymentId: parsed.paymentId ?? null,
      commissionAmountPaise: commission.commissionAmountPaise,
      tutorNetAmountPaise: commission.tutorNetAmountPaise,
      commissionSnapshotVersion: commission.commissionSnapshotVersion,
      commissionCalculatedAt: commission.calculatedAt,
      updatedAt: now,
    });
    tx.update(bookingRef, { financialStatus: "payment_confirmed" as BookingFinancialStatus, updatedAt: now });

    console.log(`✅ Booking payment confirmed: order=${parsed.orderId} booking=${bookingId} tutor=${tutorUid} netRupees=${tutorNetRupees}`);
    return { acted: true };
  });
}

// PATH: functions/src/refunds.ts
// Admin-controlled refund + reconciliation system (launch audit, Phase 1
// Task 7). Covers the four currently-live inbound payment flows: AI Guru
// subscriptions, AI Guru credit packs, Seekho subscriptions, tutor credit
// packs — functions365's subscription flow is deliberately excluded
// (separate, currently out of scope — see the launch audit).
//
// One `processRefund` callable handles all four flows via a `flow`
// parameter rather than four near-identical functions, because the shape
// is identical everywhere: verify the order → guard against a duplicate
// refund → call Razorpay → reconcile the entitlement. Only the entitlement
// step actually branches per flow (see resolveEntitlementAction).
//
// ── Exact field names this file depends on (re-verified against the
// current code before writing this, not assumed) ──────────────────────────
//   aiGuruSubscriptionOrders/{orderId}: uid, planId, cycle, amountPaise,
//     status, razorpayPaymentId, paidAt   →  subscriptions/{uid}:
//     status ("active"), endDate, razorpayOrderId
//   seekho_subscription_orders/{orderId}: userId (NOT uid), plan,
//     selectedClass, billingCycle, amountPaise, status, razorpayPaymentId,
//     paidAt   →  seekho_subscriptions/{userId}: razorpayOrderId,
//     expiresAt (NO status field — apps/mobile/services/seekhoFirestore.ts's
//     getSubscription() gates purely on expiresAt < Date.now())
//   aiGuruCreditOrders/{orderId}: uid, packId, credits, amountPaise,
//     status, razorpayPaymentId, paidAt   →  aiGuruCredits/{uid}.balance
//     (a pooled, spendable balance — not a single-entitlement doc)
//   tutorCreditOrders/{orderId}: uid, packId, credits, amountPaise,
//     status, razorpayPaymentId, paidAt   →  tutorCredits/{uid}.balance
//     (same pooled shape — but spend flows into a tutor's real
//     tutorEarnings balance via instantHelp.ts's settlement, which can
//     already have been withdrawn to a real bank account — see
//     resolveEntitlementAction's tutorCredits branch)
//
// ── Duplicate prevention ────────────────────────────────────────────────
// refunds/{flow}_{razorpayPaymentId} is a deterministic doc ID — a
// transaction checks its existence BEFORE any external I/O, so a second
// attempt on an already-succeeded (or in-flight) refund is rejected before
// Razorpay is ever called a second time. A "failed" refund can be retried
// (same doc, overwritten); a "needs_reconciliation" one is a hard stop
// until resolveRefundReconciliation clears it (see below) — retrying
// blind against an unknown external state is exactly what got us here.
//
// ── V1 scope: full refunds only ─────────────────────────────────────────
// refundedAmountPaise always equals originalAmountPaise and isFullRefund
// is always true — both fields exist now specifically so a V2 supporting
// partial refunds only needs to start accepting a smaller amount and
// isFullRefund:false, not a schema migration.

import axios from "axios";
import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";

const db = admin.firestore();

type Flow = "aiGuruSubscription" | "seekhoSubscription" | "aiGuruCredits" | "tutorCredits";

interface FlowConfig {
  orderCollection: string;
  userField: "uid" | "userId";
  kind: "subscription" | "creditPool";
  entitlementCollection: string;
  hasStatusField: boolean; // subscription-kind only — see header comment on seekho_subscriptions
}

const FLOW_CONFIG: Record<Flow, FlowConfig> = {
  aiGuruSubscription: {
    orderCollection: "aiGuruSubscriptionOrders", userField: "uid", kind: "subscription",
    entitlementCollection: "subscriptions", hasStatusField: true,
  },
  seekhoSubscription: {
    orderCollection: "seekho_subscription_orders", userField: "userId", kind: "subscription",
    entitlementCollection: "seekho_subscriptions", hasStatusField: false,
  },
  aiGuruCredits: {
    orderCollection: "aiGuruCreditOrders", userField: "uid", kind: "creditPool",
    entitlementCollection: "aiGuruCredits", hasStatusField: false,
  },
  tutorCredits: {
    orderCollection: "tutorCreditOrders", userField: "uid", kind: "creditPool",
    entitlementCollection: "tutorCredits", hasStatusField: false,
  },
};

type EntitlementActionType = "revoked" | "no_action_newer_entitlement_active" | "clawed_back_credits";

interface EntitlementAction {
  type: EntitlementActionType;
  detail: string;
  creditsClawedBack?: number;
}

// Reads the entitlement doc FRESH inside the caller's transaction (never
// stale data from before the Razorpay call) and both decides AND performs
// the write, so the whole thing — refund doc, order status, entitlement —
// commits atomically in one transaction. Reads must happen before writes
// in a Firestore transaction, hence returning the action object; the
// caller still does its own writes (refund doc, order status) after this.
async function resolveEntitlementAction(
  tx: FirebaseFirestore.Transaction,
  flow: Flow,
  config: FlowConfig,
  targetUid: string,
  order: FirebaseFirestore.DocumentData,
  razorpayOrderId: string,
  refundId: string
): Promise<EntitlementAction> {
  const entRef = db.doc(`${config.entitlementCollection}/${targetUid}`);

  if (config.kind === "subscription") {
    const entSnap = await tx.get(entRef);
    const ent = entSnap.exists ? entSnap.data()! : null;

    if (!ent || ent.razorpayOrderId !== razorpayOrderId) {
      // Either no entitlement doc at all, or the user has since renewed —
      // a DIFFERENT, currently-valid order now backs their access. Refund
      // the payment, but never touch access that a separate real payment
      // is legitimately granting.
      return {
        type: "no_action_newer_entitlement_active",
        detail: ent
          ? `A newer ${flow} entitlement (order ${ent.razorpayOrderId}) is currently active — original payment refunded, current access left untouched.`
          : `No ${config.entitlementCollection}/${targetUid} doc found — refunded the payment; there was no active entitlement to revoke.`,
      };
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const patch: Record<string, unknown> = {
      // expiresAt is what actually gates access for flows without a
      // status field (Seekho); set unconditionally so it works whether or
      // not hasStatusField is true — harmless extra field otherwise.
      expiresAt: admin.firestore.Timestamp.now(),
      updatedAt: now,
    };
    if (config.hasStatusField) {
      patch.status = "refunded";
      patch.endDate = admin.firestore.Timestamp.now();
    }
    tx.set(entRef, patch, { merge: true });

    return { type: "revoked", detail: `${flow} entitlement (order ${razorpayOrderId}) was the active one — revoked.` };
  }

  // creditPool (aiGuruCredits / tutorCredits)
  const entSnap = await tx.get(entRef);
  const currentBalance = entSnap.exists ? Number(entSnap.data()!.balance ?? 0) : 0;
  const orderCredits = Number(order.credits) || 0;
  const clawback = Math.max(0, Math.min(orderCredits, currentBalance));
  const isFull = clawback === orderCredits;

  let detail: string;
  if (isFull) {
    detail = `Clawed back the full ${clawback} credit(s) from this purchase.`;
  } else {
    detail = `Clawed back ${clawback} of ${orderCredits} credit(s) from the current pooled balance — the rest was already spent. ` +
      `This is a best-effort pooled-balance adjustment, not proof the exact credits from this purchase were the ones spent ` +
      `(the balance has no per-order tagging).`;
    if (flow === "tutorCredits") {
      detail += " Spent tutor credits fund a tutor's real earnings once a session settles (functions/src/instantHelp.ts) — " +
        "any amount already spent here may already have paid a tutor, possibly already withdrawn via RazorpayX. " +
        "That is NOT reversed automatically. Flag for manual review if it matters for this refund.";
    }
  }

  if (clawback > 0) {
    const now = admin.firestore.FieldValue.serverTimestamp();
    tx.set(entRef, {
      balance:   admin.firestore.FieldValue.increment(-clawback),
      updatedAt: now,
    }, { merge: true });
    tx.set(entRef.collection("transactions").doc(refundId), {
      type:        "DEBIT",
      amount:      clawback,
      source:      "REFUND_CLAWBACK",
      title:       "Refund — credits clawed back",
      description: detail,
      status:      "SUCCESS",
      referenceId: refundId,
      metadata:    { flow, razorpayOrderId, orderCredits },
      createdAt:   now,
      updatedAt:   now,
    });
  }

  return { type: "clawed_back_credits", detail, creditsClawedBack: clawback };
}

async function createRazorpayRefund(params: {
  keyId: string; keySecret: string; razorpayPaymentId: string; amountPaise: number; notes: Record<string, string>;
}): Promise<{ id: string; status: string }> {
  const response = await axios.post(
    `https://api.razorpay.com/v1/payments/${params.razorpayPaymentId}/refund`,
    { amount: params.amountPaise, speed: "normal", notes: params.notes },
    { auth: { username: params.keyId, password: params.keySecret }, timeout: 15_000 }
  );
  return { id: response.data.id, status: response.data.status };
}

async function listRazorpayRefunds(params: {
  keyId: string; keySecret: string; razorpayPaymentId: string;
}): Promise<unknown> {
  const response = await axios.get(
    `https://api.razorpay.com/v1/payments/${params.razorpayPaymentId}/refunds`,
    { auth: { username: params.keyId, password: params.keySecret }, timeout: 15_000 }
  );
  return response.data;
}

// A Razorpay refund-create call failing because the payment is already
// fully refunded (via this system on a prior partial success we lost
// track of, or — the case this exists for — refunded manually in the
// Razorpay dashboard outside this system entirely) reads as a
// BAD_REQUEST_ERROR whose description mentions the refund amount
// exceeding what's refundable. Treated as its own category rather than a
// plain failure: we don't know what actually happened, so we look it up
// and stop rather than guessing.
function looksLikeAlreadyRefunded(description: string): boolean {
  return /already.*refund|refund.*exceed|fully refunded/i.test(description);
}

export const processRefund = functionsV1
  .runWith({ timeoutSeconds: 60, memory: "256MB", secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"] })
  .https.onCall(async (
    data: { flow?: Flow; razorpayPaymentId?: string; reason?: string },
    context
  ) => {
    if (!context.auth?.token?.admin) {
      throw new functionsV1.https.HttpsError("permission-denied", "Admins only");
    }
    const adminUid = context.auth.uid;
    const { flow, razorpayPaymentId, reason } = data ?? {};

    if (!flow || !(flow in FLOW_CONFIG)) {
      throw new functionsV1.https.HttpsError("invalid-argument", `flow must be one of: ${Object.keys(FLOW_CONFIG).join(", ")}`);
    }
    if (!razorpayPaymentId || typeof razorpayPaymentId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "razorpayPaymentId is required");
    }
    if (!reason || !reason.trim()) {
      throw new functionsV1.https.HttpsError("invalid-argument", "reason is required — every refund needs an audit trail");
    }
    const trimmedReason = reason.trim();
    const config = FLOW_CONFIG[flow];

    const keyId     = process.env["RAZORPAY_KEY_ID"]     ?? "";
    const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? "";
    if (!keyId || !keySecret) {
      throw new functionsV1.https.HttpsError("failed-precondition", "Razorpay not configured — secrets missing");
    }

    // Orders are keyed by razorpayOrderId, not razorpayPaymentId — an
    // admin only has the payment ID (what a customer/receipt shows), so
    // this has to be a query. Single-field equality on a top-level
    // collection is automatically indexed by Firestore, no composite index
    // needed.
    const orderQuery = await db.collection(config.orderCollection)
      .where("razorpayPaymentId", "==", razorpayPaymentId)
      .limit(1)
      .get();
    if (orderQuery.empty) {
      throw new functionsV1.https.HttpsError("not-found", `No ${flow} order found for payment ${razorpayPaymentId}`);
    }
    const orderDoc = orderQuery.docs[0];
    const order = orderDoc.data();
    if (order.status !== "paid") {
      throw new functionsV1.https.HttpsError(
        "failed-precondition",
        `Order status is "${order.status}", not "paid" — there's nothing captured to refund`
      );
    }
    const targetUid          = order[config.userField] as string;
    const originalAmountPaise = Number(order.amountPaise) || 0;
    const razorpayOrderId     = orderDoc.id;

    if (!targetUid || originalAmountPaise <= 0) {
      throw new functionsV1.https.HttpsError("failed-precondition", "Order is missing its user or amount — cannot safely refund");
    }

    const refundId  = `${flow}_${razorpayPaymentId}`;
    const refundRef = db.doc(`refunds/${refundId}`);

    // ── Duplicate guard — before ANY external I/O ──────────────────────
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(refundRef);
      if (existing.exists) {
        const st = existing.data()!.status as string;
        if (st === "succeeded") {
          throw new functionsV1.https.HttpsError("already-exists", "This payment has already been refunded.");
        }
        if (st === "processing") {
          throw new functionsV1.https.HttpsError("failed-precondition", "A refund for this payment is already being processed.");
        }
        if (st === "needs_reconciliation") {
          throw new functionsV1.https.HttpsError(
            "failed-precondition",
            "This payment's refund state doesn't match what Razorpay reports — resolve via resolveRefundReconciliation before retrying."
          );
        }
        // st === "failed" → fall through, this is a retry.
      }
      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.set(refundRef, {
        flow, uid: targetUid, razorpayPaymentId, razorpayOrderId,
        orderCollection: config.orderCollection,
        originalAmountPaise, refundedAmountPaise: originalAmountPaise, isFullRefund: true,
        reason: trimmedReason,
        status: "processing",
        razorpayRefundId: null, razorpayRefundStatus: null,
        entitlementAction: null,
        requestedBy: adminUid, requestedAt: now, processedAt: null, errorMessage: null,
      }, { merge: true });
    });

    // ── Call Razorpay — outside any transaction, same rule every other
    // real-money call in this codebase follows (see tutorPayouts.ts's
    // markPayoutPaid header comment for why) ───────────────────────────
    let razorpayRefund: { id: string; status: string };
    try {
      razorpayRefund = await createRazorpayRefund({
        keyId, keySecret, razorpayPaymentId, amountPaise: originalAmountPaise,
        notes: { flow, refundId, reason: trimmedReason, adminUid },
      });
    } catch (err: any) {
      const rzpError = err?.response?.data?.error;
      const description: string = rzpError?.description ?? err?.message ?? "Unknown error";

      if (looksLikeAlreadyRefunded(description)) {
        let actualState: unknown = null;
        try {
          actualState = await listRazorpayRefunds({ keyId, keySecret, razorpayPaymentId });
        } catch (listErr: any) {
          console.error(`processRefund: couldn't look up actual refund state for ${razorpayPaymentId}:`, listErr?.message);
        }
        await refundRef.set({
          status: "needs_reconciliation",
          errorMessage: description,
          razorpayRefundStatus: actualState,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        console.error(`⚠️ processRefund: payment ${razorpayPaymentId} (${flow}) appears already refunded outside this system. Flagged needs_reconciliation — order/entitlement untouched.`);
        throw new functionsV1.https.HttpsError(
          "failed-precondition",
          `Razorpay reports this payment may already be refunded outside this system. Flagged for manual reconciliation (refunds/${refundId}) — nothing else was changed.`
        );
      }

      await refundRef.set({
        status: "failed",
        errorMessage: description,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      console.error(`processRefund: Razorpay refund failed for ${razorpayPaymentId} (${flow}):`, description);
      throw new functionsV1.https.HttpsError("internal", `Razorpay refund failed: ${description}`);
    }

    // ── Success — entitlement resolution + all writes commit together ──
    const now = admin.firestore.FieldValue.serverTimestamp();
    const result = await db.runTransaction(async (tx) => {
      const entitlementAction = await resolveEntitlementAction(tx, flow, config, targetUid, order, razorpayOrderId, refundId);

      tx.set(refundRef, {
        status: "succeeded",
        razorpayRefundId: razorpayRefund.id,
        razorpayRefundStatus: razorpayRefund.status,
        entitlementAction,
        processedAt: now,
      }, { merge: true });
      tx.update(orderDoc.ref, { status: "refunded", refundedAt: now });

      return entitlementAction;
    });

    console.log(`✅ Refund succeeded: flow=${flow} uid=${targetUid} payment=${razorpayPaymentId} razorpayRefundId=${razorpayRefund.id} entitlementAction=${result.type}`);
    return { success: true, refundId, razorpayRefundId: razorpayRefund.id, entitlementAction: result };
  });

// ── resolveRefundReconciliation (admin) ─────────────────────────────────
// The only way out of "needs_reconciliation" — a human checks Razorpay's
// dashboard/support for the payment's real state and tells this function
// what actually happened. Never guesses on its own.
export const resolveRefundReconciliation = functionsV1
  .runWith({ timeoutSeconds: 60, memory: "256MB" })
  .https.onCall(async (
    data: { refundId?: string; resolution?: "confirmed_refunded" | "not_actually_refunded"; note?: string },
    context
  ) => {
    if (!context.auth?.token?.admin) {
      throw new functionsV1.https.HttpsError("permission-denied", "Admins only");
    }
    const adminUid = context.auth.uid;
    const { refundId, resolution, note } = data ?? {};
    if (!refundId) throw new functionsV1.https.HttpsError("invalid-argument", "refundId is required");
    if (resolution !== "confirmed_refunded" && resolution !== "not_actually_refunded") {
      throw new functionsV1.https.HttpsError("invalid-argument", 'resolution must be "confirmed_refunded" or "not_actually_refunded"');
    }

    const refundRef = db.doc(`refunds/${refundId}`);
    const refundSnap = await refundRef.get();
    if (!refundSnap.exists) throw new functionsV1.https.HttpsError("not-found", "Refund record not found");
    const refund = refundSnap.data()!;
    if (refund.status !== "needs_reconciliation") {
      throw new functionsV1.https.HttpsError("failed-precondition", `Refund is "${refund.status}", not "needs_reconciliation" — nothing to resolve`);
    }

    const flow = refund.flow as Flow;
    const config = FLOW_CONFIG[flow];
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (resolution === "not_actually_refunded") {
      // The alarm was a false positive (or Razorpay's error was
      // unrelated) — clear it back to "failed" so a normal retry through
      // processRefund can proceed.
      await refundRef.set({
        status: "failed",
        errorMessage: `Reconciliation: confirmed NOT actually refunded externally. ${note ?? ""}`.trim(),
        resolvedBy: adminUid,
        resolvedAt: now,
      }, { merge: true });
      console.log(`✅ Refund reconciliation: ${refundId} resolved as not-actually-refunded by ${adminUid}`);
      return { status: "failed" };
    }

    // confirmed_refunded — a human verified the payment really was
    // refunded (outside this system). Bring our own books in line: mark
    // the order refunded and apply the exact same entitlement logic
    // processRefund's success path uses, so a manually-discovered refund
    // ends up in the same consistent state as one this system processed.
    const orderSnap = await db.collection(refund.orderCollection as string)
      .where("razorpayPaymentId", "==", refund.razorpayPaymentId)
      .limit(1)
      .get();
    if (orderSnap.empty) {
      throw new functionsV1.https.HttpsError("not-found", "Original order no longer found — cannot reconcile entitlement automatically");
    }
    const orderDoc = orderSnap.docs[0];
    const order = orderDoc.data();
    const targetUid = order[config.userField] as string;

    const result = await db.runTransaction(async (tx) => {
      const entitlementAction = await resolveEntitlementAction(tx, flow, config, targetUid, order, orderDoc.id, refundId);
      tx.set(refundRef, {
        status: "succeeded",
        entitlementAction,
        resolvedBy: adminUid,
        resolvedAt: now,
        errorMessage: `Reconciliation: confirmed refunded externally. ${note ?? ""}`.trim(),
        processedAt: now,
      }, { merge: true });
      tx.update(orderDoc.ref, { status: "refunded", refundedAt: now });
      return entitlementAction;
    });

    console.log(`✅ Refund reconciliation: ${refundId} confirmed refunded externally by ${adminUid}, entitlementAction=${result.type}`);
    return { status: "succeeded", entitlementAction: result };
  });

// ── reconcileRefundStatuses (scheduled) ─────────────────────────────────
// Status-sync only, mirrors reconcilePayoutStatuses/
// reconcileAiGuruCreditOrders — Razorpay refunds can stay "pending" for a
// while depending on the original payment method before settling to
// "processed" (or, rarely, "failed"). Never re-touches order/entitlement,
// which are already final the moment processRefund's success path runs —
// this only keeps razorpayRefundStatus itself fresh for visibility.
const TERMINAL_REFUND_STATUSES = new Set(["processed", "failed"]);

export const reconcileRefundStatuses = functionsV1
  .runWith({ timeoutSeconds: 300, memory: "256MB", secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"] })
  .pubsub.schedule("every 30 minutes")
  .onRun(async () => {
    const keyId     = process.env["RAZORPAY_KEY_ID"]     ?? "";
    const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? "";
    if (!keyId || !keySecret) {
      console.error("reconcileRefundStatuses: Razorpay secrets missing, skipping run");
      return;
    }

    const snap = await db.collection("refunds")
      .where("status", "==", "succeeded")
      .limit(200)
      .get();

    const pending = snap.docs.filter((d) => {
      const st = d.data().razorpayRefundStatus;
      return typeof st === "string" && !TERMINAL_REFUND_STATUSES.has(st);
    });
    if (pending.length === 0) return;

    for (const doc of pending) {
      const { razorpayPaymentId, razorpayRefundId } = doc.data();
      try {
        const response = await axios.get(
          `https://api.razorpay.com/v1/payments/${razorpayPaymentId}/refunds/${razorpayRefundId}`,
          { auth: { username: keyId, password: keySecret }, timeout: 10_000 }
        );
        const latestStatus = response.data.status as string;
        if (latestStatus === doc.data().razorpayRefundStatus) continue;
        await doc.ref.update({
          razorpayRefundStatus: latestStatus,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`✅ Reconciled refund status: ${doc.id} -> ${latestStatus}`);
      } catch (e: any) {
        console.error(`reconcileRefundStatuses failed for ${doc.id}:`, e?.message);
      }
    }
  });

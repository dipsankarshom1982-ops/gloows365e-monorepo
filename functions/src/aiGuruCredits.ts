// PATH: functions/src/aiGuruCredits.ts
// Pay-as-you-go credit purchase flow for AI Guru — coexists with
// aiGuruSubscription.ts's flat-fee subscriptions, doesn't replace them.
//
// Adapted from aiGuruSubscription.ts's Razorpay order/verify pattern, with
// one deliberate difference in the trust model: aiGuruCreateSubscription's
// checkout page takes planId/cycle/uid/amount straight from URL query
// params and aiGuruPaymentSuccess writes them back verbatim — nothing
// checks the paid amount against the real plan price, so a tampered
// checkout URL could claim any plan for any amount. Credits close that
// hole: aiGuruCreateCreditOrder resolves the pack (and therefore the price
// and credit amount) server-side and stores it in aiGuruCreditOrders/{id};
// aiGuruCreditPaymentSuccess reads credits/uid back from THAT doc, never
// from the client request body — only the three Razorpay fields
// (order id, payment id, signature) travel from client to server.

import axios from "axios";
import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { onRequest } from "firebase-functions/v2/https";
import { verifyRazorpayCheckoutSignature } from "./financial/checkoutSignature";

const db = admin.firestore();

// ── Create a Razorpay order for a credit pack ─────────────────────────────────

export const aiGuruCreateCreditOrder = functionsV1
  .runWith({
    timeoutSeconds: 60,
    // 256MB — order creation itself worked fine at 128MB in Task 7's
    // staging E2E test, but aiGuruCreditPaymentSuccess (same Admin SDK +
    // axios + crypto footprint, see its comment below) OOM-crashed on
    // every invocation there. Bumped this one preemptively too, matching
    // tutorCredits.ts's own precedent of applying the fix to every
    // function sharing that footprint rather than only the one observed
    // crashing.
    memory: "256MB",
    secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
  })
  .https.onCall(async (data: { packId: string }, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const packId = (data?.packId ?? "").trim();
    if (!packId) {
      throw new functionsV1.https.HttpsError("invalid-argument", "packId is required");
    }

    const packSnap = await db.doc(`aiGuruCreditPacks/${packId}`).get();
    if (!packSnap.exists) {
      throw new functionsV1.https.HttpsError("not-found", "Credit pack not found");
    }
    const pack = packSnap.data()!;
    if (pack.isActive === false) {
      throw new functionsV1.https.HttpsError("failed-precondition", "This credit pack is no longer available");
    }

    const amountPaise = Number(pack.pricePaise) || 0;
    const credits     = Number(pack.credits) + Number(pack.bonusCredits ?? 0);
    if (amountPaise < 100 || credits <= 0) {
      throw new functionsV1.https.HttpsError("failed-precondition", "Credit pack is misconfigured");
    }

    const keyId     = process.env["RAZORPAY_KEY_ID"]     ?? "";
    const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? "";
    if (!keyId || !keySecret) {
      console.error("Razorpay secrets missing — keyId:", !!keyId, "keySecret:", !!keySecret);
      throw new functionsV1.https.HttpsError("failed-precondition", "Razorpay not configured — secrets missing");
    }

    try {
      const response = await axios.post(
        "https://api.razorpay.com/v1/orders",
        {
          amount:   amountPaise,
          currency: "INR",
          receipt:  `agc_${uid.slice(0, 16)}_${Date.now().toString().slice(-8)}`,
        },
        { auth: { username: keyId, password: keySecret }, timeout: 10_000 }
      );

      const razorpayOrderId: string = response.data.id;

      // Written from the pack doc, not from anything the client sent — this
      // is what aiGuruCreditPaymentSuccess trusts at verify time.
      await db.doc(`aiGuruCreditOrders/${razorpayOrderId}`).set({
        uid,
        packId,
        credits,
        amountPaise,
        status:    "created",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ AI Guru credit order created: ${razorpayOrderId} uid=${uid} pack=${packId} credits=${credits}`);
      return { razorpayOrderId, amountPaise, credits, packName: pack.name ?? "Credits" };
    } catch (err: any) {
      const rzpError = err?.response?.data?.error;
      const detail   = rzpError
        ? `${rzpError.code}: ${rzpError.description}`
        : (err?.message ?? "Unknown error");
      console.error("Razorpay credit order creation failed:", detail, err?.response?.data);
      throw new functionsV1.https.HttpsError("internal", `Razorpay error: ${detail}`);
    }
  });

// ── HTTP endpoint called from the checkout page after payment success ─────────

export const aiGuruCreditPaymentSuccess = onRequest(
  {
    timeoutSeconds: 30,
    // 256MiB — same Admin SDK + axios + crypto footprint as
    // aiGuruPaymentSuccess, which OOM-crashed on every invocation at
    // 128MiB during Task 7's staging E2E test ("Memory limit of 128 MiB
    // exceeded with 133 MiB used"). Fixed preemptively here rather than
    // waiting to reproduce the identical crash a second time.
    memory: "256MiB",
    secrets: ["RAZORPAY_KEY_SECRET"],
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST")   { res.status(405).send("Method not allowed"); return; }

    try {
      const {
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
      } = req.body;

      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? "";
      if (!verifyRazorpayCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, keySecret)) {
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      const orderRef = db.doc(`aiGuruCreditOrders/${razorpay_order_id}`);

      const result = await db.runTransaction(async (tx) => {
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists) {
          return { notFound: true as const };
        }
        const order = orderSnap.data()!;
        if (order.status === "paid") {
          return { alreadyCredited: true as const };
        }

        const balanceRef = db.doc(`aiGuruCredits/${order.uid}`);
        // Ledger doc ID = the Razorpay payment ID — a second, independent
        // idempotency key on top of the order-status check above.
        const txRef = balanceRef.collection("transactions").doc(razorpay_payment_id);
        const now = admin.firestore.FieldValue.serverTimestamp();

        tx.set(balanceRef, {
          balance:           admin.firestore.FieldValue.increment(order.credits),
          lifetimePurchased: admin.firestore.FieldValue.increment(order.credits),
          lastPurchaseAt:    now,
          updatedAt:         now,
        }, { merge: true });

        tx.set(txRef, {
          type:        "CREDIT",
          amount:      order.credits,
          source:      "CREDIT_PACK_PURCHASE",
          title:       "AI Guru Credits Purchased",
          description: `${order.credits} AI Guru credits`,
          status:      "SUCCESS",
          referenceId: razorpay_order_id,
          metadata:    { packId: order.packId, razorpayPaymentId: razorpay_payment_id },
          createdAt:   now,
          updatedAt:   now,
        });

        tx.update(orderRef, {
          status:            "paid",
          razorpayPaymentId: razorpay_payment_id,
          paidAt:            now,
        });

        return { credited: true as const, credits: order.credits, uid: order.uid };
      });

      if ("notFound" in result) {
        res.status(404).json({ error: "Order not found" });
        return;
      }
      if ("alreadyCredited" in result) {
        res.status(200).json({ success: true, alreadyCredited: true });
        return;
      }

      console.log(`✅ AI Guru credits activated: uid=${result.uid} credits=${result.credits} order=${razorpay_order_id}`);
      res.status(200).json({ success: true, credits: result.credits });
    } catch (e: any) {
      console.error("aiGuruCreditPaymentSuccess error:", e?.message);
      res.status(500).json({ error: e?.message ?? "Internal error" });
    }
  }
);

// ── Reconciliation safety net ──────────────────────────────────────────────────
// Covers the case where a user pays but closes the tab/app before the
// checkout page's client-side fetch to aiGuruCreditPaymentSuccess lands —
// Razorpay has their money and nothing would otherwise credit it. Runs
// every 10 minutes, checks any order still "created" after 10+ minutes
// directly against Razorpay, and credits anything actually captured.

export const reconcileAiGuruCreditOrders = functionsV1
  .runWith({
    timeoutSeconds: 300,
    // 256MB — same footprint/precedent as the other two functions in this
    // file, see aiGuruCreateCreditOrder's comment above.
    memory: "256MB",
    secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
  })
  .pubsub.schedule("every 10 minutes")
  .onRun(async () => {
    const keyId     = process.env["RAZORPAY_KEY_ID"]     ?? "";
    const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? "";
    if (!keyId || !keySecret) {
      console.error("reconcileAiGuruCreditOrders: Razorpay secrets missing, skipping run");
      return;
    }

    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 10 * 60 * 1000);
    const staleSnap = await db
      .collection("aiGuruCreditOrders")
      .where("status", "==", "created")
      .where("createdAt", "<", cutoff)
      .limit(50) // one run's worth — the schedule catches the rest next pass
      .get();

    if (staleSnap.empty) return;

    for (const orderDoc of staleSnap.docs) {
      const razorpayOrderId = orderDoc.id;
      try {
        const response = await axios.get(
          `https://api.razorpay.com/v1/orders/${razorpayOrderId}/payments`,
          { auth: { username: keyId, password: keySecret }, timeout: 10_000 }
        );
        const capturedPayment = (response.data.items ?? []).find(
          (p: any) => p.status === "captured"
        );
        if (!capturedPayment) continue; // genuinely unpaid/abandoned — leave as "created"

        const order = orderDoc.data();
        const balanceRef = db.doc(`aiGuruCredits/${order.uid}`);
        const txRef = balanceRef.collection("transactions").doc(capturedPayment.id);

        await db.runTransaction(async (tx) => {
          const freshOrderSnap = await tx.get(orderDoc.ref);
          if (freshOrderSnap.data()?.status === "paid") return; // raced with the normal webhook path

          const now = admin.firestore.FieldValue.serverTimestamp();
          tx.set(balanceRef, {
            balance:           admin.firestore.FieldValue.increment(order.credits),
            lifetimePurchased: admin.firestore.FieldValue.increment(order.credits),
            lastPurchaseAt:    now,
            updatedAt:         now,
          }, { merge: true });
          tx.set(txRef, {
            type:        "CREDIT",
            amount:      order.credits,
            source:      "CREDIT_PACK_PURCHASE",
            title:       "AI Guru Credits Purchased",
            description: `${order.credits} AI Guru credits (reconciled)`,
            status:      "SUCCESS",
            referenceId: razorpayOrderId,
            metadata:    { packId: order.packId, razorpayPaymentId: capturedPayment.id, reconciled: true },
            createdAt:   now,
            updatedAt:   now,
          });
          tx.update(orderDoc.ref, {
            status:            "paid",
            razorpayPaymentId: capturedPayment.id,
            paidAt:            now,
          });
        });

        console.log(`✅ Reconciled AI Guru credit order: ${razorpayOrderId} uid=${order.uid} credits=${order.credits}`);
      } catch (e: any) {
        console.error(`reconcileAiGuruCreditOrders failed for order ${razorpayOrderId}:`, e?.message);
        // Leave it "created" — picked up again next run.
      }
    }
  });

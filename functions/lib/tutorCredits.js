"use strict";
// PATH: functions/src/tutorCredits.ts
// ShikshaHub Phase 4 — pay-as-you-go credit purchase flow that funds
// Instant Help per-minute billing (functions/src/instantHelp.ts). A
// near-line-for-line mirror of aiGuruCredits.ts's Razorpay order/verify/
// reconcile pattern, kept as a genuinely separate currency/collection
// (tutorCredits/{uid}, not aiGuruCredits/{uid}) rather than reusing AI
// Guru's balance — approved Phase 4 scope: tutor-economy spend shouldn't
// mix with (or be capped/priced by) an unrelated feature's credit packs.
//
// tutorCreditPaymentSuccess resolves credits/amount from tutorCreditOrders/
// {orderId} (itself resolved server-side from tutorCreditPacks at
// order-create time), never from the client request body — only the three
// Razorpay fields travel from client to server, same trust-model rule
// aiGuruCreditPaymentSuccess already follows.
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcileTutorCreditOrders = exports.tutorCreditPaymentSuccess = exports.createTutorCreditOrder = void 0;
const axios_1 = require("axios");
const crypto = require("crypto");
const admin = require("firebase-admin");
const functionsV1 = require("firebase-functions/v1");
const https_1 = require("firebase-functions/v2/https");
const db = admin.firestore();
// ── Create a Razorpay order for a tutor-credit pack ────────────────────────
exports.createTutorCreditOrder = functionsV1
    .runWith({
    timeoutSeconds: 60,
    // 256MB — bumped from 128MB after tutorCreditPaymentSuccess (the same
    // memory allocation, mirrored from aiGuruCreditPaymentSuccess) was
    // observed OOM-crashing on a real cold start in staging E2E ("Memory
    // limit of 128 MiB exceeded with 128 MiB used"). Applied to all three
    // Razorpay functions here as a precaution since they share the same
    // Admin SDK + axios + crypto footprint.
    memory: "256MB",
    secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const packId = (data?.packId ?? "").trim();
    if (!packId) {
        throw new functionsV1.https.HttpsError("invalid-argument", "packId is required");
    }
    const packSnap = await db.doc(`tutorCreditPacks/${packId}`).get();
    if (!packSnap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "Credit pack not found");
    }
    const pack = packSnap.data();
    if (pack.isActive === false) {
        throw new functionsV1.https.HttpsError("failed-precondition", "This credit pack is no longer available");
    }
    const amountPaise = Number(pack.pricePaise) || 0;
    const credits = Number(pack.credits) + Number(pack.bonusCredits ?? 0);
    if (amountPaise < 100 || credits <= 0) {
        throw new functionsV1.https.HttpsError("failed-precondition", "Credit pack is misconfigured");
    }
    const keyId = process.env["RAZORPAY_KEY_ID"] ?? "";
    const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? "";
    if (!keyId || !keySecret) {
        console.error("Razorpay secrets missing — keyId:", !!keyId, "keySecret:", !!keySecret);
        throw new functionsV1.https.HttpsError("failed-precondition", "Razorpay not configured — secrets missing");
    }
    try {
        const response = await axios_1.default.post("https://api.razorpay.com/v1/orders", {
            amount: amountPaise,
            currency: "INR",
            receipt: `tcc_${uid.slice(0, 16)}_${Date.now().toString().slice(-8)}`,
        }, { auth: { username: keyId, password: keySecret }, timeout: 10000 });
        const razorpayOrderId = response.data.id;
        await db.doc(`tutorCreditOrders/${razorpayOrderId}`).set({
            uid,
            packId,
            credits,
            amountPaise,
            status: "created",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`✅ Tutor credit order created: ${razorpayOrderId} uid=${uid} pack=${packId} credits=${credits}`);
        return { razorpayOrderId, amountPaise, credits, packName: pack.name ?? "Credits" };
    }
    catch (err) {
        const rzpError = err?.response?.data?.error;
        const detail = rzpError
            ? `${rzpError.code}: ${rzpError.description}`
            : (err?.message ?? "Unknown error");
        console.error("Razorpay tutor-credit order creation failed:", detail, err?.response?.data);
        throw new functionsV1.https.HttpsError("internal", `Razorpay error: ${detail}`);
    }
});
// ── HTTP endpoint called from the checkout page after payment success ─────
exports.tutorCreditPaymentSuccess = (0, https_1.onRequest)({
    timeoutSeconds: 30,
    // 256MiB — see createTutorCreditOrder's comment above. This is the
    // specific function confirmed OOM-crashing at 128MiB on a real staging
    // cold start during E2E verification, payment_id pay_TS5WDRHX0EPPrf
    // (real TEST-mode Razorpay payment captured but never recorded here as
    // a result — no partial write, the transaction never ran).
    memory: "256MiB",
    secrets: ["RAZORPAY_KEY_SECRET"],
}, async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
    }
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, } = req.body;
        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
            res.status(400).json({ error: "Missing required fields" });
            return;
        }
        const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? "";
        const expectedSig = crypto
            .createHmac("sha256", keySecret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");
        if (expectedSig !== razorpay_signature) {
            res.status(400).json({ error: "Invalid signature" });
            return;
        }
        const orderRef = db.doc(`tutorCreditOrders/${razorpay_order_id}`);
        const result = await db.runTransaction(async (tx) => {
            const orderSnap = await tx.get(orderRef);
            if (!orderSnap.exists) {
                return { notFound: true };
            }
            const order = orderSnap.data();
            if (order.status === "paid") {
                return { alreadyCredited: true };
            }
            const balanceRef = db.doc(`tutorCredits/${order.uid}`);
            const txRef = balanceRef.collection("transactions").doc(razorpay_payment_id);
            const now = admin.firestore.FieldValue.serverTimestamp();
            tx.set(balanceRef, {
                balance: admin.firestore.FieldValue.increment(order.credits),
                lifetimePurchased: admin.firestore.FieldValue.increment(order.credits),
                lastPurchaseAt: now,
                updatedAt: now,
            }, { merge: true });
            tx.set(txRef, {
                type: "CREDIT",
                amount: order.credits,
                source: "CREDIT_PACK_PURCHASE",
                title: "Tutor Credits Purchased",
                description: `${order.credits} tutor credits`,
                status: "SUCCESS",
                referenceId: razorpay_order_id,
                metadata: { packId: order.packId, razorpayPaymentId: razorpay_payment_id },
                createdAt: now,
                updatedAt: now,
            });
            tx.update(orderRef, {
                status: "paid",
                razorpayPaymentId: razorpay_payment_id,
                paidAt: now,
            });
            return { credited: true, credits: order.credits, uid: order.uid };
        });
        if ("notFound" in result) {
            res.status(404).json({ error: "Order not found" });
            return;
        }
        if ("alreadyCredited" in result) {
            res.status(200).json({ success: true, alreadyCredited: true });
            return;
        }
        console.log(`✅ Tutor credits activated: uid=${result.uid} credits=${result.credits} order=${razorpay_order_id}`);
        res.status(200).json({ success: true, credits: result.credits });
    }
    catch (e) {
        console.error("tutorCreditPaymentSuccess error:", e?.message);
        res.status(500).json({ error: e?.message ?? "Internal error" });
    }
});
// ── Reconciliation safety net ──────────────────────────────────────────────
// Same purpose as reconcileAiGuruCreditOrders: covers a user paying then
// closing the tab/app before the checkout page's client-side fetch to
// tutorCreditPaymentSuccess lands. Runs every 10 minutes.
exports.reconcileTutorCreditOrders = functionsV1
    .runWith({
    timeoutSeconds: 300,
    // 256MB — see createTutorCreditOrder's comment above.
    memory: "256MB",
    secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
})
    .pubsub.schedule("every 10 minutes")
    .onRun(async () => {
    const keyId = process.env["RAZORPAY_KEY_ID"] ?? "";
    const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? "";
    if (!keyId || !keySecret) {
        console.error("reconcileTutorCreditOrders: Razorpay secrets missing, skipping run");
        return;
    }
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 10 * 60 * 1000);
    const staleSnap = await db
        .collection("tutorCreditOrders")
        .where("status", "==", "created")
        .where("createdAt", "<", cutoff)
        .limit(50)
        .get();
    if (staleSnap.empty)
        return;
    for (const orderDoc of staleSnap.docs) {
        const razorpayOrderId = orderDoc.id;
        try {
            const response = await axios_1.default.get(`https://api.razorpay.com/v1/orders/${razorpayOrderId}/payments`, { auth: { username: keyId, password: keySecret }, timeout: 10000 });
            const capturedPayment = (response.data.items ?? []).find((p) => p.status === "captured");
            if (!capturedPayment)
                continue;
            const order = orderDoc.data();
            const balanceRef = db.doc(`tutorCredits/${order.uid}`);
            const txRef = balanceRef.collection("transactions").doc(capturedPayment.id);
            await db.runTransaction(async (tx) => {
                const freshOrderSnap = await tx.get(orderDoc.ref);
                if (freshOrderSnap.data()?.status === "paid")
                    return;
                const now = admin.firestore.FieldValue.serverTimestamp();
                tx.set(balanceRef, {
                    balance: admin.firestore.FieldValue.increment(order.credits),
                    lifetimePurchased: admin.firestore.FieldValue.increment(order.credits),
                    lastPurchaseAt: now,
                    updatedAt: now,
                }, { merge: true });
                tx.set(txRef, {
                    type: "CREDIT",
                    amount: order.credits,
                    source: "CREDIT_PACK_PURCHASE",
                    title: "Tutor Credits Purchased",
                    description: `${order.credits} tutor credits (reconciled)`,
                    status: "SUCCESS",
                    referenceId: razorpayOrderId,
                    metadata: { packId: order.packId, razorpayPaymentId: capturedPayment.id, reconciled: true },
                    createdAt: now,
                    updatedAt: now,
                });
                tx.update(orderDoc.ref, {
                    status: "paid",
                    razorpayPaymentId: capturedPayment.id,
                    paidAt: now,
                });
            });
            console.log(`✅ Reconciled tutor credit order: ${razorpayOrderId} uid=${order.uid} credits=${order.credits}`);
        }
        catch (e) {
            console.error(`reconcileTutorCreditOrders failed for order ${razorpayOrderId}:`, e?.message);
        }
    }
});
//# sourceMappingURL=tutorCredits.js.map
"use strict";
// PATH: functions/src/tutorPayouts.ts
// ShikshaHub Phase 5 — tutor earnings payout. Builds on Phase 4's
// tutorEarnings/{tutorUid} balance (functions/src/instantHelp.ts's
// settleInstantHelpSession() is still the only thing that ever credits
// it) with the missing piece: a real way for a tutor to withdraw it.
// Same v1 onCall convention as every other ShikshaHub callable.
//
// Original Phase 5 scope: manual/admin-processed payouts — a tutor
// requests a withdrawal, an admin reviews (approve/reject) and, once
// approved, transferred the money themselves outside the app via their
// own banking, then called markPayoutPaid to confirm it.
//
// Automated payouts phase — markPayoutPaid now triggers a REAL RazorpayX
// transfer (see razorpayXClient.ts) instead of just confirming a manual
// one; reviewPayoutRequest's admin-approval gate is unchanged, so a human
// still signs off before any money moves. 1 credit = ₹1 (approved Phase 5
// rate, no separate conversion table) — unchanged.
//
// Platform commission (approved Phase 5 scope: the platform DOES take a
// cut, unlike Phase 4's Instant Help settlement which is a 100%
// pass-through): an admin-configurable rate in payoutConfig/settings,
// snapshotted onto the request at requestPayout time — never re-derived
// later even if the admin changes the rate afterward, same
// snapshot-not-live-reference rule bookings/{id}.sessionFee and every
// other price in this codebase already follows. commissionAmount is
// deducted FROM requestedAmount, not added on top: requesting ₹500 at 10%
// debits the full ₹500 from tutorEarnings.balance, the tutor is owed
// payoutAmount=₹450, and the platform keeps commissionAmount=₹50 (no
// separate platform-revenue ledger this phase — commission is implicitly
// "not paid out", not journaled anywhere else; that's later-phase scope
// if a full ledger is ever needed).
//
// Reservation model: requestPayout debits (reserves) tutorEarnings.balance
// transactionally the moment a request is created, in the same
// transaction that checks the tutor has no other pending/approved
// request — not at markPayoutPaid time. cancelPayoutRequest and a
// reviewPayoutRequest rejection both credit the reservation back;
// approval leaves it reserved. This means markPayoutPaid never needs to
// (and doesn't) touch the balance itself — by the time a human approves
// and the RazorpayX transfer fires, the money is already guaranteed to be
// there. Each transactions/{requestId} ledger doc is written once at
// request time (status "HOLD") and updated in place as the request moves
// through RELEASED or SUCCESS, rather than getting a second row later.
//
// Client never writes payoutRequests/{id} or tutorPayoutDetails/{uid}
// directly — firestore.rules has `allow write: if false` on both, exactly
// mirroring every other ShikshaHub collection driven entirely by
// Admin-SDK callables.
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcilePayoutStatuses = exports.markPayoutPaid = exports.reviewPayoutRequest = exports.cancelPayoutRequest = exports.requestPayout = exports.saveTutorPayoutDetails = exports.updatePayoutConfig = void 0;
const admin = require("firebase-admin");
const functionsV1 = require("firebase-functions/v1");
const shikshahubNotify_1 = require("./shikshahubNotify");
const razorpayXClient_1 = require("./razorpayXClient");
const db = admin.firestore();
const DEFAULT_COMMISSION_PERCENT = 10;
const DEFAULT_MINIMUM_PAYOUT = 100;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER_RE = /^\d{9,18}$/;
const UPI_RE = /^[\w.\-]{2,49}@[a-zA-Z]{2,49}$/;
async function getPayoutConfig() {
    try {
        const snap = await db.doc("payoutConfig/settings").get();
        const data = snap.exists ? snap.data() : {};
        return {
            commissionPercent: typeof data.commissionPercent === "number" ? data.commissionPercent : DEFAULT_COMMISSION_PERCENT,
            minimumPayoutAmount: typeof data.minimumPayoutAmount === "number" ? data.minimumPayoutAmount : DEFAULT_MINIMUM_PAYOUT,
            enabled: data.enabled !== false,
        };
    }
    catch {
        return { commissionPercent: DEFAULT_COMMISSION_PERCENT, minimumPayoutAmount: DEFAULT_MINIMUM_PAYOUT, enabled: true };
    }
}
// ─── updatePayoutConfig (admin) ──────────────────────────────────────────────
// Phase 5 operational feature — the only writer of payoutConfig/settings.
// firestore.rules closes direct client writes on this doc (allow write: if
// false, same closed-write pattern every other ShikshaHub collection
// uses) precisely so an admin can't push an unvalidated value straight
// from the client the way aiGuruCreditConfig/settings' older convention
// still allows elsewhere in this codebase. Read stays open to any
// authenticated user in firestore.rules — apps/tutor's and
// apps/tutor-mobile's payouts screens read this doc directly (client
// getDoc) to show a tutor the current minimum/commission before they
// request a payout, which is unaffected by closing the write side.
exports.updatePayoutConfig = functionsV1
    .runWith({ timeoutSeconds: 15, memory: "128MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth?.token?.admin) {
        throw new functionsV1.https.HttpsError("permission-denied", "Admins only");
    }
    const adminUid = context.auth.uid;
    const { commissionPercent, minimumPayoutAmount, enabled } = data ?? {};
    if (typeof commissionPercent !== "number" || !Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) {
        throw new functionsV1.https.HttpsError("invalid-argument", "commissionPercent must be a number from 0 to 100");
    }
    if (typeof minimumPayoutAmount !== "number" || !Number.isInteger(minimumPayoutAmount) || minimumPayoutAmount < 0) {
        throw new functionsV1.https.HttpsError("invalid-argument", "minimumPayoutAmount must be a non-negative integer");
    }
    if (typeof enabled !== "boolean") {
        throw new functionsV1.https.HttpsError("invalid-argument", "enabled must be a boolean");
    }
    const now = admin.firestore.FieldValue.serverTimestamp();
    await db.doc("payoutConfig/settings").set({
        commissionPercent,
        minimumPayoutAmount,
        enabled,
        updatedAt: now,
        updatedBy: adminUid,
    }, { merge: true });
    console.log(`✅ payoutConfig/settings updated by admin ${adminUid}: commissionPercent=${commissionPercent} minimumPayoutAmount=${minimumPayoutAmount} enabled=${enabled}`);
    return { commissionPercent, minimumPayoutAmount, enabled };
});
// ─── saveTutorPayoutDetails ──────────────────────────────────────────────────
exports.saveTutorPayoutDetails = functionsV1
    .runWith({ timeoutSeconds: 15, memory: "128MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const tutorUid = context.auth.uid;
    const tutorSnap = await db.doc(`tutors/${tutorUid}`).get();
    if (!tutorSnap.exists) {
        throw new functionsV1.https.HttpsError("permission-denied", "Only tutor accounts can save payout details");
    }
    const { method, accountHolderName, accountNumber, ifsc, upiId } = data ?? {};
    if (method !== "bank_transfer" && method !== "upi") {
        throw new functionsV1.https.HttpsError("invalid-argument", 'method must be "bank_transfer" or "upi"');
    }
    if (!accountHolderName || !accountHolderName.trim()) {
        throw new functionsV1.https.HttpsError("invalid-argument", "accountHolderName is required");
    }
    const patch = {
        method,
        accountHolderName: accountHolderName.trim(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (method === "bank_transfer") {
        if (!accountNumber || !ACCOUNT_NUMBER_RE.test(accountNumber)) {
            throw new functionsV1.https.HttpsError("invalid-argument", "accountNumber must be 9-18 digits");
        }
        if (!ifsc || !IFSC_RE.test(ifsc.toUpperCase())) {
            throw new functionsV1.https.HttpsError("invalid-argument", "ifsc must be a valid IFSC code (e.g. HDFC0001234)");
        }
        patch.accountNumber = accountNumber;
        patch.ifsc = ifsc.toUpperCase();
        patch.upiId = admin.firestore.FieldValue.delete();
    }
    else {
        if (!upiId || !UPI_RE.test(upiId)) {
            throw new functionsV1.https.HttpsError("invalid-argument", "upiId must look like name@bank");
        }
        patch.upiId = upiId;
        patch.accountNumber = admin.firestore.FieldValue.delete();
        patch.ifsc = admin.firestore.FieldValue.delete();
    }
    await db.doc(`tutorPayoutDetails/${tutorUid}`).set(patch, { merge: true });
    console.log(`✅ Payout details saved: tutor=${tutorUid} method=${method}`);
    return { saved: true };
});
// ─── requestPayout ───────────────────────────────────────────────────────────
exports.requestPayout = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "256MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const tutorUid = context.auth.uid;
    const tutorSnap = await db.doc(`tutors/${tutorUid}`).get();
    if (!tutorSnap.exists) {
        throw new functionsV1.https.HttpsError("permission-denied", "Only tutor accounts can request a payout");
    }
    const tutor = tutorSnap.data();
    const requestedAmount = Number(data?.requestedAmount);
    if (!Number.isInteger(requestedAmount) || requestedAmount <= 0) {
        throw new functionsV1.https.HttpsError("invalid-argument", "requestedAmount must be a positive integer");
    }
    const config = await getPayoutConfig();
    if (!config.enabled) {
        throw new functionsV1.https.HttpsError("failed-precondition", "Payouts are currently disabled");
    }
    if (requestedAmount < config.minimumPayoutAmount) {
        throw new functionsV1.https.HttpsError("invalid-argument", `Minimum payout amount is ₹${config.minimumPayoutAmount}`);
    }
    const payoutDetailsSnap = await db.doc(`tutorPayoutDetails/${tutorUid}`).get();
    if (!payoutDetailsSnap.exists) {
        throw new functionsV1.https.HttpsError("failed-precondition", "Save your payout details before requesting a payout");
    }
    const details = payoutDetailsSnap.data();
    const requestRef = db.collection("payoutRequests").doc();
    const balanceRef = db.doc(`tutorEarnings/${tutorUid}`);
    const result = await db.runTransaction(async (tx) => {
        const [balanceSnap, openSnap] = await Promise.all([
            tx.get(balanceRef),
            tx.get(db.collection("payoutRequests")
                .where("tutorUid", "==", tutorUid)
                .where("status", "in", ["pending", "approved"])
                .limit(1)),
        ]);
        const balance = balanceSnap.exists ? Number(balanceSnap.data()?.balance ?? 0) : 0;
        if (requestedAmount > balance) {
            throw new functionsV1.https.HttpsError("failed-precondition", `Requested amount exceeds your earnings balance (₹${balance})`);
        }
        if (!openSnap.empty) {
            throw new functionsV1.https.HttpsError("failed-precondition", "You already have a pending or approved payout request");
        }
        const commissionPercent = config.commissionPercent;
        const commissionAmount = Math.round(requestedAmount * commissionPercent / 100);
        const payoutAmount = requestedAmount - commissionAmount;
        const now = admin.firestore.FieldValue.serverTimestamp();
        tx.set(requestRef, {
            tutorUid,
            requestedAmount,
            commissionPercent,
            commissionAmount,
            payoutAmount,
            method: details.method,
            accountHolderName: details.accountHolderName ?? "",
            ...(details.method === "bank_transfer"
                ? { accountNumber: details.accountNumber ?? "", ifsc: details.ifsc ?? "" }
                : { upiId: details.upiId ?? "" }),
            status: "pending",
            tutorName: tutor.name ?? "",
            requestedAt: now,
            updatedAt: now,
        });
        // Reserve the funds NOW, not at markPayoutPaid time — closes the
        // window where the balance re-check there ran only AFTER the real
        // RazorpayX transfer had already gone out (see markPayoutPaid's
        // header comment for why that ordering existed). With only one
        // pending/approved request allowed per tutor (openSnap above) and
        // the debit happening in the same transaction as the openSnap
        // read/requestRef write, nothing else can spend this money out from
        // under an approved request. Released back via this same
        // transactions/{requestId} doc if the request is later cancelled or
        // rejected — see cancelPayoutRequest / reviewPayoutRequest.
        tx.set(balanceRef, {
            balance: admin.firestore.FieldValue.increment(-requestedAmount),
            updatedAt: now,
        }, { merge: true });
        tx.set(balanceRef.collection("transactions").doc(requestRef.id), {
            type: "PAYOUT",
            amount: requestedAmount,
            source: "TUTOR_PAYOUT",
            title: "Payout requested",
            description: `₹${payoutAmount} to be paid out (₹${commissionAmount} platform commission on ₹${requestedAmount}) — held pending admin approval`,
            status: "HOLD",
            referenceId: requestRef.id,
            metadata: { commissionAmount, payoutAmount, method: details.method },
            createdAt: now,
            updatedAt: now,
        });
        return { requestId: requestRef.id, commissionAmount, payoutAmount };
    });
    console.log(`✅ Payout requested: ${result.requestId} tutor=${tutorUid} amount=${requestedAmount}`);
    return { requestId: result.requestId, status: "pending", commissionAmount: result.commissionAmount, payoutAmount: result.payoutAmount };
});
// ─── cancelPayoutRequest ─────────────────────────────────────────────────────
exports.cancelPayoutRequest = functionsV1
    .runWith({ timeoutSeconds: 15, memory: "128MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const tutorUid = context.auth.uid;
    const { requestId } = data ?? {};
    if (!requestId || typeof requestId !== "string") {
        throw new functionsV1.https.HttpsError("invalid-argument", "requestId is required");
    }
    const requestRef = db.doc(`payoutRequests/${requestId}`);
    const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists) {
            throw new functionsV1.https.HttpsError("not-found", "Payout request not found");
        }
        const request = snap.data();
        if (request.tutorUid !== tutorUid) {
            throw new functionsV1.https.HttpsError("permission-denied", "This request doesn't belong to you");
        }
        if (request.status !== "pending") {
            throw new functionsV1.https.HttpsError("failed-precondition", `Request is already "${request.status}"`);
        }
        const now = admin.firestore.FieldValue.serverTimestamp();
        tx.update(requestRef, {
            status: "cancelled",
            updatedAt: now,
        });
        // Release the hold requestPayout placed on this amount.
        const balanceRef = db.doc(`tutorEarnings/${tutorUid}`);
        tx.set(balanceRef, {
            balance: admin.firestore.FieldValue.increment(Number(request.requestedAmount) || 0),
            updatedAt: now,
        }, { merge: true });
        tx.set(balanceRef.collection("transactions").doc(requestId), {
            status: "RELEASED",
            title: "Payout request cancelled",
            updatedAt: now,
        }, { merge: true });
        return { status: "cancelled" };
    });
    console.log(`✅ Payout request ${requestId} cancelled by tutor ${tutorUid}`);
    return result;
});
// ─── reviewPayoutRequest (admin) ─────────────────────────────────────────────
exports.reviewPayoutRequest = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "256MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth?.token?.admin) {
        throw new functionsV1.https.HttpsError("permission-denied", "Admins only");
    }
    const adminUid = context.auth.uid;
    const { requestId, action, note } = data ?? {};
    if (!requestId || typeof requestId !== "string") {
        throw new functionsV1.https.HttpsError("invalid-argument", "requestId is required");
    }
    if (action !== "approve" && action !== "reject") {
        throw new functionsV1.https.HttpsError("invalid-argument", 'action must be "approve" or "reject"');
    }
    const requestRef = db.doc(`payoutRequests/${requestId}`);
    const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists) {
            throw new functionsV1.https.HttpsError("not-found", "Payout request not found");
        }
        const request = snap.data();
        if (request.status !== "pending") {
            throw new functionsV1.https.HttpsError("failed-precondition", `Request is already "${request.status}"`);
        }
        const newStatus = action === "approve" ? "approved" : "rejected";
        const now = admin.firestore.FieldValue.serverTimestamp();
        tx.update(requestRef, {
            status: newStatus,
            adminNote: note ?? null,
            reviewedBy: adminUid,
            reviewedAt: now,
            updatedAt: now,
        });
        if (action === "reject") {
            // Release the hold requestPayout placed on this amount — approval
            // deliberately leaves it reserved (markPayoutPaid relies on that).
            const balanceRef = db.doc(`tutorEarnings/${request.tutorUid}`);
            tx.set(balanceRef, {
                balance: admin.firestore.FieldValue.increment(Number(request.requestedAmount) || 0),
                updatedAt: now,
            }, { merge: true });
            tx.set(balanceRef.collection("transactions").doc(requestId), {
                status: "RELEASED",
                title: "Payout request rejected",
                updatedAt: now,
            }, { merge: true });
        }
        return { status: newStatus, tutorUid: request.tutorUid, requestedAmount: Number(request.requestedAmount) || 0 };
    });
    console.log(`✅ Payout request ${requestId} ${result.status} by admin ${adminUid}`);
    await (0, shikshahubNotify_1.notifyTutor)(result.tutorUid, {
        title: result.status === "approved" ? "✅ Payout request approved" : "Payout request rejected",
        body: result.status === "approved"
            ? `Your ₹${result.requestedAmount} payout request was approved — the transfer is on its way.`
            : `Your ₹${result.requestedAmount} payout request was rejected${note ? `: ${note}` : "."}`,
        type: "payout",
    }).catch((e) => console.warn("reviewPayoutRequest: notifyTutor failed:", e));
    return { status: result.status };
});
// ─── markPayoutPaid (admin) ──────────────────────────────────────────────────
// Automated payouts phase — this used to be the admin confirming they'd
// already transferred the money manually outside the app; it's now the
// moment that REALLY triggers the transfer, via RazorpayX's Payout
// Composite API (razorpayXClient.ts). The admin-approval gate
// (reviewPayoutRequest) is unchanged — a human still signs off before
// this ever runs, just no more manual banking after that.
//
// The RazorpayX API call happens BEFORE any Firestore write (it's
// external I/O, which never belongs inside a db.runTransaction callback —
// same rule this codebase's transaction-throw bug from Phase 4 already
// taught). tutorEarnings.balance itself is NOT touched here — requestPayout
// already reserved (debited) it transactionally at request time, so
// there's nothing left to debit or re-verify by the time RazorpayX is
// called. (Earlier versions of this function debited/re-checked balance
// here, AFTER the transfer had already gone out — which could only ever
// fail loudly once the money had already left. Reserving at request time
// instead closes that window.) A hard failure (bad credentials,
// insufficient RazorpayX balance, invalid account, etc.) leaves the
// request "approved" and the reservation intact — untouched, safely
// retryable, since the idempotency key (this request's own id) guarantees
// RazorpayX itself can never process two real transfers for one request
// even across retries.
exports.markPayoutPaid = functionsV1
    .runWith({
    timeoutSeconds: 30, memory: "256MB",
    secrets: ["RAZORPAYX_KEY_ID", "RAZORPAYX_KEY_SECRET", "RAZORPAYX_ACCOUNT_NUMBER"],
})
    .https.onCall(async (data, context) => {
    if (!context.auth?.token?.admin) {
        throw new functionsV1.https.HttpsError("permission-denied", "Admins only");
    }
    const adminUid = context.auth.uid;
    const { requestId, note } = data ?? {};
    if (!requestId || typeof requestId !== "string") {
        throw new functionsV1.https.HttpsError("invalid-argument", "requestId is required");
    }
    const keyId = process.env["RAZORPAYX_KEY_ID"] ?? "";
    const keySecret = process.env["RAZORPAYX_KEY_SECRET"] ?? "";
    const accountNumber = process.env["RAZORPAYX_ACCOUNT_NUMBER"] ?? "";
    if (!keyId || !keySecret || !accountNumber) {
        console.error("markPayoutPaid: RazorpayX secrets missing — keyId:", !!keyId, "keySecret:", !!keySecret, "accountNumber:", !!accountNumber);
        throw new functionsV1.https.HttpsError("failed-precondition", "RazorpayX not configured — secrets missing");
    }
    const requestRef = db.doc(`payoutRequests/${requestId}`);
    const preSnap = await requestRef.get();
    if (!preSnap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "Payout request not found");
    }
    const preRequest = preSnap.data();
    if (preRequest.status !== "approved") {
        throw new functionsV1.https.HttpsError("failed-precondition", `Request must be "approved" first (currently "${preRequest.status}")`);
    }
    const detailsSnap = await db.doc(`tutorPayoutDetails/${preRequest.tutorUid}`).get();
    if (!detailsSnap.exists) {
        throw new functionsV1.https.HttpsError("failed-precondition", "Tutor's payout details are missing — cannot process");
    }
    const details = detailsSnap.data();
    const fundAccount = details.method === "upi"
        ? { method: "upi", accountHolderName: details.accountHolderName ?? "", upiId: details.upiId ?? "" }
        : { method: "bank_transfer", accountHolderName: details.accountHolderName ?? "", accountNumber: details.accountNumber ?? "", ifsc: details.ifsc ?? "" };
    const payoutAmount = Number(preRequest.payoutAmount) || 0;
    let payoutResult;
    try {
        payoutResult = await (0, razorpayXClient_1.createRazorpayXPayout)({
            keyId, keySecret, accountNumber,
            idempotencyKey: requestId,
            amountRupees: payoutAmount,
            referenceId: requestId,
            narration: "ShikshaHub tutor payout",
            tutorName: preRequest.tutorName ?? "",
            fundAccount,
        });
    }
    catch (e) {
        const reason = e instanceof razorpayXClient_1.RazorpayXError ? e.message : (e?.message ?? "RazorpayX payout failed");
        console.error(`markPayoutPaid: RazorpayX payout failed for request ${requestId}:`, reason);
        throw new functionsV1.https.HttpsError("internal", `RazorpayX payout failed: ${reason}`);
    }
    const requestedAmount = Number(preRequest.requestedAmount) || 0;
    const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists) {
            throw new functionsV1.https.HttpsError("not-found", "Payout request not found");
        }
        const request = snap.data();
        if (request.status !== "approved") {
            // The RazorpayX transfer has ALREADY happened at this point —
            // this branch means our own books somehow drifted from what we
            // just paid for real. Extremely unlikely (single-admin-triggered,
            // nothing else moves "approved"->"paid"), but loud logging here
            // is deliberate: this is the one case worth a human looking at.
            console.error(`markPayoutPaid: *** POST-PAYOUT STATE MISMATCH *** request ${requestId} was "${request.status}" after a real RazorpayX payout (${payoutResult.id}) already succeeded — needs manual reconciliation.`);
            throw new functionsV1.https.HttpsError("failed-precondition", `Request is already "${request.status}" — the transfer succeeded (RazorpayX id ${payoutResult.id}) but needs manual reconciliation`);
        }
        // No balance debit or sufficiency check here anymore — requestPayout
        // already reserved (debited) this exact amount transactionally at
        // request time, and it stays reserved through "approved" (see that
        // function's comment). This used to re-check balance AFTER the
        // RazorpayX transfer above had already gone out, which could only
        // ever fail loudly after the money had already left — moving the
        // debit earlier closes that window instead of just logging it.
        const now = admin.firestore.FieldValue.serverTimestamp();
        const balanceRef = db.doc(`tutorEarnings/${request.tutorUid}`);
        const txRef = balanceRef.collection("transactions").doc(requestId);
        // Finalize the HOLD entry requestPayout created rather than writing
        // a second ledger row for the same money.
        tx.set(txRef, {
            title: "Payout processed",
            status: "SUCCESS",
            description: `₹${request.payoutAmount} paid out (₹${request.commissionAmount} platform commission on ₹${requestedAmount})`,
            metadata: {
                commissionAmount: request.commissionAmount, payoutAmount: request.payoutAmount, method: request.method,
                razorpayPayoutId: payoutResult.id, razorpayStatus: payoutResult.status, razorpayUtr: payoutResult.utr,
            },
            updatedAt: now,
        }, { merge: true });
        tx.update(requestRef, {
            status: "paid",
            adminNote: note ?? request.adminNote ?? null,
            paidAt: now,
            updatedAt: now,
            razorpayPayoutId: payoutResult.id,
            razorpayStatus: payoutResult.status,
            razorpayUtr: payoutResult.utr,
        });
        return { status: "paid", tutorUid: request.tutorUid, payoutAmount: Number(request.payoutAmount) || 0 };
    });
    console.log(`✅ Payout request ${requestId} marked paid by admin ${adminUid} — RazorpayX payout ${payoutResult.id} (${payoutResult.status})`);
    await (0, shikshahubNotify_1.notifyTutor)(result.tutorUid, {
        title: "💸 Payout paid",
        body: `₹${result.payoutAmount} has been transferred to your account.`,
        type: "payout",
    }).catch((e) => console.warn("markPayoutPaid: notifyTutor failed:", e));
    return { status: result.status, razorpayStatus: payoutResult.status, razorpayUtr: payoutResult.utr };
});
// ─── reconcilePayoutStatuses ──────────────────────────────────────────────────
// Automated payouts phase — status-sync only, mirrors
// functions/src/tutorCredits.ts's reconcileTutorCreditOrders. Refreshes
// razorpayStatus/razorpayUtr for any "paid" request whose last known
// RazorpayX status wasn't terminal yet (a bank transfer initiated via
// IMPS/UPI is usually near-instant, but NEFT/RTGS or a queued-for-balance
// payout can take longer to actually settle). Deliberately never reverses
// tutorEarnings.balance or flips a request's own status back — the
// balance was already debited (reserved) at requestPayout time, well
// before RazorpayX ever got involved, same "accepted means final" rule
// Phase 4's Razorpay Orders reconciliation already follows. A payout that
// later comes back "reversed" or "failed" needs a human to look at it,
// not a silent auto-refund — that's genuinely later-phase scope if ever
// needed.
const TERMINAL_RAZORPAY_STATUSES = new Set(["processed", "reversed", "failed", "cancelled", "rejected"]);
exports.reconcilePayoutStatuses = functionsV1
    .runWith({
    timeoutSeconds: 300, memory: "256MB",
    secrets: ["RAZORPAYX_KEY_ID", "RAZORPAYX_KEY_SECRET"],
})
    .pubsub.schedule("every 15 minutes")
    .onRun(async () => {
    const keyId = process.env["RAZORPAYX_KEY_ID"] ?? "";
    const keySecret = process.env["RAZORPAYX_KEY_SECRET"] ?? "";
    if (!keyId || !keySecret) {
        console.error("reconcilePayoutStatuses: RazorpayX secrets missing, skipping run");
        return;
    }
    // Fetch a bounded batch of "paid" requests and filter in code — same
    // shape tickInstantHelp/tickBookingCompletion already use — rather
    // than relying on Firestore's not-in-with-a-possibly-missing-field
    // query semantics. Requests paid via the pre-automation manual flow
    // (this phase's predecessor) have no razorpayPayoutId at all and are
    // correctly skipped below, not endlessly re-swept.
    const snap = await db.collection("payoutRequests")
        .where("status", "==", "paid")
        .orderBy("paidAt", "desc")
        .limit(200)
        .get();
    const pending = snap.docs.filter((d) => {
        const data = d.data();
        return !!data.razorpayPayoutId && !TERMINAL_RAZORPAY_STATUSES.has(data.razorpayStatus);
    });
    if (pending.length === 0)
        return;
    for (const doc of pending) {
        const razorpayPayoutId = doc.data().razorpayPayoutId;
        try {
            const latest = await (0, razorpayXClient_1.fetchRazorpayXPayoutStatus)({ keyId, keySecret, payoutId: razorpayPayoutId });
            if (latest.status === doc.data().razorpayStatus)
                continue;
            await doc.ref.update({
                razorpayStatus: latest.status,
                razorpayUtr: latest.utr,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`✅ Reconciled payout status: ${doc.id} razorpayPayoutId=${razorpayPayoutId} -> ${latest.status}`);
        }
        catch (e) {
            console.error(`reconcilePayoutStatuses failed for ${doc.id} (razorpayPayoutId=${razorpayPayoutId}):`, e?.message);
        }
    }
});
//# sourceMappingURL=tutorPayouts.js.map
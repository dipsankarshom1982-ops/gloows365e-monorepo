// PATH: functions/src/tutorPayouts.ts
// ShikshaHub Phase 5 — tutor earnings payout. Builds on Phase 4's
// tutorEarnings/{tutorUid} balance (functions/src/instantHelp.ts's
// settleInstantHelpSession() is still the only thing that ever credits
// it) with the missing piece: a real way for a tutor to withdraw it.
// Same v1 onCall convention as every other ShikshaHub callable.
//
// Approved Phase 5 scope: manual/admin-processed payouts, NOT an automated
// bank-transfer API (RazorpayX/Payouts is explicitly later-phase scope —
// see this repo's Phase 4 discussion). A tutor requests a withdrawal; an
// admin reviews (approve/reject) and, once approved, transfers the money
// themselves outside the app via their own banking, then calls
// markPayoutPaid — the ONE moment the balance is actually debited. 1
// credit = ₹1 (approved Phase 5 rate, no separate conversion table).
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
// Client never writes payoutRequests/{id} or tutorPayoutDetails/{uid}
// directly — firestore.rules has `allow write: if false` on both, exactly
// mirroring every other ShikshaHub collection driven entirely by
// Admin-SDK callables.

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";

const db = admin.firestore();

type PayoutMethod = "bank_transfer" | "upi";
type PayoutRequestStatus = "pending" | "approved" | "rejected" | "paid" | "cancelled";

const DEFAULT_COMMISSION_PERCENT = 10;
const DEFAULT_MINIMUM_PAYOUT = 100;

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER_RE = /^\d{9,18}$/;
const UPI_RE = /^[\w.\-]{2,49}@[a-zA-Z]{2,49}$/;

async function getPayoutConfig(): Promise<{ commissionPercent: number; minimumPayoutAmount: number; enabled: boolean }> {
  try {
    const snap = await db.doc("payoutConfig/settings").get();
    const data = snap.exists ? snap.data()! : {};
    return {
      commissionPercent: typeof data.commissionPercent === "number" ? data.commissionPercent : DEFAULT_COMMISSION_PERCENT,
      minimumPayoutAmount: typeof data.minimumPayoutAmount === "number" ? data.minimumPayoutAmount : DEFAULT_MINIMUM_PAYOUT,
      enabled: data.enabled !== false,
    };
  } catch {
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
export const updatePayoutConfig = functionsV1
  .runWith({ timeoutSeconds: 15, memory: "128MB" })
  .https.onCall(async (
    data: { commissionPercent?: number; minimumPayoutAmount?: number; enabled?: boolean },
    context
  ) => {
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
export const saveTutorPayoutDetails = functionsV1
  .runWith({ timeoutSeconds: 15, memory: "128MB" })
  .https.onCall(async (
    data: { method?: PayoutMethod; accountHolderName?: string; accountNumber?: string; ifsc?: string; upiId?: string },
    context
  ) => {
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

    const patch: Record<string, unknown> = {
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
    } else {
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
export const requestPayout = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "256MB" })
  .https.onCall(async (data: { requestedAmount?: number }, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const tutorUid = context.auth.uid;
    const tutorSnap = await db.doc(`tutors/${tutorUid}`).get();
    if (!tutorSnap.exists) {
      throw new functionsV1.https.HttpsError("permission-denied", "Only tutor accounts can request a payout");
    }
    const tutor = tutorSnap.data()!;

    const requestedAmount = Number(data?.requestedAmount);
    if (!Number.isInteger(requestedAmount) || requestedAmount <= 0) {
      throw new functionsV1.https.HttpsError("invalid-argument", "requestedAmount must be a positive integer");
    }

    const config = await getPayoutConfig();
    if (!config.enabled) {
      throw new functionsV1.https.HttpsError("failed-precondition", "Payouts are currently disabled");
    }
    if (requestedAmount < config.minimumPayoutAmount) {
      throw new functionsV1.https.HttpsError(
        "invalid-argument",
        `Minimum payout amount is ₹${config.minimumPayoutAmount}`
      );
    }

    const payoutDetailsSnap = await db.doc(`tutorPayoutDetails/${tutorUid}`).get();
    if (!payoutDetailsSnap.exists) {
      throw new functionsV1.https.HttpsError("failed-precondition", "Save your payout details before requesting a payout");
    }
    const details = payoutDetailsSnap.data()!;

    const requestRef = db.collection("payoutRequests").doc();
    const result = await db.runTransaction(async (tx) => {
      const [balanceSnap, openSnap] = await Promise.all([
        tx.get(db.doc(`tutorEarnings/${tutorUid}`)),
        tx.get(db.collection("payoutRequests")
          .where("tutorUid", "==", tutorUid)
          .where("status", "in", ["pending", "approved"])
          .limit(1)),
      ]);

      const balance = balanceSnap.exists ? Number(balanceSnap.data()?.balance ?? 0) : 0;
      if (requestedAmount > balance) {
        throw new functionsV1.https.HttpsError(
          "failed-precondition",
          `Requested amount exceeds your earnings balance (₹${balance})`
        );
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
        status: "pending" as PayoutRequestStatus,
        tutorName: (tutor.name as string | undefined) ?? "",
        requestedAt: now,
        updatedAt: now,
      });

      return { requestId: requestRef.id, commissionAmount, payoutAmount };
    });

    console.log(`✅ Payout requested: ${result.requestId} tutor=${tutorUid} amount=${requestedAmount}`);
    return { requestId: result.requestId, status: "pending" as PayoutRequestStatus, commissionAmount: result.commissionAmount, payoutAmount: result.payoutAmount };
  });

// ─── cancelPayoutRequest ─────────────────────────────────────────────────────
export const cancelPayoutRequest = functionsV1
  .runWith({ timeoutSeconds: 15, memory: "128MB" })
  .https.onCall(async (data: { requestId?: string }, context) => {
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
      const request = snap.data()!;
      if (request.tutorUid !== tutorUid) {
        throw new functionsV1.https.HttpsError("permission-denied", "This request doesn't belong to you");
      }
      if (request.status !== "pending") {
        throw new functionsV1.https.HttpsError("failed-precondition", `Request is already "${request.status}"`);
      }
      tx.update(requestRef, {
        status: "cancelled" as PayoutRequestStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { status: "cancelled" as PayoutRequestStatus };
    });

    console.log(`✅ Payout request ${requestId} cancelled by tutor ${tutorUid}`);
    return result;
  });

// ─── reviewPayoutRequest (admin) ─────────────────────────────────────────────
export const reviewPayoutRequest = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "256MB" })
  .https.onCall(async (
    data: { requestId?: string; action?: "approve" | "reject"; note?: string },
    context
  ) => {
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
      const request = snap.data()!;
      if (request.status !== "pending") {
        throw new functionsV1.https.HttpsError("failed-precondition", `Request is already "${request.status}"`);
      }
      const newStatus: PayoutRequestStatus = action === "approve" ? "approved" : "rejected";
      tx.update(requestRef, {
        status: newStatus,
        adminNote: note ?? null,
        reviewedBy: adminUid,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { status: newStatus };
    });

    console.log(`✅ Payout request ${requestId} ${result.status} by admin ${adminUid}`);
    return result;
  });

// ─── markPayoutPaid (admin) ──────────────────────────────────────────────────
// The one moment tutorEarnings.balance actually moves — after the admin
// has already transferred the money themselves outside the app. Re-checks
// balance sufficiency defensively (nothing else should have changed it
// since approval, since a tutor can only have one open request at a time,
// but this is the same belt-and-suspenders re-check every other
// ShikshaHub money-adjacent callable already applies).
export const markPayoutPaid = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "256MB" })
  .https.onCall(async (data: { requestId?: string; note?: string }, context) => {
    if (!context.auth?.token?.admin) {
      throw new functionsV1.https.HttpsError("permission-denied", "Admins only");
    }
    const adminUid = context.auth.uid;
    const { requestId, note } = data ?? {};
    if (!requestId || typeof requestId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "requestId is required");
    }

    const requestRef = db.doc(`payoutRequests/${requestId}`);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(requestRef);
      if (!snap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "Payout request not found");
      }
      const request = snap.data()!;
      if (request.status !== "approved") {
        throw new functionsV1.https.HttpsError("failed-precondition", `Request must be "approved" first (currently "${request.status}")`);
      }

      const requestedAmount = Number(request.requestedAmount) || 0;
      const balanceRef = db.doc(`tutorEarnings/${request.tutorUid}`);
      const balanceSnap = await tx.get(balanceRef);
      const balance = balanceSnap.exists ? Number(balanceSnap.data()?.balance ?? 0) : 0;
      if (requestedAmount > balance) {
        throw new functionsV1.https.HttpsError(
          "failed-precondition",
          `Tutor's balance (₹${balance}) is now less than the requested amount (₹${requestedAmount}) — cannot mark paid`
        );
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const txRef = balanceRef.collection("transactions").doc(requestId);

      tx.set(balanceRef, {
        balance: admin.firestore.FieldValue.increment(-requestedAmount),
        updatedAt: now,
      }, { merge: true });

      tx.set(txRef, {
        type: "PAYOUT",
        amount: requestedAmount,
        source: "TUTOR_PAYOUT",
        title: "Payout processed",
        description: `₹${request.payoutAmount} paid out (₹${request.commissionAmount} platform commission on ₹${requestedAmount})`,
        referenceId: requestId,
        metadata: { commissionAmount: request.commissionAmount, payoutAmount: request.payoutAmount, method: request.method },
        createdAt: now,
      });

      tx.update(requestRef, {
        status: "paid" as PayoutRequestStatus,
        adminNote: note ?? request.adminNote ?? null,
        paidAt: now,
        updatedAt: now,
      });

      return { status: "paid" as PayoutRequestStatus };
    });

    console.log(`✅ Payout request ${requestId} marked paid by admin ${adminUid}`);
    return result;
  });

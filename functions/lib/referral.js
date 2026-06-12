"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// FILE: functions/src/referral.ts
// PATH: functions/src/referral.ts
// FIXES APPLIED:
//   1. vCoinsBalance → vCoins  (lines 146, 153, 178, 182, 231, 233)
//   2. "VidyaAI" → "Gloows365E"  (line 194)
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReferralLeaderboard = exports.applyReferral = void 0;
const admin = require("firebase-admin");
const functionsV1 = require("firebase-functions/v1");
const db = admin.firestore();
const DEFAULT_CONFIG = {
    referrerCoins: 50,
    refereeCoins: 30,
    giftEnabled: false,
    giftLabel: "",
    triggerEvent: "signup",
    maxReferrals: 0,
    isActive: true,
    milestones: [],
};
// ─── applyReferral ──────────────────────────────────────────────────────────────
// Called by the mobile app when a new student enters a referral code at signup.
// Server-side validation prevents:
//   - Self-referral
//   - Double-using a code
//   - Coin manipulation
//   - Using codes when feature is off
exports.applyReferral = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "128MB" })
    .https.onCall(async (data, context) => {
    // ── Auth check ────────────────────────────────────────────────────────────
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const refereeId = context.auth.uid;
    const code = (data.code ?? "").toUpperCase().trim();
    if (!code || code.length !== 8) {
        throw new functionsV1.https.HttpsError("invalid-argument", "Invalid referral code");
    }
    // ── Load admin config ─────────────────────────────────────────────────────
    let config = DEFAULT_CONFIG;
    try {
        const configSnap = await db.doc("appConfig/referralConfig").get();
        if (configSnap.exists) {
            config = { ...DEFAULT_CONFIG, ...configSnap.data() };
        }
    }
    catch (err) {
        console.error("Failed to load referralConfig:", err);
    }
    if (!config.isActive) {
        throw new functionsV1.https.HttpsError("failed-precondition", "Referral program is currently inactive");
    }
    // ── Check if referee already used a referral code ─────────────────────────
    const refereeUserRef = db.doc(`users/${refereeId}`);
    const refereeUserSnap = await refereeUserRef.get();
    if (refereeUserSnap.exists && refereeUserSnap.data()?.referredBy) {
        throw new functionsV1.https.HttpsError("already-exists", "You have already used a referral code");
    }
    // ── Find the referrer by referralCode ─────────────────────────────────────
    const usersWithCode = await db
        .collection("users")
        .where("referralCode", "==", code)
        .limit(1)
        .get();
    if (usersWithCode.empty) {
        throw new functionsV1.https.HttpsError("not-found", "Referral code not found");
    }
    const referrerDoc = usersWithCode.docs[0];
    const referrerId = referrerDoc.id;
    // ── Self-referral guard ───────────────────────────────────────────────────
    if (referrerId === refereeId) {
        throw new functionsV1.https.HttpsError("invalid-argument", "You cannot use your own referral code");
    }
    // ── Max referrals cap ─────────────────────────────────────────────────────
    if (config.maxReferrals > 0) {
        const referrerData = referrerDoc.data();
        const currentCount = referrerData?.referralCount ?? 0;
        if (currentCount >= config.maxReferrals) {
            throw new functionsV1.https.HttpsError("resource-exhausted", "This referral code has reached its maximum usage limit");
        }
    }
    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    // ── 1. Create referrals document ──────────────────────────────────────────
    const referralRef = db.collection("referrals").doc();
    batch.set(referralRef, {
        referrerId,
        refereeId,
        status: "completed",
        rewardClaimed: true,
        code,
        createdAt: now,
        completedAt: now,
    });
    // ── 2. Mark referee as referred ───────────────────────────────────────────
    batch.set(refereeUserRef, {
        referredBy: referrerId,
        referralCodeEntered: code,
    }, { merge: true });
    // ── 3. Credit referrer's VCoins ───────────────────────────────────────────
    if (config.referrerCoins > 0) {
        const referrerUserRef = db.doc(`users/${referrerId}`);
        const referrerSnap = await referrerUserRef.get();
        const currentBal = referrerSnap.exists ? (referrerSnap.data()?.vCoins ?? 0) : 0; // ✅ FIX: was vCoinsBalance
        const currentEarned = referrerSnap.exists ? (referrerSnap.data()?.vCoinsLifetimeEarned ?? 0) : 0;
        const currentCount = referrerSnap.exists ? (referrerSnap.data()?.referralCount ?? 0) : 0;
        const currentRefCoins = referrerSnap.exists ? (referrerSnap.data()?.referralCoinsEarned ?? 0) : 0;
        // Update referrer balance + referral stats
        batch.update(referrerUserRef, {
            vCoins: currentBal + config.referrerCoins, // ✅ FIX: was vCoinsBalance
            vCoinsLifetimeEarned: currentEarned + config.referrerCoins,
            referralCount: currentCount + 1,
            referralCoinsEarned: currentRefCoins + config.referrerCoins,
            vCoinsUpdatedAt: now,
        });
        // Write referrer transaction doc
        const referrerTxRef = db.collection(`users/${referrerId}/vCoinTransactions`).doc();
        batch.set(referrerTxRef, {
            type: "CREDIT",
            amount: config.referrerCoins,
            source: "REFERRAL_REWARD",
            title: "Referral Reward 🎉",
            description: `A friend joined with your code ${code}`,
            status: "SUCCESS",
            referenceId: referralRef.id,
            metadata: { code, refereeId },
            createdAt: now,
            updatedAt: now,
        });
    }
    // ── 4. Credit referee's welcome bonus ─────────────────────────────────────
    if (config.refereeCoins > 0) {
        const refereeBal = refereeUserSnap.exists ? (refereeUserSnap.data()?.vCoins ?? 0) : 0; // ✅ FIX: was vCoinsBalance
        const refereeEarned = refereeUserSnap.exists ? (refereeUserSnap.data()?.vCoinsLifetimeEarned ?? 0) : 0;
        batch.update(refereeUserRef, {
            vCoins: refereeBal + config.refereeCoins, // ✅ FIX: was vCoinsBalance
            vCoinsLifetimeEarned: refereeEarned + config.refereeCoins,
            vCoinsUpdatedAt: now,
        });
        // Write referee transaction doc
        const refereeTxRef = db.collection(`users/${refereeId}/vCoinTransactions`).doc();
        batch.set(refereeTxRef, {
            type: "CREDIT",
            amount: config.refereeCoins,
            source: "REFEREE_JOIN_BONUS",
            title: "Welcome Bonus 🎁",
            description: `Welcome to Gloows365E! Bonus for joining with a referral code.`, // ✅ FIX: was VidyaAI
            status: "SUCCESS",
            referenceId: referralRef.id,
            metadata: { code, referrerId },
            createdAt: now,
            updatedAt: now,
        });
    }
    // ── 5. Check milestone rewards ────────────────────────────────────────────
    let milestoneGiftLabel = null;
    if (config.milestones?.length > 0) {
        const referrerData = referrerDoc.data();
        const newCount = (referrerData?.referralCount ?? 0) + 1;
        for (const milestone of config.milestones) {
            if (newCount % milestone.every === 0) {
                milestoneGiftLabel = milestone.giftLabel;
                // Bonus coins milestone
                if (milestone.giftType === "coins" && milestone.giftValue > 0) {
                    const msTxRef = db.collection(`users/${referrerId}/vCoinTransactions`).doc();
                    batch.set(msTxRef, {
                        type: "CREDIT",
                        amount: milestone.giftValue,
                        source: "REFERRAL_REWARD",
                        title: `Milestone Reward 🏆`,
                        description: `${newCount}th referral milestone: ${milestone.giftLabel}`,
                        status: "SUCCESS",
                        referenceId: `milestone_${newCount}`,
                        metadata: { milestone: newCount, giftLabel: milestone.giftLabel },
                        createdAt: now,
                        updatedAt: now,
                    });
                    const referrerUserRef2 = db.doc(`users/${referrerId}`);
                    const snap2 = await referrerUserRef2.get();
                    const bal2 = snap2.exists ? (snap2.data()?.vCoins ?? 0) : 0; // ✅ FIX: was vCoinsBalance
                    batch.update(referrerUserRef2, {
                        vCoins: bal2 + milestone.giftValue, // ✅ FIX: was vCoinsBalance
                        vCoinsLifetimeEarned: admin.firestore.FieldValue.increment(milestone.giftValue),
                    });
                }
                break; // only one milestone per referral
            }
        }
    }
    // ── Commit everything atomically ──────────────────────────────────────────
    await batch.commit();
    console.log(`✅ Referral applied: ${referrerId} → ${refereeId} (code: ${code})`);
    return {
        success: true,
        referrerId,
        coinsEarned: config.refereeCoins,
        giftLabel: milestoneGiftLabel ?? (config.giftEnabled ? config.giftLabel : null),
        message: `Welcome! You earned ${config.refereeCoins} VCoins as a join bonus!`,
    };
});
// ─── getReferralLeaderboard ───────────────────────────────────────────────────
// Returns top 20 referrers for the admin leaderboard view.
exports.getReferralLeaderboard = functionsV1
    .runWith({ timeoutSeconds: 15, memory: "128MB" })
    .https.onCall(async (_data, context) => {
    if (!context.auth?.token?.admin) {
        throw new functionsV1.https.HttpsError("permission-denied", "Admin only");
    }
    const snap = await db
        .collection("users")
        .where("referralCount", ">", 0)
        .orderBy("referralCount", "desc")
        .limit(20)
        .get();
    return snap.docs.map((d) => ({
        uid: d.id,
        referralCode: d.data().referralCode ?? "",
        referralCount: d.data().referralCount ?? 0,
        referralCoinsEarned: d.data().referralCoinsEarned ?? 0,
    }));
});
//# sourceMappingURL=referral.js.map
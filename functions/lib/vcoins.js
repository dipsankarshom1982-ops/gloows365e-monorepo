"use strict";
// PATH: functions/src/vcoins.ts
// Changes:
//  • claimVCoinReward now also increments vCoinsYear_{YYYY} for annual ranking
//  • Added resetAnnualVCoins — scheduled Jan 1 IST to reset yearly fields
//  • getVCoinBalance unchanged
//  • Removed all references to old "coins" / LearnFunCoins fields
Object.defineProperty(exports, "__esModule", { value: true });
exports.manualResetAnnualVCoins = exports.resetAnnualVCoins = exports.getVCoinBalance = exports.claimVCoinReward = void 0;
const admin = require("firebase-admin");
const functionsV1 = require("firebase-functions/v1");
const redish_1 = require("./redish");
const db = admin.firestore();
const ACTIVITIES = {
    daily_login: { coins: 5, daily: true, maxPerDay: 1 },
    lesson_complete: { coins: 10, daily: true, maxPerDay: 5 },
    practice_complete: { coins: 20, daily: true, maxPerDay: 3 },
    quiz_pass: { coins: 15, daily: true, maxPerDay: 5 },
    chapter_complete: { coins: 100, daily: true, maxPerDay: 3 },
    video_watch: { coins: 5, daily: true, maxPerDay: 10 },
    story_view: { coins: 2, daily: true, maxPerDay: 20 },
    post_like: { coins: 1, daily: true, maxPerDay: 30 },
    profile_complete: { coins: 50, daily: false, maxPerDay: 1 },
    first_post: { coins: 25, daily: false, maxPerDay: 1 },
    referral: { coins: 100, daily: false, maxPerDay: 1 },
};
// ─── Helpers ──────────────────────────────────────────────────────────────────
function currentYearIST() {
    // IST = UTC+5:30
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.getUTCFullYear();
}
// ─── claimVCoinReward ─────────────────────────────────────────────────────────
exports.claimVCoinReward = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "128MB", secrets: ["REDIS_URL", "REDIS_TOKEN"] })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const userId = context.auth.uid;
    const { activityId, referenceId = "" } = data;
    const activity = ACTIVITIES[activityId];
    if (!activity) {
        throw new functionsV1.https.HttpsError("invalid-argument", `Unknown activity: ${activityId}`);
    }
    const today = (0, redish_1.todayIST)();
    // ── Redis dedup lock ─────────────────────────────────────────
    try {
        if (activity.maxPerDay > 1) {
            const countKey = redish_1.RK.vcoinCount(userId, activityId, today);
            const count = await (0, redish_1.getRedis)().incr(countKey);
            if (count === 1)
                await (0, redish_1.getRedis)().expire(countKey, 86400);
            if (count > activity.maxPerDay) {
                await (0, redish_1.getRedis)().decr(countKey);
                throw new functionsV1.https.HttpsError("resource-exhausted", `Daily limit reached for ${activityId}`);
            }
        }
        else {
            const lockSuffix = activity.daily ? `${today}:${referenceId}` : referenceId;
            const lockKey = redish_1.RK.vcoinLock(userId, activityId, lockSuffix);
            const locked = await (0, redish_1.getRedis)().setnx(lockKey, 1);
            if (locked === 0) {
                throw new functionsV1.https.HttpsError("already-exists", "Activity already claimed");
            }
            const lockTTL = activity.daily ? 86400 : 60 * 60 * 24 * 365;
            await (0, redish_1.getRedis)().expire(lockKey, lockTTL);
        }
    }
    catch (e) {
        if (e instanceof functionsV1.https.HttpsError &&
            (e.code === "already-exists" || e.code === "resource-exhausted"))
            throw e;
        console.warn("vcoin Redis lock check failed — falling through:", e);
    }
    // ── Write Firestore transaction + update balance + yearly field ──────────
    const year = currentYearIST();
    const yearField = `vCoinsYear_${year}`;
    const userRef = db.doc(`users/${userId}`);
    const txRef = userRef.collection("vCoinTransactions").doc();
    const batch = db.batch();
    batch.set(txRef, {
        amount: activity.coins,
        type: "CREDIT",
        status: "SUCCESS",
        activityId,
        referenceId,
        year,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.update(userRef, {
        vCoins: admin.firestore.FieldValue.increment(activity.coins),
        vCoinsLifetimeEarned: admin.firestore.FieldValue.increment(activity.coins),
        [yearField]: admin.firestore.FieldValue.increment(activity.coins),
    });
    await batch.commit();
    // Invalidate cached balance
    (0, redish_1.getRedis)().del(redish_1.RK.vcoinBalance(userId)).catch(() => { });
    console.log(`✅ VCoin: user=${userId} activity=${activityId} coins=+${activity.coins} year=${year}`);
    return { success: true, coinsAwarded: activity.coins };
});
// ─── getVCoinBalance ──────────────────────────────────────────────────────────
exports.getVCoinBalance = functionsV1
    .runWith({ timeoutSeconds: 15, memory: "128MB", secrets: ["REDIS_URL", "REDIS_TOKEN"] })
    .https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const userId = context.auth.uid;
    const cacheKey = redish_1.RK.vcoinBalance(userId);
    try {
        const cached = await (0, redish_1.getRedis)().get(cacheKey);
        if (cached !== null)
            return { balance: cached };
    }
    catch { /* Redis unavailable */ }
    const snap = await db.doc(`users/${userId}`).get();
    const balance = snap.data()?.vCoins ?? 0;
    (0, redish_1.getRedis)().set(cacheKey, balance, { ex: redish_1.TTL.vcoinBalance }).catch(() => { });
    return { balance };
});
// ─── resetAnnualVCoins ────────────────────────────────────────────────────────
// Scheduled: every Jan 1 at 00:00 IST (= Dec 31 18:30 UTC)
// • Archives the ending year's vCoinsYear_YYYY into vCoinsHistory_{YYYY}
// • Clears vCoinsYear_YYYY on all user docs
// • Also clears any surprise gift flags so admin can set fresh ones
//
// This runs in batches of 500 to respect Firestore write limits.
exports.resetAnnualVCoins = functionsV1
    .runWith({ timeoutSeconds: 540, memory: "512MB" })
    .pubsub.schedule("30 18 31 12 *") // Dec 31 18:30 UTC = Jan 1 00:00 IST
    .timeZone("UTC")
    .onRun(async (_context) => {
    const endingYear = currentYearIST() - 1; // by this point IST is Jan 1 next year
    const endField = `vCoinsYear_${endingYear}`;
    const histField = `vCoinsHistory_${endingYear}`;
    console.log(`🔄 Annual VCoin reset: archiving ${endField} → ${histField}`);
    const PAGE_SIZE = 400;
    let lastDoc = null;
    let totalProcessed = 0;
    while (true) {
        let q = db.collection("users")
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(PAGE_SIZE);
        if (lastDoc)
            q = q.startAfter(lastDoc);
        const snap = await q.get();
        if (snap.empty)
            break;
        const batch = db.batch();
        snap.docs.forEach((d) => {
            const data = d.data();
            const yearCoins = data[endField] ?? 0;
            const update = {
                // Archive the year's coins (preserve history)
                [histField]: yearCoins,
                // Reset the year field to 0 for the new year
                [endField]: 0,
                // Clear surprise gift so admin sets a fresh one
                "surpriseGift.available": false,
                "surpriseGift.claimed": false,
                "surpriseGift.claimedAt": admin.firestore.FieldValue.delete(),
                "surpriseGift.deliveryAddress": admin.firestore.FieldValue.delete(),
            };
            batch.update(d.ref, update);
        });
        await batch.commit();
        totalProcessed += snap.docs.length;
        lastDoc = snap.docs[snap.docs.length - 1];
        console.log(`  Processed ${totalProcessed} users so far…`);
        if (snap.docs.length < PAGE_SIZE)
            break;
    }
    console.log(`✅ Annual VCoin reset complete. Total users processed: ${totalProcessed}`);
});
// ─── manualResetAnnualVCoins ──────────────────────────────────────────────────
// Admin-callable version of the above (for testing or emergency reset)
exports.manualResetAnnualVCoins = functionsV1
    .runWith({ timeoutSeconds: 540, memory: "512MB" })
    .https.onCall(async (_data, context) => {
    if (!context.auth?.token?.admin) {
        throw new functionsV1.https.HttpsError("permission-denied", "Admin only");
    }
    const year = currentYearIST();
    const yearField = `vCoinsYear_${year}`;
    const histField = `vCoinsHistory_${year}`;
    const PAGE_SIZE = 400;
    let lastDoc = null;
    let totalProcessed = 0;
    while (true) {
        let q = db.collection("users")
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(PAGE_SIZE);
        if (lastDoc)
            q = q.startAfter(lastDoc);
        const snap = await q.get();
        if (snap.empty)
            break;
        const batch = db.batch();
        snap.docs.forEach((d) => {
            batch.update(d.ref, {
                [histField]: d.data()[yearField] ?? 0,
                [yearField]: 0,
                "surpriseGift.available": false,
            });
        });
        await batch.commit();
        totalProcessed += snap.docs.length;
        lastDoc = snap.docs[snap.docs.length - 1];
        if (snap.docs.length < PAGE_SIZE)
            break;
    }
    return { success: true, totalProcessed };
});
//# sourceMappingURL=vcoins.js.map
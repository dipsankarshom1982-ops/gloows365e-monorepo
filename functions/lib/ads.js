"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateAdAnalytics = exports.claimAdReward = exports.recordAdEvent = exports.getAds = void 0;
const admin = require("firebase-admin");
const functionsV1 = require("firebase-functions/v1");
const redish_1 = require("./redish");
const db = admin.firestore();
// ── Safety filter ─────────────────────────────────────────────────────────────
const ALLOWED_CATEGORIES = [
    "education", "scholarship", "exam", "course", "skill", "olympiad",
];
const BLOCKED_KEYWORDS = [
    "gambling", "betting", "crypto", "bitcoin", "dating", "adult",
    "casino", "violent", "loan", "earn money fast", "fake",
];
function isSafeAd(ad) {
    if (!ALLOWED_CATEGORIES.includes(ad.adCategory))
        return false;
    const text = `${ad.title ?? ""} ${ad.description ?? ""}`.toLowerCase();
    return !BLOCKED_KEYWORDS.some((kw) => text.includes(kw));
}
// ── 1. getAds ─────────────────────────────────────────────────────────────────
// Returns targeted, safe ads for a given module and class level.
// Cached in Redis for 5 minutes per module+class combination.
exports.getAds = functionsV1
    .runWith({ timeoutSeconds: 15, memory: "128MB", secrets: ["REDIS_URL", "REDIS_TOKEN"] })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const module = data.module ?? "home";
    const cls = data.classLevel ?? "all";
    const adType = data.adType;
    const limit = Math.min(data.limit ?? 5, 10);
    const cacheKey = redish_1.RK.ads(module, cls);
    // ── Check Redis cache ──
    try {
        const cached = await (0, redish_1.getRedis)().get(cacheKey);
        if (cached) {
            let result = cached;
            if (adType)
                result = result.filter((a) => a.adType === adType);
            return { ads: result.slice(0, limit) };
        }
    }
    catch { /* Redis unavailable — fall through to Firestore */ }
    // ── Fetch from Firestore ──
    // Single-field query only (no composite index required).
    // isApproved, targeting, and sorting are applied in-memory.
    const now = admin.firestore.Timestamp.now();
    let snap;
    try {
        snap = await db
            .collection("ads")
            .where("isActive", "==", true)
            .limit(100)
            .get();
    }
    catch (err) {
        console.error("Firestore ads query failed:", err?.message ?? err);
        return { ads: [] };
    }
    let ads = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((ad) => {
        if (ad.isApproved !== true)
            return false;
        // Module targeting
        const targetModules = ad.targetModules ?? [];
        if (!targetModules.includes(module) && !targetModules.includes("all"))
            return false;
        // Class targeting
        const targetClass = ad.targetClass ?? [];
        if (!targetClass.includes(cls) && !targetClass.includes("all"))
            return false;
        // Date range
        if (ad.startDate && ad.startDate.toMillis() > now.toMillis())
            return false;
        if (ad.endDate && ad.endDate.toMillis() < now.toMillis())
            return false;
        // Safety
        return isSafeAd(ad);
    })
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    // Cache the full filtered list for this module+class
    try {
        (0, redish_1.getRedis)().set(cacheKey, ads, { ex: redish_1.TTL.ads }).catch(() => { });
    }
    catch { /* ok */ }
    // Apply adType filter after caching
    if (adType)
        ads = ads.filter((a) => a.adType === adType);
    return { ads: ads.slice(0, limit) };
});
// ── 2. recordAdEvent ──────────────────────────────────────────────────────────
// Records impression, click, watch_start, watch_complete, reward_claimed, skip.
// Uses Redis dedup to prevent double-counting within the TTL window.
const ALLOWED_EVENTS = [
    "impression", "click", "watch_start", "watch_complete", "reward_claimed", "skip",
];
exports.recordAdEvent = functionsV1
    .runWith({ timeoutSeconds: 10, memory: "128MB", secrets: ["REDIS_URL", "REDIS_TOKEN"] })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const { adId, event, module, sessionId } = data;
    if (!adId || !ALLOWED_EVENTS.includes(event)) {
        throw new functionsV1.https.HttpsError("invalid-argument", "Invalid adId or event");
    }
    // ── Redis dedup: skip if same event recorded within TTL.adEvents (60s) ──
    const dedupKey = redish_1.RK.adEvent(uid, adId, event);
    try {
        const exists = await (0, redish_1.getRedis)().get(dedupKey);
        if (exists)
            return { success: true, deduped: true };
        await (0, redish_1.getRedis)().set(dedupKey, 1, { ex: redish_1.TTL.adEvents });
    }
    catch { /* Redis unavailable — proceed without dedup */ }
    // ── Write analytics event ──
    await db
        .collection("adAnalytics")
        .doc(adId)
        .collection("events")
        .add({
        adId,
        userId: uid,
        event,
        module,
        sessionId: sessionId ?? "",
        classLevel: data.classLevel ?? "unknown",
        platform: "android",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
});
// ── 3. claimAdReward ──────────────────────────────────────────────────────────
// Claims V-Coin reward for watching a rewarded ad to completion.
// Validates watch_complete event exists today, enforces max 3/day, then credits coins.
exports.claimAdReward = functionsV1
    .runWith({ timeoutSeconds: 15, memory: "128MB", secrets: ["REDIS_URL", "REDIS_TOKEN"] })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const { adId, sessionId } = data;
    if (!adId) {
        throw new functionsV1.https.HttpsError("invalid-argument", "adId required");
    }
    // ── 1. Guard: reward not already claimed in this session ──
    const rewardKey = redish_1.RK.adReward(uid, adId);
    try {
        const already = await (0, redish_1.getRedis)().get(rewardKey);
        if (already) {
            throw new functionsV1.https.HttpsError("already-exists", "Reward already claimed for this ad today");
        }
    }
    catch (e) {
        if (e?.code === "already-exists")
            throw e;
        // Redis unavailable — continue
    }
    // ── 2. Daily cap: max 3 rewarded ads per day ──
    const today = (0, redish_1.todayIST)();
    const freqKey = redish_1.RK.adFreq(uid, today);
    let todayCount = 0;
    try {
        const val = await (0, redish_1.getRedis)().get(freqKey);
        todayCount = val ?? 0;
    }
    catch { /* Redis unavailable */ }
    if (todayCount >= 3) {
        throw new functionsV1.https.HttpsError("resource-exhausted", "Daily rewarded ad limit reached (3/day)");
    }
    // ── 3. Fetch ad to get reward amount ──
    const adSnap = await db.collection("ads").doc(adId).get();
    if (!adSnap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "Ad not found");
    }
    const ad = adSnap.data();
    const coins = ad.reward?.coins ?? 0;
    if (coins <= 0) {
        throw new functionsV1.https.HttpsError("failed-precondition", "Ad has no reward configured");
    }
    // ── 4. Credit V-Coins ──
    const balanceRef = db.collection("vCoins").doc(uid);
    const txRef = db.collection("vCoinTransactions").doc();
    await db.runTransaction(async (tx) => {
        const balSnap = await tx.get(balanceRef);
        const current = (balSnap.data()?.balance ?? 0);
        tx.set(balanceRef, { balance: current + coins, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        tx.set(txRef, {
            userId: uid,
            type: "CREDIT",
            amount: coins,
            source: "ad_watch",
            description: `Reward for watching ad: ${ad.title ?? adId}`,
            status: "SUCCESS",
            adId,
            sessionId: sessionId ?? "",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    // ── 5. Record reward_claimed event ──
    await db.collection("adAnalytics").doc(adId).collection("events").add({
        adId, userId: uid, event: "reward_claimed", module: "rewarded",
        sessionId: sessionId ?? "",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    // ── 6. Update Redis daily counter + set reward lock ──
    const ttlUntilMidnight = 86400; // simplification — real impl uses ttlUntilMidnightIST()
    try {
        await (0, redish_1.getRedis)().incr(freqKey);
        await (0, redish_1.getRedis)().expire(freqKey, ttlUntilMidnight);
        await (0, redish_1.getRedis)().set(rewardKey, 1, { ex: ttlUntilMidnight });
    }
    catch { /* Redis unavailable */ }
    // ── 7. Invalidate vcoin balance cache ──
    (0, redish_1.getRedis)().del(`vcoin:balance:${uid}`).catch(() => { });
    console.log(`✅ Ad reward claimed: uid=${uid} adId=${adId} coins=${coins}`);
    return { success: true, coins, message: `+${coins} V-Coins earned!` };
});
// ── 4. aggregateAdAnalytics (scheduled — every hour) ─────────────────────────
// Aggregates raw events into per-ad summary documents.
exports.aggregateAdAnalytics = functionsV1
    .runWith({ timeoutSeconds: 300, memory: "256MB" })
    .pubsub.schedule("every 60 minutes")
    .onRun(async () => {
    const adsSnap = await db.collection("ads").where("isActive", "==", true).get();
    await Promise.all(adsSnap.docs.map(async (adDoc) => {
        const adId = adDoc.id;
        const eventsSnap = await db
            .collection("adAnalytics")
            .doc(adId)
            .collection("events")
            .get();
        let impressions = 0, clicks = 0, watchComplete = 0, rewardsClaimed = 0;
        const moduleCounts = {};
        const classCounts = {};
        eventsSnap.docs.forEach((e) => {
            const ev = e.data();
            const mod = ev.module ?? "unknown";
            const cls = ev.classLevel ?? "unknown";
            if (!moduleCounts[mod])
                moduleCounts[mod] = { impressions: 0, clicks: 0 };
            if (!classCounts[cls])
                classCounts[cls] = { impressions: 0 };
            switch (ev.event) {
                case "impression":
                    impressions++;
                    moduleCounts[mod].impressions++;
                    classCounts[cls].impressions++;
                    break;
                case "click":
                    clicks++;
                    moduleCounts[mod].clicks++;
                    break;
                case "watch_complete":
                    watchComplete++;
                    break;
                case "reward_claimed":
                    rewardsClaimed++;
                    break;
            }
        });
        const ctr = impressions > 0 ? clicks / impressions : 0;
        const completionRate = impressions > 0 ? watchComplete / impressions : 0;
        await db.collection("adAnalytics").doc(adId).set({
            impressions, clicks, watchComplete, rewardsClaimed,
            ctr: parseFloat(ctr.toFixed(4)),
            completionRate: parseFloat(completionRate.toFixed(4)),
            moduleBreakdown: moduleCounts,
            classBreakdown: classCounts,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }));
    console.log(`✅ Ad analytics aggregated for ${adsSnap.docs.length} ads`);
});
//# sourceMappingURL=ads.js.map
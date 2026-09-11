"use strict";
// PATH: functions/src/vcoins.ts
// Changes:
//  • claimVCoinReward now also increments vCoinsYear_{YYYY} for annual ranking
//  • Added resetAnnualVCoins — scheduled Jan 1 IST to reset yearly fields
//  • getVCoinBalance unchanged
//  • Removed all references to old "coins" / LearnFunCoins fields
Object.defineProperty(exports, "__esModule", { value: true });
exports.manualResetAnnualVCoins = exports.claimSkillBattleReward = exports.creditWatchReward = exports.creditSignupBonus = exports.resetAnnualVCoins = exports.getVCoinBalance = exports.claimVCoinReward = void 0;
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
    // Daily Streak Quiz — one correct answer per day. maxPerDay: 1 here is
    // a belt-and-suspenders cap; the real "once per day" enforcement is the
    // studentDailyStreakProgress/{uid}/days/{date} doc check in
    // dailyStreakQuiz.ts's submitDailyStreakQuizAnswer, which runs first.
    daily_streak_quiz: { coins: 5, daily: true, maxPerDay: 1 },
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
// Mirrors apps/mobile/services/vCoinsService.ts's DEFAULT_DAILY_LIMITS for
// just the sources migrated here — used when no vCoinRules/{source} doc
// exists yet (or it's inactive). Keep in sync if admin ever edits these via
// VCoinRules.tsx and the fallback needs to change too.
const DEFAULT_DAILY_LIMITS = {
    SIGNUP_BONUS: 200,
    REEL_WATCH_REWARD: 30,
    VIDEO_WATCH_REWARD: 50,
    STORY_WATCH_REWARD: 20,
    SKILLBATTLE_WINNER_REWARD: 100,
    SKILLBATTLE_RUNNER_UP_REWARD: 100,
    SKILLBATTLE_PARTICIPATION_REWARD: 50,
};
async function getVCoinRule(source) {
    try {
        const snap = await db.doc(`vCoinRules/${source}`).get();
        if (!snap.exists)
            return null;
        const rule = snap.data();
        return rule.isActive === false ? null : rule;
    }
    catch {
        return null;
    }
}
// Core transactional credit — every source below funnels through this so
// the duplicate-per-referenceId lock and per-source daily cap are enforced
// identically regardless of caller, same as the old creditVCoins() did.
async function creditVCoinsBalance(params) {
    const { uid, amount, source, title, description, referenceId, metadata = {} } = params;
    if (amount <= 0)
        return { credited: false, amount: 0, balanceAfter: 0 };
    const rule = await getVCoinRule(source);
    const dailyLimit = rule?.dailyLimit ?? DEFAULT_DAILY_LIMITS[source] ?? 9999;
    const userRef = db.doc(`users/${uid}`);
    const txRef = userRef.collection("vCoinTransactions").doc();
    const lockRef = userRef.collection("vCoinActivityLocks").doc(`${source}_${referenceId}`);
    const dailyKey = `${source}_day_${(0, redish_1.todayIST)()}`;
    const dailyLockRef = userRef.collection("vCoinActivityLocks").doc(dailyKey);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const yearField = `vCoinsYear_${currentYearIST()}`;
    return db.runTransaction(async (tx) => {
        // ── Reads first — Firestore transactions require every read before any write ──
        const [lockSnap, userSnap, dailySnap] = await Promise.all([
            tx.get(lockRef),
            tx.get(userRef),
            tx.get(dailyLockRef),
        ]);
        const currentBalance = userSnap.exists ? (userSnap.data()?.vCoinsBalance ?? 0) : 0;
        if (lockSnap.exists) {
            return { credited: false, amount: 0, balanceAfter: currentBalance };
        }
        const earnedToday = dailySnap.exists ? (dailySnap.data()?.earnedToday ?? 0) : 0;
        const actualAmount = Math.max(0, Math.min(amount, dailyLimit - earnedToday));
        if (actualAmount <= 0) {
            return { credited: false, amount: 0, balanceAfter: currentBalance };
        }
        // ── Writes ──
        tx.set(txRef, {
            type: "CREDIT", amount: actualAmount, source, title, description,
            status: "SUCCESS", referenceId, metadata, createdAt: now, updatedAt: now,
        });
        tx.set(userRef, {
            vCoinsBalance: admin.firestore.FieldValue.increment(actualAmount),
            vCoinsLifetimeEarned: admin.firestore.FieldValue.increment(actualAmount),
            [yearField]: admin.firestore.FieldValue.increment(actualAmount),
            vCoinsUpdatedAt: now,
        }, { merge: true });
        tx.set(lockRef, { source, referenceId, amount: actualAmount, lastRewardedAt: now, createdAt: now });
        tx.set(dailyLockRef, {
            source, earnedToday: admin.firestore.FieldValue.increment(actualAmount), lastRewardedAt: now,
        }, { merge: true });
        return { credited: true, amount: actualAmount, balanceAfter: currentBalance + actualAmount };
    });
}
// ─── creditSignupBonus ──────────────────────────────────────────────────────
// referenceId is a fixed per-uid key ("signup_bonus"), so this can only
// ever credit once per user even if the client retries — same guarantee
// the old inline creditVCoins() call in register.tsx relied on.
exports.creditSignupBonus = functionsV1
    .runWith({ timeoutSeconds: 15, memory: "128MB" })
    .https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const rule = await getVCoinRule("SIGNUP_BONUS");
    const amount = rule?.rewardAmount ?? 200;
    const result = await creditVCoinsBalance({
        uid, amount, source: "SIGNUP_BONUS",
        title: "Welcome Bonus",
        description: `${amount} VCoins for completing registration`,
        referenceId: "signup_bonus",
    });
    console.log(`✅ VCoins signup bonus: uid=${uid} credited=${result.credited} amount=${result.amount}`);
    return result;
});
// ─── creditWatchReward ────────────────────────────────────────────────────
// contentId doubles as the idempotency key — one reward per piece of
// content ever, same as the old rewardForWatchCompletion(). watchPercentage
// stays self-reported by the client (no server-side playback verification
// exists) — this migration closes the "bypass the daily cap with a raw
// Firestore write" hole, it does not add watch-time anti-cheat.
const WATCH_REWARD_CONFIG = {
    reel: { source: "REEL_WATCH_REWARD", minPct: 80, amount: 1, title: "Watched Reel", description: "Earned for watching a skill reel" },
    video: { source: "VIDEO_WATCH_REWARD", minPct: 80, amount: 3, title: "Watched Educational Video", description: "Earned for completing an educational video" },
    story: { source: "STORY_WATCH_REWARD", minPct: 100, amount: 1, title: "Watched Story", description: "Earned for watching a full story" },
};
exports.creditWatchReward = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "128MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const { contentId, contentType, watchPercentage } = data ?? {};
    if (!contentId || typeof contentId !== "string") {
        throw new functionsV1.https.HttpsError("invalid-argument", "contentId is required");
    }
    const config = contentType ? WATCH_REWARD_CONFIG[contentType] : undefined;
    if (!config) {
        throw new functionsV1.https.HttpsError("invalid-argument", 'contentType must be "reel", "video", or "story"');
    }
    if (typeof watchPercentage !== "number" || watchPercentage < config.minPct) {
        throw new functionsV1.https.HttpsError("failed-precondition", `Must watch at least ${config.minPct}% to earn a reward`);
    }
    const rule = await getVCoinRule(config.source);
    const amount = rule?.rewardAmount ?? config.amount;
    const result = await creditVCoinsBalance({
        uid, amount, source: config.source,
        title: config.title,
        description: config.description,
        referenceId: contentId,
        metadata: { contentId, contentType, watchPercentage },
    });
    return result;
});
// ─── claimSkillBattleReward ────────────────────────────────────────────────
// SECURITY NOTE: ranks/vcoins are still trusted from the client here,
// ported as-is from claimSkillBattleRewards — see this section's header
// comment. referenceId = `${battleId}_${scope}` caps each scope to one
// claim per battle, same as before.
// Mirrors apps/mobile/utils/formatVCoins.ts's VCOIN_DIST_PCT — keep in sync
// if that table ever changes; unifying the two is in scope for the
// SkillBattle rank-verification follow-up, not this migration.
const VCOIN_DIST_PCT = [50, 30, 20, 12, 10, 8, 6, 5, 4, 3];
function getSkillBattleCoinForRank(baseCoins, rank) {
    if (rank < 1 || rank > 10 || baseCoins <= 0)
        return 0;
    return Math.round((baseCoins * (VCOIN_DIST_PCT[rank - 1] ?? 0)) / 100);
}
function skillBattleSource(rank) {
    if (rank === 1)
        return "SKILLBATTLE_WINNER_REWARD";
    if (rank === 2)
        return "SKILLBATTLE_RUNNER_UP_REWARD";
    return "SKILLBATTLE_PARTICIPATION_REWARD";
}
const SKILLBATTLE_SCOPE_LABELS = {
    india: "All India", state: "State", district: "District", local: "Local",
};
exports.claimSkillBattleReward = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "128MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const { battleId, battleMonth, ranks, vcoins } = data ?? {};
    if (!battleId || !battleMonth || !ranks || !vcoins) {
        throw new functionsV1.https.HttpsError("invalid-argument", "battleId, battleMonth, ranks, and vcoins are required");
    }
    const scopes = [
        { key: "india", rank: ranks.india, base: vcoins.vcoin_india },
        { key: "state", rank: ranks.state, base: vcoins.vcoin_state },
        { key: "district", rank: ranks.district, base: vcoins.vcoin_district },
        { key: "local", rank: ranks.local, base: vcoins.vcoin_local },
    ];
    let totalCredited = 0;
    for (const { key, rank, base } of scopes) {
        const coins = getSkillBattleCoinForRank(base, rank);
        if (coins <= 0)
            continue;
        const source = skillBattleSource(rank);
        const scopeLabel = SKILLBATTLE_SCOPE_LABELS[key] ?? key;
        const result = await creditVCoinsBalance({
            uid, amount: coins, source,
            title: `SkillBattle ${scopeLabel} · Rank #${rank}`,
            description: `${battleMonth} SkillBattle — ${scopeLabel} rank #${rank}`,
            referenceId: `${battleId}_${key}`,
            metadata: { battleId, battleMonth, scope: key, rank, baseCoins: base },
        });
        if (result.credited)
            totalCredited += result.amount;
    }
    console.log(`✅ SkillBattle claim: uid=${uid} battle=${battleId} totalCredited=${totalCredited}`);
    return { totalCredited };
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
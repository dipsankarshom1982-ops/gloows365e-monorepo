"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSubscription = getSubscription;
exports.checkGenerationLimit = checkGenerationLimit;
exports.checkFollowUpLimit = checkFollowUpLimit;
exports.incrementGenerationUsage = incrementGenerationUsage;
exports.incrementFollowUpUsage = incrementFollowUpUsage;
exports.checkAskGuruLimit = checkAskGuruLimit;
exports.incrementAskGuruUsage = incrementAskGuruUsage;
exports.checkVidyaGuruLimit = checkVidyaGuruLimit;
exports.incrementVidyaGuruUsage = incrementVidyaGuruUsage;
const admin = require("firebase-admin");
const redish_1 = require("./redish");
const FREE_DAILY_LESSONS = 2;
const FREE_DAILY_FOLLOWUPS = 5;
// ─── Subscription cache ───────────────────────────────────────────────────────
async function getSubscription(uid, db) {
    const key = redish_1.RK.aiGuruSub(uid);
    try {
        const cached = await (0, redish_1.getRedis)().get(key);
        if (cached !== null)
            return cached;
    }
    catch { /* Redis unavailable */ }
    try {
        const snap = await db.doc(`subscriptions/${uid}`).get();
        const isPremium = snap.exists &&
            snap.data()?.status === "active" &&
            (snap.data()?.endDate?.toMillis() ?? 0) > Date.now();
        const result = { isPremium };
        (0, redish_1.getRedis)().set(key, result, { ex: redish_1.TTL.subscription }).catch(() => { });
        return result;
    }
    catch {
        return { isPremium: false };
    }
}
// ─── Rate limit checks ────────────────────────────────────────────────────────
async function checkGenerationLimit(uid, db) {
    const { isPremium } = await getSubscription(uid, db);
    if (isPremium)
        return;
    const key = redish_1.RK.aiGuruGen(uid, (0, redish_1.todayIST)());
    let used = 0;
    try {
        const count = await (0, redish_1.getRedis)().get(key);
        if (count !== null) {
            used = count;
        }
        else {
            // Cold start — seed from Firestore
            const snap = await db.doc(`aiGuruUsage/${uid}/daily/${(0, redish_1.todayIST)()}`).get();
            used = snap.exists ? (snap.data()?.generationsUsed ?? 0) : 0;
            if (used > 0) {
                (0, redish_1.getRedis)().set(key, used, { ex: (0, redish_1.ttlUntilMidnightIST)() }).catch(() => { });
            }
        }
    }
    catch {
        const snap = await db.doc(`aiGuruUsage/${uid}/daily/${(0, redish_1.todayIST)()}`).get();
        used = snap.exists ? (snap.data()?.generationsUsed ?? 0) : 0;
    }
    if (used >= FREE_DAILY_LESSONS) {
        throw new Error(`FREE_LIMIT_REACHED:You have used your ${FREE_DAILY_LESSONS} free lessons for today. Upgrade to Premium for unlimited lessons.`);
    }
}
async function checkFollowUpLimit(uid, db) {
    const { isPremium } = await getSubscription(uid, db);
    if (isPremium)
        return;
    const key = redish_1.RK.aiGuruFollowup(uid, (0, redish_1.todayIST)());
    let used = 0;
    try {
        const count = await (0, redish_1.getRedis)().get(key);
        if (count !== null) {
            used = count;
        }
        else {
            const snap = await db.doc(`aiGuruUsage/${uid}/daily/${(0, redish_1.todayIST)()}`).get();
            used = snap.exists ? (snap.data()?.quizAttempts ?? 0) : 0;
            if (used > 0) {
                (0, redish_1.getRedis)().set(key, used, { ex: (0, redish_1.ttlUntilMidnightIST)() }).catch(() => { });
            }
        }
    }
    catch {
        const snap = await db.doc(`aiGuruUsage/${uid}/daily/${(0, redish_1.todayIST)()}`).get();
        used = snap.exists ? (snap.data()?.quizAttempts ?? 0) : 0;
    }
    if (used >= FREE_DAILY_FOLLOWUPS) {
        throw new Error(`FREE_LIMIT_REACHED:You have used your ${FREE_DAILY_FOLLOWUPS} free follow-ups for today.`);
    }
}
// ─── Increment usage ──────────────────────────────────────────────────────────
async function incrementGenerationUsage(uid, db) {
    const key = redish_1.RK.aiGuruGen(uid, (0, redish_1.todayIST)());
    try {
        const count = await (0, redish_1.getRedis)().incr(key);
        if (count === 1)
            await (0, redish_1.getRedis)().expire(key, (0, redish_1.ttlUntilMidnightIST)());
    }
    catch { /* Redis unavailable */ }
    // Async Firestore write for persistence
    db.doc(`aiGuruUsage/${uid}/daily/${(0, redish_1.todayIST)()}`).set({
        generationsUsed: admin.firestore.FieldValue.increment(1),
        lastGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }).catch((e) => console.warn("aiGuruUsage gen write failed:", e));
}
async function incrementFollowUpUsage(uid, db) {
    const key = redish_1.RK.aiGuruFollowup(uid, (0, redish_1.todayIST)());
    try {
        const count = await (0, redish_1.getRedis)().incr(key);
        if (count === 1)
            await (0, redish_1.getRedis)().expire(key, (0, redish_1.ttlUntilMidnightIST)());
    }
    catch { /* Redis unavailable */ }
    db.doc(`aiGuruUsage/${uid}/daily/${(0, redish_1.todayIST)()}`).set({ quizAttempts: admin.firestore.FieldValue.increment(1) }, { merge: true }).catch((e) => console.warn("aiGuruUsage followup write failed:", e));
}
// ─── Ask AI Guru limits ───────────────────────────────────────────────────────
const FREE_ASK_GURU_DAILY = 5;
async function checkAskGuruLimit(uid, db) {
    const { isPremium } = await getSubscription(uid, db);
    if (isPremium)
        return;
    const key = redish_1.RK.askGuruChat(uid, (0, redish_1.todayIST)());
    let used = 0;
    try {
        const count = await (0, redish_1.getRedis)().get(key);
        if (count !== null) {
            used = count;
        }
        else {
            const snap = await db.doc(`askGuruUsage/${uid}/daily/${(0, redish_1.todayIST)()}`).get();
            used = snap.exists ? (snap.data()?.questionsUsed ?? 0) : 0;
            if (used > 0)
                (0, redish_1.getRedis)().set(key, used, { ex: (0, redish_1.ttlUntilMidnightIST)() }).catch(() => { });
        }
    }
    catch {
        const snap = await db.doc(`askGuruUsage/${uid}/daily/${(0, redish_1.todayIST)()}`).get();
        used = snap.exists ? (snap.data()?.questionsUsed ?? 0) : 0;
    }
    if (used >= FREE_ASK_GURU_DAILY) {
        throw new Error(`FREE_LIMIT_REACHED:You have used your ${FREE_ASK_GURU_DAILY} free questions for today. Come back tomorrow or upgrade to Premium.`);
    }
}
async function incrementAskGuruUsage(uid, db) {
    const key = redish_1.RK.askGuruChat(uid, (0, redish_1.todayIST)());
    try {
        const count = await (0, redish_1.getRedis)().incr(key);
        if (count === 1)
            await (0, redish_1.getRedis)().expire(key, (0, redish_1.ttlUntilMidnightIST)());
    }
    catch { /* Redis unavailable */ }
    db.doc(`askGuruUsage/${uid}/daily/${(0, redish_1.todayIST)()}`).set({ questionsUsed: admin.firestore.FieldValue.increment(1), lastAskedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch((e) => console.warn("askGuruUsage write failed:", e));
}
// ─── VidyaGuru chat limits ────────────────────────────────────────────────────
const FREE_VIDYAGURU_DAILY = 1;
async function checkVidyaGuruLimit(uid, db) {
    const { isPremium } = await getSubscription(uid, db);
    if (isPremium)
        return;
    const key = redish_1.RK.vidyaGuruChat(uid, (0, redish_1.todayIST)());
    let used = 0;
    try {
        const count = await (0, redish_1.getRedis)().get(key);
        if (count !== null) {
            used = count;
        }
        else {
            const snap = await db.doc(`vidyaguruUsage/${uid}/daily/${(0, redish_1.todayIST)()}`).get();
            used = snap.exists ? (snap.data()?.questionsUsed ?? 0) : 0;
            if (used > 0)
                (0, redish_1.getRedis)().set(key, used, { ex: (0, redish_1.ttlUntilMidnightIST)() }).catch(() => { });
        }
    }
    catch {
        const snap = await db.doc(`vidyaguruUsage/${uid}/daily/${(0, redish_1.todayIST)()}`).get();
        used = snap.exists ? (snap.data()?.questionsUsed ?? 0) : 0;
    }
    if (used >= FREE_VIDYAGURU_DAILY) {
        throw new Error(`FREE_LIMIT_REACHED:You've used your free VidyaGuru question for today. Upgrade to Premium for unlimited conversations.`);
    }
}
async function incrementVidyaGuruUsage(uid, db) {
    const key = redish_1.RK.vidyaGuruChat(uid, (0, redish_1.todayIST)());
    try {
        const count = await (0, redish_1.getRedis)().incr(key);
        if (count === 1)
            await (0, redish_1.getRedis)().expire(key, (0, redish_1.ttlUntilMidnightIST)());
    }
    catch { /* Redis unavailable */ }
    db.doc(`vidyaguruUsage/${uid}/daily/${(0, redish_1.todayIST)()}`).set({ questionsUsed: admin.firestore.FieldValue.increment(1), lastAskedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch((e) => console.warn("vidyaguruUsage write failed:", e));
}
//# sourceMappingURL=usageCheck.js.map
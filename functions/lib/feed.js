"use strict";
/**
 * functions/src/feed.ts
 * ─────────────────────────────────────────────────────────────
 * Cloud Functions for home feed + reels feed + admin short reels feed.
 *
 * Exports:
 *   getHomeFeed           — (unchanged) home feed posts + banners
 *   getReelsFeed          — (unchanged) skill battle reels
 *   getAdminShortReelsFeed — 🆕 personalised admin short reels
 *
 * getAdminShortReelsFeed priority order:
 *   1. Class match          (+10)
 *   2. Language match       (+8)
 *   3. State match          (+5)
 *   4. Interest match       (+6) or generic (+2)
 *   5. Featured bonus       (+3)
 *   Falls back to all active reels if no targeting matches.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminShortReelsFeed = exports.getReelsFeed = exports.getHomeFeed = void 0;
const admin = require("firebase-admin");
const functionsV1 = require("firebase-functions/v1");
const redish_1 = require("./redish");
const db = admin.firestore();
// ─── getHomeFeed ──────────────────────────────────────────────
exports.getHomeFeed = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "256MB", secrets: ["REDIS_URL", "REDIS_TOKEN"] })
    .https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    const cls = data.classLevel ?? "all";
    let banners = [];
    const bannersKey = redish_1.RK.banners();
    try {
        const cached = await (0, redish_1.getRedis)().get(bannersKey);
        if (cached) {
            banners = cached;
        }
        else {
            const snap = await db.collection("banners").orderBy("createdAt", "desc").limit(10).get();
            banners = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            (0, redish_1.getRedis)().set(bannersKey, banners, { ex: redish_1.TTL.banners }).catch(() => { });
        }
    }
    catch {
        const snap = await db.collection("banners").orderBy("createdAt", "desc").limit(10).get();
        banners = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
    let posts = [];
    const feedKey = redish_1.RK.homeFeed(cls);
    try {
        const cached = await (0, redish_1.getRedis)().get(feedKey);
        if (cached) {
            posts = cached;
        }
        else {
            posts = await fetchPosts(cls);
            (0, redish_1.getRedis)().set(feedKey, posts, { ex: redish_1.TTL.homeFeed }).catch(() => { });
        }
    }
    catch {
        posts = await fetchPosts(cls);
    }
    return { banners, posts };
});
async function fetchPosts(cls) {
    const q = cls !== "all"
        ? db.collection("posts").where("postType", "==", "post").where("class", "==", cls).orderBy("createdAt", "desc").limit(30)
        : db.collection("posts").where("postType", "==", "post").orderBy("createdAt", "desc").limit(30);
    const snap = await q.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
// ─── getReelsFeed ─────────────────────────────────────────────
exports.getReelsFeed = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "256MB", secrets: ["REDIS_URL", "REDIS_TOKEN"] })
    .https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    const cls = data.classLevel ?? "all";
    const pageSize = Math.min(data.limit ?? 20, 50);
    const hasCursor = !!data.cursor;
    const cacheKey = redish_1.RK.reelsFeed(cls);
    if (!hasCursor) {
        try {
            const cached = await (0, redish_1.getRedis)().get(cacheKey);
            if (cached)
                return { reels: cached, cursor: null };
        }
        catch { /* Redis unavailable */ }
    }
    let q = cls !== "all"
        ? db.collection("posts").where("postType", "==", "reel").where("class", "==", cls).orderBy("views", "desc")
        : db.collection("posts").where("postType", "==", "reel").orderBy("views", "desc");
    if (data.cursor) {
        const cursorDoc = await db.doc(`posts/${data.cursor}`).get();
        if (cursorDoc.exists)
            q = q.startAfter(cursorDoc);
    }
    const snap = await q.limit(pageSize).get();
    const reels = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const cursor = snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1].id : null;
    if (!hasCursor)
        (0, redish_1.getRedis)().set(cacheKey, reels, { ex: redish_1.TTL.reelsFeed }).catch(() => { });
    return { reels, cursor };
});
function scoreDoc(data, ctx) {
    let score = 0;
    const tc = data.targetClass ?? ["All"];
    const tl = data.targetLanguage ?? ["All"];
    const ts = data.targetState ?? ["All"];
    const ti = data.targetInterest ?? ["All"];
    if (tc.includes("All") || (ctx.classLevel && tc.includes(ctx.classLevel)))
        score += 10;
    if (tl.includes("All") || (ctx.language && tl.includes(ctx.language)))
        score += 8;
    if (ts.includes("All") || (ctx.state && ts.includes(ctx.state)))
        score += 5;
    if (ti.includes("All"))
        score += 2;
    else if (ctx.interests?.some((i) => ti.includes(i)))
        score += 6;
    if (data.featured === true)
        score += 3;
    return score;
}
exports.getAdminShortReelsFeed = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "256MB", secrets: ["REDIS_URL", "REDIS_TOKEN"] })
    .https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    const uid = context.auth.uid;
    const limit = Math.min(data.limit ?? 30, 60);
    const cacheKey = `short_reels:${uid}`;
    // Per-user cache (5 min) — personalisation is cheap enough that we can
    // cache per user rather than per class, giving tighter relevance.
    try {
        const cached = await (0, redish_1.getRedis)().get(cacheKey);
        if (cached)
            return { reels: cached };
    }
    catch { /* Redis unavailable, proceed */ }
    // Fetch all active short reels (admin collection is small, typically < 200)
    const snap = await db
        .collection("short_reels")
        .where("status", "==", "active")
        .get();
    const scored = snap.docs
        .map((d) => ({ id: d.id, score: scoreDoc(d.data(), data), data: d.data(), createdAt: d.data().createdAt }))
        .sort((a, b) => {
        if (b.score !== a.score)
            return b.score - a.score;
        // Secondary sort: createdAt desc
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
    })
        .slice(0, limit)
        .map(({ id, data }) => ({ id, ...data }));
    // Cache per user for 5 minutes
    (0, redish_1.getRedis)().set(cacheKey, scored, { ex: 300 }).catch(() => { });
    return { reels: scored };
});
//# sourceMappingURL=feed.js.map
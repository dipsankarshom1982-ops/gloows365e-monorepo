"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLeaderboard = void 0;
const admin = require("firebase-admin");
const functionsV1 = require("firebase-functions/v1");
const redish_1 = require("./redish");
const db = admin.firestore();
// ─── getLeaderboard ───────────────────────────────────────────────────────────
// Returns cached skillboard top-50 for a given class + month + scope.
// Client calls this instead of reading Firestore directly.
exports.getLeaderboard = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "128MB", secrets: ["REDIS_URL", "REDIS_TOKEN"] })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const { class: cls, month, scope = "india", scopeValue = "" } = data;
    if (!cls || !month) {
        throw new functionsV1.https.HttpsError("invalid-argument", "class and month are required");
    }
    // Key includes scopeValue for state/district/local scopes
    const cacheKey = redish_1.RK.leaderboard(scope === "india" ? scope : `${scope}:${scopeValue}`, cls, month);
    // ── Cache hit ────────────────────────────────────────────
    try {
        const cached = await (0, redish_1.getRedis)().get(cacheKey);
        if (cached)
            return { leaderboard: cached, fromCache: true };
    }
    catch { /* Redis unavailable */ }
    // ── Firestore fallback ───────────────────────────────────
    let q = db
        .collection("skillboard")
        .where("class", "==", cls)
        .where("month", "==", month)
        .orderBy("totalScore", "desc")
        .limit(50);
    if (scope !== "india" && scopeValue) {
        const fieldMap = {
            state: "location.state",
            district: "location.district",
            local: "location.pincode",
        };
        q = db
            .collection("skillboard")
            .where("class", "==", cls)
            .where("month", "==", month)
            .where(fieldMap[scope] ?? "location.state", "==", scopeValue)
            .orderBy("totalScore", "desc")
            .limit(50);
    }
    const snap = await q.get();
    const leaderboard = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    (0, redish_1.getRedis)().set(cacheKey, leaderboard, { ex: redish_1.TTL.leaderboard }).catch(() => { });
    return { leaderboard, fromCache: false };
});
//# sourceMappingURL=leaderboard.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RK = exports.TTL = void 0;
exports.getRedis = getRedis;
exports.todayIST = todayIST;
exports.ttlUntilMidnightIST = ttlUntilMidnightIST;
const redis_1 = require("@upstash/redis");
let _client = null;
// Lazy init — safe for modules that import but don't always call Redis
function getRedis() {
    if (!_client) {
        const url = (process.env.REDIS_URL ?? "").replace(/^["'\s]+|["'\s]+$/g, "");
        const token = (process.env.REDIS_TOKEN ?? "").replace(/^["'\s]+|["'\s]+$/g, "");
        _client = new redis_1.Redis({ url, token });
    }
    return _client;
}
// ─── Key helpers ──────────────────────────────────────────────────────────────
function todayIST() {
    const now = new Date(Date.now() + IST_OFFSET_MS);
    return now.toISOString().slice(0, 10); // "YYYY-MM-DD"
}
function ttlUntilMidnightIST() {
    const istMs = Date.now() + IST_OFFSET_MS;
    const midnight = new Date(istMs);
    midnight.setUTCHours(24, 0, 0, 0);
    return Math.max(60, Math.floor((midnight.getTime() - istMs) / 1000));
}
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
// ─── TTLs (seconds) ───────────────────────────────────────────────────────────
exports.TTL = {
    subscription: 300, // 5 min
    leaderboard: 300, // 5 min
    homeFeed: 300, // 5 min
    banners: 1800, // 30 min
    reelsFeed: 300, // 5 min
    seekhoPlan: 3600, // 1 hr
    seekhoCourses: 86400, // 1 day
    vcoinBalance: 300, // 5 min
    // Discover AI
    discoverQuery: 3600, // 1 hr — per-query response cache
    discoverTrending: 86400, // 1 day
    // AI Personalized Dashboard
    dashboard: 14400, // 4 hours
    // Ask AI Guru
    askGuruAnswer: 3600, // 1 hr — cache answer per question hash
    // Ads system
    ads: 300, // 5 min — per-module ad list
    adEvents: 60, // 1 min — dedup window for impression/click events
};
// ─── Redis key factory ────────────────────────────────────────────────────────
exports.RK = {
    // AI Guru rate limiting
    aiGuruGen: (uid, date) => `aiguru:gen:${uid}:${date}`,
    aiGuruFollowup: (uid, date) => `aiguru:followup:${uid}:${date}`,
    aiGuruSub: (uid) => `sub:${uid}`,
    vidyaGuruChat: (uid, date) => `vidyaguru:chat:${uid}:${date}`,
    // Seekho
    seekhoPlan: (uid, date) => `seekho:plan:${uid}:${date}`,
    seekhoCourses: (cls, board) => `seekho:courses:${cls}:${board}`,
    seekhoSub: (uid) => `seekho:sub:${uid}`,
    // Leaderboard / Skillboard
    leaderboard: (scope, cls, month) => `lb:${scope}:${cls}:${month}`,
    // Home / Reels feed
    banners: () => `home:banners`,
    homeFeed: (cls) => `home:feed:${cls}`,
    reelsFeed: (cls) => `reels:feed:${cls}`,
    // VCoins
    vcoinBalance: (uid) => `vcoin:balance:${uid}`,
    vcoinLock: (uid, activity, suffix) => `vcoin:lock:${uid}:${activity}:${suffix}`,
    vcoinCount: (uid, activity, date) => `vcoin:count:${uid}:${activity}:${date}`,
    // Discover AI
    discoverSearch: (uid, date) => `discover:search:${uid}:${date}`,
    discoverQuery: (hash) => `discover:query:${hash}`,
    discoverTrending: () => `discover:trending`,
    // AI Personalized Dashboard
    dashboard: (uid) => `dashboard:${uid}`,
    // Ask AI Guru
    askGuruChat: (uid, date) => `askguru:chat:${uid}:${date}`,
    askGuruAnswer: (hash) => `askguru:ans:${hash}`,
    // Ads system
    ads: (module, cls) => `ads:${module}:${cls}`,
    adEvent: (uid, adId, event) => `adev:${uid}:${adId}:${event}`,
    adFreq: (uid, date) => `adfreq:${uid}:${date}`,
    adReward: (uid, adId) => `adreward:${uid}:${adId}`,
    // PhotoSolve
    photoSolve: (uid, date) => `photosolve:${uid}:${date}`,
    photoSolveCache: (hash) => `photosolve:cache:${hash}`,
    // Exam Simulator
    examGen: (uid, date) => `exam:gen:${uid}:${date}`,
    examCache: (hash) => `exam:cache:${hash}`,
    // Voice Tutor
    voiceTutor: (uid, date) => `voicetutor:${uid}:${date}`,
};
//# sourceMappingURL=redish.js.map
import { Redis } from "@upstash/redis";

let _client: Redis | null = null;

// Lazy init — safe for modules that import but don't always call Redis
export function getRedis(): Redis {
  if (!_client) {
    const url   = (process.env.REDIS_URL   ?? "").replace(/^["'\s]+|["'\s]+$/g, "");
    const token = (process.env.REDIS_TOKEN ?? "").replace(/^["'\s]+|["'\s]+$/g, "");
    _client = new Redis({ url, token });
  }
  return _client;
}

// ─── Key helpers ──────────────────────────────────────────────────────────────

export function todayIST(): string {
  const now = new Date(Date.now() + IST_OFFSET_MS);
  return now.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export function ttlUntilMidnightIST(): number {
  const istMs = Date.now() + IST_OFFSET_MS;
  const midnight = new Date(istMs);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.max(60, Math.floor((midnight.getTime() - istMs) / 1000));
}

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

// ─── TTLs (seconds) ───────────────────────────────────────────────────────────

export const TTL = {
  subscription:    300,    // 5 min
  leaderboard:     300,    // 5 min
  homeFeed:        300,    // 5 min
  banners:         1800,   // 30 min
  reelsFeed:       300,    // 5 min
  seekhoPlan:      3600,   // 1 hr
  seekhoCourses:   86400,  // 1 day
  vcoinBalance:    300,    // 5 min

  // Discover AI
  discoverQuery:    3600,  // 1 hr — per-query response cache
  discoverTrending: 86400, // 1 day

  // AI Personalized Dashboard
  dashboard: 14400, // 4 hours

  // Ask AI Guru
  askGuruAnswer: 3600, // 1 hr — cache answer per question hash

  // Ads system
  ads:      300,   // 5 min — per-module ad list
  adEvents: 60,    // 1 min — dedup window for impression/click events
} as const;

// ─── Redis key factory ────────────────────────────────────────────────────────

export const RK = {
  // AI Guru rate limiting
  aiGuruGen:       (uid: string, date: string) => `aiguru:gen:${uid}:${date}`,
  aiGuruFollowup:  (uid: string, date: string) => `aiguru:followup:${uid}:${date}`,
  aiGuruSub:       (uid: string)               => `sub:${uid}`,
  vidyaGuruChat:   (uid: string, date: string) => `vidyaguru:chat:${uid}:${date}`,

  // Seekho
  seekhoPlan:      (uid: string, date: string) => `seekho:plan:${uid}:${date}`,
  seekhoCourses:   (cls: number, board: string) => `seekho:courses:${cls}:${board}`,
  seekhoSub:       (uid: string)               => `seekho:sub:${uid}`,

  // Leaderboard / Skillboard
  leaderboard:     (scope: string, cls: string, month: string) => `lb:${scope}:${cls}:${month}`,

  // Home / Reels feed
  banners:         ()                           => `home:banners`,
  homeFeed:        (cls: string)               => `home:feed:${cls}`,
  reelsFeed:       (cls: string)               => `reels:feed:${cls}`,

  // VCoins
  vcoinBalance:    (uid: string)               => `vcoin:balance:${uid}`,
  vcoinLock:       (uid: string, activity: string, suffix: string) =>
                     `vcoin:lock:${uid}:${activity}:${suffix}`,
  vcoinCount:      (uid: string, activity: string, date: string) =>
                     `vcoin:count:${uid}:${activity}:${date}`,

  // Discover AI
  discoverSearch:   (uid: string, date: string) => `discover:search:${uid}:${date}`,
  discoverQuery:    (hash: string)              => `discover:query:${hash}`,
  discoverTrending: ()                          => `discover:trending`,

  // AI Personalized Dashboard
  dashboard:        (uid: string)               => `dashboard:${uid}`,

  // Ask AI Guru
  askGuruChat:      (uid: string, date: string) => `askguru:chat:${uid}:${date}`,
  askGuruAnswer:    (hash: string)              => `askguru:ans:${hash}`,

  // Ads system
  ads:       (module: string, cls: string)   => `ads:${module}:${cls}`,
  adEvent:   (uid: string, adId: string, event: string) => `adev:${uid}:${adId}:${event}`,
  adFreq:    (uid: string, date: string)     => `adfreq:${uid}:${date}`,
  adReward:  (uid: string, adId: string)     => `adreward:${uid}:${adId}`,

  // PhotoSolve
  photoSolve:      (uid: string, date: string) => `photosolve:${uid}:${date}`,
  photoSolveCache: (hash: string)              => `photosolve:cache:${hash}`,

  // Exam Simulator
  examGen:    (uid: string, date: string) => `exam:gen:${uid}:${date}`,
  examCache:  (hash: string)              => `exam:cache:${hash}`,

  // Voice Tutor
  voiceTutor: (uid: string, date: string) => `voicetutor:${uid}:${date}`,
};

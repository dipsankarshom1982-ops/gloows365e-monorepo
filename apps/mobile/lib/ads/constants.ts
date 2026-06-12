import type { AdCategory } from "./types";

// ── Safety: only these categories are served to students ─────────────────────
export const ALLOWED_AD_CATEGORIES: AdCategory[] = [
  "education",
  "scholarship",
  "exam",
  "course",
  "skill",
  "olympiad",
];

// Keywords in title/description that auto-block an ad (server-side enforced)
export const BLOCKED_KEYWORDS = [
  "gambling", "betting", "crypto", "bitcoin", "dating", "adult",
  "casino", "violent", "loan", "earn money fast", "fake",
];

// ── Frequency limits ──────────────────────────────────────────────────────────
export const AD_FREQUENCY = {
  maxPerSession:          6,    // max total ads shown in one app session
  minFeedItemsBetweenAds: 6,    // min posts/items between consecutive ads
  maxRewardedPerDay:      3,    // max rewarded ads claimable per day
  sameAdCooldownHours:    24,   // same ad not shown again within N hours
} as const;

// ── Module identifiers (must match targetModules in Firestore) ────────────────
export const AD_MODULES = {
  HOME:         "home",
  AI_GURU:      "aiGuru",
  SEEKHO:       "seekho",
  SKILL_BOOST:  "skillBoost",
  SKILL_BATTLE: "skillBattle",
  VIDYA_STAR:   "vidyaStar",
  LEARN_FUN:    "learnFun",
} as const;

// ── Default fetch limits per call ─────────────────────────────────────────────
export const AD_FETCH_LIMIT = 5;

// ── AsyncStorage keys ─────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  sessionAdCount:   "ads_session_count",
  sessionStartedAt: "ads_session_started",
  lastAdShownAt:    "ads_last_shown_at",
} as const;

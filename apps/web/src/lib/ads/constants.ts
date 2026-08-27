// PATH: apps/web/src/lib/ads/constants.ts
// Direct port of mobile's lib/ads/constants.ts. Same values, so frequency
// caps and safety rules behave identically across platforms. STORAGE_KEYS
// here back localStorage (web) instead of AsyncStorage (mobile) — see
// hooks/useAdFrequency.ts.

import type { AdCategory } from "./types";

// ── Safety: only these categories are served to students ─────────────────────
// (Mirrors the server-side ALLOWED_CATEGORIES check in functions/src/ads.ts —
// this client-side copy is just for any UI that wants to label/filter ads
// before they're fetched; the Cloud Function is the actual enforcement point.)
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
  maxPerSession:          6,    // max total ads shown in one tab session
  minFeedItemsBetweenAds: 6,    // min posts/items between consecutive ads
  maxRewardedPerDay:      3,    // max rewarded ads claimable per day (also enforced server-side)
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

// ── localStorage keys (web equivalent of mobile's AsyncStorage keys) ─────────
export const STORAGE_KEYS = {
  sessionAdCount:   "ads_session_count",
  sessionStartedAt: "ads_session_started",
  lastAdShownAt:    "ads_last_shown_at",
} as const;

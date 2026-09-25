// PATH: apps/web/src/utils/formatVCoins.ts
// Mirrors mobile utils/formatVCoins.ts — source constants must match
// vCoinRules document IDs in Firestore exactly.

export const VCOIN_SOURCES = {
  APP_TIME_REWARD:                  "APP_TIME_REWARD",
  REEL_WATCH_REWARD:                "REEL_WATCH_REWARD",
  VIDEO_WATCH_REWARD:                "VIDEO_WATCH_REWARD",
  STORY_WATCH_REWARD:                "STORY_WATCH_REWARD",
  SKILLBATTLE_WINNER_REWARD:         "SKILLBATTLE_WINNER_REWARD",
  SKILLBATTLE_RUNNER_UP_REWARD:      "SKILLBATTLE_RUNNER_UP_REWARD",
  SKILLBATTLE_PARTICIPATION_REWARD:  "SKILLBATTLE_PARTICIPATION_REWARD",
  ADMIN_FAIR_USE_REWARD:             "ADMIN_FAIR_USE_REWARD",
  VIDYASTAR_CONTEST_ENTRY:           "VIDYASTAR_CONTEST_ENTRY",
  // DEBIT — charged when a student joins a paid VidyaStar contest.
  // Mirrors mobile utils/formatVCoins.ts's VIDYASTAR_CONTEST_JOIN_FEE.
  VIDYASTAR_CONTEST_JOIN_FEE:        "VIDYASTAR_CONTEST_JOIN_FEE",
  COURSE_DISCOUNT_REDEEM:            "COURSE_DISCOUNT_REDEEM",
  REFERRAL_REWARD:                   "REFERRAL_REWARD",
  REFEREE_JOIN_BONUS:                "REFEREE_JOIN_BONUS",
  SIGNUP_BONUS:                      "SIGNUP_BONUS",
} as const;

export type VCoinSource = (typeof VCOIN_SOURCES)[keyof typeof VCOIN_SOURCES];

export function formatVCoins(amount: number): string {
  return Math.floor(amount).toLocaleString("en-IN");
}

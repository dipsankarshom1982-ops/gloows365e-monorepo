// PATH: utils/formatVCoins.ts
// Formatting helpers for V-Coins display — no Firebase imports

import { Timestamp } from "firebase/firestore";

// ─── Source constants (must match vCoinRules document IDs in Firestore) ───────
export const VCOIN_SOURCES = {
  APP_TIME_REWARD:                   "APP_TIME_REWARD",
  REEL_WATCH_REWARD:                 "REEL_WATCH_REWARD",
  VIDEO_WATCH_REWARD:                "VIDEO_WATCH_REWARD",
  STORY_WATCH_REWARD:                "STORY_WATCH_REWARD",
  SKILLBATTLE_WINNER_REWARD:         "SKILLBATTLE_WINNER_REWARD",
  SKILLBATTLE_RUNNER_UP_REWARD:      "SKILLBATTLE_RUNNER_UP_REWARD",
  SKILLBATTLE_PARTICIPATION_REWARD:  "SKILLBATTLE_PARTICIPATION_REWARD",
  ADMIN_FAIR_USE_REWARD:             "ADMIN_FAIR_USE_REWARD",
  VIDYASTAR_CONTEST_ENTRY:           "VIDYASTAR_CONTEST_ENTRY",
  // DEBIT — charged when a student joins a paid VidyaStar contest (admin
  // sets the V-Coins cost per contest in CreateContest.tsx's "V-Coins
  // Entry Fee" field; 0 or a sponsored contest = free). Distinct from
  // VIDYASTAR_CONTEST_ENTRY above, which is a CREDIT paid out for
  // *completing* a contest's quiz (see submitContestQuiz.ts) — that name
  // predates this feature and was left as-is to avoid touching an
  // already-working reward path.
  VIDYASTAR_CONTEST_JOIN_FEE:        "VIDYASTAR_CONTEST_JOIN_FEE",
  COURSE_DISCOUNT_REDEEM:            "COURSE_DISCOUNT_REDEEM",
  // ── Referral rewards (NEW) ────────────────────────────────────────────────
  REFERRAL_REWARD:                   "REFERRAL_REWARD",    // coins for student who shares
  REFEREE_JOIN_BONUS:                "REFEREE_JOIN_BONUS", // welcome coins for new student
  // ── Daily Streak Quiz ─────────────────────────────────────────────────────
  // FIX: this key previously only existed in utils/utils_formatVCoins.ts — an
  // orphaned duplicate of this file that nothing actually imports (checked:
  // every consumer imports from "@/utils/formatVCoins", this file). But
  // services/vCoinsService.ts's DEFAULT_DAILY_LIMITS references
  // VCOIN_SOURCES.DAILY_STREAK_QUIZ_CORRECT from *this* file, where the key
  // didn't exist — so that lookup was silently building a limits entry keyed
  // "undefined" instead of the real source string. Moved the real constant
  // here and deleted the duplicate file.
  //
  // Credited server-side only, via the submitDailyStreakQuizAnswer Cloud
  // Function — see docs/DAILY_STREAK_QUIZ_BACKEND.md. Listed here so admin's
  // VCoinRules page and VCoinLeaderboard/analytics can reference the same
  // source string as the source-of-truth.
  DAILY_STREAK_QUIZ_CORRECT:          "DAILY_STREAK_QUIZ_CORRECT",
  // ── Registration welcome bonus ────────────────────────────────────────────
  // FIX (bug report — "200 v-coins not updated"): registration used to write
  // users/{uid}.coins = 200 directly — a field nothing reads (the real
  // balance field is vCoinsBalance). Routed through creditVCoins() instead,
  // same as every other reward — see app/(auth)/register.tsx.
  SIGNUP_BONUS:                       "SIGNUP_BONUS",
} as const;

export type VCoinSource = (typeof VCOIN_SOURCES)[keyof typeof VCOIN_SOURCES];

// ─── formatVCoins ─────────────────────────────────────────────────────────────
export function formatVCoins(amount: number): string {
  return Math.floor(amount).toLocaleString("en-IN");
}

// ─── formatTransactionDate ───────────────────────────────────────────────────
export function formatTransactionDate(timestamp: Timestamp | null | undefined): string {
  if (!timestamp) return "—";

  const date = timestamp.toDate();
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const timeStr = date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (isToday) return `Today, ${timeStr}`;
  if (isYesterday) return `Yesterday, ${timeStr}`;

  const dateStr = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
  return `${dateStr}, ${timeStr}`;
}

// ─── getVCoinsSourceLabel ─────────────────────────────────────────────────────
export function getVCoinsSourceLabel(source: string): string {
  switch (source) {
    case VCOIN_SOURCES.APP_TIME_REWARD:                  return "App Learning Time";
    case VCOIN_SOURCES.REEL_WATCH_REWARD:                return "Watched Reel";
    case VCOIN_SOURCES.VIDEO_WATCH_REWARD:               return "Watched Video";
    case VCOIN_SOURCES.STORY_WATCH_REWARD:               return "Watched Story";
    case VCOIN_SOURCES.SKILLBATTLE_WINNER_REWARD:        return "SkillBattle Winner";
    case VCOIN_SOURCES.SKILLBATTLE_RUNNER_UP_REWARD:     return "SkillBattle Runner-up";
    case VCOIN_SOURCES.SKILLBATTLE_PARTICIPATION_REWARD: return "SkillBattle Participation";
    case VCOIN_SOURCES.ADMIN_FAIR_USE_REWARD:            return "Bonus Reward";
    case VCOIN_SOURCES.VIDYASTAR_CONTEST_ENTRY:          return "VidyaStar Contest Entry";
    case VCOIN_SOURCES.VIDYASTAR_CONTEST_JOIN_FEE:       return "VidyaStar Contest Join Fee";
    case VCOIN_SOURCES.COURSE_DISCOUNT_REDEEM:           return "Course Discount";
    case VCOIN_SOURCES.REFERRAL_REWARD:                  return "Referral Reward";
    case VCOIN_SOURCES.REFEREE_JOIN_BONUS:               return "Welcome Bonus";
    case VCOIN_SOURCES.DAILY_STREAK_QUIZ_CORRECT:        return "Daily Streak Quiz";
    case VCOIN_SOURCES.SIGNUP_BONUS:                     return "Welcome Bonus";
    default:                                             return source;
  }
}

// ─── getVCoinsSourceIcon ──────────────────────────────────────────────────────
// Returns an Ionicons icon name
export function getVCoinsSourceIcon(source: string): string {
  switch (source) {
    case VCOIN_SOURCES.APP_TIME_REWARD:                  return "time-outline";
    case VCOIN_SOURCES.REEL_WATCH_REWARD:                return "play-circle-outline";
    case VCOIN_SOURCES.VIDEO_WATCH_REWARD:               return "videocam-outline";
    case VCOIN_SOURCES.STORY_WATCH_REWARD:               return "images-outline";
    case VCOIN_SOURCES.SKILLBATTLE_WINNER_REWARD:        return "trophy-outline";
    case VCOIN_SOURCES.SKILLBATTLE_RUNNER_UP_REWARD:     return "medal-outline";
    case VCOIN_SOURCES.SKILLBATTLE_PARTICIPATION_REWARD: return "ribbon-outline";
    case VCOIN_SOURCES.ADMIN_FAIR_USE_REWARD:            return "gift-outline";
    case VCOIN_SOURCES.VIDYASTAR_CONTEST_ENTRY:          return "ticket-outline";
    case VCOIN_SOURCES.VIDYASTAR_CONTEST_JOIN_FEE:       return "log-in-outline";
    case VCOIN_SOURCES.COURSE_DISCOUNT_REDEEM:           return "pricetag-outline";
    case VCOIN_SOURCES.REFERRAL_REWARD:                  return "people-outline";
    case VCOIN_SOURCES.REFEREE_JOIN_BONUS:               return "gift-outline";
    case VCOIN_SOURCES.DAILY_STREAK_QUIZ_CORRECT:        return "flame-outline";
    case VCOIN_SOURCES.SIGNUP_BONUS:                     return "gift-outline";
    default:                                             return "ellipse-outline";
  }
}

// ─── getVCoinsSourceIconBg ────────────────────────────────────────────────────
export function getVCoinsSourceIconBg(source: string): string {
  switch (source) {
    case VCOIN_SOURCES.APP_TIME_REWARD:                  return "#EDE9FE";
    case VCOIN_SOURCES.REEL_WATCH_REWARD:                return "#FEF3C7";
    case VCOIN_SOURCES.VIDEO_WATCH_REWARD:               return "#DBEAFE";
    case VCOIN_SOURCES.STORY_WATCH_REWARD:               return "#FCE7F3";
    case VCOIN_SOURCES.SKILLBATTLE_WINNER_REWARD:        return "#FEF9C3";
    case VCOIN_SOURCES.SKILLBATTLE_RUNNER_UP_REWARD:     return "#FEF3C7";
    case VCOIN_SOURCES.SKILLBATTLE_PARTICIPATION_REWARD: return "#F3F4F6";
    case VCOIN_SOURCES.ADMIN_FAIR_USE_REWARD:            return "#FDF2F8";
    case VCOIN_SOURCES.VIDYASTAR_CONTEST_ENTRY:          return "#FFF1F2";
    case VCOIN_SOURCES.VIDYASTAR_CONTEST_JOIN_FEE:       return "#FEE2E2";
    case VCOIN_SOURCES.COURSE_DISCOUNT_REDEEM:           return "#EFF6FF";
    case VCOIN_SOURCES.REFERRAL_REWARD:                  return "#EDE9FE";
    case VCOIN_SOURCES.REFEREE_JOIN_BONUS:               return "#FEF9C3";
    case VCOIN_SOURCES.DAILY_STREAK_QUIZ_CORRECT:        return "#FFEDD5";
    case VCOIN_SOURCES.SIGNUP_BONUS:                     return "#FEF9C3";
    default:                                             return "#F3F4F6";
  }
}

// ─── getVCoinsSourceIconColor ─────────────────────────────────────────────────
export function getVCoinsSourceIconColor(source: string): string {
  switch (source) {
    case VCOIN_SOURCES.APP_TIME_REWARD:                  return "#7C3AED";
    case VCOIN_SOURCES.REEL_WATCH_REWARD:                return "#D97706";
    case VCOIN_SOURCES.VIDEO_WATCH_REWARD:               return "#2563EB";
    case VCOIN_SOURCES.STORY_WATCH_REWARD:               return "#DB2777";
    case VCOIN_SOURCES.SKILLBATTLE_WINNER_REWARD:        return "#CA8A04";
    case VCOIN_SOURCES.SKILLBATTLE_RUNNER_UP_REWARD:     return "#D97706";
    case VCOIN_SOURCES.SKILLBATTLE_PARTICIPATION_REWARD: return "#6B7280";
    case VCOIN_SOURCES.ADMIN_FAIR_USE_REWARD:            return "#BE185D";
    case VCOIN_SOURCES.VIDYASTAR_CONTEST_ENTRY:          return "#E11D48";
    case VCOIN_SOURCES.VIDYASTAR_CONTEST_JOIN_FEE:       return "#DC2626";
    case VCOIN_SOURCES.COURSE_DISCOUNT_REDEEM:           return "#1D4ED8";
    case VCOIN_SOURCES.REFERRAL_REWARD:                  return "#7C3AED";
    case VCOIN_SOURCES.REFEREE_JOIN_BONUS:               return "#CA8A04";
    case VCOIN_SOURCES.DAILY_STREAK_QUIZ_CORRECT:        return "#EA580C";
    case VCOIN_SOURCES.SIGNUP_BONUS:                     return "#CA8A04";
    default:                                             return "#6B7280";
  }
}

// ─── SkillBattle V-Coin distribution ─────────────────────────────────────────
// Top 10 positions, must sum to 100
export const VCOIN_DIST_PCT = [30, 20, 14, 10, 8, 5, 4, 3, 3, 3] as const;

export function getVCoinForRank(baseCoins: number, rank: number): number {
  if (rank < 1 || rank > 10 || baseCoins <= 0) return 0;
  const pct = VCOIN_DIST_PCT[rank - 1] ?? 0;
  return Math.round((baseCoins * pct) / 100);
}

// ─── getTransactionColor ──────────────────────────────────────────────────────
export function getTransactionColor(
  type: "CREDIT" | "DEBIT" | string,
  status: "SUCCESS" | "PENDING" | "FAILED" | "REVERSED" | string
): string {
  if (status === "FAILED" || status === "REVERSED") return "#EF4444";
  if (status === "PENDING")                          return "#F59E0B";
  return type === "CREDIT" ? "#16A34A" : "#EF4444";
}

// ─── getStatusColor ───────────────────────────────────────────────────────────
export function getStatusColor(status: string): string {
  switch (status) {
    case "SUCCESS":  return "#16A34A";
    case "PENDING":  return "#F59E0B";
    case "FAILED":   return "#EF4444";
    case "REVERSED": return "#6B7280";
    default:         return "#6B7280";
  }
}

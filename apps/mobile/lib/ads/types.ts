import type { Timestamp } from "firebase/firestore";

export type AdType = "feed" | "rewarded" | "sponsored_reel" | "scholarship";
export type AdCategory = "education" | "scholarship" | "exam" | "course" | "skill" | "olympiad";
export type AdEvent =
  | "impression"
  | "click"
  | "watch_start"
  | "watch_complete"
  | "reward_claimed"
  | "skip";

export interface AdReward {
  coins: number;
  xp?: number;
  watchDurationSeconds: number;  // 15 or 30
}

export interface Ad {
  id: string;
  adType: AdType;

  // Content
  title: string;
  description: string;
  imageUrl: string;              // Cloudflare Image or direct URL
  videoUrl?: string;             // Cloudflare Stream URL (rewarded + sponsored_reel)
  ctaText: string;               // "Apply Now", "Learn More", "Enroll Free"
  ctaUrl?: string;               // external link
  ctaRoute?: string;             // internal Expo Router path
  sponsorName: string;
  adCategory: AdCategory;

  // Targeting
  targetModules: string[];       // ["home","aiGuru","seekho","skillBattle","learnFun",...]
  targetClass: string[];         // ["8","9","10","all"]
  targetInterests: string[];     // ["coding","english","math","science"]

  // Control
  isActive: boolean;
  isApproved: boolean;
  priority: number;
  startDate: Timestamp | null;
  endDate: Timestamp | null;

  // Reward (adType: "rewarded" only)
  reward?: AdReward;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
}

export interface AdAnalyticsEvent {
  adId: string;
  userId: string;
  event: AdEvent;
  module: string;
  adType: AdType;
  sessionId: string;
  timestamp: Timestamp;
  platform: "android" | "ios" | "web";
  classLevel: string;
}

export interface AdFrequency {
  lastSeen: Record<string, Timestamp>;        // adId → last seen Timestamp
  dailyImpressions: Record<string, number>;   // "YYYY-MM-DD" → count
  rewardedToday: Record<string, number>;      // "YYYY-MM-DD" → count
}

export interface AdAnalyticsSummary {
  impressions: number;
  clicks: number;
  watchComplete: number;
  rewardsClaimed: number;
  ctr: number;
  completionRate: number;
  moduleBreakdown: Record<string, { impressions: number; clicks: number }>;
  classBreakdown: Record<string, { impressions: number }>;
  updatedAt: Timestamp;
}

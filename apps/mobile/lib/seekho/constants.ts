import type { SeekhoSubject, SeekhoBoard, SeekhoPlan } from "./types";

// ─── Classes & Boards ─────────────────────────────────────────────────────────

export const SEEKHO_CLASSES: number[] = [6, 7, 8, 9, 10, 11, 12];
export const SEEKHO_BOARDS: SeekhoBoard[] = ["CBSE", "ICSE", "State"];
export const SEEKHO_SUBJECTS: SeekhoSubject[] = [
  "Mathematics",
  "Science",
  "Social Science",
  "English",
];

// ─── Subject metadata for UI ──────────────────────────────────────────────────

export const SUBJECT_META: Record<
  SeekhoSubject,
  { emoji: string; gradient: [string, string]; shortName: string; color: string }
> = {
  Mathematics: {
    emoji: "🔢",
    gradient: ["#1e1b4b", "#4f46e5"],
    shortName: "Maths",
    color: "#6366f1",
  },
  Science: {
    emoji: "🔬",
    gradient: ["#052e16", "#059669"],
    shortName: "Science",
    color: "#10b981",
  },
  "Social Science": {
    emoji: "🌍",
    gradient: ["#450a0a", "#dc2626"],
    shortName: "SST",
    color: "#ef4444",
  },
  English: {
    emoji: "📖",
    gradient: ["#1e3a5f", "#0284c7"],
    shortName: "English",
    color: "#0ea5e9",
  },
};

// ─── Subscription plan config ─────────────────────────────────────────────────

export interface PlanDetails {
  name: string;
  emoji: string;
  monthlyPrice: number;        // INR
  annualPrice: number;         // INR
  annualMonthly: number;       // effective monthly when billed annually
  features: string[];
  gradient: [string, string];
}

export const PLAN_CONFIG: Record<Exclude<SeekhoPlan, "free">, PlanDetails> = {
  plus: {
    name: "Seekho Plus",
    emoji: "⭐",
    monthlyPrice: 149,
    annualPrice: 999,
    annualMonthly: 83,
    features: [
      "1 class full access",
      "All 4 subjects",
      "Video lessons + notes",
      "Chapter practice tests",
      "Spaced revision",
    ],
    gradient: ["#1e1b4b", "#6366f1"],
  },
  pro: {
    name: "Seekho Pro",
    emoji: "🚀",
    monthlyPrice: 299,
    annualPrice: 1999,
    annualMonthly: 167,
    features: [
      "All classes 6–12",
      "Exam mode + study planner",
      "Daily revision reminders",
      "AI Guru integration",
      "Priority support",
    ],
    gradient: ["#4c1d95", "#7c3aed"],
  },
};

// ─── Feature thresholds ───────────────────────────────────────────────────────

/** Fraction of lessons completed before Practice Set unlocks */
export const PRACTICE_UNLOCK_THRESHOLD = 0.6;

/** Fraction of video watched before "Mark Complete" button appears */
export const LESSON_WATCH_THRESHOLD = 0.8;

/** XP awarded per completed chapter */
export const CHAPTER_XP_REWARD = 200;

/** Minimum correct % to trigger chapter-complete XP award */
export const PRACTICE_PASS_THRESHOLD = 0.6;

// ─── SM-2 spaced repetition defaults ─────────────────────────────────────────

export const SM2_DEFAULT_EASE_FACTOR = 2.5;
export const SM2_MIN_EASE_FACTOR = 1.3;

// ─── Razorpay ─────────────────────────────────────────────────────────────────

// Requires react-native-razorpay: npx expo install react-native-razorpay
// Needs Expo Dev Client build (incompatible with Expo Go)
export const RAZORPAY_KEY_ID = process.env["EXPO_PUBLIC_RAZORPAY_KEY_ID"] ?? "";

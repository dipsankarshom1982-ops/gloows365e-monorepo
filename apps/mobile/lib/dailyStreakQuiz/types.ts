// PATH: lib/dailyStreakQuiz/types.ts
// Daily Streak Quiz — shared types for mobile + (mirrored) admin.
//
// Collections (see /mnt/skills or docs/DAILY_STREAK_QUIZ_BACKEND.md for the
// full backend contract):
//   dailyStreakQuizQuestions/{id}        — admin-authored question bank
//   studentDailyStreakProgress/{uid}     — one doc per student, rollups + a
//                                           `days` subcollection for history
//
// SECURITY NOTE: the client NEVER reads optionA/B/C/D + correctOption from
// dailyStreakQuizQuestions directly for "today's question". It calls the
// getTodaysStreakQuizQuestion Cloud Function, which strips correctOption
// and explanation server-side before returning. See dailyStreakQuizService.ts.

export type DailyStreakQuizOption = "A" | "B" | "C" | "D";

// ─── Question bank (admin-authored) ────────────────────────────────────────
// This is the full shape as stored in Firestore. Students never receive the
// full shape pre-submission — see PublicDailyStreakQuizQuestion below.
export interface DailyStreakQuizQuestion {
  id: string;
  class: number;                 // 6–12
  // Class 11/12 only — null for classes 6–10 and for legacy questions
  // authored before the 2026-09-14 stream architecture update (field
  // absent entirely on those docs, treated identically to null everywhere
  // this is read). "Science" | "Commerce" | "Arts/Humanities".
  stream?: string | null;
  language: string;               // matches INDIAN_LANGUAGES[].name
  subject: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: DailyStreakQuizOption;
  explanation: string;
  publishDate: string;            // "YYYY-MM-DD", student's local-independent publish day
  status: "active" | "inactive";
  createdBy: string;              // admin uid
  createdAt: unknown;             // Firestore Timestamp
  updatedAt?: unknown;
}

// ─── What the client actually receives before submission ──────────────────
// Returned by the getTodaysStreakQuizQuestion Cloud Function. No
// correctOption, no explanation — see SECURITY NOTE above.
export interface PublicDailyStreakQuizQuestion {
  questionId: string;
  date: string;                   // "YYYY-MM-DD"
  subject: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  alreadySubmitted: boolean;      // true if this exact question was already answered today
}

// ─── Result returned after submitting an answer ────────────────────────────
// Returned by the submitDailyStreakQuizAnswer Cloud Function. This is the
// ONLY place the correct answer + explanation are ever sent to the client,
// and only after the student has already locked in their choice.
export interface DailyStreakQuizSubmitResult {
  isCorrect: boolean;
  correctOption: DailyStreakQuizOption;
  explanation: string;
  vCoinsAwarded: number;
  xpAwarded: number;
  streak: DailyStreakProgress;
  ambassadorEligible: boolean;
}

// ─── Per-student rollup (studentDailyStreakProgress/{uid}) ─────────────────
export interface DailyStreakProgress {
  currentStreak: number;          // 0–7, position within the current week
  weeklyProgress: number;         // alias of currentStreak, 1–7 — kept distinct
                                   // in the UI per spec ("Weekly Progress")
  completedWeeks: number;         // 0–52
  lastCompletedDate: string | null; // "YYYY-MM-DD"
  ambassadorEligible: boolean;    // true once completedWeeks reaches 52
  ambassadorAppliedAt?: unknown;  // Firestore Timestamp, set once "Apply Now" used
}

// ─── One row of submission history (studentDailyStreakProgress/{uid}/days/{date}) ──
export interface DailyStreakQuizDayRecord {
  date: string;
  questionId: string;
  selectedOption: DailyStreakQuizOption;
  isCorrect: boolean;
  dailyStreak: number;
  weeklyProgress: number;
  completedWeeks: number;
  vCoinsEarned: number;
  xpEarned: number;
  submittedAt: unknown;
}

export const DAILY_STREAK_QUIZ_VCOIN_REWARD = 5;
export const DAILY_STREAK_QUIZ_MAX_WEEKLY_PROGRESS = 7;
export const DAILY_STREAK_QUIZ_AMBASSADOR_WEEKS = 52;

// Source key used by the existing V-Coins ledger (vCoinRules/{source} doc id
// + vCoinTransactions[].source). Mirrors VCOIN_SOURCES in utils/formatVCoins.ts
// — add this same key there when wiring the Cloud Function (see backend docs).
export const DAILY_STREAK_QUIZ_VCOIN_SOURCE = "DAILY_STREAK_QUIZ_CORRECT";

// XP awarded for a correct answer, using the existing LearnFunXP system
// (see lib/learnfun/constants.ts — XP_PER_LEVEL / getLevelFromXP). Admin can
// retune this later the same way contest/lesson XP values are constants today.
export const DAILY_STREAK_QUIZ_XP_REWARD = 10;

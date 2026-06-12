// ─── Firestore document shapes ────────────────────────────────────────────────

export type SeekhoBoard = "CBSE" | "ICSE" | "State";
export type SeekhoSubject = "Mathematics" | "Science" | "Social Science" | "English";
export type SeekhoPlan = "free" | "plus" | "pro";
export type SeekhoDifficulty = "easy" | "medium" | "hard";

export interface SeekhoCourse {
  courseId: string;
  class: number;               // 6–12
  board: SeekhoBoard;
  subject: SeekhoSubject;
  chapterNumber: number;
  chapterTitle: string;
  description: string;
  totalLessons: number;
  isFree: boolean;             // first 2 chapters per subject = true
  thumbnailUrl: string;
  createdAt: unknown;
}

export interface SeekhoLesson {
  lessonId: string;
  courseId: string;
  lessonNumber: number;
  title: string;
  duration: number;            // seconds
  videoUrl: string;
  notesUrl?: string;           // PDF URL
  conceptTags: string[];
  isFree: boolean;
  createdAt: unknown;
}

export interface SeekhoPracticeQuestion {
  questionId: string;
  courseId: string;
  lessonId?: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  difficulty: SeekhoDifficulty;
  conceptTag: string;
}

export interface SeekhoProgress {
  progressId: string;
  userId: string;
  courseId: string;
  completedLessons: string[];
  practiceScores: Record<string, boolean>;    // { [questionId]: correct }
  percentComplete: number;
  lastAccessedAt: unknown;
  chapterCompleted: boolean;
}

export interface SeekhoSubscription {
  userId: string;
  plan: SeekhoPlan;
  classAccess: number[];       // [10] for plus, [6..12] for pro
  expiresAt: unknown;
  razorpaySubscriptionId?: string;
  createdAt: unknown;
}

export interface SeekhoRevisionItem {
  docId: string;               // Firestore doc ID: "{userId}_{conceptTag}"
  userId: string;
  conceptTag: string;
  questionIds: string[];
  nextReviewAt: number;        // Unix ms timestamp
  interval: number;            // SM-2 interval in days
  easeFactor: number;          // SM-2 EF, starts at 2.5, min 1.3
}

// ─── Store-level types ─────────────────────────────────────────────────────────

export interface DailyPlanItem {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  chapterTitle: string;
  subject: SeekhoSubject;
  durationSecs: number;
  completed: boolean;
}

// ─── Access check result ───────────────────────────────────────────────────────

export type SeekhoAccessResult =
  | { allowed: true }
  | { allowed: false; reason: "not_subscribed" | "wrong_class" | "not_logged_in" };

// ─── Cloud function payloads ──────────────────────────────────────────────────

export interface PracticeResultItem {
  courseId: string;
  questionId: string;
  conceptTag: string;
  correct: boolean;
  responseTimeMs: number;
}

export interface RazorpayPaymentResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

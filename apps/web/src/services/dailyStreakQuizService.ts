// PATH: apps/web/src/services/dailyStreakQuizService.ts
//
// Daily Streak Quiz — web service layer. Exact mirror of mobile
// services/dailyStreakQuizService.ts, adapted to this app's web Firestore
// import style (getFirestore() inline, per hooks/useVCoins.ts) and the
// shared `functions` export from lib/firebase.ts.
//
// SECURITY: same as mobile — answers are validated ONLY by the
// getTodaysStreakQuizQuestion / submitDailyStreakQuizAnswer Cloud
// Functions (functions/src/dailyStreakQuiz.ts). The client never has the
// correct option in memory before submitting.

import { functions } from "@/lib/firebase";
import { getAuth } from "firebase/auth";
import { doc, getFirestore, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

// ─── Types ──────────────────────────────────────────────────────────────────
// Mirrors mobile lib/dailyStreakQuiz/types.ts exactly.

export type DailyStreakQuizOption = "A" | "B" | "C" | "D";

export interface PublicDailyStreakQuizQuestion {
  questionId: string;
  date: string;
  subject: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  alreadySubmitted: boolean;
}

export interface DailyStreakProgress {
  currentStreak: number;
  weeklyProgress: number;
  completedWeeks: number;
  lastCompletedDate: string | null;
  ambassadorEligible: boolean;
  ambassadorAppliedAt?: unknown;
}

export interface DailyStreakQuizSubmitResult {
  isCorrect: boolean;
  correctOption: DailyStreakQuizOption;
  explanation: string;
  vCoinsAwarded: number;
  xpAwarded: number;
  streak: DailyStreakProgress;
  ambassadorEligible: boolean;
}

export const DAILY_STREAK_QUIZ_MAX_WEEKLY_PROGRESS = 7;
export const DAILY_STREAK_QUIZ_AMBASSADOR_WEEKS = 52;

// ─── Callable bindings ──────────────────────────────────────────────────────

const getTodaysStreakQuizQuestionCF = httpsCallable<
  Record<string, never>,
  PublicDailyStreakQuizQuestion | null
>(functions, "getTodaysStreakQuizQuestion");

const submitDailyStreakQuizAnswerCF = httpsCallable<
  { questionId: string; selectedOption: DailyStreakQuizOption },
  DailyStreakQuizSubmitResult
>(functions, "submitDailyStreakQuizAnswer");

const applyForAmbassadorProgramCF = httpsCallable<
  Record<string, never>,
  { success: boolean }
>(functions, "applyForAmbassadorProgram");

// ─── fetchTodaysStreakQuizQuestion ───────────────────────────────────────────
// Non-English students may hit a question that's never been shown in their
// language before — the server translates it on first request (see
// functions/src/dailyStreakQuiz.ts's getOrTranslateQuestion) and throws
// already-exists if another student's request is already translating the
// same (question, language) pair. Retry a few times rather than surfacing
// that as an error; a single-question translation is fast, so this should
// resolve within a couple of attempts.

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchTodaysStreakQuizQuestion(): Promise<PublicDailyStreakQuizQuestion | null> {
  const MAX_ATTEMPTS = 6;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const result = await getTodaysStreakQuizQuestionCF({});
      return result.data ?? null;
    } catch (err: any) {
      const code = String(err?.code ?? "");
      if (code.endsWith("already-exists") && attempt < MAX_ATTEMPTS - 1) {
        await sleep(2000);
        continue;
      }
      throw err;
    }
  }
  return null;
}

// ─── submitStreakQuizAnswer ──────────────────────────────────────────────────

export async function submitStreakQuizAnswer(
  questionId: string,
  selectedOption: DailyStreakQuizOption
): Promise<DailyStreakQuizSubmitResult> {
  const result = await submitDailyStreakQuizAnswerCF({ questionId, selectedOption });
  return result.data;
}

// ─── applyForAmbassadorProgram ───────────────────────────────────────────────

export async function applyForAmbassadorProgram(): Promise<void> {
  await applyForAmbassadorProgramCF({});
}

// ─── subscribeToStreakProgress ───────────────────────────────────────────────
// Real-time listener on studentDailyStreakProgress/{uid} — same collection
// the Cloud Function writes to, so the header updates the instant a
// submission commits, no page refresh needed.

export function subscribeToStreakProgress(
  callback: (progress: DailyStreakProgress | null) => void
): () => void {
  const uid = getAuth().currentUser?.uid;
  if (!uid) {
    callback(null);
    return () => {};
  }

  const db = getFirestore();
  return onSnapshot(
    doc(db, "studentDailyStreakProgress", uid),
    (snap) => {
      if (!snap.exists()) {
        callback({
          currentStreak: 0,
          weeklyProgress: 0,
          completedWeeks: 0,
          lastCompletedDate: null,
          ambassadorEligible: false,
        });
        return;
      }
      const d = snap.data();
      callback({
        currentStreak: d.currentStreak ?? 0,
        weeklyProgress: d.weeklyProgress ?? 0,
        completedWeeks: d.completedWeeks ?? 0,
        lastCompletedDate: d.lastCompletedDate ?? null,
        ambassadorEligible: d.ambassadorEligible ?? false,
        ambassadorAppliedAt: d.ambassadorAppliedAt,
      });
    },
    (err) => {
      console.error("[dailyStreakQuizService] progress snapshot error:", err);
      callback(null);
    }
  );
}

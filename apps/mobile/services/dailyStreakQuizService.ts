// PATH: services/dailyStreakQuizService.ts
//
// Daily Streak Quiz — client service layer.
//
// SECURITY: unlike services/submitContestQuiz.ts (which scores client-side),
// this feature validates answers ONLY on the server. The client never has
// the correct option in memory before submission — see
// getTodaysStreakQuizQuestion / submitDailyStreakQuizAnswer below, both
// Cloud Functions. This mirrors the existing claimVCoinReward pattern in
// hooks/useLearnFun.ts and lib/rewardService.ts, just with a richer payload.
//
// ⚡ CLOUD_FUNCTION_TODO (backend, not in this app's source tree — see
// docs/DAILY_STREAK_QUIZ_BACKEND.md for the full contract both callables
// must implement):
//   - getTodaysStreakQuizQuestion()
//   - submitDailyStreakQuizAnswer({ questionId, selectedOption })
// Both run with context.auth and read the student's class/language/uid from
// the authenticated token + their `students/{uid}` doc — never from
// client-supplied params — so a student cannot request another class's
// question or spoof who they're answering for.

import { functions } from "@/lib/firebase";
import {
  DailyStreakProgress,
  DailyStreakQuizDayRecord,
  DailyStreakQuizOption,
  DailyStreakQuizSubmitResult,
  PublicDailyStreakQuizQuestion,
} from "@/lib/dailyStreakQuiz/types";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

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

// ─── fetchTodaysQuestion ─────────────────────────────────────────────────────
// Resolves today's question for the signed-in student based on their class,
// preferred language, active status, and today's date — all looked up
// server-side from students/{uid}, never passed by the client.
// Returns null if no question is published for this student today.
//
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

// ─── submitAnswer ────────────────────────────────────────────────────────────
// One-shot: the server re-checks (a) the question is still today's question,
// (b) the student hasn't already submitted today, before scoring. A second
// call for the same day will reject with "already-exists" — callers should
// treat that the same as a successful first submission having already
// happened (re-sync from Firestore rather than show an error).

export async function submitStreakQuizAnswer(
  questionId: string,
  selectedOption: DailyStreakQuizOption
): Promise<DailyStreakQuizSubmitResult> {
  const result = await submitDailyStreakQuizAnswerCF({ questionId, selectedOption });
  return result.data;
}

// ─── applyForAmbassadorProgram ───────────────────────────────────────────────
// Records that the student tapped "Apply Now" once completedWeeks >= 52.
// Actual application review/processing is out of scope for this feature
// (per spec §7 — "Application functionality can be added later") — this
// just timestamps intent so admin can see who has applied.

export async function applyForAmbassadorProgram(): Promise<void> {
  await applyForAmbassadorProgramCF({});
}

// ─── subscribeToStreakProgress ───────────────────────────────────────────────
// Real-time listener on the student's rollup doc — drives the header stats
// (streak, weekly progress, completed weeks, ambassador eligibility) without
// needing a callable round-trip on every screen open.

export function subscribeToStreakProgress(
  callback: (progress: DailyStreakProgress | null) => void
): () => void {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    callback(null);
    return () => {};
  }

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

// ─── getTodayDayRecord (optional, used to confirm lock state on remount) ───
// Not subscribed in real time — the submit result + progress doc above are
// enough to drive the UI. Exposed for completeness / future debugging.

export function dayRecordPath(uid: string, dateStr: string) {
  return `studentDailyStreakProgress/${uid}/days/${dateStr}`;
}

export type { DailyStreakQuizDayRecord };

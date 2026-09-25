"use client";

// PATH: apps/web/src/services/submitContestQuiz.ts
// Mirrors mobile services/submitContestQuiz.ts — see that file's header
// comment for why this now calls the submitVidyastarContestQuiz Cloud
// Function instead of writing participant docs directly: firestore.rules
// only allows a user to update their OWN participant doc, but this needs
// to stamp EVERY participant's rank in one batch, which used to fail the
// whole batch (Firestore batches are all-or-nothing) on any contest with
// more than one participant.
//
// SECURITY (VidyaStar Phase 1): QuizAnswer intentionally has NO `correct`
// field — the client never determines or asserts answer correctness.
// Whether an answer was correct is graded server-side, from a private
// answer key the client never receives. `timeTakenSeconds` is an optional
// measured hint the server clamps to a sane range, never trusted outright.

import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

export interface QuizAnswer {
  questionIndex:    number;
  selectedIndex:    number | null;
  timeTakenSeconds?: number;
}

// VidyaStar Phase 2: no `rank` in the response anymore — see
// functions/src/submitVidyastarContestQuiz.ts's header comment. Rank is
// resolved separately (lib/contestLeaderboard.ts) by whichever screen
// needs it, never returned by the submission itself.
const submitVidyastarContestQuizCF = httpsCallable<
  { contestId: string; answers: QuizAnswer[] },
  { score: number }
>(functions, "submitVidyastarContestQuiz");

export async function submitContestQuiz(
  contestId: string,
  _userId: string,
  answers: QuizAnswer[]
): Promise<{ score: number }> {
  const { data } = await submitVidyastarContestQuizCF({ contestId, answers });
  return data;
}


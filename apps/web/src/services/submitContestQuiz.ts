"use client";

// PATH: apps/web/src/services/submitContestQuiz.ts
// Mirrors mobile services/submitContestQuiz.ts — see that file's header
// comment for why this now calls the submitVidyastarContestQuiz Cloud
// Function instead of writing participant docs directly: firestore.rules
// only allows a user to update their OWN participant doc, but this needs
// to stamp EVERY participant's rank in one batch, which used to fail the
// whole batch (Firestore batches are all-or-nothing) on any contest with
// more than one participant.

import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

export interface QuizAnswer {
  questionIndex: number;
  selectedIndex: number | null;
  correct: boolean;
  timeTakenSeconds: number;
}

const submitVidyastarContestQuizCF = httpsCallable<
  { contestId: string; answers: QuizAnswer[] },
  { score: number; rank: number }
>(functions, "submitVidyastarContestQuiz");

export async function submitContestQuiz(
  contestId: string,
  _userId: string,
  answers: QuizAnswer[]
): Promise<{ score: number; rank: number }> {
  const { data } = await submitVidyastarContestQuizCF({ contestId, answers });
  return data;
}


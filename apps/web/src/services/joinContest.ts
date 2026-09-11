"use client";

// PATH: apps/web/src/services/joinContest.ts
// Mirrors mobile services/joinContest.ts — see that file's header comment
// for why this now calls the joinVidyastarContest Cloud Function instead
// of writing the participant doc directly: firestore.rules used to let
// any signed-in client create that doc themselves with arbitrary field
// values (entryFeePaid: 0, sponsored: true, ...), bypassing the entry-fee
// check entirely. The Cloud Function does the balance check, debit,
// participant write, and joinedCount increment atomically server-side.

import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

export interface JoinableContest {
  id: string;
  title?: string;
  vCoinEntryFee?: number;
  isSponsored?: boolean;
  sponsorName?: string;
}

export type JoinContestResult =
  | { status: "joined"; feePaid: number }
  | { status: "already_joined" }
  | { status: "insufficient_balance"; required: number; balance: number };

const joinVidyastarContestCF = httpsCallable<{ contestId: string }, JoinContestResult>(
  functions,
  "joinVidyastarContest"
);

export async function joinContest(
  _userId: string,
  contest: JoinableContest
): Promise<JoinContestResult> {
  const { data } = await joinVidyastarContestCF({ contestId: contest.id });
  return data;
}

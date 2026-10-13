// PATH: apps/mobile/services/joinContest.ts
// Joining a VidyaStar contest costs V-Coins — set per-contest by admin
// (CreateContest.tsx's "V-Coins Entry Fee" field). A contest marked
// "Sponsored" in admin waives the fee entirely regardless of that value.
//
// FIX (production hardening): this used to check the balance and debit
// V-Coins client-side, then setDoc the participant doc directly — but
// firestore.rules let any signed-in user `create` that participant doc
// themselves with whatever field values they wanted (entryFeePaid: 0,
// sponsored: true, ...), completely bypassing this file. The check,
// debit, participant write, and contests/{id}.joinedCount increment now
// all happen atomically in the joinVidyastarContest Cloud Function
// (functions/src/vidyastarContest.ts); firestore.rules denies direct
// client `create` on the participant subcollection, so this callable is
// the only path to joining.
//
// Callers must branch on the returned status — a caller that only awaits
// this and moves on (the old contract) will silently let an unaffordable
// join fail without telling the student why. See vidyastar.tsx's
// handleJoin for the reference UI (shows the "earn more V-Coins" sheet on
// insufficient_balance).

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

"use client";

// PATH: apps/web/src/lib/contestLeaderboard.ts
// Mirrors mobile lib/contestLeaderboard.ts.
//
// VidyaStar Phase 2 — replaces the old "read every participant, sort
// client-side by a batch-rewritten rank field" pattern with a bounded,
// ordered, paginated Firestore query. See functions/src/
// contestLeaderboard.ts's header comment for the full architecture and
// functions/src/contestRankingPolicy.ts for why the Firestore-level
// orderBy only uses score + quizCompletedAt (both universally present,
// including on pre-Phase-1 historical docs) while correctAnswers is
// applied as an in-memory refinement to the fetched page only.

import { db } from "@/lib/firebase";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
  where,
} from "firebase/firestore";

export const LEADERBOARD_PAGE_SIZE = 50;

export interface LeaderboardRow {
  userId:          string;
  name:            string;
  score:           number;
  correctAnswers?: number;
  timeBonus?:      number;
  finalRank?:      number; // present only once the contest has been finalized
  rank?:           number; // legacy field — historical (pre-Phase-2) contests only
}

function toParticipantRow(id: string, data: any): LeaderboardRow {
  return {
    userId:         data.userId ?? id,
    name:           data.name ?? "Student",
    score:          data.score ?? 0,
    correctAnswers: typeof data.correctAnswers === "number" ? data.correctAnswers : undefined,
    timeBonus:      data.timeBonus ?? 0,
    finalRank:      typeof data.finalRank === "number" ? data.finalRank : undefined,
    rank:           typeof data.rank === "number" ? data.rank : undefined,
  };
}

// Refines ordering within exact-score ties using correctAnswers (missing
// on historical docs -> treated as 0). Never reorders across different
// scores — the Firestore-level order for those is already authoritative.
function refineByCorrectAnswers(rows: LeaderboardRow[]): LeaderboardRow[] {
  const out = [...rows];
  let start = 0;
  while (start < out.length) {
    let end = start + 1;
    while (end < out.length && out[end].score === out[start].score) end++;
    if (end - start > 1) {
      const slice = out.slice(start, end).sort((a, b) => (b.correctAnswers ?? 0) - (a.correctAnswers ?? 0));
      out.splice(start, end - start, ...slice);
    }
    start = end;
  }
  return out;
}

export interface LeaderboardPage {
  rows: LeaderboardRow[];
  cursor: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

/** Dynamic, bounded, paginated leaderboard query — for ACTIVE or
 *  not-yet-finalized contests. Never reads more than one page's worth of
 *  documents, regardless of how many students have completed the contest. */
export async function fetchLeaderboardPage(
  contestId: string,
  cursor: QueryDocumentSnapshot | null = null,
  pageSize: number = LEADERBOARD_PAGE_SIZE
): Promise<LeaderboardPage> {
  const base = query(
    collection(db, "contests", contestId, "participant"),
    where("completed", "==", true),
    orderBy("score", "desc"),
    orderBy("quizCompletedAt", "asc"),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize)
  );
  const snap = await getDocs(base);
  const rows = refineByCorrectAnswers(snap.docs.map((d) => toParticipantRow(d.id, d.data())));
  return {
    rows,
    cursor: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === pageSize,
  };
}

/** Finalized-contest leaderboard — ordered by the permanent finalRank,
 *  same bounded/paginated shape as the live query above. */
export async function fetchFinalizedLeaderboardPage(
  contestId: string,
  cursor: QueryDocumentSnapshot | null = null,
  pageSize: number = LEADERBOARD_PAGE_SIZE
): Promise<LeaderboardPage> {
  const base = query(
    collection(db, "contests", contestId, "participant"),
    where("completed", "==", true),
    orderBy("finalRank", "asc"),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize)
  );
  const snap = await getDocs(base);
  const rows = snap.docs.map((d) => toParticipantRow(d.id, d.data()));
  return {
    rows,
    cursor: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === pageSize,
  };
}

/** Live, approximate rank for a student in an ACTIVE (not yet finalized)
 *  contest — two bounded count() aggregation queries, never proportional
 *  to total participant count. This is explicitly a live/evolving
 *  estimate (matches the existing "rankings update as more students
 *  complete the quiz" framing) — it can undercount by the number of tied
 *  students who happen to be missing `correctAnswers` (pre-Phase-1
 *  historical participants mixed into an otherwise-still-active contest);
 *  the authoritative number is always the finalized `finalRank`. */
export async function fetchMyLiveRank(
  contestId: string,
  myScore: number,
  myCorrectAnswers: number
): Promise<number> {
  const participantsCol = collection(db, "contests", contestId, "participant");
  const higherScoreQ = query(participantsCol, where("completed", "==", true), where("score", ">", myScore));
  const tiedButMoreCorrectQ = query(
    participantsCol,
    where("completed", "==", true),
    where("score", "==", myScore),
    where("correctAnswers", ">", myCorrectAnswers)
  );
  const [aheadOnScore, tiedButAhead] = await Promise.all([
    getCountFromServer(higherScoreQ),
    getCountFromServer(tiedButMoreCorrectQ),
  ]);
  return aheadOnScore.data().count + tiedButAhead.data().count + 1;
}

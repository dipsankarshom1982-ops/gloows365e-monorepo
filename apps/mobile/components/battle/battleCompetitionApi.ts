// PATH: components/battle/battleCompetitionApi.ts
//
// Phase 2D-5 — Competition + Live/Final Leaderboard: thin, typed wrappers
// around Phase 2C's ACTUAL battle-engine APIs (verified against
// functions/src/battleRanking.ts and functions/src/battleEngagement.ts
// before writing this file — nothing here is a guessed signature).
//
// This is the ONE place battle-competition.tsx talks to the backend, same
// posture as fetchMySubmissionStatus.ts / resolveBattleExperience.ts for
// the rest of this feature — no rank/score/order is computed here, only
// passed through from the server response.
//
// IMPORTANT — what the real APIs do NOT return (verified, not assumed):
//   - getBattleLeaderboardPage's LIVE branch (battle not yet RESULT_LOCKED)
//     returns only {studentId, submissionId, score} per entry — no `rank`
//     field. A client computing `rank = index + 1` from that would be
//     exactly the forbidden client-side ranking the Phase 2D-5 brief §8
//     calls out by name. This file deliberately does NOT add one — see
//     battle-competition.tsx for how the UI stays honest about that gap
//     (authoritative per-student rank still comes from getMyBattleRank,
//     which DOES compute rank server-side, for both LIVE and FINAL).
//   - Neither branch returns per-entry verifiedLikes/verifiedViews (the
//     FINAL branch's battleResults entries only carry a combined
//     `rawEngagement` count — confirmed by reading battleFinalization.ts's
//     actual write, which never copies the split counts into the locked
//     doc even though the live battleScoreEntries source has them). This
//     file does not invent a split that isn't there.

import { db, functions } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

// ─── getMyBattleRank ─────────────────────────────────────────────────────
export interface MyBattleRank {
  final: boolean;
  score: number;
  rank: number; // 0 = the student has no ranked (approved) entry in this battle — never invent a nonzero rank when this is 0
  isWinner: boolean;
  totalParticipants: number;
}

export async function fetchMyBattleRank(battleId: string): Promise<MyBattleRank> {
  const res = await httpsCallable<{ battleId: string }, MyBattleRank>(
    functions,
    "getMyBattleRank"
  )({ battleId });
  return res.data;
}

// ─── getBattleLeaderboardPage ───────────────────────────────────────────
export interface LeaderboardEntry {
  studentId: string;
  submissionId: string;
  score: number;
  // Present ONLY when the page result's `final` is true (straight from the
  // locked battleResults doc) — see this file's header.
  rank?: number;
  isWinner?: boolean;
  rawEngagement?: number;
}

export interface LeaderboardPage {
  final: boolean;
  entries: LeaderboardEntry[];
  nextCursor: string | null;
}

export async function fetchLeaderboardPage(
  battleId: string,
  cursorStudentId: string | null,
  pageSize = 20
): Promise<LeaderboardPage> {
  const res = await httpsCallable<
    { battleId: string; pageSize?: number; cursorStudentId?: string },
    LeaderboardPage
  >(functions, "getBattleLeaderboardPage")({
    battleId,
    pageSize,
    ...(cursorStudentId ? { cursorStudentId } : {}),
  });
  return res.data;
}

// ─── engageBattleSubmission ─────────────────────────────────────────────
export interface EngagementResult {
  recorded: boolean;
  alreadyEngaged: boolean;
}

export async function likeSubmission(submissionId: string): Promise<EngagementResult> {
  const res = await httpsCallable<
    { submissionId: string; type: "like" | "view" },
    EngagementResult
  >(functions, "engageBattleSubmission")({ submissionId, type: "like" });
  return res.data;
}

// ─── Display metadata — direct, bounded, authoritative Firestore reads ──
// The ranking API above never returns media/identity fields (it only
// knows studentId/submissionId/score/rank) — that data lives on the
// submission doc itself. Reading it directly, bounded to exactly the
// entries on the current page (<=50 per fetchLeaderboardPage's own cap),
// is the same established pattern as fetchMySubmissionStatus.ts, not a
// new architecture and not a duplicate ranking system — the order/score/
// rank themselves always come from the calls above, never from this read.

export interface SubmissionDisplay {
  studentName: string;
  studentClass: string;
  skillId?: string;
  title: string;
  description: string;
  mediaRef: string;
}

export async function fetchSubmissionDisplay(submissionId: string): Promise<SubmissionDisplay | null> {
  const snap = await getDoc(doc(db, "submissions", submissionId));
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  return {
    studentName: typeof d.studentName === "string" && d.studentName ? d.studentName : "Student",
    studentClass: typeof d.studentClass === "string" ? d.studentClass : "",
    skillId: typeof d.skillId === "string" ? d.skillId : undefined,
    title: typeof d.title === "string" ? d.title : "",
    description: typeof d.description === "string" ? d.description : "",
    mediaRef: typeof d.mediaRef === "string" ? d.mediaRef : "",
  };
}

// Has the current student already liked this submission? A direct,
// deterministic-ID read of their OWN authoritative engagement fact
// (submissions/{id}/engagements/like_{uid}) — not a count, not a computed
// value, just "does this one fact-document exist."
export async function fetchMyLikeState(submissionId: string, uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, "submissions", submissionId, "engagements", `like_${uid}`));
  return snap.exists();
}

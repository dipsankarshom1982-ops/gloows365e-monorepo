// PATH: functions/src/battleRanking.ts
//
// Phase 2C — Battle Engine: authoritative, battle-scoped, scalable
// ranking. Replaces the read-amplification pattern the original audit
// flagged (SB-P1-01) and that Phase 1 deliberately deferred — for THIS
// engine (not the legacy posts-based one, which is unchanged) there is no
// client-side full-collection scan anywhere in this file:
//
//   - "my rank"        → one doc read + two count() aggregations, O(1)
//                         regardless of how many students are in the battle
//   - "leaderboard page" → one cursor-paginated query, O(page size)
//   - "top N"            → the same paginated query, first page
//
// No Redis, no scheduled recompute job. Firestore's native count()
// aggregation and cursor pagination already satisfy the Phase 2A
// blueprint's §12/§18 requirements at the scales this phase targets
// (documented with numbers in the Phase 2C report's Performance
// Findings) — introducing a cache layer now would be exactly the
// "cache technology unless justified" the brief warns against.
//
// LIVE vs FINAL ranking (§19): everything in this file computes LIVE,
// provisional rank — ties share a rank (standard "competition ranking":
// two students both at rank 3 skip rank 4), which is fine for a
// leaderboard that's still moving. The DEFINITIVE, tie-broken,
// zero-duplicate-rank result only exists after battleFinalization.ts's
// finalizeBattleResults runs and writes the immutable battleResults doc —
// once a battle is locked, the callables below switch to reading THAT
// instead of recomputing live (see getMyBattleRank/getBattleLeaderboardPage).

import * as admin from "firebase-admin";
import {
  Change,
  DocumentSnapshot,
  FirestoreEvent,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
import * as functionsV1 from "firebase-functions/v1";
import { calculateSubmissionScore, DEFAULT_SCORING_PROFILE, type ScoringProfile } from "./battleScoring";

const db = admin.firestore();

interface SubmissionDoc {
  studentId?: string;
  battleId?: string;
  status?: string;
  approvedAt?: admin.firestore.Timestamp | null;
}
interface SkillBattleDoc {
  state?: string;
  scoringProfile?: Partial<ScoringProfile>;
}
interface BattleResultsDoc {
  entries: Array<{ studentId: string; submissionId: string; score: number; rank: number; isWinner: boolean }>;
  status: string;
}

// ─── Shared recompute logic ─────────────────────────────────────────────────
// Called by both triggers below (a submission's status changing, or one of
// its engagements being recorded) — same "recompute this one submission's
// score/entry" operation regardless of which write caused it, mirroring
// Phase 1's updateSkillboard pattern.
export async function recomputeSubmissionScore(submissionId: string): Promise<void> {
  const submissionRef = db.doc(`submissions/${submissionId}`);
  const submissionSnap = await submissionRef.get();
  if (!submissionSnap.exists) return;
  const submission = submissionSnap.data() as SubmissionDoc;
  if (!submission.battleId || !submission.studentId) return;

  const entryRef = db.doc(`battleScoreEntries/${submission.battleId}_${submission.studentId}`);

  const battleSnap = await db.doc(`skillBattles/${submission.battleId}`).get();
  const battle = battleSnap.exists ? (battleSnap.data() as SkillBattleDoc) : null;

  // RESULT LOCK ENFORCEMENT (Phase 2C brief §22, mandatory): once a battle
  // has left RANKING_FINALIZATION on its way to/through RESULT_LOCKED, live
  // score entries are frozen — no normal application path (a late
  // moderation decision, a stray engagement write) may alter them. This is
  // the enforcement half; battleFinalization.ts's transition into
  // RESULT_LOCKED is the other half.
  const FROZEN_STATES = new Set(["RESULT_LOCKED", "WINNERS_ANNOUNCED", "AWARDS_PROCESSING", "COMPLETED", "CANCELLED"]);
  if (battle && FROZEN_STATES.has(battle.state ?? "")) {
    return;
  }

  if (submission.status !== "APPROVED") {
    // Not (or no longer) eligible — remove any stale entry rather than
    // leaving a score around for a rejected/removed/withdrawn submission.
    await entryRef.delete().catch(() => {});
    return;
  }

  const engagementsRef = submissionRef.collection("engagements");
  const [likeCount, viewCount] = await Promise.all([
    engagementsRef.where("type", "==", "like").count().get(),
    engagementsRef.where("type", "==", "view").count().get(),
  ]);
  const verifiedLikes = likeCount.data().count;
  const verifiedViews = viewCount.data().count;

  const profile: ScoringProfile = { ...DEFAULT_SCORING_PROFILE, ...(battle?.scoringProfile ?? {}) };
  const score = calculateSubmissionScore({ verifiedLikes, verifiedViews, isApproved: true }, profile);

  const approvedAtMillis = submission.approvedAt?.toMillis?.() ?? Date.now();

  await entryRef.set({
    battleId: submission.battleId,
    studentId: submission.studentId,
    submissionId,
    verifiedLikes,
    verifiedViews,
    rawEngagement: verifiedLikes + verifiedViews,
    score,
    approvedAtMillis,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ─── Triggers ────────────────────────────────────────────────────────────────

export const onBattleSubmissionWritten = onDocumentWritten(
  { document: "submissions/{submissionId}" },
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { submissionId: string }>) => {
    if (!event.data) return null;
    await recomputeSubmissionScore(event.params.submissionId);
    return null;
  }
);

export const onBattleEngagementWritten = onDocumentWritten(
  { document: "submissions/{submissionId}/engagements/{engagementId}" },
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { submissionId: string; engagementId: string }>) => {
    if (!event.data) return null;
    await recomputeSubmissionScore(event.params.submissionId);
    return null;
  }
);

// ─── getMyBattleRank ─────────────────────────────────────────────────────────
export const getMyBattleRank = functionsV1
  .runWith({ timeoutSeconds: 15, memory: "128MB" })
  .https.onCall(async (data: { battleId?: string }, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const { battleId } = data ?? {};
    if (!battleId || typeof battleId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "battleId is required");
    }

    // Post-lock: the definitive, tie-broken rank lives in battleResults —
    // read that instead of recomputing from (frozen but tie-unaware) live
    // score entries.
    const resultsSnap = await db.doc(`battleResults/${battleId}`).get();
    if (resultsSnap.exists) {
      const results = resultsSnap.data() as BattleResultsDoc;
      const mine = results.entries.find((e) => e.studentId === uid);
      return {
        final: true,
        score: mine?.score ?? 0,
        rank: mine?.rank ?? 0,
        isWinner: mine?.isWinner ?? false,
        totalParticipants: results.entries.length,
      };
    }

    const entriesRef = db.collection("battleScoreEntries");
    const mySnap = await db.doc(`battleScoreEntries/${battleId}_${uid}`).get();
    const myScore = mySnap.exists ? ((mySnap.data()?.score as number) ?? 0) : 0;

    const [higherCount, totalCount] = await Promise.all([
      mySnap.exists
        ? entriesRef.where("battleId", "==", battleId).where("score", ">", myScore).count().get()
        : Promise.resolve(null),
      entriesRef.where("battleId", "==", battleId).count().get(),
    ]);

    return {
      final: false,
      score: myScore,
      rank: mySnap.exists ? (higherCount!.data().count + 1) : 0,
      isWinner: false,
      totalParticipants: totalCount.data().count,
    };
  });

// ─── getBattleLeaderboardPage ───────────────────────────────────────────────
export const getBattleLeaderboardPage = functionsV1
  .runWith({ timeoutSeconds: 15, memory: "128MB" })
  .https.onCall(async (data: { battleId?: string; pageSize?: number; cursorStudentId?: string }, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const { battleId } = data ?? {};
    if (!battleId || typeof battleId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "battleId is required");
    }
    const pageSize = Math.min(Math.max(data?.pageSize ?? 20, 1), 50);

    const resultsSnap = await db.doc(`battleResults/${battleId}`).get();
    if (resultsSnap.exists) {
      const results = resultsSnap.data() as BattleResultsDoc;
      const sorted = [...results.entries].sort((a, b) => a.rank - b.rank);
      const startIdx = data?.cursorStudentId
        ? sorted.findIndex((e) => e.studentId === data.cursorStudentId) + 1
        : 0;
      const page = sorted.slice(startIdx, startIdx + pageSize);
      return {
        final: true,
        entries: page,
        nextCursor: page.length === pageSize ? page[page.length - 1].studentId : null,
      };
    }

    // Single-field cursor (score only) — simpler than a compound
    // score+studentId cursor, at the cost of a rare theoretical edge case:
    // if many entries tie on the exact score at a page boundary, a page
    // split could show/skip one of them inconsistently across requests.
    // Accepted for V1; worth revisiting with a compound cursor if ties at
    // scale ever make this a real product issue rather than a documented
    // edge case.
    let query = db.collection("battleScoreEntries")
      .where("battleId", "==", battleId)
      .orderBy("score", "desc");
    if (data?.cursorStudentId) {
      const cursorSnap = await db.doc(`battleScoreEntries/${battleId}_${data.cursorStudentId}`).get();
      if (cursorSnap.exists) {
        query = query.startAfter(cursorSnap.data()!.score);
      }
    }
    const snap = await query.limit(pageSize).get();
    const entries = snap.docs.map((d) => {
      const e = d.data();
      return { studentId: e.studentId, submissionId: e.submissionId, score: e.score };
    });
    return {
      final: false,
      entries,
      nextCursor: entries.length === pageSize ? entries[entries.length - 1].studentId : null,
    };
  });

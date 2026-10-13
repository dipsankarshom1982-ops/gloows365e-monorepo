// PATH: functions/src/battleFinalization.ts
//
// Phase 2C — Battle Engine: result finalization + RESULT_LOCKED
// enforcement + winner resolution (brief §20-23).
//
// finalizeBattleResults is idempotent by construction: battleResults/
// {battleId} is checked for existence as the FIRST read of the
// transaction, and if it already has status:"locked", the function
// returns that existing document untouched — no second computation, no
// second set of writes, no second SkillBoard application. Calling it
// twice (a retry, a double-click on an admin button, a network resend)
// produces exactly one result, not two.
//
// ATOMICITY, HONESTLY STATED: for battles with <=100 finalized entries,
// the entire operation — reading every battleScoreEntries doc, writing
// the immutable battleResults doc, locking skillBattles.state, AND
// applying SkillBoard points/achievements for every entrant — happens in
// ONE Firestore transaction (safely within its 500-write cap: 1 results
// doc + 1 state update + 1 stateTransitions entry + up to 100 * ~3
// SkillBoard writes ≈ 303 writes). For battles LARGER than that, the
// core (results + lock) still happens in one transaction, but SkillBoard
// integration runs as a best-effort batched follow-up immediately after
// — NOT part of the same atomic operation. A failure in that follow-up
// step leaves the battle correctly RESULT_LOCKED with a fully correct,
// reward-claimable battleResults doc, but SkillBoard points for that
// battle could need a manual retry. This is a documented, bounded
// limitation (see the Phase 2C report's Performance Findings /
// Remaining Risks), not a silent gap.

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { compareEntries, type RankableEntry } from "./battleScoring";
import { buildSkillBoardWrites, type FinalizedEntry } from "./battleSkillboardIntegration";
import { canTransition, isValidBattleState, type BattleState } from "./skillBattleDomain";

const db = admin.firestore();

const ATOMIC_ENTRY_LIMIT = 100;

interface SkillBattleDoc {
  state?: string;
  skillId?: string;
  winnerCount?: number;
}
interface ScoreEntryDoc {
  studentId: string;
  submissionId: string;
  score: number;
  rawEngagement: number;
  approvedAtMillis: number;
}
interface BattleResultsDoc {
  battleId: string;
  finalizedAt: admin.firestore.FieldValue;
  scoringVersion: number;
  winnerCount: number;
  entries: Array<FinalizedEntry & { verifiedLikes?: number; verifiedViews?: number; rawEngagement: number; approvedAtMillis: number }>;
  status: "locked";
}

export const finalizeBattleResults = functionsV1
  .runWith({ timeoutSeconds: 120, memory: "256MB" })
  .https.onCall(async (data: { battleId?: string }, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    if (context.auth.token.admin !== true) {
      throw new functionsV1.https.HttpsError("permission-denied", "Admin only");
    }
    const { battleId } = data ?? {};
    if (!battleId || typeof battleId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "battleId is required");
    }

    const battleRef = db.doc(`skillBattles/${battleId}`);
    const resultsRef = db.doc(`battleResults/${battleId}`);

    // ── Phase 1 of 2: the atomic core (idempotency check, compute, lock) ──
    const outcome = await db.runTransaction(async (tx) => {
      const [battleSnap, resultsSnap, entriesSnap] = await Promise.all([
        tx.get(battleRef),
        tx.get(resultsRef),
        tx.get(db.collection("battleScoreEntries").where("battleId", "==", battleId)),
      ]);

      if (resultsSnap.exists && (resultsSnap.data() as BattleResultsDoc).status === "locked") {
        return { alreadyFinalized: true, results: resultsSnap.data() as BattleResultsDoc, wroteSkillBoardInline: false };
      }

      if (!battleSnap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "This battle does not exist.");
      }
      const battle = battleSnap.data() as SkillBattleDoc;
      const currentState = battle.state;
      if (!isValidBattleState(currentState) || !canTransition(currentState, "RESULT_LOCKED")) {
        throw new functionsV1.https.HttpsError(
          "failed-precondition",
          `Battle must be in RANKING_FINALIZATION to finalize (current: ${currentState ?? "unmanaged"}).`
        );
      }
      if (!battle.skillId) {
        throw new functionsV1.https.HttpsError("failed-precondition", "Battle has no skillId — cannot apply SkillBoard integration.");
      }

      // ── Compute deterministic ranking (full tie-break chain, §11's
      // "reproducible from authoritative data") ──
      const rawEntries: ScoreEntryDoc[] = entriesSnap.docs.map((d) => d.data() as ScoreEntryDoc);
      const rankable: RankableEntry[] = rawEntries.map((e) => ({
        studentId: e.studentId, score: e.score, rawEngagement: e.rawEngagement, approvedAt: e.approvedAtMillis,
      }));
      rankable.sort(compareEntries);

      const winnerCount = battle.winnerCount ?? 3;
      const finalizedEntries: FinalizedEntry[] = rankable.map((r, i) => {
        const src = rawEntries.find((e) => e.studentId === r.studentId)!;
        const rank = i + 1;
        return { studentId: r.studentId, submissionId: src.submissionId, score: r.score, rank, isWinner: rank <= winnerCount };
      });

      const now = admin.firestore.FieldValue.serverTimestamp();
      const resultsDoc: BattleResultsDoc = {
        battleId, finalizedAt: now, scoringVersion: 1, winnerCount,
        entries: finalizedEntries.map((e) => {
          const src = rawEntries.find((r) => r.studentId === e.studentId)!;
          return { ...e, rawEngagement: src.rawEngagement, approvedAtMillis: src.approvedAtMillis };
        }),
        status: "locked",
      };
      tx.set(resultsRef, resultsDoc);

      // State transition — inline (not via the transitionBattleState
      // callable, to stay within this one transaction) but using the SAME
      // graph-validated logic, imported not re-implemented.
      tx.update(battleRef, { state: "RESULT_LOCKED" as BattleState, updatedAt: now });
      tx.set(battleRef.collection("stateTransitions").doc(), {
        fromState: currentState, toState: "RESULT_LOCKED",
        actorUid: context.auth!.uid, createdAt: now,
      });

      let wroteSkillBoardInline = false;
      if (finalizedEntries.length <= ATOMIC_ENTRY_LIMIT) {
        for (const entry of finalizedEntries) {
          for (const w of buildSkillBoardWrites(battleId, battle.skillId, entry)) {
            tx.set(w.ref, w.data, { merge: w.merge });
          }
        }
        wroteSkillBoardInline = true;
      }

      return { alreadyFinalized: false, results: resultsDoc, wroteSkillBoardInline, skillId: battle.skillId, entries: finalizedEntries };
    });

    if (outcome.alreadyFinalized) {
      return { alreadyFinalized: true, entries: outcome.results.entries };
    }

    // ── Phase 2 of 2 (large battles only): best-effort SkillBoard batch ──
    if (!outcome.wroteSkillBoardInline) {
      const CHUNK = 150;
      for (let i = 0; i < outcome.entries!.length; i += CHUNK) {
        const chunk = outcome.entries!.slice(i, i + CHUNK);
        const batch = db.batch();
        for (const entry of chunk) {
          for (const w of buildSkillBoardWrites(battleId, outcome.skillId!, entry)) {
            batch.set(w.ref, w.data, { merge: w.merge });
          }
        }
        await batch.commit();
      }
    }

    console.log(`✅ Battle finalized: battle=${battleId} entries=${outcome.results.entries.length} inlineSkillBoard=${outcome.wroteSkillBoardInline}`);
    return { alreadyFinalized: false, entries: outcome.results.entries };
  });

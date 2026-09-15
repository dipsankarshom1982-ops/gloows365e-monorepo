// PATH: functions/src/battleRewards.ts
//
// Phase 2C — Battle Engine: reward integration for the NEW canonical
// engine (§24-25). V1 reward mechanism is VCoins only, per this phase's
// locked Decision 2 — no cash/physical payout processing here. Reuses
// Phase 1's proven primitives (creditVCoinsBalance, VCOIN_DIST_PCT) and
// its exact reserve-before-credit idempotency pattern
// (claimSkillBattleReward, functions/src/vcoins.ts) rather than
// reinventing either — this is a SEPARATE collection (battleAwards, not
// skillBattleAwards) and a SEPARATE callable from the legacy flow, since
// the two engines' data models (single scope + single vcoinsPool here vs.
// four simultaneous scopes there) are genuinely different, not just
// renamed — see the Phase 2C report's Legacy Compatibility section for
// why they stay parallel rather than merged.
//
// The client provides ONLY battleId. Rank, reward-pool amount, and the
// credited total are all resolved server-side from the immutable,
// already-locked battleResults doc and the battle's own configured
// vcoinsPool — never from the request payload, same posture as
// claimSkillBattleReward.

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { creditVCoinsBalance, getSkillBattleCoinForRank } from "./vcoins";

const db = admin.firestore();

interface BattleResultsDoc {
  status: string;
  entries: Array<{ studentId: string; rank: number; isWinner: boolean }>;
}
interface SkillBattleDoc {
  vcoinsPool?: number;
}

export const claimBattleReward = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "128MB" })
  .https.onCall(async (data: { battleId?: string }, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const { battleId } = data ?? {};
    if (!battleId || typeof battleId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "battleId is required");
    }

    const [resultsSnap, battleSnap] = await Promise.all([
      db.doc(`battleResults/${battleId}`).get(),
      db.doc(`skillBattles/${battleId}`).get(),
    ]);

    if (!resultsSnap.exists || (resultsSnap.data() as BattleResultsDoc).status !== "locked") {
      throw new functionsV1.https.HttpsError(
        "failed-precondition",
        "Results for this battle have not been finalized yet."
      );
    }
    const results = resultsSnap.data() as BattleResultsDoc;
    const myEntry = results.entries.find((e) => e.studentId === uid);

    if (!myEntry) {
      return { totalCredited: 0, alreadyClaimed: false };
    }

    const vcoinsPool = battleSnap.exists ? ((battleSnap.data() as SkillBattleDoc).vcoinsPool ?? 0) : 0;
    const coins = getSkillBattleCoinForRank(vcoinsPool, myEntry.rank);

    const awardRef = db.doc(`battleAwards/${battleId}_${uid}`);

    const reservation = await db.runTransaction(async (tx) => {
      const existing = await tx.get(awardRef);
      if (existing.exists) {
        return { alreadyReserved: true, data: existing.data() };
      }
      tx.set(awardRef, {
        battleId, uid, rank: myEntry.rank, isWinner: myEntry.isWinner,
        vcoinsPool, coins,
        status: "reserved",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { alreadyReserved: false, data: { coins } };
    });

    if (reservation.alreadyReserved) {
      const existing = reservation.data as { coins?: number } | undefined;
      return { totalCredited: existing?.coins ?? 0, alreadyClaimed: true };
    }

    let totalCredited = 0;
    if (coins > 0) {
      const result = await creditVCoinsBalance({
        uid, amount: coins, source: "BATTLE_ENGINE_REWARD",
        title: `Skill Battle · Rank #${myEntry.rank}`,
        description: `Battle ${battleId} — rank #${myEntry.rank}`,
        referenceId: `${battleId}_reward`,
        metadata: { battleId, rank: myEntry.rank, isWinner: myEntry.isWinner },
        bypassDailyLimit: true, // one-time battle prize, not a repeatable daily source — see vcoins.ts's doc comment
      });
      if (result.credited) totalCredited = result.amount;
    }

    await awardRef.set({ status: "credited", creditedAt: admin.firestore.FieldValue.serverTimestamp(), totalCredited }, { merge: true });

    console.log(`✅ Battle engine reward claimed: uid=${uid} battle=${battleId} rank=${myEntry.rank} credited=${totalCredited}`);
    return { totalCredited, alreadyClaimed: false };
  });

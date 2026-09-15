// PATH: functions/src/aiGuruCreditDebit.ts
// Atomic, server-side debit/refund for AI Guru's pay-as-you-go credit
// balance (aiGuruCredits/{uid}). Kept separate from aiGuruCredits.ts (the
// purchase/Razorpay flow) so feature files that only need to *spend*
// credits — photoSolve.ts, examSimulator.ts, voiceTutor.ts, etc. — don't
// transitively pull axios into their cold-start path.
//
// tryDebitAiGuruCredit() adapts vidyastarContest.ts's joinVidyastarContest
// transaction almost line-for-line: read balance, check, debit, write a
// ledger doc, all inside one db.runTransaction so a double-tap (or two
// concurrent requests racing on the same low balance) can't double-charge.
// Returns {ok:false, reason:"insufficient"} rather than throwing — same
// idiom as joinVidyastarContest's insufficient_balance return — so callers
// can distinguish "can't pay" from "something broke" and message the user
// accordingly, instead of a generic 500.
//
// Credits get a server-only debit path from day one — unlike VCoins
// originally did (apps/mobile/services/vCoinsService.ts's creditVCoins/
// debitVCoins ran from the client and admitted as much in their own
// comments; since migrated to functions/src/vcoins.ts's
// "vCoinsBalance crediting (security migration)" section).

import * as admin from "firebase-admin";
import { getRedis, RK, TTL } from "./redish";

export type AiGuruCreditFeature =
  | "ASK_GURU"
  | "VIDYAGURU"
  | "DISCOVER"
  | "PHOTOSOLVE"
  | "EXAM_SIMULATOR"
  | "VOICE_TUTOR"
  | "LESSON_GENERATION"
  | "LESSON_FOLLOWUP";

export type CreditDebitResult =
  | { ok: true; charged: number; balanceAfter: number; txId: string }
  | { ok: false; reason: "insufficient"; balance: number; required: number }
  | { ok: false; reason: "disabled" };

const DEFAULT_COST_PER_ACTION = 1;

// ─── Cost per action ────────────────────────────────────────────────────────
// Redis-cached for a few minutes; always falls back to the Firestore doc
// (or the hardcoded default if that doc doesn't exist yet either). This is
// display/fast-path only — the debit transaction below always re-reads the
// real balance from Firestore, so a stale cached cost can, at worst, quote
// a slightly-out-of-date price; it can never authorize an over-spend.

export async function getCreditCostPerAction(
  db: admin.firestore.Firestore
): Promise<number> {
  const key = RK.aiGuruCreditCost();
  try {
    const cached = await getRedis().get<number>(key);
    if (cached !== null) return cached;
  } catch { /* Redis unavailable */ }

  try {
    const snap = await db.doc("aiGuruCreditConfig/settings").get();
    const cost = snap.exists && typeof snap.data()?.costPerAction === "number"
      ? snap.data()!.costPerAction
      : DEFAULT_COST_PER_ACTION;
    getRedis().set(key, cost, { ex: TTL.aiGuruCreditCost }).catch(() => {});
    return cost;
  } catch {
    return DEFAULT_COST_PER_ACTION;
  }
}

async function isCreditSystemEnabled(db: admin.firestore.Firestore): Promise<boolean> {
  try {
    const snap = await db.doc("aiGuruCreditConfig/settings").get();
    // Enabled by default until admin explicitly turns it off — matches how
    // every other feature in this app behaves absent an admin config doc.
    return snap.exists ? snap.data()?.enabled !== false : true;
  } catch {
    return true;
  }
}

// ─── Debit ──────────────────────────────────────────────────────────────────

export async function tryDebitAiGuruCredit(
  uid: string,
  feature: AiGuruCreditFeature,
  db: admin.firestore.Firestore,
  opts?: { requestId?: string; metadata?: Record<string, unknown> }
): Promise<CreditDebitResult> {
  if (!(await isCreditSystemEnabled(db))) {
    return { ok: false, reason: "disabled" };
  }

  const cost = await getCreditCostPerAction(db);
  const balanceRef = db.doc(`aiGuruCredits/${uid}`);
  // Idempotency: a client-supplied requestId makes the ledger doc ID
  // deterministic, so a retried request (e.g. a client timeout-and-retry)
  // can't charge twice for the same logical action.
  const txId = opts?.requestId ? `${feature}_${opts.requestId}` : db.collection("_").doc().id;
  const txRef = balanceRef.collection("transactions").doc(txId);

  const result = await db.runTransaction(async (tx) => {
    if (opts?.requestId) {
      const existing = await tx.get(txRef);
      if (existing.exists) {
        const balSnap = await tx.get(balanceRef);
        return {
          ok: true as const,
          charged: cost,
          balanceAfter: balSnap.exists ? (balSnap.data()?.balance ?? 0) : 0,
          txId,
        };
      }
    }

    const balSnap = await tx.get(balanceRef);
    const balance = balSnap.exists ? (balSnap.data()?.balance ?? 0) : 0;

    if (balance < cost) {
      return { ok: false as const, reason: "insufficient" as const, balance, required: cost };
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    tx.set(balanceRef, {
      balance:       admin.firestore.FieldValue.increment(-cost),
      lifetimeSpent: admin.firestore.FieldValue.increment(cost),
      updatedAt:     now,
    }, { merge: true });

    tx.set(txRef, {
      type:        "DEBIT",
      amount:      cost,
      source:      feature,
      title:       `AI Guru — ${feature}`,
      description: `${cost} credit${cost === 1 ? "" : "s"} used for ${feature.replace(/_/g, " ").toLowerCase()}`,
      status:      "SUCCESS",
      referenceId: opts?.requestId ?? null,
      metadata:    opts?.metadata ?? {},
      createdAt:   now,
      updatedAt:   now,
    });

    return { ok: true as const, charged: cost, balanceAfter: balance - cost, txId };
  });

  return result;
}

// ─── Refund ─────────────────────────────────────────────────────────────────
// Charge-before-call, refund-on-failure: debiting only after a successful
// Gemini call would open a window where two concurrent requests both pass
// the balance check before either one's debit lands. Debit first (above),
// refund here if the downstream call then fails, so a genuine failure never
// costs the student a credit.

export async function refundAiGuruCredit(
  uid: string,
  originalTxId: string,
  feature: AiGuruCreditFeature,
  db: admin.firestore.Firestore
): Promise<void> {
  const balanceRef = db.doc(`aiGuruCredits/${uid}`);
  const originalTxRef = balanceRef.collection("transactions").doc(originalTxId);
  const refundTxRef = balanceRef.collection("transactions").doc(`${originalTxId}_refund`);

  try {
    await db.runTransaction(async (tx) => {
      const originalSnap = await tx.get(originalTxRef);
      if (!originalSnap.exists || originalSnap.data()?.status === "REVERSED") return; // already refunded / nothing to refund
      const refundSnap = await tx.get(refundTxRef);
      if (refundSnap.exists) return; // already refunded (idempotent)

      const amount = originalSnap.data()?.amount ?? 0;
      const now = admin.firestore.FieldValue.serverTimestamp();

      tx.update(balanceRef, {
        balance:       admin.firestore.FieldValue.increment(amount),
        lifetimeSpent: admin.firestore.FieldValue.increment(-amount),
        updatedAt:     now,
      });
      tx.update(originalTxRef, { status: "REVERSED", updatedAt: now });
      tx.set(refundTxRef, {
        type:        "CREDIT",
        amount,
        source:      "REFUND",
        title:       "AI Guru — Refund",
        description: `Refund for a failed ${feature.replace(/_/g, " ").toLowerCase()} request`,
        status:      "SUCCESS",
        referenceId: originalTxId,
        metadata:    { refundedFeature: feature },
        createdAt:   now,
        updatedAt:   now,
      });
    });
  } catch (e) {
    // Never let a refund failure mask the original error the caller is
    // already handling — log and move on. Worst case, support can manually
    // credit back from the ledger, which still shows the DEBIT clearly.
    console.error(`refundAiGuruCredit failed (uid=${uid}, tx=${originalTxId}, feature=${feature}):`, e);
  }
}

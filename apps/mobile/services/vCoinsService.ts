// services/vCoinsService.ts
// V-Coins service layer — READ-ONLY now. All balance-mutating logic
// (creditVCoins, debitVCoins, rewardForWatchCompletion, rewardForAppTime,
// rewardForSkillBattleWin, claimSkillBattleRewards) has been migrated to
// Cloud Functions in functions/src/vcoins.ts (creditSignupBonus,
// creditWatchReward, claimSkillBattleReward) — call those via
// httpsCallable() instead. This file used to run all of that via the
// Firestore client SDK directly, which meant it was only ever as safe as
// firestore.rules made it: the users/{userId} update rule protected
// vCoins/vCoinsLifetimeEarned/etc. but never vCoinsBalance — the field
// this pipeline actually incremented — so any signed-in user could set
// their own vCoinsBalance to an arbitrary number with a direct Firestore
// write, bypassing every daily-limit/duplicate check below entirely. See
// firestore.rules' users/{userId} rule and functions/src/vcoins.ts's
// "vCoinsBalance crediting (security migration)" section for the fix.
//
// debitVCoins and rewardForAppTime had zero callers at the time of this
// migration and were removed rather than ported — if a real spend or
// app-time-reward feature is ever built, it should go straight to a Cloud
// Function from day one (see aiGuruCreditDebit.ts for the established
// pattern), not back through a client-side write.

import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type VCoinTransactionType   = "CREDIT" | "DEBIT";
export type VCoinTransactionStatus = "SUCCESS" | "PENDING" | "FAILED" | "REVERSED";

export interface VCoinTransaction {
  id:          string;
  type:        VCoinTransactionType;
  amount:      number;
  source:      string;
  title:       string;
  description: string;
  status:      VCoinTransactionStatus;
  referenceId: string | null;
  metadata:    Record<string, unknown>;
  createdAt:   Timestamp;
  updatedAt:   Timestamp;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function userRef(uid: string) {
  return doc(db, "users", uid);
}

function txCol(uid: string) {
  return collection(db, "users", uid, "vCoinTransactions");
}

// ─── Read: get balance once ───────────────────────────────────────────────────
//
// FIX (bug report — "all updated v-coins must be shown in drawer and
// v-coins page properly"): there are two separate, disconnected balance
// fields on users/{uid} — vCoinsBalance (written by creditWatchReward /
// creditSignupBonus / claimSkillBattleReward in functions/src/vcoins.ts,
// used for reels/videos/SkillBattle/registration/etc.) and vCoins (written
// by a separate Cloud Function, claimVCoinReward, used by the Daily
// Streak Quiz). Nothing reconciles them server-side. Both of these read
// functions used to return vCoinsBalance alone, so VCoinsHeaderBadge (the
// header pill, via subscribeToVCoinsBalance) and any getVCoinsBalance()
// caller would under-report for a student who'd also earned coins through
// the Daily Streak Quiz. Summing both here keeps this in sync with
// hooks/useVCoins.ts (Wallet, LearnFun) and app/(drawer)/_layout.tsx,
// which apply the same sum.

export async function getVCoinsBalance(uid: string): Promise<number> {
  const snap = await getDoc(userRef(uid));
  if (!snap.exists()) return 0;
  const d = snap.data();
  return (d.vCoinsBalance ?? 0) + (d.vCoins ?? 0);
}

// ─── Read: real-time balance subscription ─────────────────────────────────────

export function subscribeToVCoinsBalance(
  uid: string,
  callback: (balance: number) => void
): () => void {
  return onSnapshot(userRef(uid), (snap) => {
    if (snap.exists()) {
      const d = snap.data();
      callback((d.vCoinsBalance ?? 0) + (d.vCoins ?? 0));
    } else {
      callback(0);
    }
  });
}

// ─── Read: real-time transactions subscription ────────────────────────────────

export function subscribeToVCoinsTransactions(
  uid: string,
  callback: (transactions: VCoinTransaction[]) => void,
  filter?: "CREDIT" | "DEBIT" | "PENDING" | null
): () => void {
  let q = query(txCol(uid), orderBy("createdAt", "desc"));

  if (filter === "CREDIT") {
    q = query(txCol(uid), where("type", "==", "CREDIT"), orderBy("createdAt", "desc"));
  } else if (filter === "DEBIT") {
    q = query(txCol(uid), where("type", "==", "DEBIT"), orderBy("createdAt", "desc"));
  } else if (filter === "PENDING") {
    q = query(txCol(uid), where("status", "==", "PENDING"), orderBy("createdAt", "desc"));
  }

  return onSnapshot(q, (snap) => {
    const txs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as VCoinTransaction));
    callback(txs);
  });
}

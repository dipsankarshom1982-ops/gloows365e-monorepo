// PATH: apps/web/src/services/vCoinsService.ts
// READ-ONLY now. All balance-mutating logic (creditVCoins, debitVCoins)
// has been migrated to Cloud Functions in functions/src/vcoins.ts
// (creditSignupBonus, creditWatchReward, claimSkillBattleReward) — call
// those via httpsCallable() instead. This file used to run all of that via
// the Firestore client SDK directly, which meant it was only ever as safe
// as firestore.rules made it: the users/{userId} update rule protected
// vCoins/vCoinsLifetimeEarned/etc. but never vCoinsBalance — the field
// this pipeline actually incremented — so any signed-in user could set
// their own vCoinsBalance to an arbitrary number with a direct Firestore
// write, bypassing every daily-limit/duplicate check below entirely. See
// firestore.rules' users/{userId} rule and functions/src/vcoins.ts's
// "vCoinsBalance crediting (security migration)" section for the fix.
// Same migration already applied to apps/mobile/services/vCoinsService.ts.
//
// debitVCoins had zero callers at the time of this migration (the
// getVCoinsBalance comment below used to cite joinContest.ts as a use
// case, but that file never actually calls it on either platform) and was
// removed rather than ported — if a real spend feature is ever built, it
// should go straight to a Cloud Function from day one (see
// aiGuruCreditDebit.ts for the established pattern), not back through a
// client-side write. canRewardForContent (a lock-existence check) also had
// no external callers and was removed with it.
//
// Read-side subscriptions (live balance/transaction listeners) already
// exist separately as hooks/useVCoins.ts — this file only ever needed to
// carry the one-off getVCoinsBalance() read used outside React render.

import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export type VCoinTransactionType   = "CREDIT" | "DEBIT";
export type VCoinTransactionStatus = "SUCCESS" | "PENDING" | "FAILED" | "REVERSED";

function userRef(uid: string) {
  return doc(db, "users", uid);
}

// One-off balance read (as opposed to hooks/useVCoins.ts's live
// subscription) — for use in async flows that run outside a React render.
// Sums vCoinsBalance + vCoins for the same reason useVCoins.ts and
// Drawer.tsx do — see the FIX comment in hooks/useVCoins.ts.
export async function getVCoinsBalance(uid: string): Promise<number> {
  const snap = await getDoc(userRef(uid));
  if (!snap.exists()) return 0;
  const d = snap.data();
  return (d.vCoinsBalance ?? 0) + (d.vCoins ?? 0);
}

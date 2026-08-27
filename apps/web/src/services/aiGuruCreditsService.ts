// PATH: apps/web/src/services/aiGuruCreditsService.ts
// AI Guru pay-as-you-go credits — mirrors apps/mobile/services/
// aiGuruCreditsService.ts's read side exactly. Every balance mutation
// happens server-side (functions/src/aiGuruCreditDebit.ts / aiGuruCredits.ts)
// — this file only ever reads the balance/ledger or creates a Razorpay
// order; the actual checkout UI (RazorpayCheckout + the verify-endpoint
// call) lives in the page component, same split as apps/web/src/app/(app)/
// ai-guru/subscription/page.tsx's handleStartCheckout/handlePaymentSuccess,
// since web's payment flow (in-page modal, not a browser redirect) is
// naturally split across a component rather than one importable function
// like mobile's purchaseCreditPack.

import { db, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  getDoc,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";

export interface CreditTransaction {
  id:          string;
  type:        "CREDIT" | "DEBIT";
  amount:      number;
  source:      string;
  title:       string;
  description: string;
  status:      "SUCCESS" | "REVERSED";
  referenceId: string | null;
  metadata:    Record<string, unknown>;
  createdAt:   Timestamp;
  updatedAt:   Timestamp;
}

function balanceRef(uid: string) {
  return doc(db, "aiGuruCredits", uid);
}

export async function getCreditBalance(uid: string): Promise<number> {
  const snap = await getDoc(balanceRef(uid));
  return snap.exists() ? (snap.data().balance ?? 0) : 0;
}

export function subscribeToCreditBalance(
  uid: string,
  callback: (balance: number) => void
): () => void {
  return onSnapshot(balanceRef(uid), (snap) => {
    callback(snap.exists() ? (snap.data().balance ?? 0) : 0);
  });
}

export function subscribeToCreditTransactions(
  uid: string,
  callback: (transactions: CreditTransaction[]) => void
): () => void {
  const q = query(
    collection(db, "aiGuruCredits", uid, "transactions"),
    orderBy("createdAt", "desc"),
    fsLimit(50)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CreditTransaction)));
  });
}

// ─── Create a Razorpay order for a credit pack ──────────────────────────────
// Step 1 of the purchase flow — Step 2 (RazorpayCheckout + verify) lives in
// the page component, same as aiGuruCreateSubscription's split there.

export interface CreateCreditOrderResult {
  razorpayOrderId: string;
  amountPaise:     number;
  credits:         number;
  packName:        string;
}

const createCreditOrderFn = httpsCallable<{ packId: string }, CreateCreditOrderResult>(
  functions,
  "aiGuruCreateCreditOrder"
);

export async function createCreditOrder(packId: string): Promise<CreateCreditOrderResult> {
  const res = await createCreditOrderFn({ packId });
  return res.data;
}

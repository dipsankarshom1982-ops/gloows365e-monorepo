// PATH: services/aiGuruCreditsService.ts
// AI Guru pay-as-you-go credits — read-side mirror of vCoinsService.ts's
// balance/transaction subscriptions, plus the purchase flow (mirrors
// app/ai-guru/subscription.tsx's handleSubscribe, pointed at credits
// instead of a subscription).
//
// Every balance mutation happens server-side (functions/src/
// aiGuruCreditDebit.ts / aiGuruCredits.ts) — there is no client-side
// debit/credit function here at all. This file only ever reads the
// balance/ledger or kicks off a Razorpay purchase. (vCoinsService.ts used
// to be the counter-example — its creditVCoins/debitVCoins ran client-side
// — but that's been migrated to functions/src/vcoins.ts too; see that
// file's "vCoinsBalance crediting (security migration)" section.)

import { auth, db, functions } from "@/lib/firebase";
import { RAZORPAY_KEY_ID } from "@/lib/seekho/constants";
import type { CreditPack } from "./appConfigService";
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
import { httpsCallable } from "firebase/functions";
// Graceful: expo-web-browser — requires prebuild, falls back gracefully.
// Same defensive require() as subscription.tsx, since this is the same
// browser-checkout mechanism reused for a different purchase type.
let WebBrowser: { openBrowserAsync: (url: string) => Promise<any> } | null = null;
try { WebBrowser = require("expo-web-browser"); } catch {}

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

// ─── Read: one-off balance fetch ────────────────────────────────────────────

export async function getCreditBalance(uid: string): Promise<number> {
  const snap = await getDoc(balanceRef(uid));
  return snap.exists() ? (snap.data().balance ?? 0) : 0;
}

// ─── Read: real-time balance subscription ───────────────────────────────────

export function subscribeToCreditBalance(
  uid: string,
  callback: (balance: number) => void
): () => void {
  return onSnapshot(balanceRef(uid), (snap) => {
    callback(snap.exists() ? (snap.data().balance ?? 0) : 0);
  });
}

// ─── Read: real-time transaction ledger subscription ────────────────────────

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

// ─── Purchase a credit pack ──────────────────────────────────────────────────
// Mirrors app/ai-guru/subscription.tsx's handleSubscribe almost exactly:
// create a Razorpay order via a callable, open the same hosted checkout
// page (now parameterized with purpose=credits — see
// functions/src/aiGuruSubscription.ts), then poll the balance for up to 30s
// since activation happens server-side via aiGuruCreditPaymentSuccess after
// the browser tab completes payment, not synchronously here.

export interface PurchaseResult {
  activated: boolean; // true once the balance is observed to have increased
  newBalance: number;
}

export async function purchaseCreditPack(pack: CreditPack): Promise<PurchaseResult> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Please log out and log in again.");
  if (!RAZORPAY_KEY_ID) throw new Error("Razorpay key not configured. Add EXPO_PUBLIC_RAZORPAY_KEY_ID to .env");
  if (!WebBrowser) throw new Error("Payment requires a development build.\n\nRun: npx expo run:android");

  await currentUser.getIdToken(true); // force refresh so the callable's context.auth is populated

  const createOrder = httpsCallable<
    { packId: string },
    { razorpayOrderId: string; amountPaise: number; credits: number; packName: string }
  >(functions, "aiGuruCreateCreditOrder");

  const orderRes = await createOrder({ packId: pack.id });
  const { razorpayOrderId, amountPaise } = orderRes.data;

  const uid   = currentUser.uid;
  const email = currentUser.email ?? "";
  const balanceBefore = await getCreditBalance(uid);

  const cfBase = process.env.EXPO_PUBLIC_CLOUD_FUNCTION_URL
    ?? "https://us-central1-gloows-03b6sz.cloudfunctions.net";

  const checkoutUrl = `${cfBase}/aiGuruCheckoutPage`
    + `?key=${encodeURIComponent(RAZORPAY_KEY_ID)}`
    + `&order_id=${encodeURIComponent(razorpayOrderId)}`
    + `&amount=${amountPaise}`
    + `&plan=${encodeURIComponent(pack.name)}`
    + `&email=${encodeURIComponent(email)}`
    + `&purpose=credits`;

  await WebBrowser.openBrowserAsync(checkoutUrl);

  // Poll for up to 30s — same cadence as subscription.tsx's activation
  // check, since the actual credit happens via aiGuruCreditPaymentSuccess
  // inside that browser tab, not this call.
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const balance = await getCreditBalance(uid);
    if (balance > balanceBefore) return { activated: true, newBalance: balance };
  }

  return { activated: false, newBalance: balanceBefore };
}

// PATH: services/tutorCreditsService.ts
// ShikshaHub Phase 4 — tutor credits (funds Instant Help per-minute
// billing). RN purchase-flow mirror of aiGuruCreditsService.ts, pointed at
// the separate tutorCredits currency (see functions/src/tutorCredits.ts's
// header comment for why it's genuinely separate from aiGuruCredits) and
// the shared aiGuruCheckoutPage's new purpose=tutorcredits branch (see
// functions/src/aiGuruSubscription.ts).

import { auth, db, functions } from "@/lib/firebase";
import { RAZORPAY_KEY_ID } from "@/lib/seekho/constants";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
let WebBrowser: { openBrowserAsync: (url: string) => Promise<any> } | null = null;
try { WebBrowser = require("expo-web-browser"); } catch {}

function balanceRef(uid: string) {
  return doc(db, "tutorCredits", uid);
}

export async function getTutorCreditsBalance(uid: string): Promise<number> {
  const snap = await getDoc(balanceRef(uid));
  return snap.exists() ? (snap.data().balance ?? 0) : 0;
}

export interface TutorCreditPurchaseResult {
  activated: boolean;
  newBalance: number;
}

export interface TutorCreditPackLite {
  id: string;
  name: string;
  pricePaise: number;
}

export async function purchaseTutorCreditPack(pack: TutorCreditPackLite): Promise<TutorCreditPurchaseResult> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Please log out and log in again.");
  if (!RAZORPAY_KEY_ID) throw new Error("Razorpay key not configured. Add EXPO_PUBLIC_RAZORPAY_KEY_ID to .env");
  if (!WebBrowser) throw new Error("Payment requires a development build.\n\nRun: npx expo run:android");

  await currentUser.getIdToken(true);

  const createOrder = httpsCallable<
    { packId: string },
    { razorpayOrderId: string; amountPaise: number; credits: number; packName: string }
  >(functions, "createTutorCreditOrder");

  const orderRes = await createOrder({ packId: pack.id });
  const { razorpayOrderId, amountPaise } = orderRes.data;

  const uid   = currentUser.uid;
  const email = currentUser.email ?? "";
  const balanceBefore = await getTutorCreditsBalance(uid);

  const cfBase = process.env.EXPO_PUBLIC_CLOUD_FUNCTION_URL
    ?? "https://us-central1-gloows-03b6sz.cloudfunctions.net";

  const checkoutUrl = `${cfBase}/aiGuruCheckoutPage`
    + `?key=${encodeURIComponent(RAZORPAY_KEY_ID)}`
    + `&order_id=${encodeURIComponent(razorpayOrderId)}`
    + `&amount=${amountPaise}`
    + `&plan=${encodeURIComponent(pack.name)}`
    + `&email=${encodeURIComponent(email)}`
    + `&purpose=tutorcredits`;

  await WebBrowser.openBrowserAsync(checkoutUrl);

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const balance = await getTutorCreditsBalance(uid);
    if (balance > balanceBefore) return { activated: true, newBalance: balance };
  }

  return { activated: false, newBalance: balanceBefore };
}

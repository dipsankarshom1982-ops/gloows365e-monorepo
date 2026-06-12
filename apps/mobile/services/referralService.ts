// ─────────────────────────────────────────────────────────────────────────────
// FILE: services/referralService.ts  (NEW FILE)
// PATH: services/referralService.ts
// ─────────────────────────────────────────────────────────────────────────────

import { auth, db, functions } from "@/lib/firebase";
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
import { httpsCallable } from "firebase/functions";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReferralStatus = "pending" | "completed" | "expired";

export interface ReferralDoc {
  id:            string;
  referrerId:    string;
  refereeId:     string;
  status:        ReferralStatus;
  rewardClaimed: boolean;
  createdAt:     Timestamp;
  completedAt:   Timestamp | null;
}

export interface ReferralConfig {
  referrerCoins:  number;   // coins given to the student who shared
  refereeCoins:   number;   // welcome coins for the new student
  giftEnabled:    boolean;
  giftLabel:      string;   // e.g. "7-day AI Guru Free Trial"
  giftImageUrl:   string;
  triggerEvent:   "signup" | "first_login" | "first_quiz";
  maxReferrals:   number;   // 0 = unlimited
  isActive:       boolean;
  // milestone gifts: e.g. every 5th referral = special gift
  milestones:     MilestoneReward[];
}

export interface MilestoneReward {
  every:     number;  // every N referrals
  giftLabel: string;
  giftType:  "badge" | "subscription_days" | "coins";
  giftValue: number;
}

export interface ApplyReferralParams {
  code: string; // referral code entered by new student
}

export interface ApplyReferralResult {
  success:     boolean;
  referrerId:  string;
  coinsEarned: number;
  giftLabel:   string | null;
  message:     string;
}

// ─── Default config (shown in UI while Firestore loads) ───────────────────────
export const DEFAULT_REFERRAL_CONFIG: ReferralConfig = {
  referrerCoins: 50,
  refereeCoins:  30,
  giftEnabled:   false,
  giftLabel:     "",
  giftImageUrl:  "",
  triggerEvent:  "signup",
  maxReferrals:  0,
  isActive:      true,
  milestones:    [],
};

// ─── generateReferralCode ─────────────────────────────────────────────────────
// Generates a deterministic 8-char uppercase code from the user's UID.
// Called during user init — NOT a cloud function call.

export function generateReferralCode(uid: string): string {
  // Use first 4 chars of uid + last 4 chars, uppercased, alphanumeric only
  const clean = uid.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const part1 = clean.slice(0, 4).padEnd(4, "X");
  const part2 = clean.slice(-4).padEnd(4, "Y");
  return `${part1}${part2}`;
}

// ─── getReferralConfig ────────────────────────────────────────────────────────
// One-time read of the referral config from Firestore.

export async function getReferralConfig(): Promise<ReferralConfig> {
  try {
    const snap = await getDoc(doc(db, "appConfig", "referralConfig"));
    if (snap.exists()) {
      return { ...DEFAULT_REFERRAL_CONFIG, ...(snap.data() as Partial<ReferralConfig>) };
    }
  } catch {
    // return default on error
  }
  return DEFAULT_REFERRAL_CONFIG;
}

// ─── subscribeToReferralConfig ────────────────────────────────────────────────
// Real-time listener — admin changes reflect immediately.

export function subscribeToReferralConfig(
  callback: (config: ReferralConfig) => void
): () => void {
  return onSnapshot(
    doc(db, "appConfig", "referralConfig"),
    (snap) => {
      if (snap.exists()) {
        callback({ ...DEFAULT_REFERRAL_CONFIG, ...(snap.data() as Partial<ReferralConfig>) });
      } else {
        callback(DEFAULT_REFERRAL_CONFIG);
      }
    },
    () => callback(DEFAULT_REFERRAL_CONFIG)
  );
}

// ─── subscribeToMyReferrals ───────────────────────────────────────────────────
// Real-time listener for current user's referral list.

export function subscribeToMyReferrals(
  uid: string,
  callback: (referrals: ReferralDoc[]) => void
): () => void {
  const q = query(
    collection(db, "referrals"),
    where("referrerId", "==", uid),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    q,
    (snap) => {
      const refs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReferralDoc));
      callback(refs);
    },
    () => callback([])
  );
}

// ─── applyReferral ────────────────────────────────────────────────────────────
// Called when a new student enters a referral code during registration.
// This is a CLOUD FUNCTION call — all validation + coin credit happens server-side.

export async function applyReferral(
  params: ApplyReferralParams
): Promise<ApplyReferralResult> {
  const fn = httpsCallable<ApplyReferralParams, ApplyReferralResult>(
    functions,
    "applyReferral"
  );
  const { data } = await fn(params);
  return data;
}

// ─── getReferralStats ─────────────────────────────────────────────────────────
// One-time read of the current user's referral stats from their user doc.

export interface ReferralStats {
  referralCode:        string;
  referralCount:       number;
  referralCoinsEarned: number;
  referredBy:          string | null;
}

export async function getReferralStats(uid: string): Promise<ReferralStats> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const d = snap.data();
      return {
        referralCode:        d.referralCode        ?? generateReferralCode(uid),
        referralCount:       d.referralCount        ?? 0,
        referralCoinsEarned: d.referralCoinsEarned  ?? 0,
        referredBy:          d.referredBy           ?? null,
      };
    }
  } catch { /* fall through */ }
  return {
    referralCode:        generateReferralCode(uid),
    referralCount:       0,
    referralCoinsEarned: 0,
    referredBy:          null,
  };
}

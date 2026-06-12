// PATH: lib/initUser.ts

import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

// ─── generateReferralCode ─────────────────────────────────────────────────────
// Generates a deterministic 8-char uppercase code from the user's UID.
// Safe to call multiple times — always returns the same code for the same uid.
export function generateReferralCode(uid: string): string {
  const clean = uid.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const part1 = clean.slice(0, 4).padEnd(4, "X");
  const part2 = clean.slice(-4).padEnd(4, "Y");
  return `${part1}${part2}`;
}

// ─── initDashboard ────────────────────────────────────────────────────────────
export async function initDashboard(userId: string) {
  const ref = doc(db, "dashboard", userId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      courses: 0,
      streak: 0,
      coins: 0,
      rank: 0,
      currentCourse: "Start Learning",
      progress: 0,
      earnings: 0,
    });

    console.log("🔥 Dashboard created for user");
  }
}

// ─── ensureReferralCode ───────────────────────────────────────────────────────
// Called after registration to guarantee the user has a referralCode in their
// users/{uid} document. Safe to call multiple times — idempotent.
export async function ensureReferralCode(userId: string): Promise<string> {
  const userRef  = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);

  // Already has a code — return it
  if (userSnap.exists() && userSnap.data().referralCode) {
    return userSnap.data().referralCode as string;
  }

  const code = generateReferralCode(userId);

  try {
    if (userSnap.exists()) {
      await updateDoc(userRef, { referralCode: code });
    } else {
      await setDoc(userRef, { referralCode: code }, { merge: true });
    }
  } catch {
    // Non-fatal — code will be generated client-side if needed
  }

  console.log(`🎫 Referral code assigned: ${code}`);
  return code;
}

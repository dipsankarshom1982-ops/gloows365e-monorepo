// PATH: apps/web/src/services/vCoinsService.ts
// Mirrors mobile services/vCoinsService.ts's creditVCoins — same
// admin-configurable daily limits (vCoinRules), same dedup-by-referenceId
// lock, same daily-earned cap. Read-side functions (balance/transaction
// subscriptions) already exist on web as hooks/useVCoins.ts, so this file
// only ports the write side that was missing.

import { db } from "@/lib/firebase";
import { VCOIN_SOURCES } from "@/utils/formatVCoins";
import {
  collection,
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

export type VCoinTransactionType   = "CREDIT" | "DEBIT";
export type VCoinTransactionStatus = "SUCCESS" | "PENDING" | "FAILED" | "REVERSED";

export interface VCoinRule {
  source:       string;
  rewardAmount: number;
  dailyLimit:   number;
  isActive:     boolean;
  description:  string;
}

export interface CreditParams {
  uid:         string;
  // Optional: omit to use the admin-configured rewardAmount for `source`
  // (see getRewardAmount below). Pass an explicit amount only when the
  // value is computed per-event (e.g. contest score), not a flat reward.
  amount?:     number;
  source:      string;
  title:       string;
  description: string;
  referenceId?: string | null;
  metadata?:   Record<string, unknown>;
}

export interface DebitParams {
  uid:         string;
  amount:      number;
  source:      string;
  title:       string;
  description: string;
  referenceId?: string | null;
  metadata?:   Record<string, unknown>;
}

const DEFAULT_DAILY_LIMITS: Record<string, number> = {
  [VCOIN_SOURCES.APP_TIME_REWARD]:                  20,
  [VCOIN_SOURCES.REEL_WATCH_REWARD]:                30,
  [VCOIN_SOURCES.VIDEO_WATCH_REWARD]:                50,
  [VCOIN_SOURCES.STORY_WATCH_REWARD]:                20,
  [VCOIN_SOURCES.SKILLBATTLE_WINNER_REWARD]:         100,
  [VCOIN_SOURCES.SKILLBATTLE_RUNNER_UP_REWARD]:      100,
  [VCOIN_SOURCES.SKILLBATTLE_PARTICIPATION_REWARD]:  50,
  [VCOIN_SOURCES.ADMIN_FAIR_USE_REWARD]:             9999,
  [VCOIN_SOURCES.VIDYASTAR_CONTEST_ENTRY]:           9999,
  [VCOIN_SOURCES.COURSE_DISCOUNT_REDEEM]:            9999,
  [VCOIN_SOURCES.SIGNUP_BONUS]:                      200,
};

// Per-action reward amount, admin-editable via VCoinRules.tsx (rewardAmount
// field on the same vCoinRules/{source} document as the daily limit).
// These are the fallback values used if no rule doc exists yet, or the
// existing doc predates this field — same fallback pattern as
// DEFAULT_DAILY_LIMITS above, not a separate source of truth.
const DEFAULT_REWARD_AMOUNTS: Record<string, number> = {
  [VCOIN_SOURCES.REEL_WATCH_REWARD]:                1,
  [VCOIN_SOURCES.VIDEO_WATCH_REWARD]:               1,
  [VCOIN_SOURCES.STORY_WATCH_REWARD]:               1,
  [VCOIN_SOURCES.VIDYASTAR_CONTEST_ENTRY]:          50,
  [VCOIN_SOURCES.SIGNUP_BONUS]:                     200,
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Matches the exact field name Drawer.tsx, wallet/page.tsx, and admin's
// VCoinLeaderboard.tsx already read/rank by — see creditVCoins below, which
// is the only place this field is written.
function yearField(): string {
  return `vCoinsYear_${new Date().getFullYear()}`;
}

function userRef(uid: string) {
  return doc(db, "users", uid);
}

function txCol(uid: string) {
  return collection(db, "users", uid, "vCoinTransactions");
}

function lockDoc(uid: string, lockKey: string) {
  return doc(db, "users", uid, "vCoinActivityLocks", lockKey);
}

async function getDailyLimit(source: string): Promise<number> {
  try {
    const snap = await getDoc(doc(db, "vCoinRules", source));
    if (snap.exists()) {
      const rule = snap.data() as VCoinRule;
      if (rule.isActive) return rule.dailyLimit;
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_DAILY_LIMITS[source] ?? 9999;
}

// Reads the same vCoinRules/{source} document as getDailyLimit — admin
// edits both fields together in VCoinRules.tsx, so one read pattern here
// keeps them from drifting out of sync with each other.
async function getRewardAmount(source: string): Promise<number> {
  try {
    const snap = await getDoc(doc(db, "vCoinRules", source));
    if (snap.exists()) {
      const rule = snap.data() as VCoinRule;
      if (rule.isActive && typeof rule.rewardAmount === "number") return rule.rewardAmount;
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_REWARD_AMOUNTS[source] ?? 0;
}

async function getDailyEarned(uid: string, source: string): Promise<number> {
  const lockKey = `${source}_day_${todayStr()}`;
  const snap = await getDoc(lockDoc(uid, lockKey));
  if (!snap.exists()) return 0;
  const data = snap.data();
  const lockDate = data.lastRewardedAt?.toDate?.();
  if (!lockDate) return 0;
  const lockDay = `${lockDate.getFullYear()}-${String(lockDate.getMonth() + 1).padStart(2, "0")}-${String(lockDate.getDate()).padStart(2, "0")}`;
  if (lockDay !== todayStr()) return 0;
  return data.earnedToday ?? 0;
}

export async function canRewardForContent({
  uid, source, referenceId,
}: { uid: string; source: string; referenceId: string }): Promise<boolean> {
  const contentKey = `${source}_${referenceId}`;
  const snap = await getDoc(lockDoc(uid, contentKey));
  return !snap.exists();
}

export async function creditVCoins(params: CreditParams): Promise<void> {
  const {
    uid,
    amount: explicitAmount,
    source,
    title,
    description,
    referenceId = null,
    metadata = {},
  } = params;

  if (referenceId) {
    const contentKey = `${source}_${referenceId}`;
    const existing = await getDoc(lockDoc(uid, contentKey));
    if (existing.exists()) return;
  }

  // Flat per-action rewards (reel watch, contest entry, etc.) omit `amount`
  // and pull the admin-configured value here. Per-event rewards (contest
  // score, e.g.) pass an explicit amount and skip this lookup.
  const amount = explicitAmount ?? await getRewardAmount(source);
  if (amount <= 0) return;

  const dailyLimit  = await getDailyLimit(source);
  const dailyEarned = await getDailyEarned(uid, source);
  const canEarn     = Math.min(amount, dailyLimit - dailyEarned);
  if (canEarn <= 0) return;

  const actualAmount = canEarn;
  const now          = serverTimestamp();

  const batch = writeBatch(db);

  const txRef = doc(txCol(uid));
  batch.set(txRef, {
    type:        "CREDIT" as VCoinTransactionType,
    amount:      actualAmount,
    source,
    title,
    description,
    status:      "SUCCESS" as VCoinTransactionStatus,
    referenceId,
    metadata,
    createdAt:   now,
    updatedAt:   now,
  });

  // FIX: previously read the user doc first to compute `current + amount`
  // by hand, purely to decide whether to batch.set(merge) (new doc) or
  // batch.update (existing doc) — but that read-then-write is a race
  // condition if two credits land concurrently (e.g. two tabs, or a retry),
  // and the value it computed was only ever used to feed that same race.
  // Firestore's increment() is atomic and works whether the field/doc
  // exists yet or not, so set(..., {merge:true}) with increment() values
  // replaces the read entirely — one fewer read, and no race window.
  //
  // Also now writes vCoinsYear_{year} via the same increment() — this field
  // is what Drawer.tsx (web + mobile), wallet/page.tsx, and admin's
  // VCoinLeaderboard.tsx all rank by, but nothing was ever writing it.
  const userDocRef = userRef(uid);
  batch.set(userDocRef, {
    vCoinsBalance:        increment(actualAmount),
    vCoinsLifetimeEarned: increment(actualAmount),
    [yearField()]:        increment(actualAmount),
    vCoinsLifetimeSpent:  increment(0), // no-op on existing value; ensures field exists for new docs
    vCoinsUpdatedAt:      now,
  }, { merge: true });

  if (referenceId) {
    const contentKey = `${source}_${referenceId}`;
    batch.set(lockDoc(uid, contentKey), {
      source,
      referenceId,
      earnedToday:     actualAmount,
      lastRewardedAt:  now,
      createdAt:       now,
    });
  }

  // FIX: same race condition class as the balance write above — this read
  // (dailyLockSnap) then write (earnedToday + actualAmount) is not atomic,
  // so two concurrent credits for the same source/day could both read the
  // same earnedToday, both add their amount, and the second commit would
  // overwrite the first's contribution instead of stacking on top of it.
  // increment() makes this atomic the same way it did for vCoinsBalance.
  //
  // createdAt is intentionally left out of this write: with merge:true,
  // including it would reset the field to "now" on every credit, not just
  // the doc's first one. getDailyEarned() already resets earnedToday to 0
  // once lastRewardedAt rolls into a new day (see above), so a stale
  // createdAt from a previous day causes no incorrect behavior — it's
  // purely informational and not worth a second write path to preserve.
  const dailyKey      = `${source}_day_${todayStr()}`;
  const dailyLockRef  = lockDoc(uid, dailyKey);
  batch.set(dailyLockRef, {
    source,
    referenceId:    `day_${todayStr()}`,
    earnedToday:    increment(actualAmount),
    lastRewardedAt: now,
  }, { merge: true });

  await batch.commit();
}

// ─── getVCoinsBalance ──────────────────────────────────────────────────────
// One-off balance read (as opposed to hooks/useVCoins.ts's live
// subscription) — for use in async flows like joinContest.ts's fee check,
// which run outside a React render. Sums vCoinsBalance + vCoins for the
// same reason useVCoins.ts and Drawer.tsx do — see the FIX comment atop
// hooks/useVCoins.ts.
export async function getVCoinsBalance(uid: string): Promise<number> {
  const snap = await getDoc(userRef(uid));
  if (!snap.exists()) return 0;
  const d = snap.data();
  return (d.vCoinsBalance ?? 0) + (d.vCoins ?? 0);
}

// ─── debitVCoins ─────────────────────────────────────────────────────────
// Mirrors mobile services/vCoinsService.ts's debitVCoins exactly — atomic
// balance check + deduction via runTransaction, so two concurrent spends
// (e.g. double-tapping "Join Now") can't both succeed against a balance
// that only covers one of them.
// ⚡ CLOUD_FUNCTION_TODO: move server-side for the same reason as creditVCoins.
export async function debitVCoins(params: DebitParams): Promise<void> {
  const {
    uid,
    amount,
    source,
    title,
    description,
    referenceId = null,
    metadata = {},
  } = params;

  if (amount <= 0) return;

  await runTransaction(db, async (tx) => {
    const userDocRef = userRef(uid);
    const userSnap   = await tx.get(userDocRef);

    // Eligibility check must match the combined balance shown to the user
    // everywhere else (useVCoins, getVCoinsBalance, Drawer.tsx) — see the
    // FIX comment on getVCoinsBalance above.
    const balancePart = userSnap.exists() ? (userSnap.data().vCoinsBalance ?? 0) : 0;
    const streakPart  = userSnap.exists() ? (userSnap.data().vCoins ?? 0) : 0;
    const current      = balancePart + streakPart;

    if (current < amount) {
      throw new Error(`Insufficient V-Coins balance. Have ${current}, need ${amount}.`);
    }

    const currentSpent = userSnap.exists() ? (userSnap.data().vCoinsLifetimeSpent ?? 0) : 0;
    const now          = serverTimestamp();

    const txRef = doc(txCol(uid));
    tx.set(txRef, {
      type:        "DEBIT" as VCoinTransactionType,
      amount,
      source,
      title,
      description,
      status:      "SUCCESS" as VCoinTransactionStatus,
      referenceId,
      metadata,
      createdAt:   now,
      updatedAt:   now,
    });

    // Deduct from vCoinsBalance specifically (not the combined `current`
    // used for the eligibility check) — can go negative if amount exceeds
    // balancePart alone; the combined total (what's displayed) still comes
    // out correct since the separate `vCoins` (streak) pool is untouched.
    if (userSnap.exists()) {
      tx.update(userDocRef, {
        vCoinsBalance:       balancePart - amount,
        vCoinsLifetimeSpent: currentSpent + amount,
        vCoinsUpdatedAt:     now,
      });
    }
  });
}

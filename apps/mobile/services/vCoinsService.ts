// services/vCoinsService.ts
// V-Coins service layer — all balance-mutating functions are marked
// ⚡ CLOUD_FUNCTION_TODO: when Cloud Functions are added, move that logic
// server-side and replace the client call with an HTTPS callable invocation.
// The hook and UI components do NOT need to change when that migration happens.

import { auth, db } from "@/lib/firebase";
import { VCOIN_SOURCES, VCoinSource, VCOIN_DIST_PCT } from "@/utils/formatVCoins";
import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
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
  // (see getRewardAmount below). Pass an explicit amount when the value is
  // computed per-event (e.g. SkillBattle rank-based payout, contest score)
  // rather than a flat reward.
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

// ─── Default daily limits (used if vCoinRules document not found) ─────────────
const DEFAULT_DAILY_LIMITS: Record<string, number> = {
  [VCOIN_SOURCES.APP_TIME_REWARD]:                  20,
  [VCOIN_SOURCES.REEL_WATCH_REWARD]:                30,
  [VCOIN_SOURCES.VIDEO_WATCH_REWARD]:               50,
  [VCOIN_SOURCES.STORY_WATCH_REWARD]:               20,
  [VCOIN_SOURCES.SKILLBATTLE_WINNER_REWARD]:        100,
  [VCOIN_SOURCES.SKILLBATTLE_RUNNER_UP_REWARD]:     100,
  [VCOIN_SOURCES.SKILLBATTLE_PARTICIPATION_REWARD]: 50,
  [VCOIN_SOURCES.ADMIN_FAIR_USE_REWARD]:            9999,
  [VCOIN_SOURCES.VIDYASTAR_CONTEST_ENTRY]:          9999,
  [VCOIN_SOURCES.COURSE_DISCOUNT_REDEEM]:           9999,
  // Daily Streak Quiz: 1 question/day, so this cap is really just a safety
  // net — the real "once per day" rule is enforced server-side by the
  // submitDailyStreakQuizAnswer Cloud Function (see
  // docs/DAILY_STREAK_QUIZ_BACKEND.md), not by this client-side limit.
  [VCOIN_SOURCES.DAILY_STREAK_QUIZ_CORRECT]:        5,
  [VCOIN_SOURCES.SIGNUP_BONUS]:                     200,
};

// Per-action reward amount, admin-editable via admin's VCoinRules.tsx
// (rewardAmount field on the same vCoinRules/{source} document as the
// daily limit). Used as the fallback for callers that omit `amount` in
// CreditParams — e.g. submitContestQuiz.ts's VIDYASTAR_CONTEST_ENTRY
// credit. Reward functions in this file that compute a variable amount
// (rewardForAppTime, rewardForSkillBattleWin's rank tiers, etc.) keep
// passing an explicit amount and are unaffected by this.
const DEFAULT_REWARD_AMOUNTS: Record<string, number> = {
  [VCOIN_SOURCES.REEL_WATCH_REWARD]:       1,
  [VCOIN_SOURCES.VIDEO_WATCH_REWARD]:      3,
  [VCOIN_SOURCES.STORY_WATCH_REWARD]:      1,
  [VCOIN_SOURCES.VIDYASTAR_CONTEST_ENTRY]: 50,
  [VCOIN_SOURCES.SIGNUP_BONUS]:            200,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

// Matches the exact field name app/(drawer)/_layout.tsx, vcoins/wallet.tsx,
// and admin's VCoinLeaderboard.tsx already read/rank by — see creditVCoins
// below, which is the only place this field is written.
function yearField(): string {
  return `vCoinsYear_${new Date().getFullYear()}`;
}

// ─── Read: get balance once ───────────────────────────────────────────────────
//
// FIX (bug report — "all updated v-coins must be shown in drawer and
// v-coins page properly"): there are two separate, disconnected balance
// fields on users/{uid} — vCoinsBalance (written by creditVCoins() below,
// used for reels/videos/contests/registration/etc.) and vCoins (written by
// a separate backend Cloud Function, claimVCoinReward, used by the Daily
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

// ─── Internal: fetch daily limit for a source ─────────────────────────────────

async function getDailyLimit(source: string): Promise<number> {
  // vCoinRules doc ID = source string (e.g. "APP_TIME_REWARD")
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
// edits both fields together (see admin's VCoinRules.tsx), so one read
// pattern here keeps them from drifting out of sync with each other.
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

// ─── Internal: check and read daily earned so far ────────────────────────────

async function getDailyEarned(uid: string, source: string): Promise<number> {
  const lockKey = `${source}_day_${todayStr()}`;
  const snap = await getDoc(lockDoc(uid, lockKey));
  if (!snap.exists()) return 0;
  const data = snap.data();
  // Only count if the lock was created today
  const lockDate = data.lastRewardedAt?.toDate();
  if (!lockDate) return 0;
  const lockDay = `${lockDate.getFullYear()}-${String(lockDate.getMonth() + 1).padStart(2, "0")}-${String(lockDate.getDate()).padStart(2, "0")}`;
  if (lockDay !== todayStr()) return 0;
  return data.earnedToday ?? 0;
}

// ─── canRewardForContent ──────────────────────────────────────────────────────
// Returns false if this exact (source + referenceId) has already been rewarded.

export async function canRewardForContent({
  uid,
  source,
  referenceId,
}: {
  uid:         string;
  source:      string;
  referenceId: string;
}): Promise<boolean> {
  const contentKey = `${source}_${referenceId}`;
  const snap = await getDoc(lockDoc(uid, contentKey));
  return !snap.exists();
}

// ─── creditVCoins ─────────────────────────────────────────────────────────────
// ⚡ CLOUD_FUNCTION_TODO: Move this entire function to a Firebase Cloud Function
// (functions/src/vCoins/creditVCoins.ts). Call it via httpsCallable() instead.
// The function should verify the caller's uid from context.auth, then perform
// the same batch write below. This prevents any client-side manipulation.

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

  // 1. Duplicate check — if referenceId given, skip if already rewarded.
  // Checked before resolving amount below so a duplicate attempt costs one
  // read instead of two.
  if (referenceId) {
    const contentKey = `${source}_${referenceId}`;
    const existing = await getDoc(lockDoc(uid, contentKey));
    if (existing.exists()) return; // already rewarded for this content
  }

  // Flat per-action rewards (contest entry, etc.) omit `amount` and pull
  // the admin-configured value here. Per-event rewards (SkillBattle rank
  // tiers, app-time minutes, etc.) pass an explicit amount and skip this.
  const amount = explicitAmount ?? await getRewardAmount(source);
  if (amount <= 0) return;

  // 2. Daily limit check
  const dailyLimit  = await getDailyLimit(source);
  const dailyEarned = await getDailyEarned(uid, source);
  const canEarn     = Math.min(amount, dailyLimit - dailyEarned);
  if (canEarn <= 0) return; // daily cap reached

  const actualAmount = canEarn;
  const now          = serverTimestamp();

  // 3. Batch write: transaction doc + user balance update + activity lock
  // ⚡ CLOUD_FUNCTION_TODO: The writeBatch below is the server-side logic to migrate.
  const batch = writeBatch(db);

  // 3a. Transaction document (new auto-id)
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

  // 3b. User document — atomic increments
  // FIX: previously read the user doc first to compute `current + amount`
  // by hand, purely to decide batch.set(new doc) vs batch.update(existing
  // doc) — a race condition if two credits land concurrently (e.g. a retry
  // while offline sync catches up), and the mobile `else` branch's plain
  // set() (no merge) would have silently wiped any other fields on the
  // user doc if it existed without vCoinsBalance already set.
  // Firestore's increment() is atomic and works whether the field/doc
  // exists yet or not, so set(..., {merge:true}) with increment() values
  // replaces the read entirely — one fewer read, no race window, and no
  // risk of clobbering unrelated fields.
  //
  // Also now writes vCoinsYear_{year} via the same increment() — this field
  // is what app/(drawer)/_layout.tsx, vcoins/wallet.tsx, and admin's
  // VCoinLeaderboard.tsx all rank by, but nothing was ever writing it.
  const userDocRef = userRef(uid);
  batch.set(userDocRef, {
    vCoinsBalance:        increment(actualAmount),
    vCoinsLifetimeEarned: increment(actualAmount),
    [yearField()]:        increment(actualAmount),
    vCoinsLifetimeSpent:  increment(0), // no-op on existing value; ensures field exists for new docs
    vCoinsUpdatedAt:      now,
  }, { merge: true });

  // 3c. Content lock (prevents duplicate reward for same content)
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

  // 3d. Daily lock (tracks daily total for this source)
  // FIX: same race condition class as the balance write above (3b) — this
  // read (dailyLockSnap) then write (earnedToday + actualAmount) was not
  // atomic, so two concurrent credits for the same source/day could both
  // read the same earnedToday, both add their amount, and the second
  // commit would overwrite the first's contribution instead of stacking on
  // top of it. increment() makes this atomic the same way it did for
  // vCoinsBalance above.
  //
  // createdAt is intentionally left out of this write: with merge:true,
  // including it would reset the field to "now" on every credit, not just
  // the doc's first one. The lock key itself already encodes today's date
  // (`${source}_day_${todayStr()}`), so a new day means a brand-new
  // document, not a stale createdAt on a reused one — nothing reads
  // createdAt to decide freshness, only the key does.
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

// ─── debitVCoins ──────────────────────────────────────────────────────────────
// ⚡ CLOUD_FUNCTION_TODO: Move to a Firebase Cloud Function for security.
// The Cloud Function should verify balance server-side before debiting.

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

  // Use runTransaction to atomically read and update balance
  await runTransaction(db, async (tx) => {
    const userDocRef = userRef(uid);
    const userSnap   = await tx.get(userDocRef);
    // FIX: the displayed balance everywhere (useVCoins, getVCoinsBalance,
    // subscribeToVCoinsBalance, header badge) is vCoinsBalance + vCoins —
    // see the FIX comment on getVCoinsBalance above for why. Checking
    // vCoinsBalance alone here would reject a spend the user can plainly
    // see they can afford (e.g. vCoinsBalance=10, vCoins=500, displayed
    // balance=510, but this would've thrown "Have 10, need X" on any
    // amount over 10). vCoinsBalance is still what actually gets debited
    // (see below) — vCoins is a separate pool written by an external
    // Cloud Function this repo doesn't own, so we don't touch it directly
    // — but the *eligibility check* must match what the user was shown.
    const balancePart = userSnap.exists() ? (userSnap.data().vCoinsBalance ?? 0) : 0;
    const streakPart  = userSnap.exists() ? (userSnap.data().vCoins ?? 0) : 0;
    const current      = balancePart + streakPart;

    if (current < amount) {
      throw new Error(`Insufficient V-Coins balance. Have ${current}, need ${amount}.`);
    }

    const currentSpent = userSnap.exists() ? (userSnap.data().vCoinsLifetimeSpent ?? 0) : 0;
    const now          = serverTimestamp();

    // Create transaction document
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
    // used for the eligibility check above) — can go negative if amount
    // exceeds balancePart alone; the combined total (which is what's
    // displayed) still comes out correct since vCoins is untouched.
    if (userSnap.exists()) {
      tx.update(userDocRef, {
        vCoinsBalance:       balancePart - amount,
        vCoinsLifetimeSpent: currentSpent + amount,
        vCoinsUpdatedAt:     now,
      });
    }
  });
}

// ─── rewardForWatchCompletion ─────────────────────────────────────────────────
// Call this after a reel/video/story has been watched past the threshold.
// contentType: "reel" | "video" | "story"
// watchPercentage: 0–100

export async function rewardForWatchCompletion({
  uid,
  contentId,
  contentType,
  watchPercentage,
}: {
  uid:             string;
  contentId:       string;
  contentType:     "reel" | "video" | "story";
  watchPercentage: number;
}): Promise<void> {
  let source: string;
  let minPct: number;
  let amount: number;
  let title: string;
  let description: string;

  switch (contentType) {
    case "reel":
      source      = VCOIN_SOURCES.REEL_WATCH_REWARD;
      minPct      = 80;
      amount      = 1;
      title       = "Watched Reel";
      description = "Earned for watching a skill reel";
      break;
    case "video":
      source      = VCOIN_SOURCES.VIDEO_WATCH_REWARD;
      minPct      = 80;
      amount      = 3;
      title       = "Watched Educational Video";
      description = "Earned for completing an educational video";
      break;
    case "story":
      source      = VCOIN_SOURCES.STORY_WATCH_REWARD;
      minPct      = 100;
      amount      = 1;
      title       = "Watched Story";
      description = "Earned for watching a full story";
      break;
    default:
      return;
  }

  if (watchPercentage < minPct) return;

  await creditVCoins({
    uid,
    amount,
    source,
    title,
    description,
    referenceId: contentId,
    metadata:    { contentId, contentType, watchPercentage },
  });
}

// ─── rewardForAppTime ─────────────────────────────────────────────────────────
// Call periodically during active foreground usage.
// activeMinutes: total foreground minutes this session (caller tracks this).
// Awards 1 coin per 5 minutes; max 20/day.

export async function rewardForAppTime({
  uid,
  activeMinutes,
}: {
  uid:           string;
  activeMinutes: number;
}): Promise<void> {
  const coinsToAward = Math.floor(activeMinutes / 5);
  if (coinsToAward <= 0) return;

  await creditVCoins({
    uid,
    amount:      coinsToAward,
    source:      VCOIN_SOURCES.APP_TIME_REWARD,
    title:       "Learning Time Reward",
    description: `Earned for ${activeMinutes} min of active learning`,
    referenceId: `session_${todayStr()}_${Date.now()}`,
    metadata:    { activeMinutes },
  });
}

// FIX (product decision — "V-Coins can not be earned from AI Guru, it's a
// subscription-based model"): removed rewardForAIGuruSubscription (and its
// AI_GURU_MONTHLY_BONUS/AI_GURU_YEARLY_BONUS sources in formatVCoins.ts,
// VCoinRules.tsx). Was never actually wired up anywhere — no caller in
// mobile, web, or the server-side aiGuruSubscription.ts purchase handler —
// but it was listed in admin's VCoinRules.tsx alongside real, working
// reward sources, misleadingly implying subscribing paid VCoins back out.

// ─── rewardForSkillBattleWin ──────────────────────────────────────────────────
// ⚡ CLOUD_FUNCTION_TODO: This should be triggered server-side when a SkillBattle
// result is finalized, not from the client, to prevent rank manipulation.
// Call after SkillBattle result is confirmed.
// rank: 1 = winner (50 coins), 2 = runner-up (20 coins), other = participation (5 coins)

export async function rewardForSkillBattleWin({
  uid,
  battleId,
  rank,
}: {
  uid:      string;
  battleId: string;
  rank:     number;
}): Promise<void> {
  let source: string;
  let amount: number;
  let title: string;
  let description: string;

  if (rank === 1) {
    source      = VCOIN_SOURCES.SKILLBATTLE_WINNER_REWARD;
    amount      = 50;
    title       = "SkillBattle Champion!";
    description = "Won first place in SkillBattle";
  } else if (rank === 2) {
    source      = VCOIN_SOURCES.SKILLBATTLE_RUNNER_UP_REWARD;
    amount      = 20;
    title       = "SkillBattle Runner-up";
    description = "Finished second in SkillBattle";
  } else {
    source      = VCOIN_SOURCES.SKILLBATTLE_PARTICIPATION_REWARD;
    amount      = 5;
    title       = "SkillBattle Participation";
    description = "Participated in SkillBattle";
  }

  await creditVCoins({
    uid,
    amount,
    source,
    title,
    description,
    referenceId: battleId,
    metadata:    { battleId, rank },
  });
}

// ─── claimSkillBattleRewards ──────────────────────────────────────────────────
// ⚡ CLOUD_FUNCTION_TODO: This should be triggered server-side when the battle
// endDate passes, distributing coins to ALL ranked participants automatically.
// For now (MVP): each user self-claims by calling this when they open the
// skillboard after the battle ends. Activity locks ensure idempotency.
//
// Call this ONLY for battles where new Date(endDate) < new Date().
// Returns the total V-Coins newly credited (0 if already claimed or unranked).

export interface SkillBattleClaimParams {
  uid:         string;
  battleId:    string;   // Firestore doc ID of the skillBattle
  battleMonth: string;   // "YYYY-MM"
  ranks: {
    india:    number;    // 0 = not ranked
    state:    number;
    district: number;
    local:    number;
  };
  vcoins: {
    vcoin_india:    number;
    vcoin_state:    number;
    vcoin_district: number;
    vcoin_local:    number;
  };
}

// FIX: this used to be its own locally-declared copy of the same
// percentages as VCOIN_DIST_PCT (utils/formatVCoins.ts) — two independent
// copies of the same table is exactly how they drifted apart in the first
// place (see the matching FIX in app/(drawer)/(tabs)/skillbattle.tsx, whose
// reward *preview* had silently diverged from this, the actual payout
// table). Now there's one source of truth.
function getSkillBattleCoinForRank(baseCoins: number, rank: number): number {
  if (rank < 1 || rank > 10 || baseCoins <= 0) return 0;
  return Math.round((baseCoins * (VCOIN_DIST_PCT[rank - 1] ?? 0)) / 100);
}

function skillBattleSource(rank: number): string {
  if (rank === 1) return VCOIN_SOURCES.SKILLBATTLE_WINNER_REWARD;
  if (rank === 2) return VCOIN_SOURCES.SKILLBATTLE_RUNNER_UP_REWARD;
  return VCOIN_SOURCES.SKILLBATTLE_PARTICIPATION_REWARD;
}

const SCOPE_LABELS: Record<string, string> = {
  india:    "All India",
  state:    "State",
  district: "District",
  local:    "Local",
};

export async function claimSkillBattleRewards(
  params: SkillBattleClaimParams
): Promise<number> {
  const { uid, battleId, battleMonth, ranks, vcoins } = params;
  const scopes = [
    { key: "india",    rank: ranks.india,    base: vcoins.vcoin_india    },
    { key: "state",    rank: ranks.state,    base: vcoins.vcoin_state    },
    { key: "district", rank: ranks.district, base: vcoins.vcoin_district },
    { key: "local",    rank: ranks.local,    base: vcoins.vcoin_local    },
  ] as const;

  let totalCredited = 0;

  for (const { key, rank, base } of scopes) {
    const coins = getSkillBattleCoinForRank(base, rank);
    if (coins <= 0) continue;

    const source    = skillBattleSource(rank);
    const scopeLabel = SCOPE_LABELS[key] ?? key;

    // referenceId = battleId_scope ensures one reward per scope per battle
    const referenceId = `${battleId}_${key}`;

    // Check if already claimed (canRewardForContent checks the lock)
    const alreadyClaimed = !(await canRewardForContent({ uid, source, referenceId }));
    if (alreadyClaimed) continue;

    await creditVCoins({
      uid,
      amount:      coins,
      source,
      title:       `SkillBattle ${scopeLabel} · Rank #${rank}`,
      description: `${battleMonth} SkillBattle — ${scopeLabel} rank #${rank}`,
      referenceId,
      metadata:    { battleId, battleMonth, scope: key, rank, baseCoins: base },
    });

    totalCredited += coins;
  }

  return totalCredited;
}

// PATH: functions/src/vcoins.ts
// Changes:
//  • claimVCoinReward now also increments vCoinsYear_{YYYY} for annual ranking
//  • Added resetAnnualVCoins — scheduled Jan 1 IST to reset yearly fields
//  • getVCoinBalance unchanged
//  • Removed all references to old "coins" / LearnFunCoins fields

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { getRedis, todayIST, TTL, RK } from "./redish";

const db = admin.firestore();

// ─── Activity catalogue ───────────────────────────────────────────────────────

interface ActivityDef {
  coins:     number;
  daily:     boolean;
  maxPerDay: number;
}

const ACTIVITIES: Record<string, ActivityDef> = {
  daily_login:        { coins: 5,   daily: true,  maxPerDay: 1  },
  lesson_complete:    { coins: 10,  daily: true,  maxPerDay: 5  },
  practice_complete:  { coins: 20,  daily: true,  maxPerDay: 3  },
  quiz_pass:          { coins: 15,  daily: true,  maxPerDay: 5  },
  chapter_complete:   { coins: 100, daily: true,  maxPerDay: 3  },
  video_watch:        { coins: 5,   daily: true,  maxPerDay: 10 },
  story_view:         { coins: 2,   daily: true,  maxPerDay: 20 },
  post_like:          { coins: 1,   daily: true,  maxPerDay: 30 },
  profile_complete:   { coins: 50,  daily: false, maxPerDay: 1  },
  first_post:         { coins: 25,  daily: false, maxPerDay: 1  },
  referral:           { coins: 100, daily: false, maxPerDay: 1  },
  // Daily Streak Quiz — one correct answer per day. maxPerDay: 1 here is
  // a belt-and-suspenders cap; the real "once per day" enforcement is the
  // studentDailyStreakProgress/{uid}/days/{date} doc check in
  // dailyStreakQuiz.ts's submitDailyStreakQuizAnswer, which runs first.
  daily_streak_quiz:  { coins: 5,   daily: true,  maxPerDay: 1  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentYearIST(): number {
  // IST = UTC+5:30
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.getUTCFullYear();
}

// ─── claimVCoinReward ─────────────────────────────────────────────────────────

export const claimVCoinReward = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "128MB", secrets: ["REDIS_URL", "REDIS_TOKEN"] })
  .https.onCall(async (
    data: { activityId: string; referenceId?: string },
    context
  ) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }

    const userId     = context.auth.uid;
    const { activityId, referenceId = "" } = data;
    const activity   = ACTIVITIES[activityId];

    if (!activity) {
      throw new functionsV1.https.HttpsError("invalid-argument", `Unknown activity: ${activityId}`);
    }

    const today = todayIST();

    // ── Redis dedup lock ─────────────────────────────────────────
    try {
      if (activity.maxPerDay > 1) {
        const countKey = RK.vcoinCount(userId, activityId, today);
        const count    = await getRedis().incr(countKey);
        if (count === 1) await getRedis().expire(countKey, 86400);
        if (count > activity.maxPerDay) {
          await getRedis().decr(countKey);
          throw new functionsV1.https.HttpsError(
            "resource-exhausted",
            `Daily limit reached for ${activityId}`
          );
        }
      } else {
        const lockSuffix = activity.daily ? `${today}:${referenceId}` : referenceId;
        const lockKey    = RK.vcoinLock(userId, activityId, lockSuffix);
        const locked     = await getRedis().setnx(lockKey, 1);
        if (locked === 0) {
          throw new functionsV1.https.HttpsError("already-exists", "Activity already claimed");
        }
        const lockTTL = activity.daily ? 86400 : 60 * 60 * 24 * 365;
        await getRedis().expire(lockKey, lockTTL);
      }
    } catch (e: unknown) {
      if (
        e instanceof functionsV1.https.HttpsError &&
        (e.code === "already-exists" || e.code === "resource-exhausted")
      ) throw e;
      console.warn("vcoin Redis lock check failed — falling through:", e);
    }

    // ── Write Firestore transaction + update balance + yearly field ──────────
    const year      = currentYearIST();
    const yearField = `vCoinsYear_${year}`;

    const userRef = db.doc(`users/${userId}`);
    const txRef   = userRef.collection("vCoinTransactions").doc();

    const batch = db.batch();
    batch.set(txRef, {
      amount:     activity.coins,
      type:       "CREDIT",
      status:     "SUCCESS",
      activityId,
      referenceId,
      year,
      createdAt:  admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.update(userRef, {
      vCoins:                              admin.firestore.FieldValue.increment(activity.coins),
      vCoinsLifetimeEarned:                admin.firestore.FieldValue.increment(activity.coins),
      [yearField]:                         admin.firestore.FieldValue.increment(activity.coins),
    });

    await batch.commit();

    // Invalidate cached balance
    getRedis().del(RK.vcoinBalance(userId)).catch(() => {});

    console.log(`✅ VCoin: user=${userId} activity=${activityId} coins=+${activity.coins} year=${year}`);
    return { success: true, coinsAwarded: activity.coins };
  });

// ─── getVCoinBalance ──────────────────────────────────────────────────────────

export const getVCoinBalance = functionsV1
  .runWith({ timeoutSeconds: 15, memory: "128MB", secrets: ["REDIS_URL", "REDIS_TOKEN"] })
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }

    const userId   = context.auth.uid;
    const cacheKey = RK.vcoinBalance(userId);

    try {
      const cached = await getRedis().get<number>(cacheKey);
      if (cached !== null) return { balance: cached };
    } catch { /* Redis unavailable */ }

    const snap    = await db.doc(`users/${userId}`).get();
    const balance = snap.data()?.vCoins ?? 0;

    getRedis().set(cacheKey, balance, { ex: TTL.vcoinBalance }).catch(() => {});

    return { balance };
  });

// ─── resetAnnualVCoins ────────────────────────────────────────────────────────
// Scheduled: every Jan 1 at 00:00 IST (= Dec 31 18:30 UTC)
// • Archives the ending year's vCoinsYear_YYYY into vCoinsHistory_{YYYY}
// • Clears vCoinsYear_YYYY on all user docs
// • Also clears any surprise gift flags so admin can set fresh ones
//
// This runs in batches of 500 to respect Firestore write limits.

export const resetAnnualVCoins = functionsV1
  .runWith({ timeoutSeconds: 540, memory: "512MB" })
  .pubsub.schedule("30 18 31 12 *") // Dec 31 18:30 UTC = Jan 1 00:00 IST
  .timeZone("UTC")
  .onRun(async (_context) => {
    const endingYear  = currentYearIST() - 1; // by this point IST is Jan 1 next year
    const endField    = `vCoinsYear_${endingYear}`;
    const histField   = `vCoinsHistory_${endingYear}`;

    console.log(`🔄 Annual VCoin reset: archiving ${endField} → ${histField}`);

    const PAGE_SIZE = 400;
    let lastDoc: admin.firestore.DocumentSnapshot | null = null;
    let totalProcessed = 0;

    while (true) {
      let q: admin.firestore.Query = db.collection("users")
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(PAGE_SIZE);

      if (lastDoc) q = q.startAfter(lastDoc);

      const snap = await q.get();
      if (snap.empty) break;

      const batch = db.batch();

      snap.docs.forEach((d) => {
        const data = d.data();
        const yearCoins = data[endField] ?? 0;

        const update: Record<string, any> = {
          // Archive the year's coins (preserve history)
          [histField]: yearCoins,
          // Reset the year field to 0 for the new year
          [endField]:  0,
          // Clear surprise gift so admin sets a fresh one
          "surpriseGift.available": false,
          "surpriseGift.claimed":   false,
          "surpriseGift.claimedAt": admin.firestore.FieldValue.delete(),
          "surpriseGift.deliveryAddress": admin.firestore.FieldValue.delete(),
        };

        batch.update(d.ref, update);
      });

      await batch.commit();
      totalProcessed += snap.docs.length;
      lastDoc = snap.docs[snap.docs.length - 1];

      console.log(`  Processed ${totalProcessed} users so far…`);

      if (snap.docs.length < PAGE_SIZE) break;
    }

    console.log(`✅ Annual VCoin reset complete. Total users processed: ${totalProcessed}`);
  });

// ─── vCoinsBalance crediting (security migration) ─────────────────────────────
// Moved here from apps/mobile/services/vCoinsService.ts's creditVCoins() /
// rewardForWatchCompletion() / claimSkillBattleRewards(), which ran
// entirely client-side via the Firestore client SDK. firestore.rules'
// users/{userId} update rule blocks direct client writes to vCoins,
// vCoinsLifetimeEarned/Spent, vCoinsYear_*, and vCoinsHistory_* — but never
// included vCoinsBalance, the field this pipeline actually increments and
// the one summed (with vCoins above) into the balance the app displays.
// That gap meant any authenticated user could set their own vCoinsBalance
// to an arbitrary number with a direct Firestore write, bypassing every
// daily-limit/duplicate check in vCoinsService.ts entirely — no app UI or
// Cloud Function involved. Moving the writes here and adding vCoinsBalance
// to firestore.rules' deny-list closes that off completely for the three
// sources below (signup bonus, reel/video/story watch, SkillBattle claim).
//
// Deliberately a SEPARATE pool from vCoins/claimVCoinReward above rather
// than merged into it — unifying the two historically-disconnected VCoins
// pools was out of scope for this migration, which only needed to move the
// WRITE PATH server-side, not redesign the balance model.
//
// SkillBattle rank verification is explicitly NOT part of this migration —
// claimSkillBattleReward below still trusts the client's claimed rank and
// prize amounts (ported as-is from claimSkillBattleRewards), same as
// before. It closes the "forge any balance via a raw Firestore write" hole
// but does not verify a claim against real battle standings; that needs
// the actual scoring data model explored first and is tracked separately.

interface VCoinRule {
  rewardAmount: number;
  dailyLimit:   number;
  isActive:     boolean;
}

// Mirrors apps/mobile/services/vCoinsService.ts's DEFAULT_DAILY_LIMITS for
// just the sources migrated here — used when no vCoinRules/{source} doc
// exists yet (or it's inactive). Keep in sync if admin ever edits these via
// VCoinRules.tsx and the fallback needs to change too.
const DEFAULT_DAILY_LIMITS: Record<string, number> = {
  SIGNUP_BONUS:                      200,
  REEL_WATCH_REWARD:                 30,
  VIDEO_WATCH_REWARD:                50,
  STORY_WATCH_REWARD:                20,
  SKILLBATTLE_WINNER_REWARD:         100,
  SKILLBATTLE_RUNNER_UP_REWARD:      100,
  SKILLBATTLE_PARTICIPATION_REWARD:  50,
};

async function getVCoinRule(source: string): Promise<VCoinRule | null> {
  try {
    const snap = await db.doc(`vCoinRules/${source}`).get();
    if (!snap.exists) return null;
    const rule = snap.data() as VCoinRule;
    return rule.isActive === false ? null : rule;
  } catch {
    return null;
  }
}

// Core transactional credit — every source below funnels through this so
// the duplicate-per-referenceId lock and per-source daily cap are enforced
// identically regardless of caller, same as the old creditVCoins() did.
async function creditVCoinsBalance(params: {
  uid:         string;
  amount:      number;
  source:      string;
  title:       string;
  description: string;
  referenceId: string;
  metadata?:   Record<string, unknown>;
  // BUGFIX (surfaced while implementing SB-P0-03's server-side reward
  // resolution): dailyLimit exists to cap REPEATABLE per-day earning
  // (reel/video/story watch), not a one-time prize payout. SkillBattle
  // credits used to route through the same cap anyway — a legitimate
  // ₹-pool-adjacent India rank-1 reward (e.g. 500 VCoins) was silently
  // clamped down to SKILLBATTLE_WINNER_REWARD's dailyLimit (100), with no
  // error or indication to the student that they were underpaid. A
  // SkillBattle claim already has its own correct anti-abuse control — one
  // claim per battle+scope via referenceId (this function's own lock
  // below) plus the immutable skillBattleAwards reservation
  // (claimSkillBattleReward) — so it doesn't need or want the daily cap on
  // top of that. Caught by functions/src/__tests__/skillBattleReward.test.ts.
  bypassDailyLimit?: boolean;
}): Promise<{ credited: boolean; amount: number; balanceAfter: number }> {
  const { uid, amount, source, title, description, referenceId, metadata = {}, bypassDailyLimit = false } = params;
  if (amount <= 0) return { credited: false, amount: 0, balanceAfter: 0 };

  const rule       = await getVCoinRule(source);
  const dailyLimit = bypassDailyLimit ? Number.MAX_SAFE_INTEGER : (rule?.dailyLimit ?? DEFAULT_DAILY_LIMITS[source] ?? 9999);

  const userRef       = db.doc(`users/${uid}`);
  const txRef          = userRef.collection("vCoinTransactions").doc();
  const lockRef        = userRef.collection("vCoinActivityLocks").doc(`${source}_${referenceId}`);
  const dailyKey       = `${source}_day_${todayIST()}`;
  const dailyLockRef   = userRef.collection("vCoinActivityLocks").doc(dailyKey);

  const now       = admin.firestore.FieldValue.serverTimestamp();
  const yearField = `vCoinsYear_${currentYearIST()}`;

  return db.runTransaction(async (tx) => {
    // ── Reads first — Firestore transactions require every read before any write ──
    const [lockSnap, userSnap, dailySnap] = await Promise.all([
      tx.get(lockRef),
      tx.get(userRef),
      tx.get(dailyLockRef),
    ]);

    const currentBalance = userSnap.exists ? (userSnap.data()?.vCoinsBalance ?? 0) : 0;

    if (lockSnap.exists) {
      return { credited: false, amount: 0, balanceAfter: currentBalance };
    }

    const earnedToday  = dailySnap.exists ? (dailySnap.data()?.earnedToday ?? 0) : 0;
    const actualAmount = Math.max(0, Math.min(amount, dailyLimit - earnedToday));
    if (actualAmount <= 0) {
      return { credited: false, amount: 0, balanceAfter: currentBalance };
    }

    // ── Writes ──
    tx.set(txRef, {
      type: "CREDIT", amount: actualAmount, source, title, description,
      status: "SUCCESS", referenceId, metadata, createdAt: now, updatedAt: now,
    });
    tx.set(userRef, {
      vCoinsBalance:        admin.firestore.FieldValue.increment(actualAmount),
      vCoinsLifetimeEarned: admin.firestore.FieldValue.increment(actualAmount),
      [yearField]:          admin.firestore.FieldValue.increment(actualAmount),
      vCoinsUpdatedAt:      now,
    }, { merge: true });
    tx.set(lockRef, { source, referenceId, amount: actualAmount, lastRewardedAt: now, createdAt: now });
    tx.set(dailyLockRef, {
      source, earnedToday: admin.firestore.FieldValue.increment(actualAmount), lastRewardedAt: now,
    }, { merge: true });

    return { credited: true, amount: actualAmount, balanceAfter: currentBalance + actualAmount };
  });
}

// ─── creditSignupBonus ──────────────────────────────────────────────────────
// referenceId is a fixed per-uid key ("signup_bonus"), so this can only
// ever credit once per user even if the client retries — same guarantee
// the old inline creditVCoins() call in register.tsx relied on.

export const creditSignupBonus = functionsV1
  .runWith({ timeoutSeconds: 15, memory: "128MB" })
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;

    const rule   = await getVCoinRule("SIGNUP_BONUS");
    const amount = rule?.rewardAmount ?? 200;

    const result = await creditVCoinsBalance({
      uid, amount, source: "SIGNUP_BONUS",
      title:       "Welcome Bonus",
      description: `${amount} VCoins for completing registration`,
      referenceId: "signup_bonus",
    });

    console.log(`✅ VCoins signup bonus: uid=${uid} credited=${result.credited} amount=${result.amount}`);
    return result;
  });

// ─── creditWatchReward ────────────────────────────────────────────────────
// contentId doubles as the idempotency key — one reward per piece of
// content ever, same as the old rewardForWatchCompletion(). watchPercentage
// stays self-reported by the client (no server-side playback verification
// exists) — this migration closes the "bypass the daily cap with a raw
// Firestore write" hole, it does not add watch-time anti-cheat.

const WATCH_REWARD_CONFIG: Record<"reel" | "video" | "story", { source: string; minPct: number; amount: number; title: string; description: string }> = {
  reel:  { source: "REEL_WATCH_REWARD",  minPct: 80,  amount: 1, title: "Watched Reel",                description: "Earned for watching a skill reel" },
  video: { source: "VIDEO_WATCH_REWARD", minPct: 80,  amount: 3, title: "Watched Educational Video",   description: "Earned for completing an educational video" },
  story: { source: "STORY_WATCH_REWARD", minPct: 100, amount: 1, title: "Watched Story",                description: "Earned for watching a full story" },
};

export const creditWatchReward = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "128MB" })
  .https.onCall(async (
    data: { contentId?: string; contentType?: "reel" | "video" | "story"; watchPercentage?: number },
    context
  ) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const { contentId, contentType, watchPercentage } = data ?? {};

    if (!contentId || typeof contentId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "contentId is required");
    }
    const config = contentType ? WATCH_REWARD_CONFIG[contentType] : undefined;
    if (!config) {
      throw new functionsV1.https.HttpsError("invalid-argument", 'contentType must be "reel", "video", or "story"');
    }
    if (typeof watchPercentage !== "number" || watchPercentage < config.minPct) {
      throw new functionsV1.https.HttpsError("failed-precondition", `Must watch at least ${config.minPct}% to earn a reward`);
    }

    const rule   = await getVCoinRule(config.source);
    const amount = rule?.rewardAmount ?? config.amount;

    const result = await creditVCoinsBalance({
      uid, amount, source: config.source,
      title:       config.title,
      description: config.description,
      referenceId: contentId,
      metadata:    { contentId, contentType, watchPercentage },
    });

    return result;
  });

// ─── SkillBattle: server-authoritative standing + reward resolution ───────
// SECURITY FIX (SkillBattle trust-boundary remediation — SB-P0-03/SB-P0-04/
// SB-P0-05): claimSkillBattleReward used to accept `ranks` AND `vcoins`
// (the reward-pool base amounts) directly from the client, with zero
// server-side cross-check — a caller could invoke this Cloud Function
// directly (no app UI needed) claiming e.g. rank #1 against a fabricated,
// oversized pool amount for a battleId that need not even be real, and
// receive an attacker-chosen VCoins amount. The client now sends ONLY
// battleId; every other value below (rank, pool, reward %, reward amount,
// whether the battle has even ended) is resolved here from trusted
// server-side reads of skillboard/{battleId}_{class}_{uid} (written by
// updateSkillboard, functions/src/index.ts) and skillBattles/{battleId} —
// never from the request payload.
//
// VCOIN_DIST_PCT here is now the ONE authoritative reward-percentage table
// — it used to have an independent copy in
// apps/mobile/utils/formatVCoins.ts that had already drifted out of sync
// (SB-P0-05), showing students one reward number and paying a different
// one. The client no longer computes its own reward preview for anything
// that could actually be claimed — getMySkillBattleStanding below returns
// a server-computed estimatedReward the client only displays. See
// functions/src/__tests__/skillBattleRewardDrift.test.ts for the
// regression test guarding against this table ever drifting again.

const VCOIN_DIST_PCT = [50, 30, 20, 12, 10, 8, 6, 5, 4, 3];

function getSkillBattleCoinForRank(baseCoins: number, rank: number): number {
  if (rank < 1 || rank > 10 || baseCoins <= 0) return 0;
  return Math.round((baseCoins * (VCOIN_DIST_PCT[rank - 1] ?? 0)) / 100);
}

function skillBattleSource(rank: number): string {
  if (rank === 1) return "SKILLBATTLE_WINNER_REWARD";
  if (rank === 2) return "SKILLBATTLE_RUNNER_UP_REWARD";
  return "SKILLBATTLE_PARTICIPATION_REWARD";
}

const SKILLBATTLE_SCOPE_LABELS: Record<string, string> = {
  india: "All India", state: "State", district: "District", local: "Local",
};
const SKILLBATTLE_SCOPES = ["india", "state", "district", "local"] as const;
type SkillBattleScope = (typeof SKILLBATTLE_SCOPES)[number];

interface SkillBattleDoc {
  endDate?:        string | null;
  month?:          string;
  vcoin_india?:    number;
  vcoin_state?:    number;
  vcoin_district?: number;
  vcoin_local?:    number;
}

interface SkillboardRankDoc {
  totalScore?: number;
  ranks?: Partial<Record<SkillBattleScope, number>>;
}

// Shared by getMySkillBattleStanding and claimSkillBattleReward — both need
// the same "read the battle + this student's class + their skillboard doc"
// resolution, and must agree on what a battle's reward pool per scope is.
async function resolveSkillBattleStanding(uid: string, battleId: string): Promise<{
  battle: SkillBattleDoc;
  battleEnded: boolean;
  cls: string;
  totalScore: number;
  ranks: Record<SkillBattleScope, number>;
  vcoinPool: Record<SkillBattleScope, number>;
}> {
  const [battleSnap, studentSnap] = await Promise.all([
    db.doc(`skillBattles/${battleId}`).get(),
    db.doc(`students/${uid}`).get(),
  ]);

  if (!battleSnap.exists) {
    throw new functionsV1.https.HttpsError("not-found", "This battle does not exist.");
  }
  const battle = battleSnap.data() as SkillBattleDoc;
  const battleEnded = !!battle.endDate && new Date(battle.endDate).getTime() <= Date.now();

  const cls = studentSnap.exists
    ? String((studentSnap.data() as { class?: string | number })?.class ?? "")
    : "";

  const vcoinPool: Record<SkillBattleScope, number> = {
    india:    battle.vcoin_india    ?? 0,
    state:    battle.vcoin_state    ?? 0,
    district: battle.vcoin_district ?? 0,
    local:    battle.vcoin_local    ?? 0,
  };

  if (!cls) {
    return { battle, battleEnded, cls, totalScore: 0, ranks: { india: 0, state: 0, district: 0, local: 0 }, vcoinPool };
  }

  const skillboardSnap = await db.doc(`skillboard/${battleId}_${cls}_${uid}`).get();
  const skillboard = skillboardSnap.exists ? (skillboardSnap.data() as SkillboardRankDoc) : null;

  return {
    battle,
    battleEnded,
    cls,
    totalScore: skillboard?.totalScore ?? 0,
    ranks: {
      india:    skillboard?.ranks?.india    ?? 0,
      state:    skillboard?.ranks?.state    ?? 0,
      district: skillboard?.ranks?.district ?? 0,
      local:    skillboard?.ranks?.local    ?? 0,
    },
    vcoinPool,
  };
}

// ─── getMySkillBattleStanding ──────────────────────────────────────────────
// Read-only. Lets the client show "my rank" / "my estimated reward" for a
// battle using the server-computed skillboard doc instead of recomputing
// ranks itself from raw posts reads (the client-trusted approach the audit
// flagged — SB-P0-04). Participant counts use Firestore's server-side
// count() aggregation, not a full document fetch, so this stays cheap
// regardless of how many students are in a scope (foundation for SB-P1-01).
export const getMySkillBattleStanding = functionsV1
  .runWith({ timeoutSeconds: 20, memory: "128MB" })
  .https.onCall(async (data: { battleId?: string }, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const { battleId } = data ?? {};
    if (!battleId || typeof battleId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "battleId is required");
    }

    const { battleEnded, cls, totalScore, ranks, vcoinPool } =
      await resolveSkillBattleStanding(uid, battleId);

    const estimatedReward: Record<SkillBattleScope, number> = { india: 0, state: 0, district: 0, local: 0 };
    const participants: Record<SkillBattleScope, number> = { india: 0, state: 0, district: 0, local: 0 };

    if (cls) {
      await Promise.all(SKILLBATTLE_SCOPES.map(async (scope) => {
        estimatedReward[scope] = getSkillBattleCoinForRank(vcoinPool[scope], ranks[scope]);
        try {
          const countSnap = await db.collection("skillboard")
            .where("battleId", "==", battleId)
            .where("class",    "==", cls)
            .where(`ranks.${scope}`, ">", 0)
            .count()
            .get();
          participants[scope] = countSnap.data().count;
        } catch {
          participants[scope] = 0;
        }
      }));
    }

    return { battleId, class: cls, battleEnded, totalScore, ranks, estimatedReward, participants };
  });

// ─── claimSkillBattleReward ────────────────────────────────────────────────
// referenceId = `${battleId}_${scope}` caps each scope's VCoins credit to
// once per battle (creditVCoinsBalance's own lock). On top of that, an
// immutable skillBattleAwards/{battleId}_{uid} doc is reserved via a
// transaction BEFORE any crediting happens (Step 10: one immutable award,
// no duplicate claims, auditable) — a second call for the same
// battle+student, even a concurrent one, sees the award already reserved
// and returns the original result instead of crediting again.
export const claimSkillBattleReward = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "128MB" })
  .https.onCall(async (data: { battleId?: string }, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const { battleId } = data ?? {};
    if (!battleId || typeof battleId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "battleId is required");
    }

    const { battle, battleEnded, cls, ranks, vcoinPool } =
      await resolveSkillBattleStanding(uid, battleId);

    if (!battleEnded) {
      throw new functionsV1.https.HttpsError(
        "failed-precondition",
        "This battle hasn't ended yet — rewards are only claimable once results are final."
      );
    }
    if (!cls) {
      return { totalCredited: 0, alreadyClaimed: false, breakdown: {} };
    }

    const awardRef = db.doc(`skillBattleAwards/${battleId}_${uid}`);

    // Reserve the award atomically first — this is the single point that
    // prevents a duplicate/concurrent claim, independent of and in
    // addition to creditVCoinsBalance's own per-scope referenceId lock.
    const reservation = await db.runTransaction(async (tx) => {
      const existing = await tx.get(awardRef);
      if (existing.exists) {
        return { alreadyReserved: true, data: existing.data() };
      }

      const breakdown: Record<string, { rank: number; baseCoins: number; coins: number }> = {};
      let totalCoins = 0;
      for (const scope of SKILLBATTLE_SCOPES) {
        const rank  = ranks[scope];
        const base  = vcoinPool[scope];
        const coins = getSkillBattleCoinForRank(base, rank);
        breakdown[scope] = { rank, baseCoins: base, coins };
        totalCoins += coins;
      }

      tx.set(awardRef, {
        battleId, uid, class: cls,
        battleMonth: battle.month ?? "",
        breakdown, totalCoins,
        status:    "reserved",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { alreadyReserved: false, data: { breakdown, totalCoins } };
    });

    if (reservation.alreadyReserved) {
      const existing = reservation.data as { totalCoins?: number; breakdown?: unknown } | undefined;
      console.log(`ℹ️ SkillBattle claim already awarded: uid=${uid} battle=${battleId}`);
      return {
        totalCredited: existing?.totalCoins ?? 0,
        alreadyClaimed: true,
        breakdown: existing?.breakdown ?? {},
      };
    }

    const { breakdown } = reservation.data as {
      breakdown: Record<string, { rank: number; baseCoins: number; coins: number }>;
    };

    let totalCredited = 0;
    for (const scope of SKILLBATTLE_SCOPES) {
      const { rank, baseCoins, coins } = breakdown[scope];
      if (coins <= 0) continue;

      const source     = skillBattleSource(rank);
      const scopeLabel = SKILLBATTLE_SCOPE_LABELS[scope] ?? scope;

      const result = await creditVCoinsBalance({
        uid, amount: coins, source,
        title:       `SkillBattle ${scopeLabel} · Rank #${rank}`,
        description: `${battle.month ?? ""} SkillBattle — ${scopeLabel} rank #${rank}`,
        referenceId: `${battleId}_${scope}`,
        metadata:    { battleId, battleMonth: battle.month ?? "", scope, rank, baseCoins },
        // BUGFIX: see creditVCoinsBalance's bypassDailyLimit doc comment —
        // this is a one-time battle prize, not a repeatable per-day
        // source; the referenceId lock above + the award reservation in
        // the caller already prevent double-payment.
        bypassDailyLimit: true,
      });
      if (result.credited) totalCredited += result.amount;
    }

    await awardRef.set({
      status: "credited",
      creditedAt: admin.firestore.FieldValue.serverTimestamp(),
      totalCredited,
    }, { merge: true });

    console.log(`✅ SkillBattle claim: uid=${uid} battle=${battleId} totalCredited=${totalCredited}`);
    return { totalCredited, alreadyClaimed: false, breakdown };
  });

// ─── manualResetAnnualVCoins ──────────────────────────────────────────────────
// Admin-callable version of the above (for testing or emergency reset)

export const manualResetAnnualVCoins = functionsV1
  .runWith({ timeoutSeconds: 540, memory: "512MB" })
  .https.onCall(async (_data, context) => {
    if (!context.auth?.token?.admin) {
      throw new functionsV1.https.HttpsError("permission-denied", "Admin only");
    }

    const year      = currentYearIST();
    const yearField = `vCoinsYear_${year}`;
    const histField = `vCoinsHistory_${year}`;

    const PAGE_SIZE = 400;
    let lastDoc: admin.firestore.DocumentSnapshot | null = null;
    let totalProcessed = 0;

    while (true) {
      let q: admin.firestore.Query = db.collection("users")
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(PAGE_SIZE);

      if (lastDoc) q = q.startAfter(lastDoc);

      const snap = await q.get();
      if (snap.empty) break;

      const batch = db.batch();
      snap.docs.forEach((d) => {
        batch.update(d.ref, {
          [histField]: d.data()[yearField] ?? 0,
          [yearField]: 0,
          "surpriseGift.available": false,
        });
      });

      await batch.commit();
      totalProcessed += snap.docs.length;
      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < PAGE_SIZE) break;
    }

    return { success: true, totalProcessed };
  });

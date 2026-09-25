import * as admin from "firebase-admin";
import { getRedis, todayIST, ttlUntilMidnightIST, TTL, RK } from "./redish";
import { tryDebitAiGuruCredit, type AiGuruCreditFeature } from "./aiGuruCreditDebit";

const FREE_DAILY_LESSONS   = 2;
const FREE_DAILY_FOLLOWUPS = 5;

// Every check*Limit function below returns this once the free daily limit
// is exceeded — {creditTxId: null} means "unmetered" (premium, or still
// within the free limit); a non-null creditTxId means this specific call
// was paid for with a credit, which the caller must hang onto and pass to
// refundAiGuruCredit() if the downstream AI call then fails.
export interface QuotaResult { creditTxId: string | null; }

// ─── Subscription cache ───────────────────────────────────────────────────────

export async function getSubscription(
  uid: string,
  db: admin.firestore.Firestore
): Promise<{ isPremium: boolean }> {
  const key = RK.aiGuruSub(uid);

  try {
    const cached = await getRedis().get<{ isPremium: boolean }>(key);
    if (cached !== null) return cached;
  } catch { /* Redis unavailable */ }

  try {
    // FIX (tester access): mirrors apps/mobile/services/aiGuruFirestore.ts's
    // isSubscribed() — without this, a tester/admin's client shows "Premium"
    // (that file's own bypass) while this server-side check doesn't know
    // that, so they'd get charged credits on a screen telling them they're
    // unlimited.
    const userSnap = await db.doc(`users/${uid}`).get();
    const role = userSnap.exists ? userSnap.data()?.role : undefined;
    if (role === "tester" || role === "admin") {
      const result = { isPremium: true };
      getRedis().set(key, result, { ex: TTL.subscription }).catch(() => {});
      return result;
    }

    const snap = await db.doc(`subscriptions/${uid}`).get();
    const isPremium =
      snap.exists &&
      snap.data()?.status === "active" &&
      (snap.data()?.endDate?.toMillis() ?? 0) > Date.now();
    const result = { isPremium };
    getRedis().set(key, result, { ex: TTL.subscription }).catch(() => {});
    return result;
  } catch {
    return { isPremium: false };
  }
}

// ─── Credit fallback ────────────────────────────────────────────────────────
// Shared by every check*Limit function below once its free daily limit is
// hit: try to pay with a credit instead of hard-blocking. Throws
// "CREDITS_EXHAUSTED:<message>" (same prefixed-string-error convention
// this file already uses for "FREE_LIMIT_REACHED:") when there's nothing
// left to pay with, so existing callers only need one more prefix check
// alongside the one they already have.

// Thrown by payWithCreditOrThrow so callers can read structured
// creditBalance/creditsRequired off the error (in addition to the
// human-readable message) and pass them through to the client — mobile's
// PremiumLock renders "Use N credit(s) · X left" from these, not by
// parsing the message text.
export class CreditsExhaustedError extends Error {
  creditBalance: number;
  creditsRequired: number;
  constructor(message: string, creditBalance: number, creditsRequired: number) {
    super(`CREDITS_EXHAUSTED:${message}`);
    this.creditBalance = creditBalance;
    this.creditsRequired = creditsRequired;
  }
}

async function payWithCreditOrThrow(
  uid: string,
  db: admin.firestore.Firestore,
  feature: AiGuruCreditFeature,
  freeLimitMessage: string
): Promise<QuotaResult> {
  const debit = await tryDebitAiGuruCredit(uid, feature, db);
  if (debit.ok) return { creditTxId: debit.txId };

  const balance  = debit.reason === "insufficient" ? debit.balance  : 0;
  const required = debit.reason === "insufficient" ? debit.required : 1;
  const balanceNote = debit.reason === "insufficient"
    ? ` You have ${balance} credit${balance === 1 ? "" : "s"} left, need ${required}.`
    : "";
  throw new CreditsExhaustedError(
    `${freeLimitMessage}${balanceNote} Buy credits or upgrade to Premium.`,
    balance,
    required
  );
}

// ─── Rate limit checks ────────────────────────────────────────────────────────

export async function checkGenerationLimit(
  uid: string,
  db: admin.firestore.Firestore
): Promise<QuotaResult> {
  const { isPremium } = await getSubscription(uid, db);
  if (isPremium) return { creditTxId: null };

  const key = RK.aiGuruGen(uid, todayIST());
  let used = 0;

  try {
    const count = await getRedis().get<number>(key);
    if (count !== null) {
      used = count;
    } else {
      // Cold start — seed from Firestore
      const snap = await db.doc(`aiGuruUsage/${uid}/daily/${todayIST()}`).get();
      used = snap.exists ? (snap.data()?.generationsUsed ?? 0) : 0;
      if (used > 0) {
        getRedis().set(key, used, { ex: ttlUntilMidnightIST() }).catch(() => {});
      }
    }
  } catch {
    const snap = await db.doc(`aiGuruUsage/${uid}/daily/${todayIST()}`).get();
    used = snap.exists ? (snap.data()?.generationsUsed ?? 0) : 0;
  }

  if (used >= FREE_DAILY_LESSONS) {
    return payWithCreditOrThrow(
      uid, db, "LESSON_GENERATION",
      `You have used your ${FREE_DAILY_LESSONS} free lessons for today.`
    );
  }
  return { creditTxId: null };
}

export async function checkFollowUpLimit(
  uid: string,
  db: admin.firestore.Firestore
): Promise<QuotaResult> {
  const { isPremium } = await getSubscription(uid, db);
  if (isPremium) return { creditTxId: null };

  const key = RK.aiGuruFollowup(uid, todayIST());
  let used = 0;

  try {
    const count = await getRedis().get<number>(key);
    if (count !== null) {
      used = count;
    } else {
      const snap = await db.doc(`aiGuruUsage/${uid}/daily/${todayIST()}`).get();
      used = snap.exists ? (snap.data()?.quizAttempts ?? 0) : 0;
      if (used > 0) {
        getRedis().set(key, used, { ex: ttlUntilMidnightIST() }).catch(() => {});
      }
    }
  } catch {
    const snap = await db.doc(`aiGuruUsage/${uid}/daily/${todayIST()}`).get();
    used = snap.exists ? (snap.data()?.quizAttempts ?? 0) : 0;
  }

  if (used >= FREE_DAILY_FOLLOWUPS) {
    return payWithCreditOrThrow(
      uid, db, "LESSON_FOLLOWUP",
      `You have used your ${FREE_DAILY_FOLLOWUPS} free follow-ups for today.`
    );
  }
  return { creditTxId: null };
}

// ─── Increment usage ──────────────────────────────────────────────────────────

export async function incrementGenerationUsage(
  uid: string,
  db: admin.firestore.Firestore
): Promise<void> {
  const key = RK.aiGuruGen(uid, todayIST());
  try {
    const count = await getRedis().incr(key);
    if (count === 1) await getRedis().expire(key, ttlUntilMidnightIST());
  } catch { /* Redis unavailable */ }

  // Async Firestore write for persistence
  db.doc(`aiGuruUsage/${uid}/daily/${todayIST()}`).set(
    {
      generationsUsed: admin.firestore.FieldValue.increment(1),
      lastGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  ).catch((e) => console.warn("aiGuruUsage gen write failed:", e));
}

export async function incrementFollowUpUsage(
  uid: string,
  db: admin.firestore.Firestore
): Promise<void> {
  const key = RK.aiGuruFollowup(uid, todayIST());
  try {
    const count = await getRedis().incr(key);
    if (count === 1) await getRedis().expire(key, ttlUntilMidnightIST());
  } catch { /* Redis unavailable */ }

  db.doc(`aiGuruUsage/${uid}/daily/${todayIST()}`).set(
    { quizAttempts: admin.firestore.FieldValue.increment(1) },
    { merge: true }
  ).catch((e) => console.warn("aiGuruUsage followup write failed:", e));
}

// ─── Ask AI Guru limits ───────────────────────────────────────────────────────

const FREE_ASK_GURU_DAILY = 5;

export async function checkAskGuruLimit(
  uid: string,
  db: admin.firestore.Firestore
): Promise<QuotaResult> {
  const { isPremium } = await getSubscription(uid, db);
  if (isPremium) return { creditTxId: null };

  const key = RK.askGuruChat(uid, todayIST());
  let used = 0;

  try {
    const count = await getRedis().get<number>(key);
    if (count !== null) {
      used = count;
    } else {
      const snap = await db.doc(`askGuruUsage/${uid}/daily/${todayIST()}`).get();
      used = snap.exists ? (snap.data()?.questionsUsed ?? 0) : 0;
      if (used > 0) getRedis().set(key, used, { ex: ttlUntilMidnightIST() }).catch(() => {});
    }
  } catch {
    const snap = await db.doc(`askGuruUsage/${uid}/daily/${todayIST()}`).get();
    used = snap.exists ? (snap.data()?.questionsUsed ?? 0) : 0;
  }

  if (used >= FREE_ASK_GURU_DAILY) {
    return payWithCreditOrThrow(
      uid, db, "ASK_GURU",
      `You have used your ${FREE_ASK_GURU_DAILY} free questions for today.`
    );
  }
  return { creditTxId: null };
}

export async function incrementAskGuruUsage(
  uid: string,
  db: admin.firestore.Firestore
): Promise<void> {
  const key = RK.askGuruChat(uid, todayIST());
  try {
    const count = await getRedis().incr(key);
    if (count === 1) await getRedis().expire(key, ttlUntilMidnightIST());
  } catch { /* Redis unavailable */ }

  db.doc(`askGuruUsage/${uid}/daily/${todayIST()}`).set(
    { questionsUsed: admin.firestore.FieldValue.increment(1), lastAskedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  ).catch((e) => console.warn("askGuruUsage write failed:", e));
}

// ─── VidyaGuru chat limits ────────────────────────────────────────────────────

const FREE_VIDYAGURU_DAILY = 1;

export async function checkVidyaGuruLimit(
  uid: string,
  db: admin.firestore.Firestore
): Promise<QuotaResult> {
  const { isPremium } = await getSubscription(uid, db);
  if (isPremium) return { creditTxId: null };

  const key = RK.vidyaGuruChat(uid, todayIST());
  let used = 0;

  try {
    const count = await getRedis().get<number>(key);
    if (count !== null) {
      used = count;
    } else {
      const snap = await db.doc(`vidyaguruUsage/${uid}/daily/${todayIST()}`).get();
      used = snap.exists ? (snap.data()?.questionsUsed ?? 0) : 0;
      if (used > 0) getRedis().set(key, used, { ex: ttlUntilMidnightIST() }).catch(() => {});
    }
  } catch {
    const snap = await db.doc(`vidyaguruUsage/${uid}/daily/${todayIST()}`).get();
    used = snap.exists ? (snap.data()?.questionsUsed ?? 0) : 0;
  }

  if (used >= FREE_VIDYAGURU_DAILY) {
    return payWithCreditOrThrow(
      uid, db, "VIDYAGURU",
      `You've used your free VidyaGuru question for today.`
    );
  }
  return { creditTxId: null };
}

export async function incrementVidyaGuruUsage(
  uid: string,
  db: admin.firestore.Firestore
): Promise<void> {
  const key = RK.vidyaGuruChat(uid, todayIST());
  try {
    const count = await getRedis().incr(key);
    if (count === 1) await getRedis().expire(key, ttlUntilMidnightIST());
  } catch { /* Redis unavailable */ }

  db.doc(`vidyaguruUsage/${uid}/daily/${todayIST()}`).set(
    { questionsUsed: admin.firestore.FieldValue.increment(1), lastAskedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  ).catch((e) => console.warn("vidyaguruUsage write failed:", e));
}

import * as admin from "firebase-admin";
import { getRedis, todayIST, ttlUntilMidnightIST, TTL, RK } from "./redish";

const FREE_DAILY_LESSONS   = 2;
const FREE_DAILY_FOLLOWUPS = 5;

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

// ─── Rate limit checks ────────────────────────────────────────────────────────

export async function checkGenerationLimit(
  uid: string,
  db: admin.firestore.Firestore
): Promise<void> {
  const { isPremium } = await getSubscription(uid, db);
  if (isPremium) return;

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
    throw new Error(
      `FREE_LIMIT_REACHED:You have used your ${FREE_DAILY_LESSONS} free lessons for today. Upgrade to Premium for unlimited lessons.`
    );
  }
}

export async function checkFollowUpLimit(
  uid: string,
  db: admin.firestore.Firestore
): Promise<void> {
  const { isPremium } = await getSubscription(uid, db);
  if (isPremium) return;

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
    throw new Error(
      `FREE_LIMIT_REACHED:You have used your ${FREE_DAILY_FOLLOWUPS} free follow-ups for today.`
    );
  }
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
): Promise<void> {
  const { isPremium } = await getSubscription(uid, db);
  if (isPremium) return;

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
    throw new Error(
      `FREE_LIMIT_REACHED:You have used your ${FREE_ASK_GURU_DAILY} free questions for today. Come back tomorrow or upgrade to Premium.`
    );
  }
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
): Promise<void> {
  const { isPremium } = await getSubscription(uid, db);
  if (isPremium) return;

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
    throw new Error(
      `FREE_LIMIT_REACHED:You've used your free VidyaGuru question for today. Upgrade to Premium for unlimited conversations.`
    );
  }
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

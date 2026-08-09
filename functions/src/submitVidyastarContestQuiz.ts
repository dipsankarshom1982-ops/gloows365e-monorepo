// PATH: functions/src/submitVidyastarContestQuiz.ts
// Server-side version of finishing a VidyaStar contest quiz.
//
// The client implementation (apps/mobile & apps/web
// services/submitContestQuiz.ts) wrote the current user's own participant
// doc (allowed by firestore.rules) but ALSO tried to batch.update() every
// OTHER participant's doc to stamp their rank — firestore.rules only
// allows a user to update their own participant doc
// (contests/{id}/participant/{userId}, request.auth.uid == userId), so
// that cross-user write violates the rules. Firestore batches are
// all-or-nothing: the one bad write fails the ENTIRE batch, which means
// submitContestQuiz has been throwing on every contest with more than one
// participant — no score/rank ever returned, no Starboard sync, no V-Coins
// award. This callable does the same scoring + ranking, but via the Admin
// SDK (not subject to firestore.rules), so it can legitimately update
// every participant's rank in one atomic batch. It also folds in the
// Starboard sync and V-Coins award, which — same root cause — were
// writing to leaderboard/{tab}/entries/{uid}, a path with no matching
// firestore.rules entry at all (default-deny), so they were silently
// failing too (masked by their own .catch(() => {})).

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";

const db = admin.firestore();

interface QuizAnswer {
  questionIndex:    number;
  selectedIndex:    number | null;
  correct:          boolean;
  timeTakenSeconds: number;
}

const LEADERBOARD_TABS = ["daily", "weekly", "monthly", "yearly"] as const;
const VIDYASTAR_CONTEST_ENTRY = "VIDYASTAR_CONTEST_ENTRY";
const DEFAULT_CONTEST_REWARD  = 50;

async function getContestRewardAmount(): Promise<number> {
  try {
    const snap = await db.doc(`vCoinRules/${VIDYASTAR_CONTEST_ENTRY}`).get();
    if (snap.exists) {
      const rule = snap.data() as { isActive?: boolean; rewardAmount?: number };
      if (rule.isActive && typeof rule.rewardAmount === "number") return rule.rewardAmount;
    }
  } catch { /* fall through to default */ }
  return DEFAULT_CONTEST_REWARD;
}

async function syncToStarboard(uid: string, score: number): Promise<void> {
  if (score <= 0) return;

  let name = "Student";
  let state: string | undefined;
  let studentClass: string | number | undefined;
  try {
    const snap = await db.doc(`students/${uid}`).get();
    if (snap.exists) {
      const d = snap.data() as Record<string, any>;
      name         = d.name || name;
      state        = d.location?.state;
      studentClass = d.class;
    }
  } catch { /* keep defaults */ }

  const now   = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  for (const tab of LEADERBOARD_TABS) {
    const ref = db.doc(`leaderboard/${tab}/entries/${uid}`);
    batch.set(ref, {
      name,
      ...(state ? { state } : {}),
      ...(studentClass != null ? { class: studentClass } : {}),
      points:    admin.firestore.FieldValue.increment(score),
      updatedAt: now,
    }, { merge: true });
  }
  await batch.commit();
}

async function awardContestVCoins(uid: string, contestId: string): Promise<void> {
  // Same dedup pattern as the client's creditVCoins()/canRewardForContent —
  // one award per (source, contestId), ever.
  const lockRef = db.doc(`users/${uid}/vCoinActivityLocks/${VIDYASTAR_CONTEST_ENTRY}_${contestId}`);
  const lockSnap = await lockRef.get();
  if (lockSnap.exists) return;

  const amount = await getContestRewardAmount();
  if (amount <= 0) return;

  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();

  batch.set(db.collection(`users/${uid}/vCoinTransactions`).doc(), {
    type:        "CREDIT",
    amount,
    source:      VIDYASTAR_CONTEST_ENTRY,
    title:       "VidyaStar Contest Completed",
    description: "Reward for completing a VidyaStar contest quiz",
    status:      "SUCCESS",
    referenceId: contestId,
    metadata:    { contestId },
    createdAt:   now,
    updatedAt:   now,
  });

  batch.set(db.doc(`users/${uid}`), {
    vCoinsBalance:        admin.firestore.FieldValue.increment(amount),
    vCoinsLifetimeEarned: admin.firestore.FieldValue.increment(amount),
    vCoinsUpdatedAt:      now,
  }, { merge: true });

  batch.set(lockRef, {
    source:         VIDYASTAR_CONTEST_ENTRY,
    referenceId:    contestId,
    earnedToday:    amount,
    lastRewardedAt: now,
    createdAt:      now,
  });

  await batch.commit();
}

export const submitVidyastarContestQuiz = functionsV1
  .runWith({ timeoutSeconds: 60, memory: "128MB" })
  .https.onCall(async (
    data: { contestId: string; answers: QuizAnswer[] },
    context
  ) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid       = context.auth.uid;
    const contestId = (data?.contestId ?? "").trim();
    const answers   = Array.isArray(data?.answers) ? data.answers : null;

    if (!contestId || !answers) {
      throw new functionsV1.https.HttpsError("invalid-argument", "contestId and answers are required");
    }

    const participantRef  = db.doc(`contests/${contestId}/participant/${uid}`);
    const participantSnap = await participantRef.get();

    if (!participantSnap.exists) {
      throw new functionsV1.https.HttpsError("failed-precondition", "You haven't joined this contest");
    }
    if (participantSnap.data()?.completed) {
      throw new functionsV1.https.HttpsError("already-exists", "Quiz already submitted for this contest");
    }

    // Backfill safety net: joinVidyastarContest denormalizes `name` onto
    // this doc at join time (firestore.rules blocks the leaderboard from
    // reading another student's name directly, so it has to come from
    // here) — but participants who joined before that fix shipped won't
    // have it. The leaderboard only shows completed participants, so
    // filling this in here guarantees every row it ever renders has a
    // real name, regardless of when the student joined.
    let participantName = participantSnap.data()?.name as string | undefined;
    if (!participantName) {
      const studentSnap = await db.doc(`students/${uid}`).get();
      participantName = studentSnap.exists ? (studentSnap.data()?.name ?? "Student") : "Student";
    }

    const correctAnswers = answers.filter((a) => a.correct).length;
    const timeBonus = answers.reduce((sum, a) => {
      if (!a.correct) return sum;
      const bonus = Math.max(0, Math.floor(5 * (30 - a.timeTakenSeconds) / 25));
      return sum + bonus;
    }, 0);
    const totalScore      = correctAnswers * 10 + timeBonus;
    const quizCompletedAt = admin.firestore.FieldValue.serverTimestamp();
    const nowLocal        = new Date();

    const allSnap = await db.collection(`contests/${contestId}/participant`).get();
    const participants = allSnap.docs.map((d) => {
      if (d.id === uid) {
        return { id: d.id, ref: d.ref, score: totalScore, completedAt: nowLocal };
      }
      const data2 = d.data();
      return {
        id: d.id,
        ref: d.ref,
        score: data2.score ?? 0,
        completedAt: (data2.quizCompletedAt?.toDate?.() as Date | undefined) ?? new Date(0),
      };
    });

    participants.sort((a, b) =>
      b.score !== a.score ? b.score - a.score : a.completedAt.getTime() - b.completedAt.getTime()
    );

    const myRank = participants.findIndex((p) => p.id === uid) + 1;

    const batch = db.batch();
    batch.set(participantRef, {
      answers,
      timeBonus,
      name:           participantName,
      score:          totalScore,
      completed:      true,
      quizCompletedAt,
      updatedAt:      quizCompletedAt,
    }, { merge: true });

    participants.forEach((p, i) => {
      batch.update(p.ref, { rank: i + 1 });
    });

    await batch.commit();

    // Best-effort, same as the client version — neither should block the
    // quiz result from returning to the student.
    await Promise.all([
      syncToStarboard(uid, totalScore).catch((e) => console.warn("Starboard sync failed:", e)),
      awardContestVCoins(uid, contestId).catch((e) => console.warn("VCoins award failed:", e)),
    ]);

    console.log(`✅ VidyaStar quiz submitted: user=${uid} contest=${contestId} score=${totalScore} rank=${myRank}`);
    return { score: totalScore, rank: myRank };
  });

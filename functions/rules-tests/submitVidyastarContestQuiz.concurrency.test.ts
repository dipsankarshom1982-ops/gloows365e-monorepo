// PATH: functions/rules-tests/submitVidyastarContestQuiz.concurrency.test.ts
//
// Phase 1.5 Critical Check 9 — concurrent submission safety. This was
// explicitly NOT verifiable by the offline unit suite
// (src/__tests__/submitVidyastarContestQuiz.test.ts): that suite mocks
// firebase-admin onto an in-memory FakeFirestore whose runTransaction()
// just calls the callback directly with no contention detection or retry
// — it cannot model Firestore's real optimistic-concurrency behavior, so
// it can't prove two truly concurrent submissions don't both slip through.
//
// This file runs the REAL submitVidyastarContestQuiz module (not mocked)
// against the REAL Firestore emulator (same one rules-tests/firestore.
// rules.test.ts uses — this file lives alongside it so `npm run test:rules`
// picks it up automatically via jest.rules.config.js's testMatch), and
// fires several truly concurrent .run() calls at it. The real emulator
// implements genuine optimistic-concurrency transactions with automatic
// retry, so this is a real test of the atomic claim-then-grade pattern in
// submitVidyastarContestQuiz.ts, not a simulation of one.

import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: "demo-gloows365e-test" });
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { submitVidyastarContestQuiz } = require("../src/submitVidyastarContestQuiz");

const db = admin.firestore();

const CONTEST_ID = "concurrency_contest_1";
const UID = "concurrency_student_1";
const CTX = { auth: { uid: UID } };

const ANSWER_KEY = [
  { correctAnswerIndex: 1, explanation: "" },
  { correctAnswerIndex: 0, explanation: "" },
  { correctAnswerIndex: 2, explanation: "" },
];
const ANSWERS = [
  { questionIndex: 0, selectedIndex: 1, timeTakenSeconds: 5 },
  { questionIndex: 1, selectedIndex: 0, timeTakenSeconds: 5 },
  { questionIndex: 2, selectedIndex: 2, timeTakenSeconds: 5 },
];
// All 3 answers are correct here (selectedIndex matches every
// correctAnswerIndex) — 3 correct * 10 + time bonus for 3 correct at 5s
// each (floor(5*(30-5)/25) = 5 each) = 30 + 15 = 45.
const EXPECTED_SCORE = 45;

test("N truly concurrent submissions of the same quiz produce exactly one graded result, one V-Coins credit, and one Starboard update", async () => {
  const now = Date.now();
  await db.doc(`contests/${CONTEST_ID}`).set({
    title: "Concurrency Test Contest",
    startTime: admin.firestore.Timestamp.fromMillis(now - 60_000),
    endTime: admin.firestore.Timestamp.fromMillis(now + 3_600_000),
    isActive: true,
  });
  await db.doc(`contests/${CONTEST_ID}/participant/${UID}`).set({
    userId: UID, contestId: CONTEST_ID, name: "Concurrency Student", score: 0, completed: false,
  });
  await db.doc(`students/${UID}`).set({ name: "Concurrency Student", preferredLanguage: "English", class: "8" });
  await db.doc(`users/${UID}`).set({ role: "student", vCoinsBalance: 0 });
  await db.doc(`contests/${CONTEST_ID}/lessonAnswers/English`).set({ answerKey: ANSWER_KEY });

  // Fire 5 genuinely concurrent submission attempts — no await between
  // them, all racing against the real emulator's transaction machinery.
  const callDurationsMs: number[] = [];
  const settled = await Promise.allSettled(
    Array.from({ length: 5 }, () => {
      const t0 = Date.now();
      return submitVidyastarContestQuiz.run({ contestId: CONTEST_ID, answers: ANSWERS }, CTX)
        .finally(() => { callDurationsMs.push(Date.now() - t0); });
    })
  );

  // None should throw — the loser(s) of the race get the idempotent
  // "already submitted" return (same verified result), not an error.
  const rejected = settled.filter((r) => r.status === "rejected");
  expect(rejected).toEqual([]);

  const fulfilled = settled as PromiseFulfilledResult<{ score: number; rank: number }>[];
  const scores = fulfilled.map((r) => r.value.score);
  // Every single one of the 5 concurrent calls must report the SAME score
  // — the one true server-graded result, not 5 independent gradings.
  expect(new Set(scores)).toEqual(new Set([EXPECTED_SCORE]));

  // Exactly one participant doc, completed, with the real score.
  const participant = await db.doc(`contests/${CONTEST_ID}/participant/${UID}`).get();
  expect(participant.data()?.completed).toBe(true);
  expect(participant.data()?.score).toBe(EXPECTED_SCORE);

  // Exactly ONE V-Coins credit transaction — not 5.
  const txSnap = await db.collection(`users/${UID}/vCoinTransactions`).get();
  expect(txSnap.size).toBe(1);

  // Balance reflects exactly one award (50, the default reward amount —
  // no vCoinRules doc seeded), not 5x (250).
  const user = await db.doc(`users/${UID}`).get();
  expect(user.data()?.vCoinsBalance).toBe(50);

  // Exactly one idempotency lock doc.
  const lock = await db.doc(`users/${UID}/vCoinActivityLocks/VIDYASTAR_CONTEST_ENTRY_${CONTEST_ID}`).get();
  expect(lock.exists).toBe(true);

  // Starboard points incremented exactly once by the real score — not 5x.
  const board = await db.doc(`leaderboard/daily/entries/${UID}`).get();
  expect(board.data()?.points).toBe(EXPECTED_SCORE);
  // eslint-disable-next-line no-console
  console.log(`[concurrency test] individual call durations (ms): ${JSON.stringify(callDurationsMs)}`);
}, 180_000); // generous — 5-way transaction contention legitimately retries with backoff

// ─── VidyaStar Phase 2 — Test 5, taken literally: "100 students submit
// around the same time". Distinct from the test above (one student
// racing itself) — this is many DIFFERENT students completing the SAME
// contest concurrently. Confirms the Phase 2 architecture (no more O(n)
// full-participant read + batch rank rewrite per submission) means this
// scales without a batch-limit failure or any cross-student corruption —
// each submission now only ever touches its own participant doc. ───────
test("100 different students submitting the same contest concurrently: no batch-limit failure, no corruption, each gets exactly one correct, independent result", async () => {
  const contestId = "concurrency_contest_many_students";
  const studentCount = 100;
  const now = Date.now();

  await db.doc(`contests/${contestId}`).set({
    title: "Many-Student Concurrency Test",
    startTime: admin.firestore.Timestamp.fromMillis(now - 60_000),
    endTime: admin.firestore.Timestamp.fromMillis(now + 3_600_000),
    isActive: true,
  });
  await db.doc(`contests/${contestId}/lessonAnswers/English`).set({ answerKey: ANSWER_KEY });

  // Seed all 100 students + their joined-but-not-completed participant
  // docs + user docs, in chunked batches (this is test SETUP, not part of
  // what's being measured).
  const uids = Array.from({ length: studentCount }, (_, i) => `many_student_${String(i).padStart(3, "0")}`);
  for (let start = 0; start < uids.length; start += 50) {
    const batch = db.batch();
    for (const uid of uids.slice(start, start + 50)) {
      batch.set(db.doc(`students/${uid}`), { name: uid, preferredLanguage: "English", class: "8" });
      batch.set(db.doc(`users/${uid}`), { role: "student", vCoinsBalance: 0 });
      batch.set(db.doc(`contests/${contestId}/participant/${uid}`), {
        userId: uid, contestId, name: uid, score: 0, completed: false,
      });
    }
    await batch.commit();
  }

  // Each student answers a different subset correctly, so scores vary —
  // a more realistic mix than everyone submitting identical answers.
  const answersFor = (i: number) => [
    { questionIndex: 0, selectedIndex: i % 3 === 0 ? 1 : 0, timeTakenSeconds: 5 },   // correct iff i%3==0
    { questionIndex: 1, selectedIndex: 0, timeTakenSeconds: 5 },                      // always correct
    { questionIndex: 2, selectedIndex: i % 2 === 0 ? 2 : 0, timeTakenSeconds: 5 },   // correct iff i%2==0
  ];

  const t0 = Date.now();
  const settled = await Promise.allSettled(
    uids.map((uid, i) =>
      submitVidyastarContestQuiz.run({ contestId, answers: answersFor(i) }, { auth: { uid } })
    )
  );
  const elapsedMs = Date.now() - t0;

  const rejected = settled.filter((r) => r.status === "rejected");
  expect(rejected).toEqual([]); // all 100 succeed — no batch-limit failure, no cross-student contention errors

  // Every student's own participant doc is independently correct.
  const participantsSnap = await db.collection(`contests/${contestId}/participant`).get();
  expect(participantsSnap.size).toBe(studentCount);
  for (const doc of participantsSnap.docs) {
    const i = uids.indexOf(doc.id);
    const correctCount = (i % 3 === 0 ? 1 : 0) + 1 /* Q1 always correct */ + (i % 2 === 0 ? 1 : 0);
    expect(doc.data().completed).toBe(true);
    expect(doc.data().correctAnswers).toBe(correctCount);
  }

  // Every student's OWN V-Coins award landed exactly once — no
  // cross-student double-crediting or corruption from concurrent writes
  // to different documents under load.
  for (const uid of uids) {
    const user = await db.doc(`users/${uid}`).get();
    expect(user.data()?.vCoinsBalance).toBe(50);
  }

  // The leaderboard remains correctly queryable/ordered afterward (the
  // same composite index + query real students will hit).
  const orderedSnap = await db.collection(`contests/${contestId}/participant`)
    .where("completed", "==", true)
    .orderBy("score", "desc")
    .limit(10)
    .get();
  expect(orderedSnap.size).toBe(10);
  const topScores = orderedSnap.docs.map((d) => d.data().score);
  for (let i = 1; i < topScores.length; i++) expect(topScores[i]).toBeLessThanOrEqual(topScores[i - 1]);

  // eslint-disable-next-line no-console
  console.log(`[scale test] 100 concurrent DIFFERENT-student submissions took ${elapsedMs}ms total`);
}, 180_000);

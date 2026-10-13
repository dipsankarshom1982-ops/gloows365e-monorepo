// PATH: functions/src/__tests__/dailyStreakQuizSubmitLock.test.ts
//
// Regression test for a real production bug found via a live browser
// repro (see dailyStreakQuiz.ts's submitDailyStreakQuizAnswer "BUG FIX"
// comment): the Redis submission lock was acquired BEFORE the Firestore
// transaction ran, but was never released if that transaction then
// failed — permanently locking the student out of ever submitting
// today's answer, since every retry hit "already-exists" from Redis
// alone while Firestore never actually recorded anything.
//
// Proven live against production: a fresh test account's very first
// submission returned HTTP 500 (a transient failure inside the
// transaction), and every retry after that returned "already-exists"
// even though studentDailyStreakProgress/{uid}/days/{date} never
// existed — exactly matching the reported symptom ("clicking Submit
// does nothing"), since the web client's already-exists handling just
// silently reloads the question with no visible error.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

const redisDel = jest.fn().mockResolvedValue(1);
const redisSetnx = jest.fn().mockResolvedValue(1); // lock always "acquired" in these tests
const redisExpire = jest.fn().mockResolvedValue(1);

jest.mock("../redish", () => ({
  getRedis: () => ({
    setnx: redisSetnx,
    expire: redisExpire,
    del: redisDel,
    set: jest.fn().mockResolvedValue("OK"),
  }),
  todayIST: () => "2099-01-01",
  RK: {
    streakQuizSubmitLock: (uid: string, date: string) => `lock:streak:${uid}:${date}`,
    vcoinLock: (uid: string, activityId: string, ref: string) => `lock:vcoin:${uid}:${activityId}:${ref}`,
    vcoinBalance: (uid: string) => `vcoin:balance:${uid}`,
  },
}));

import { fakeDb } from "./helpers/mockFirebaseAdmin";
import { submitDailyStreakQuizAnswer } from "../dailyStreakQuiz";

const UID = "student_lock_test";
const QUESTION_ID = "2099-01-01_c6";
const LOCK_KEY = `lock:streak:${UID}:2099-01-01`;
const AUTH_CONTEXT = { auth: { uid: UID, token: {} } };

function seedQuestion(overrides: Record<string, unknown> = {}) {
  return fakeDb.collection("dailyStreakQuizQuestions").doc(QUESTION_ID).set({
    class: 6,
    language: "English",
    subject: "Test",
    question: "Q?",
    optionA: "A",
    optionB: "B",
    optionC: "C",
    optionD: "D",
    correctOption: "B",
    explanation: "because",
    publishDate: "2099-01-01",
    status: "active",
    ...overrides,
  });
}

function seedStudent(overrides: Record<string, unknown> = {}) {
  return fakeDb.collection("students").doc(UID).set({
    class: "6",
    preferredLanguage: "English",
    ...overrides,
  });
}

describe("submitDailyStreakQuizAnswer — Redis lock release on transaction failure", () => {
  beforeEach(() => {
    fakeDb.reset();
    redisDel.mockClear();
    redisSetnx.mockClear().mockResolvedValue(1);
  });

  test("releases the Redis lock when the transaction rejects the submission (e.g. class mismatch)", async () => {
    await seedQuestion({ class: 7 }); // mismatched vs the student's class 6 below
    await seedStudent();

    await expect(
      submitDailyStreakQuizAnswer.run({ questionId: QUESTION_ID, selectedOption: "B" }, AUTH_CONTEXT)
    ).rejects.toThrow(/no longer valid/i);

    expect(redisDel).toHaveBeenCalledWith(LOCK_KEY);
  });

  test("releases the Redis lock when the question doesn't exist", async () => {
    await seedStudent();

    await expect(
      submitDailyStreakQuizAnswer.run({ questionId: "does-not-exist", selectedOption: "B" }, AUTH_CONTEXT)
    ).rejects.toThrow(/not found/i);

    // A missing question means todayIST()-scoped lock key is still the one
    // acquired above submit's question lookup — same key regardless of
    // which question id was requested.
    expect(redisDel).toHaveBeenCalledWith(LOCK_KEY);
  });

  test("does NOT release the lock on a successful submission (correct answer credits normally)", async () => {
    await seedQuestion();
    await seedStudent();

    const result = await submitDailyStreakQuizAnswer.run(
      { questionId: QUESTION_ID, selectedOption: "B" },
      AUTH_CONTEXT
    );

    expect(result.isCorrect).toBe(true);
    expect(result.vCoinsAwarded).toBe(5);
    expect(result.xpAwarded).toBe(10);
    // redisDel IS called once here, but for the unrelated, pre-existing
    // vCoins-balance cache invalidation in claimDailyStreakQuizVCoins
    // (RK.vcoinBalance) — not for the submission lock, which is what this
    // regression actually guards against.
    expect(redisDel).not.toHaveBeenCalledWith(LOCK_KEY);
  });

  test("does NOT release the lock on a successful wrong-answer submission either", async () => {
    await seedQuestion();
    await seedStudent();

    const result = await submitDailyStreakQuizAnswer.run(
      { questionId: QUESTION_ID, selectedOption: "A" }, // wrong — correctOption is "B"
      AUTH_CONTEXT
    );

    expect(result.isCorrect).toBe(false);
    expect(result.vCoinsAwarded).toBe(0);
    expect(redisDel).not.toHaveBeenCalled();
  });
});

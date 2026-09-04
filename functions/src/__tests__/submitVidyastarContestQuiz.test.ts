// PATH: functions/src/__tests__/submitVidyastarContestQuiz.test.ts
//
// Offline unit tests for the VidyaStar Phase 1 security repair — run
// directly against the REAL module (not a reimplementation of its logic)
// via the v1 callable's `.run(data, context)` testing hook, firebase-admin
// mocked onto an in-memory FakeFirestore (see helpers/fakeFirestore.ts).
//
// Covers the Phase 1 brief's Test Plan items 1-7 and 10 (Tests 8 and 9 —
// direct Firestore rule rejection and private answer-key read denial — are
// covered by rules-tests/firestore.rules.test.ts's real-emulator suite
// instead, since those are rules questions, not function-logic questions).

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "./helpers/mockFirebaseAdmin";

const CONTEST_ID = "contest_1";
const UID        = "student_1";
const CTX        = { auth: { uid: UID } };

// Real answer key: Q0 correct=1, Q1 correct=0, Q2 correct=2 — three
// questions, matching what a real getContestLesson-generated quiz would
// produce (see contestLesson.ts's splitQuizAnswerKey).
const ANSWER_KEY = [
  { correctAnswerIndex: 1, explanation: "" },
  { correctAnswerIndex: 0, explanation: "" },
  { correctAnswerIndex: 2, explanation: "" },
];

function seedLiveContest() {
  const now = Date.now();
  fakeDb.seed(`contests/${CONTEST_ID}`, {
    title: "Test Contest",
    startTime: { toDate: () => new Date(now - 60_000) }, // started 1 min ago
    endTime:   { toDate: () => new Date(now + 3_600_000) }, // ends in 1 hour
    isActive: true,
  });
}

function seedJoinedParticipant(overrides: Record<string, unknown> = {}) {
  fakeDb.seed(`contests/${CONTEST_ID}/participant/${UID}`, {
    userId: UID, contestId: CONTEST_ID, name: "Test Student",
    score: 0, completed: false, entryFeePaid: 0,
    ...overrides,
  });
}

function seedStudentAndAnswerKey() {
  fakeDb.seed(`students/${UID}`, { name: "Test Student", preferredLanguage: "English", class: "8", location: { state: "MH" } });
  fakeDb.seed(`contests/${CONTEST_ID}/lessonAnswers/English`, { answerKey: ANSWER_KEY });
  fakeDb.seed(`users/${UID}`, { role: "student", vCoinsBalance: 0 });
}

function seedAll() {
  seedLiveContest();
  seedJoinedParticipant();
  seedStudentAndAnswerKey();
}

beforeEach(() => {
  fakeDb.reset();
});

describe("submitVidyastarContestQuiz — Test 1: normal submission, server-verified score", () => {
  test("computes score independently from the answer key, never from the client, and awards V-Coins + Starboard points exactly once", async () => {
    seedAll();
    const { submitVidyastarContestQuiz } = require("../submitVidyastarContestQuiz");

    // Q0: correct (selects 1). Q1: wrong (selects 1, real answer is 0).
    // Q2: unanswered (null). Client sends NO score/correctness fields at
    // all — the QuizAnswer type doesn't even have them anymore.
    const answers = [
      { questionIndex: 0, selectedIndex: 1, timeTakenSeconds: 5 },
      { questionIndex: 1, selectedIndex: 1, timeTakenSeconds: 10 },
      { questionIndex: 2, selectedIndex: null, timeTakenSeconds: 30 },
    ];

    const result = await submitVidyastarContestQuiz.run({ contestId: CONTEST_ID, answers }, CTX);

    // 1 correct answer * 10 points + time bonus for that one correct
    // answer (5s taken -> floor(5*(30-5)/25) = 5) = 15.
    expect(result.score).toBe(15);
    expect(result.rank).toBe(1);

    const participant = fakeDb.peek(`contests/${CONTEST_ID}/participant/${UID}`);
    expect(participant?.completed).toBe(true);
    expect(participant?.score).toBe(15);
    expect(participant?.correctAnswers).toBe(1);
    expect(participant?.incorrectAnswers).toBe(1);
    expect(participant?.unanswered).toBe(1);

    // V-Coins awarded exactly once (default reward, no vCoinRules doc seeded).
    const user = fakeDb.peek(`users/${UID}`);
    expect(user?.vCoinsBalance).toBe(50);
    const lock = fakeDb.peek(`users/${UID}/vCoinActivityLocks/VIDYASTAR_CONTEST_ENTRY_${CONTEST_ID}`);
    expect(lock).toBeDefined();

    // Starboard points incremented by the server-computed score on all 4 tabs.
    expect(fakeDb.peek(`leaderboard/daily/entries/${UID}`)?.points).toBe(15);
    expect(fakeDb.peek(`leaderboard/weekly/entries/${UID}`)?.points).toBe(15);
    expect(fakeDb.peek(`leaderboard/monthly/entries/${UID}`)?.points).toBe(15);
    expect(fakeDb.peek(`leaderboard/yearly/entries/${UID}`)?.points).toBe(15);
  });
});

describe("submitVidyastarContestQuiz — Test 2 & 3: client cannot forge score or correctness", () => {
  test("a client-supplied `score`/`correct`/`isCorrect` field anywhere in the payload is completely ignored", async () => {
    seedAll();
    const { submitVidyastarContestQuiz } = require("../submitVidyastarContestQuiz");

    // Runtime JS doesn't enforce the TS interface — simulate a manipulated
    // request that smuggles score/correctness fields the real client type
    // no longer even has.
    const maliciousPayload = {
      contestId: CONTEST_ID,
      score: 999999,
      answers: [
        { questionIndex: 0, selectedIndex: 0, correct: true, isCorrect: true, timeTakenSeconds: 0 }, // actually WRONG (real answer is 1)
        { questionIndex: 1, selectedIndex: 0, correct: true, timeTakenSeconds: 0 },                   // actually correct
        { questionIndex: 2, selectedIndex: 2, correct: true, timeTakenSeconds: 0 },                   // actually correct
      ],
    };

    const result = await submitVidyastarContestQuiz.run(maliciousPayload, CTX);

    // Real grading: Q0 wrong, Q1 correct, Q2 correct = 2 correct * 10 = 20
    // + time bonus for 2 correct answers at 0s taken each
    // (floor(5*(30-0)/25) = 6 each) = 20 + 12 = 32. NOT 999999.
    expect(result.score).toBe(32);
    expect(result.score).not.toBe(999999);

    const participant = fakeDb.peek(`contests/${CONTEST_ID}/participant/${UID}`);
    expect(participant?.correctAnswers).toBe(2);
    // The persisted `answers` array reflects SERVER-determined correctness,
    // not whatever the client claimed.
    const persistedAnswers = participant?.answers as Array<{ questionIndex: number; correct: boolean }>;
    expect(persistedAnswers.find((a) => a.questionIndex === 0)?.correct).toBe(false);
  });
});

describe("submitVidyastarContestQuiz — Test 4, 5 & 10: duplicate submission / replay idempotency", () => {
  test("a second submission for the same contest returns the existing verified result and awards nothing twice", async () => {
    seedAll();
    const { submitVidyastarContestQuiz } = require("../submitVidyastarContestQuiz");

    const answers = [
      { questionIndex: 0, selectedIndex: 1, timeTakenSeconds: 5 },
      { questionIndex: 1, selectedIndex: 0, timeTakenSeconds: 5 },
      { questionIndex: 2, selectedIndex: 2, timeTakenSeconds: 5 },
    ];

    const first = await submitVidyastarContestQuiz.run({ contestId: CONTEST_ID, answers }, CTX);
    expect(first.score).toBeGreaterThan(0);

    const balanceAfterFirst = fakeDb.peek(`users/${UID}`)?.vCoinsBalance;
    const pointsAfterFirst  = fakeDb.peek(`leaderboard/daily/entries/${UID}`)?.points;

    // Replay/duplicate — even with a DIFFERENT (higher-scoring-looking)
    // payload, since the participant is already `completed`.
    const second = await submitVidyastarContestQuiz.run(
      { contestId: CONTEST_ID, answers: [{ questionIndex: 0, selectedIndex: 1, timeTakenSeconds: 0 }, { questionIndex: 1, selectedIndex: 0, timeTakenSeconds: 0 }, { questionIndex: 2, selectedIndex: 2, timeTakenSeconds: 0 }] },
      CTX
    );

    // Returns the SAME already-verified result, not a re-graded one.
    expect(second.score).toBe(first.score);

    // No double-award.
    expect(fakeDb.peek(`users/${UID}`)?.vCoinsBalance).toBe(balanceAfterFirst);
    expect(fakeDb.peek(`leaderboard/daily/entries/${UID}`)?.points).toBe(pointsAfterFirst);
  });
});

describe("submitVidyastarContestQuiz — Test 6: question IDs from another contest / out of range", () => {
  test("rejects a questionIndex outside the real quiz's range", async () => {
    seedAll();
    const { submitVidyastarContestQuiz } = require("../submitVidyastarContestQuiz");

    await expect(
      submitVidyastarContestQuiz.run(
        { contestId: CONTEST_ID, answers: [
          { questionIndex: 0, selectedIndex: 1, timeTakenSeconds: 5 },
          { questionIndex: 1, selectedIndex: 0, timeTakenSeconds: 5 },
          { questionIndex: 99, selectedIndex: 0, timeTakenSeconds: 5 }, // doesn't exist — only 3 questions (0-2)
        ] },
        CTX
      )
    ).rejects.toMatchObject({ code: "invalid-argument" });

    // Nothing was persisted or rewarded from a rejected submission.
    expect(fakeDb.peek(`contests/${CONTEST_ID}/participant/${UID}`)?.completed).toBe(false);
    expect(fakeDb.peek(`users/${UID}`)?.vCoinsBalance).toBe(0);
  });

  test("rejects a duplicate questionIndex within the same submission", async () => {
    seedAll();
    const { submitVidyastarContestQuiz } = require("../submitVidyastarContestQuiz");
    await expect(
      submitVidyastarContestQuiz.run(
        { contestId: CONTEST_ID, answers: [
          { questionIndex: 0, selectedIndex: 1, timeTakenSeconds: 5 },
          { questionIndex: 0, selectedIndex: 1, timeTakenSeconds: 5 },
          { questionIndex: 1, selectedIndex: 0, timeTakenSeconds: 5 },
        ] },
        CTX
      )
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("rejects a submission with fewer answers than the real question count", async () => {
    seedAll();
    const { submitVidyastarContestQuiz } = require("../submitVidyastarContestQuiz");
    await expect(
      submitVidyastarContestQuiz.run(
        { contestId: CONTEST_ID, answers: [{ questionIndex: 0, selectedIndex: 1, timeTakenSeconds: 5 }] },
        CTX
      )
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });
});

describe("submitVidyastarContestQuiz — Test 7: invalid option index", () => {
  test("rejects a negative/non-integer selectedIndex", async () => {
    seedAll();
    const { submitVidyastarContestQuiz } = require("../submitVidyastarContestQuiz");
    await expect(
      submitVidyastarContestQuiz.run(
        { contestId: CONTEST_ID, answers: [
          { questionIndex: 0, selectedIndex: -1, timeTakenSeconds: 5 },
          { questionIndex: 1, selectedIndex: 0, timeTakenSeconds: 5 },
          { questionIndex: 2, selectedIndex: 2, timeTakenSeconds: 5 },
        ] },
        CTX
      )
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("an out-of-range selectedIndex is simply graded incorrect, not exploitable", async () => {
    seedAll();
    const { submitVidyastarContestQuiz } = require("../submitVidyastarContestQuiz");
    // selectedIndex 99 can never equal any real correctAnswerIndex —
    // graded incorrect by construction, no crash, no free credit.
    const result = await submitVidyastarContestQuiz.run(
      { contestId: CONTEST_ID, answers: [
        { questionIndex: 0, selectedIndex: 99, timeTakenSeconds: 5 },
        { questionIndex: 1, selectedIndex: 0, timeTakenSeconds: 5 },
        { questionIndex: 2, selectedIndex: 2, timeTakenSeconds: 5 },
      ] },
      CTX
    );
    expect(fakeDb.peek(`contests/${CONTEST_ID}/participant/${UID}`)?.correctAnswers).toBe(2);
    expect(result.score).toBeGreaterThan(0);
  });
});

describe("submitVidyastarContestQuiz — auth, join, and contest-window guards", () => {
  test("rejects an unauthenticated call", async () => {
    const { submitVidyastarContestQuiz } = require("../submitVidyastarContestQuiz");
    await expect(
      submitVidyastarContestQuiz.run({ contestId: CONTEST_ID, answers: [] }, { auth: null })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("uses the AUTHENTICATED uid, never a uid the client might smuggle into the payload", async () => {
    seedAll();
    const { submitVidyastarContestQuiz } = require("../submitVidyastarContestQuiz");
    const answers = [
      { questionIndex: 0, selectedIndex: 1, timeTakenSeconds: 5 },
      { questionIndex: 1, selectedIndex: 0, timeTakenSeconds: 5 },
      { questionIndex: 2, selectedIndex: 2, timeTakenSeconds: 5 },
    ];
    // A payload claiming to act as a different user — context.auth.uid
    // (the real, verified identity) must be what's used, not this.
    await submitVidyastarContestQuiz.run({ contestId: CONTEST_ID, uid: "someone_else", userId: "someone_else", answers }, CTX);
    expect(fakeDb.peek(`contests/${CONTEST_ID}/participant/${UID}`)?.completed).toBe(true);
    expect(fakeDb.peek(`contests/${CONTEST_ID}/participant/someone_else`)).toBeUndefined();
  });

  test("rejects a submission when the student never joined (no participant doc)", async () => {
    seedLiveContest();
    seedStudentAndAnswerKey();
    const { submitVidyastarContestQuiz } = require("../submitVidyastarContestQuiz");
    await expect(
      submitVidyastarContestQuiz.run({ contestId: CONTEST_ID, answers: [{ questionIndex: 0, selectedIndex: 1 }] }, CTX)
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("rejects a submission for a contest that hasn't started yet", async () => {
    const now = Date.now();
    fakeDb.seed(`contests/${CONTEST_ID}`, {
      title: "Future Contest",
      startTime: { toDate: () => new Date(now + 3_600_000) },
      endTime:   { toDate: () => new Date(now + 7_200_000) },
    });
    seedJoinedParticipant();
    seedStudentAndAnswerKey();
    const { submitVidyastarContestQuiz } = require("../submitVidyastarContestQuiz");
    await expect(
      submitVidyastarContestQuiz.run({ contestId: CONTEST_ID, answers: [] }, CTX)
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("rejects a submission for a contest that has already ended", async () => {
    const now = Date.now();
    fakeDb.seed(`contests/${CONTEST_ID}`, {
      title: "Past Contest",
      startTime: { toDate: () => new Date(now - 7_200_000) },
      endTime:   { toDate: () => new Date(now - 3_600_000) },
    });
    seedJoinedParticipant();
    seedStudentAndAnswerKey();
    const { submitVidyastarContestQuiz } = require("../submitVidyastarContestQuiz");
    await expect(
      submitVidyastarContestQuiz.run({ contestId: CONTEST_ID, answers: [] }, CTX)
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("error messages never leak internals (no Firebase/stack-trace text)", async () => {
    seedAll();
    const { submitVidyastarContestQuiz } = require("../submitVidyastarContestQuiz");
    try {
      await submitVidyastarContestQuiz.run(
        { contestId: CONTEST_ID, answers: [{ questionIndex: 999, selectedIndex: 0 }] },
        CTX
      );
      fail("expected rejection");
    } catch (e: any) {
      expect(e.message).not.toMatch(/firestore|stack|admin sdk|exception/i);
    }
  });
});

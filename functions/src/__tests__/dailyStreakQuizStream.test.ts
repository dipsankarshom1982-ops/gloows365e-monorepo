// PATH: functions/src/__tests__/dailyStreakQuizStream.test.ts
//
// Stage 2.2, F1 — staging QA found that a Class 11/12 student with no
// stream on their profile was silently served an ARBITRARY one of the 3
// stream-specific AI questions (an unfiltered Firestore query with
// .limit(1) just returns whichever sorts first — deterministically
// Arts/Humanities on every real dataset seen so far), and that a class
// change away from 11/12 (via the web profile editor OR the admin
// callable) could leave a stale stream on the profile.
//
// This file covers the fix end-to-end:
//   - getTodaysStreakQuizQuestion serves the correct stream's question for
//     all 6 (class × stream) combinations.
//   - A stream-less 11/12 student gets nothing when only stream-specific
//     questions exist, but DOES get a genuinely stream-less (legacy)
//     question when one exists for that class+date.
//   - submitDailyStreakQuizAnswer rejects a stream-specific question for a
//     stream-less student (server-side, defense in depth — this callable
//     never trusts that whatever was served client-side is still valid).
//   - The full stale-stream story: a Class 11 Commerce student who becomes
//     Class 9 (mirroring the reproduced staging bug) gets no quiz at all,
//     not the old class's stream leaking through.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

const redisSetnx = jest.fn().mockResolvedValue(1);
const redisExpire = jest.fn().mockResolvedValue(1);
const redisDel = jest.fn().mockResolvedValue(1);
const redisSet = jest.fn().mockResolvedValue("OK");
jest.mock("../redish", () => ({
  getRedis: () => ({ set: redisSet, setnx: redisSetnx, expire: redisExpire, del: redisDel }),
  todayIST: () => "2099-01-01",
  RK: {
    streakQuizQuestion: (uid: string, date: string) => `streak:q:${uid}:${date}`,
    streakQuizSubmitLock: (uid: string, date: string) => `lock:streak:${uid}:${date}`,
    vcoinLock: (uid: string, activityId: string, ref: string) => `lock:vcoin:${uid}:${activityId}:${ref}`,
    vcoinBalance: (uid: string) => `vcoin:balance:${uid}`,
  },
}));

import { fakeDb } from "./helpers/mockFirebaseAdmin";
import { getTodaysStreakQuizQuestion, submitDailyStreakQuizAnswer } from "../dailyStreakQuiz";

const DATE = "2099-01-01";
const STREAMS = ["Science", "Commerce", "Arts/Humanities"] as const;

function seedQuestion(id: string, cls: number, stream: string | null, overrides: Record<string, unknown> = {}) {
  fakeDb.seed(`dailyStreakQuizQuestions/${id}`, {
    class: cls,
    stream: stream ?? null,
    language: "English",
    subject: "Test",
    question: `Question ${id}`,
    optionA: "A", optionB: "B", optionC: "C", optionD: "D",
    correctOption: "B",
    explanation: "because",
    publishDate: DATE,
    status: "active",
    ...overrides,
  });
}
function seedStudent(uid: string, cls: number | string, stream: string | null = null, extra: Record<string, unknown> = {}) {
  fakeDb.seed(`students/${uid}`, { class: String(cls), stream, preferredLanguage: "English", ...extra });
}
function authFor(uid: string) {
  return { auth: { uid, token: {} } };
}

beforeEach(() => {
  fakeDb.reset();
  redisSetnx.mockClear().mockResolvedValue(1);
  redisExpire.mockClear();
  redisDel.mockClear();
  redisSet.mockClear();
});

describe("getTodaysStreakQuizQuestion — stream targeting is exact", () => {
  for (const cls of [11, 12]) {
    for (const stream of STREAMS) {
      test(`Class ${cls} ${stream} gets exactly the ${stream} question, never another stream's`, async () => {
        const uid = `student_${cls}_${stream}`;
        seedStudent(uid, cls, stream);
        for (const s of STREAMS) seedQuestion(`${DATE}_c${cls}_${s.toLowerCase().replace("/", "-")}`, cls, s);

        const result = await getTodaysStreakQuizQuestion.run({}, authFor(uid) as any);
        expect(result).toMatchObject({ questionId: `${DATE}_c${cls}_${stream.toLowerCase().replace("/", "-")}` });
      });
    }
  }

  test("a stream-less Class 11 student gets NOTHING when only stream-specific questions exist (no arbitrary fallback)", async () => {
    const uid = "student_11_nostream";
    seedStudent(uid, 11, null);
    for (const s of STREAMS) seedQuestion(`${DATE}_c11_${s.toLowerCase().replace("/", "-")}`, 11, s);

    await expect(getTodaysStreakQuizQuestion.run({}, authFor(uid) as any)).resolves.toBeNull();
  });

  test("a stream-less Class 12 student gets NOTHING when only stream-specific questions exist (no arbitrary fallback)", async () => {
    const uid = "student_12_nostream";
    seedStudent(uid, 12, null);
    for (const s of STREAMS) seedQuestion(`${DATE}_c12_${s.toLowerCase().replace("/", "-")}`, 12, s);

    await expect(getTodaysStreakQuizQuestion.run({}, authFor(uid) as any)).resolves.toBeNull();
  });

  test("a stream-less Class 11 student DOES get a genuinely stream-less (legacy admin-authored) question", async () => {
    const uid = "student_11_legacy";
    seedStudent(uid, 11, null);
    seedQuestion(`${DATE}_c11_legacy`, 11, null); // no stream field at all — pre-stream-architecture doc
    for (const s of STREAMS) seedQuestion(`${DATE}_c11_${s.toLowerCase().replace("/", "-")}`, 11, s);

    const result = await getTodaysStreakQuizQuestion.run({}, authFor(uid) as any);
    expect(result).toMatchObject({ questionId: `${DATE}_c11_legacy` });
  });

  test("Class 6-10 behaviour is unchanged: always served regardless of stream field", async () => {
    const uid = "student_8";
    seedStudent(uid, 8, null);
    seedQuestion(`${DATE}_c8`, 8, null);
    const result = await getTodaysStreakQuizQuestion.run({}, authFor(uid) as any);
    expect(result).toMatchObject({ questionId: `${DATE}_c8` });
  });
});

describe("submitDailyStreakQuizAnswer — server-side stream enforcement (defense in depth)", () => {
  test("a stream-less student cannot submit a stream-specific question directly, even by knowing its id", async () => {
    const uid = "student_attack_nostream";
    seedStudent(uid, 11, null);
    seedQuestion(`${DATE}_c11_science`, 11, "Science");

    await expect(
      submitDailyStreakQuizAnswer.run({ questionId: `${DATE}_c11_science`, selectedOption: "B" }, authFor(uid) as any)
    ).rejects.toThrow(/no longer valid/i);
    expect(fakeDb.peek(`studentDailyStreakProgress/${uid}/days/${DATE}`)).toBeUndefined();
  });

  test("a student cannot submit another stream's question", async () => {
    const uid = "student_attack_wrongstream";
    seedStudent(uid, 11, "Commerce");
    seedQuestion(`${DATE}_c11_science`, 11, "Science");

    await expect(
      submitDailyStreakQuizAnswer.run({ questionId: `${DATE}_c11_science`, selectedOption: "B" }, authFor(uid) as any)
    ).rejects.toThrow(/no longer valid/i);
  });

  test("a matching stream submits normally and scores correctly", async () => {
    const uid = "student_ok_stream";
    seedStudent(uid, 11, "Science");
    seedQuestion(`${DATE}_c11_science`, 11, "Science");

    const result = await submitDailyStreakQuizAnswer.run(
      { questionId: `${DATE}_c11_science`, selectedOption: "B" },
      authFor(uid) as any
    );
    expect(result).toMatchObject({ isCorrect: true, xpAwarded: 10, vCoinsAwarded: 5 });
  });

  test("a Class 6-10 (stream-less) question still submits normally — the mismatch check never blocks non-stream classes", async () => {
    const uid = "student_8_submit";
    seedStudent(uid, 8, null);
    seedQuestion(`${DATE}_c8`, 8, null);
    const result = await submitDailyStreakQuizAnswer.run({ questionId: `${DATE}_c8`, selectedOption: "B" }, authFor(uid) as any);
    expect(result.isCorrect).toBe(true);
  });
});

describe("end-to-end: stale stream after a class change (the exact staging repro)", () => {
  test("Class 11 Commerce -> Class 9: with the stream cleared, the student is served the Class 9 question", async () => {
    const uid = "student_stale_fixed";
    // Simulates adminUpdateStudentProfile's fix: the class-only edit also
    // clears the stream (see adminManagement.test.ts for that half).
    seedStudent(uid, 9, null);
    seedQuestion(`${DATE}_c9`, 9, null);
    seedQuestion(`${DATE}_c11_commerce`, 11, "Commerce");

    const result = await getTodaysStreakQuizQuestion.run({}, authFor(uid) as any);
    expect(result).toMatchObject({ questionId: `${DATE}_c9` });
  });

  test("Class 11 Commerce -> Class 9 WITHOUT clearing the stream (the pre-fix bug shape) would still be safe: class mismatch alone blocks it", async () => {
    // Belt-and-braces: even if a stream were somehow left stale on a
    // non-stream-class profile, the plain class check already rejects it —
    // this documents that F1's fix is not the only thing standing between
    // a stale stream and incorrect content.
    const uid = "student_stale_defensive";
    seedStudent(uid, 9, "Commerce" as any); // simulates the OLD bug: stream never cleared
    seedQuestion(`${DATE}_c11_commerce`, 11, "Commerce");
    await expect(getTodaysStreakQuizQuestion.run({}, authFor(uid) as any)).resolves.toBeNull();
  });
});

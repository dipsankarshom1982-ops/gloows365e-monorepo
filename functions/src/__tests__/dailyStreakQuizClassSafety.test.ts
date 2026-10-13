// Class 3–12 safety for the Daily Streak Quiz: every supported class has its
// own difficulty and subject pool, an unsupported class fails loudly instead
// of borrowing another class's difficulty, and a student is only ever served
// a question authored for their own class.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

jest.mock("../redish", () => ({
  getRedis: () => ({ set: jest.fn().mockResolvedValue("OK") }),
  todayIST: () => "2099-01-01",
  RK: { streakQuizQuestion: (uid: string, date: string) => `streak:q:${uid}:${date}` },
}));

import { fakeDb } from "./helpers/mockFirebaseAdmin";
import { SUPPORTED_CLASS_LEVELS } from "../educationConfig";
import {
  buildDailySlots,
  buildGenerationPrompt,
  CLASS_DIFFICULTY,
  getClassDifficulty,
  regenerateDailyStreakQuizQuestion,
} from "../dailyStreakQuizGeneration";
import { getTodaysStreakQuizQuestion } from "../dailyStreakQuiz";

const UID = "student_class_safety";
const AUTH = { auth: { uid: UID, token: {} } };

function seedQuestion(cls: number, id: string) {
  fakeDb.seed(`dailyStreakQuizQuestions/${id}`, {
    class: cls,
    language: "English",
    subject: "Mathematics",
    question: `Question for class ${cls}`,
    optionA: "A", optionB: "B", optionC: "C", optionD: "D",
    correctOption: "A",
    explanation: "because",
    publishDate: "2099-01-01",
    status: "active",
  });
}

beforeEach(() => fakeDb.reset());

describe("daily slots", () => {
  test("14 per day: Class 3–10 without a stream, Class 11–12 once per stream", () => {
    const slots = buildDailySlots();
    expect(slots).toHaveLength(14);
    expect(slots.filter((s) => s.stream === null).map((s) => s.class)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    for (const cls of [11, 12]) {
      expect(slots.filter((s) => s.class === cls).map((s) => s.stream).sort()).toEqual(
        ["Arts/Humanities", "Commerce", "Science"]
      );
    }
  });
});

describe("difficulty", () => {
  test.each([...SUPPORTED_CLASS_LEVELS])("Class %i has its own difficulty entry", (cls) => {
    expect(CLASS_DIFFICULTY[cls]).toBeDefined();
    expect(getClassDifficulty(cls).label.length).toBeGreaterThan(0);
  });

  test.each([3, 4, 5])("Class %i is easy", (cls) => {
    expect(getClassDifficulty(cls).level).toBe("easy");
  });

  test.each([0, 1, 2, 13])("unsupported Class %i throws instead of borrowing another class's difficulty", (cls) => {
    expect(() => getClassDifficulty(cls)).toThrow(/No Daily Streak Quiz difficulty configured/);
  });
});

describe("generation prompt", () => {
  test("Class 3 gets the primary subject pool and early-primary guidance", () => {
    const prompt = buildGenerationPrompt(3, null, getClassDifficulty(3).label, [], []);
    expect(prompt).toContain("Class 3");
    expect(prompt).toContain("Mathematics, English, Environmental Studies (EVS), General Knowledge, Logical Reasoning");
    expect(prompt).toContain("early-primary learner");
    expect(prompt).not.toContain("Current Affairs");
  });

  test("Class 8 keeps its original subject pool and gets no primary guidance", () => {
    const prompt = buildGenerationPrompt(8, null, getClassDifficulty(8).label, [], []);
    expect(prompt).toContain("General Knowledge, Mathematics, Science, English, Social Science, Current Affairs, Logical Reasoning");
    expect(prompt).not.toContain("early-primary");
  });

  test("a class with no subject pool fails loudly", () => {
    expect(() => buildGenerationPrompt(11, null, "x", [], [])).toThrow(/No Daily Streak Quiz subject pool/);
  });
});

describe("regenerateDailyStreakQuizQuestion validation", () => {
  const adminCtx = { auth: { uid: "admin_1", token: { admin: true } } };

  test("rejects a non-admin", async () => {
    await expect(
      regenerateDailyStreakQuizQuestion.run({ class: 3, date: "2099-01-01" }, AUTH as any)
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test.each([2, 13, 0])("rejects unsupported Class %i", async (cls) => {
    await expect(
      regenerateDailyStreakQuizQuestion.run({ class: cls, date: "2099-01-01" }, adminCtx as any)
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("Class 3 cannot be given a stream", async () => {
    await expect(
      regenerateDailyStreakQuizQuestion.run({ class: 3, date: "2099-01-01", stream: "Science" }, adminCtx as any)
    ).rejects.toMatchObject({ code: "invalid-argument", message: "Classes 3–10 do not have a stream" });
  });
});

describe("getTodaysStreakQuizQuestion — never serves another class", () => {
  test("a Class 3 student with only a Class 8 question published gets nothing", async () => {
    fakeDb.seed(`students/${UID}`, { class: "3", preferredLanguage: "English" });
    seedQuestion(8, "2099-01-01_c8");
    await expect(getTodaysStreakQuizQuestion.run({}, AUTH as any)).resolves.toBeNull();
  });

  test("a Class 3 student gets their own Class 3 question", async () => {
    fakeDb.seed(`students/${UID}`, { class: "3", preferredLanguage: "English" });
    seedQuestion(3, "2099-01-01_c3");
    seedQuestion(8, "2099-01-01_c8");
    const result = await getTodaysStreakQuizQuestion.run({}, AUTH as any);
    expect(result).toMatchObject({ questionId: "2099-01-01_c3", question: "Question for class 3" });
  });

  test("a stored 'Class 4' style value still resolves to Class 4", async () => {
    fakeDb.seed(`students/${UID}`, { class: "Class 4", preferredLanguage: "English" });
    seedQuestion(4, "2099-01-01_c4");
    const result = await getTodaysStreakQuizQuestion.run({}, AUTH as any);
    expect(result).toMatchObject({ questionId: "2099-01-01_c4" });
  });

  test.each([undefined, "", "2", "13", "abc"])("an unsupported stored class %p gets nothing", async (stored) => {
    fakeDb.seed(`students/${UID}`, { ...(stored === undefined ? {} : { class: stored }), preferredLanguage: "English" });
    seedQuestion(8, "2099-01-01_c8");
    seedQuestion(3, "2099-01-01_c3");
    await expect(getTodaysStreakQuizQuestion.run({}, AUTH as any)).resolves.toBeNull();
  });
});

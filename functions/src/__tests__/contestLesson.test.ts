// PATH: functions/src/__tests__/contestLesson.test.ts
//
// Stage 2.2, F5 — getContestLesson had no server-side class check of its
// own: joinVidyastarContest already enforced a contest's targetClass, but
// this callable was reachable independently of having joined, so a student
// who knew/guessed another class's contestId could still fetch (and
// trigger generation of) its lesson. Fixed by adding the same
// checkContestClassEligibility check joinVidyastarContest already uses,
// checked BEFORE the generation-claim transaction and BEFORE any cached
// lesson is returned.
//
// validateLessonJson and the Gemini calls are mocked out — this file tests
// ONLY the new eligibility gate, not lesson-generation correctness (which
// is unchanged and untested here).

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

const callGeminiText = jest.fn();
jest.mock("../gemini", () => ({
  callGeminiText: (...args: unknown[]) => callGeminiText(...args),
  parseJsonFromResponse: (raw: string) => JSON.parse(raw),
}));
jest.mock("../validateLesson", () => ({ validateLessonJson: jest.fn() }));

import { fakeDb } from "./helpers/mockFirebaseAdmin";
import { getContestLesson } from "../contestLesson";

const AUTH = (uid: string) => ({ auth: { uid, token: {} } });
const VALID_LESSON = JSON.stringify({ lessonTitle: "T", quiz: [] });
const VALID_BANNER = JSON.stringify({ emoji: "🌟", tagline: "Go!", gradientStart: "#000", gradientEnd: "#fff" });

function seedContest(id: string, targetClass: unknown, extra: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { title: "Test Contest", description: "", isActive: true, ...extra };
  if (targetClass !== undefined) data.targetClass = targetClass;
  fakeDb.seed(`contests/${id}`, data);
}
function seedStudent(uid: string, cls?: string) {
  fakeDb.seed(`students/${uid}`, cls === undefined ? { name: "Kid" } : { name: "Kid", class: cls });
}

beforeEach(() => {
  fakeDb.reset();
  callGeminiText.mockReset();
  callGeminiText.mockImplementation((prompt: string) =>
    Promise.resolve(prompt.includes("banner") || /tagline/i.test(prompt) ? VALID_BANNER : VALID_LESSON)
  );
});

describe("getContestLesson — server-side class eligibility (F5)", () => {
  test("Class 3 student requesting a Class-8-only contest's lesson is DENIED", async () => {
    seedStudent("s3", "3");
    seedContest("c1", ["8"]);

    await expect(
      getContestLesson.run({ contestId: "c1", language: "English" }, AUTH("s3") as any)
    ).rejects.toMatchObject({ code: "permission-denied" });

    // No lesson was generated or written, and Gemini was never called —
    // the check runs before both the transaction claim and any generation.
    expect(callGeminiText).not.toHaveBeenCalled();
    expect(fakeDb.peek("contests/c1/lessons/English")).toBeUndefined();
    expect(fakeDb.peek("contests/c1/lessonAnswers/English")).toBeUndefined();
  });

  test("Class 8 student requesting the SAME Class-8-only contest's lesson is ALLOWED", async () => {
    seedStudent("s8", "8");
    seedContest("c1", ["8"]);

    const result = await getContestLesson.run({ contestId: "c1", language: "English" }, AUTH("s8") as any);
    expect(result.status).toBe("completed");
    expect(callGeminiText).toHaveBeenCalled();
    expect(fakeDb.peek("contests/c1/lessons/English")).toMatchObject({ status: "completed" });
  });

  test("a student with no class on record is DENIED a class-targeted contest's lesson", async () => {
    seedStudent("s_noclass");
    seedContest("c1", ["8"]);

    await expect(
      getContestLesson.run({ contestId: "c1", language: "English" }, AUTH("s_noclass") as any)
    ).rejects.toMatchObject({ code: "permission-denied", message: "Set your class in your profile to view this lesson." });
    expect(callGeminiText).not.toHaveBeenCalled();
  });

  test("an 'all' contest is reachable by every class", async () => {
    seedStudent("s5", "5");
    seedContest("c1", ["all"]);
    const result = await getContestLesson.run({ contestId: "c1", language: "English" }, AUTH("s5") as any);
    expect(result.status).toBe("completed");
  });

  test("an untargeted contest (no targetClass at all) is reachable by every class, including 3-5", async () => {
    seedStudent("s3", "3");
    seedContest("c1", undefined);
    const result = await getContestLesson.run({ contestId: "c1", language: "English" }, AUTH("s3") as any);
    expect(result.status).toBe("completed");
  });

  test("an unsupported stored class ('2') is DENIED a class-targeted contest's lesson", async () => {
    seedStudent("s_bad", "2");
    seedContest("c1", ["8"]);
    await expect(
      getContestLesson.run({ contestId: "c1", language: "English" }, AUTH("s_bad") as any)
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("a missing contest still reports not-found (eligibility check runs first, same conclusion either way)", async () => {
    seedStudent("s8", "8");
    await expect(
      getContestLesson.run({ contestId: "does-not-exist", language: "English" }, AUTH("s8") as any)
    ).rejects.toMatchObject({ code: "not-found" });
  });

  test("no auth -> unauthenticated, before any class check", async () => {
    await expect(
      getContestLesson.run({ contestId: "c1", language: "English" }, { auth: null } as any)
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });
});

// Seekho's daily study plan must only ever use the student's own class:
// no Class 10 default, drafts stay hidden, and a student with no supported
// class gets an empty plan rather than another class's chapters.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

jest.mock("../redish", () => ({
  getRedis: () => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
  }),
  todayIST: () => "2099-01-01",
  TTL: { seekhoCourses: 60, seekhoPlan: 60 },
  RK: {
    seekhoCourses: (cls: number, board: string) => `seekho:courses:${cls}:${board}`,
    seekhoPlan: (uid: string, date: string) => `seekho:plan:${uid}:${date}`,
  },
}));

import { fakeDb } from "./helpers/mockFirebaseAdmin";
import { seekhoGetDailyStudyPlan } from "../seekho";

const UID = "student_seekho";
const AUTH = { auth: { uid: UID, token: {} } };

function seedCourse(id: string, cls: number, extra: Record<string, unknown> = {}) {
  fakeDb.seed(`seekho_courses/${id}`, {
    class: cls, board: "CBSE", subject: "Mathematics",
    chapterNumber: 1, chapterTitle: `Chapter for class ${cls}`, ...extra,
  });
}

beforeEach(() => fakeDb.reset());

describe("seekhoGetDailyStudyPlan — class safety", () => {
  test("a Class 3 student sees only their own Class 3 chapters", async () => {
    fakeDb.seed(`students/${UID}`, { class: "3", board: "CBSE" });
    seedCourse("c3", 3);
    seedCourse("c10", 10);
    const result = await seekhoGetDailyStudyPlan.run({}, AUTH as any);
    expect(result.courses.map((c: any) => c.courseId)).toEqual(["c3"]);
  });

  test("a Class 3 student with only Class 10 chapters published gets an empty plan, not Class 10", async () => {
    fakeDb.seed(`students/${UID}`, { class: "3", board: "CBSE" });
    seedCourse("c10", 10);
    const result = await seekhoGetDailyStudyPlan.run({}, AUTH as any);
    expect(result.courses).toEqual([]);
  });

  test.each([undefined, "", "2", "13", "abc"])("a student whose class is %p gets an empty plan, never Class 10", async (stored) => {
    fakeDb.seed(`students/${UID}`, { ...(stored === undefined ? {} : { class: stored }), board: "CBSE" });
    seedCourse("c10", 10);
    seedCourse("c8", 8);
    const result = await seekhoGetDailyStudyPlan.run({}, AUTH as any);
    expect(result.courses).toEqual([]);
  });

  test("draft chapters are hidden, and older chapters without isPublished still show", async () => {
    fakeDb.seed(`students/${UID}`, { class: "4", board: "CBSE" });
    seedCourse("draft", 4, { chapterNumber: 1, isPublished: false });
    seedCourse("legacy", 4, { chapterNumber: 2 });
    seedCourse("live", 4, { chapterNumber: 3, isPublished: true });
    const result = await seekhoGetDailyStudyPlan.run({}, AUTH as any);
    expect(result.courses.map((c: any) => c.courseId).sort()).toEqual(["legacy", "live"]);
  });

  test("an existing Class 8 student is unaffected", async () => {
    fakeDb.seed(`students/${UID}`, { class: "8", board: "CBSE" });
    seedCourse("c8", 8);
    seedCourse("c10", 10);
    const result = await seekhoGetDailyStudyPlan.run({}, AUTH as any);
    expect(result.courses.map((c: any) => c.courseId)).toEqual(["c8"]);
  });
});

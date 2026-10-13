// PATH: functions/src/__tests__/personalDashboardStudyPlan.test.ts
//
// Stage 2.2, F3 — getPersonalizedDashboard's study plan and "recent
// lessons" were both silently empty for every student on staging.
//
// Two independent causes, confirmed by tracing generateLesson (index.ts) →
// the Firestore doc it writes → this file's query → the response:
//   1. Schema mismatch: generateLesson writes the lesson owner as `uid` —
//      the SAME field apps/{web,mobile}/.../ai-guru/my-lessons already
//      queries and dataRights.ts's DPDP export already relies on (making
//      `uid` the established canonical field for this collection) — but
//      this file queried `userId`, a field aiGuruLessons documents never
//      have. FIXED by querying `uid` here instead (personalDashboard.ts).
//   2. seekho_progress had NO composite index at all for
//      (userId ==, percentComplete <) — the query field name was already
//      correct there (matches seekho.ts, mobile, dataRights.ts), just
//      missing an index. Added to firestore.indexes.json.
//
// A FakeFirestore query has no index enforcement (see fakeFirestore.ts's
// header), so it cannot reproduce "missing index ⇒ query rejects" the way
// real Firestore did on staging — the seekho_progress half of this file
// proves the *query logic* (class isolation via the courses lookup) is
// correct and unaffected, not that the index itself is deployed. The
// aiGuruLessons half genuinely proves the field-name fix: these tests fail
// against the pre-fix `.where("userId", ...)` query, since none of the
// seeded docs (or anything generateLesson ever writes) has a `userId`
// field.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

const redisGet = jest.fn().mockResolvedValue(null);
const redisSet = jest.fn().mockResolvedValue("OK");
jest.mock("../redish", () => ({
  getRedis: () => ({ get: redisGet, set: redisSet }),
  RK: {
    dashboard: (uid: string) => `dashboard:${uid}`,
    seekhoCourses: (cls: number, board: string) => `seekho:courses:${cls}:${board}`,
  },
  TTL: { dashboard: 14400, seekhoCourses: 86400 },
  todayIST: () => "2099-01-01",
}));

jest.mock("../gemini", () => ({
  callGeminiText: jest.fn().mockResolvedValue("Keep learning — you're doing great!"),
}));

import { fakeDb } from "./helpers/mockFirebaseAdmin";
import { getPersonalizedDashboard } from "../personalDashboard";

const UID = "student_dash";

function mockReqRes(body: Record<string, unknown> = {}) {
  const req: any = { method: "POST", headers: { authorization: `Bearer ${UID}` }, body };
  const json = jest.fn();
  const res: any = { set: jest.fn(), status: jest.fn(() => res), json };
  return { req, res, json };
}

beforeEach(() => {
  fakeDb.reset();
  redisGet.mockClear().mockResolvedValue(null);
  redisSet.mockClear();
});

describe("getPersonalizedDashboard — auth", () => {
  test("no Authorization header -> 401, no data touched", async () => {
    const { req, res, json } = mockReqRes();
    req.headers.authorization = "";
    await getPersonalizedDashboard(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });
});

describe("getPersonalizedDashboard — study plan class isolation", () => {
  test("lists ONLY the student's own class course, even when a progress row points at another class's course", async () => {
    fakeDb.seed(`students/${UID}`, { class: "8", board: "CBSE" });
    fakeDb.seed("seekho_courses/c8", { class: 8, board: "CBSE", subject: "Maths", chapterTitle: "Ch1", chapterNumber: 1, isPublished: true });
    fakeDb.seed("seekho_courses/c9", { class: 9, board: "CBSE", subject: "Maths", chapterTitle: "Ch1", chapterNumber: 1, isPublished: true });
    fakeDb.seed("seekho_progress/p1", { userId: UID, courseId: "c8", percentComplete: 40 });
    fakeDb.seed("seekho_progress/p2", { userId: UID, courseId: "c9", percentComplete: 20 }); // another class's course

    const { req, res, json } = mockReqRes();
    await getPersonalizedDashboard(req, res);

    const payload = json.mock.calls[0][0];
    expect(payload.studyPlan).toHaveLength(1);
    expect(payload.studyPlan[0]).toMatchObject({ courseId: "c8", subject: "Maths" });
  });

  test("a student with no class on record gets an empty study plan, never another class's courses", async () => {
    fakeDb.seed(`students/${UID}`, {});
    fakeDb.seed("seekho_courses/c8", { class: 8, board: "CBSE", subject: "Maths", chapterTitle: "Ch1", chapterNumber: 1, isPublished: true });
    fakeDb.seed("seekho_progress/p1", { userId: UID, courseId: "c8", percentComplete: 40 });

    const { req, res, json } = mockReqRes();
    await getPersonalizedDashboard(req, res);

    expect(json.mock.calls[0][0].studyPlan).toEqual([]);
  });
});

describe("getPersonalizedDashboard — recent lessons (the uid/userId fix)", () => {
  test("reads the SAME 'uid' field generateLesson writes, and only this student's lessons", async () => {
    fakeDb.seed(`students/${UID}`, { class: "8", board: "CBSE" });
    fakeDb.seed("aiGuruLessons/l1", { uid: UID, subject: "Science", chapter: "Motion", status: "completed", createdAt: { toMillis: () => 2000 } });
    fakeDb.seed("aiGuruLessons/l2", { uid: "someone_else", subject: "History", chapter: "Wars", status: "completed", createdAt: { toMillis: () => 3000 } });

    const { req, res, json } = mockReqRes();
    await getPersonalizedDashboard(req, res);

    const payload = json.mock.calls[0][0];
    expect(payload.recentLessons).toHaveLength(1);
    expect(payload.recentLessons[0]).toMatchObject({ lessonId: "l1", subject: "Science", chapter: "Motion" });
  });

  test("no lessons for this uid -> empty array, not an error", async () => {
    fakeDb.seed(`students/${UID}`, { class: "8", board: "CBSE" });
    fakeDb.seed("aiGuruLessons/l1", { uid: "someone_else", subject: "History", chapter: "Wars", status: "completed", createdAt: { toMillis: () => 1000 } });

    const { req, res, json } = mockReqRes();
    await getPersonalizedDashboard(req, res);

    expect(json.mock.calls[0][0].recentLessons).toEqual([]);
  });
});

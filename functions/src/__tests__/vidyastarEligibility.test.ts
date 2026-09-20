// Server-side class eligibility for joining a VidyaStar contest: the join
// callable must enforce a contest's targetClass from the student's own
// profile, so a client can't join another class's contest by calling the
// function directly.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "./helpers/mockFirebaseAdmin";
import { checkContestClassEligibility, isPrimaryOnlyTarget } from "../vidyastarEligibility";
import { joinVidyastarContest } from "../vidyastarContest";
import { buildContestLessonPrompt } from "../contestLesson";

const UID = "student_join";
const AUTH = { auth: { uid: UID, token: {} } };

function seedContest(targetClass: unknown, extra: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { title: "Test Contest", isActive: true, totalSpots: 0, joinedCount: 0, vCoinEntryFee: 0, ...extra };
  if (targetClass !== undefined) data.targetClass = targetClass;
  fakeDb.seed("contests/c1", data);
}

beforeEach(() => fakeDb.reset());

describe("checkContestClassEligibility", () => {
  test("a contest with no targetClass is open to everyone", () => {
    expect(checkContestClassEligibility(undefined, "3")).toEqual({ eligible: true });
    expect(checkContestClassEligibility(null, undefined)).toEqual({ eligible: true });
  });

  test("'all' (any case) is open to everyone, even a student with no class", () => {
    expect(checkContestClassEligibility(["all"], "3")).toEqual({ eligible: true });
    expect(checkContestClassEligibility(["ALL"], undefined)).toEqual({ eligible: true });
  });

  test.each([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])("Class %i is eligible only for a contest that targets it", (cls) => {
    expect(checkContestClassEligibility([String(cls)], String(cls))).toEqual({ eligible: true });
    const other = cls === 12 ? "3" : String(cls + 1);
    expect(checkContestClassEligibility([other], String(cls))).toEqual({ eligible: false, reason: "class-not-targeted" });
  });

  test("a student with no or unsupported class is not eligible for a class-targeted contest", () => {
    for (const cls of [undefined, "", "2", "13", "abc"]) {
      expect(checkContestClassEligibility(["6"], cls)).toEqual({ eligible: false, reason: "no-class" });
    }
  });

  test("an empty targetClass list targets no one", () => {
    expect(checkContestClassEligibility([], "6")).toEqual({ eligible: false, reason: "class-not-targeted" });
  });

  test("tolerates a single string and 'Class N' entries", () => {
    expect(checkContestClassEligibility("6", "6")).toEqual({ eligible: true });
    expect(checkContestClassEligibility(["Class 4"], "4")).toEqual({ eligible: true });
  });
});

describe("contest lesson level", () => {
  test("only a Class 3–5 contest is treated as primary-only", () => {
    expect(isPrimaryOnlyTarget(["3", "4", "5"])).toBe(true);
    expect(isPrimaryOnlyTarget(["4"])).toBe(true);
    expect(isPrimaryOnlyTarget(["5", "6"])).toBe(false);
    expect(isPrimaryOnlyTarget(["all"])).toBe(false);
    expect(isPrimaryOnlyTarget([])).toBe(false);
    expect(isPrimaryOnlyTarget(undefined)).toBe(false);
    expect(isPrimaryOnlyTarget(["abc"])).toBe(false);
  });

  test("the prompt is written at an early-primary level only for primary-only contests", () => {
    const primary = buildContestLessonPrompt("Animals", "", "English", true);
    expect(primary).toContain("early-primary level (Class 3–5)");
    expect(primary).toContain("Difficulty: Easy.");

    const general = buildContestLessonPrompt("Animals", "", "English");
    expect(general).toContain("Teach at a general school level.");
    expect(general).toContain("Difficulty: Standard.");
    expect(general).not.toContain("early-primary");
  });
});

describe("joinVidyastarContest — class eligibility", () => {
  test("rejects a Class 4 student joining a Class 6–7 contest", async () => {
    fakeDb.seed(`students/${UID}`, { name: "Kid", class: "4" });
    seedContest(["6", "7"]);
    await expect(joinVidyastarContest.run({ contestId: "c1" }, AUTH as any)).rejects.toMatchObject({
      code: "permission-denied",
      message: "This contest isn't open for your class.",
    });
    expect(fakeDb.peek("contests/c1/participant/" + UID)).toBeUndefined();
    expect(fakeDb.peek("contests/c1")?.joinedCount).toBe(0);
  });

  test("lets a Class 3 student join a contest that targets Class 3", async () => {
    fakeDb.seed(`students/${UID}`, { name: "Kid", class: "3" });
    seedContest(["3", "4", "5"]);
    await expect(joinVidyastarContest.run({ contestId: "c1" }, AUTH as any)).resolves.toMatchObject({ status: "joined" });
    expect(fakeDb.peek("contests/c1/participant/" + UID)).toMatchObject({ userId: UID, name: "Kid" });
  });

  test("lets any class join an 'all' contest, and a contest with no targetClass", async () => {
    fakeDb.seed(`students/${UID}`, { name: "Kid", class: "5" });
    seedContest(["all"]);
    await expect(joinVidyastarContest.run({ contestId: "c1" }, AUTH as any)).resolves.toMatchObject({ status: "joined" });

    fakeDb.reset();
    fakeDb.seed(`students/${UID}`, { name: "Kid", class: "5" });
    seedContest(undefined);
    await expect(joinVidyastarContest.run({ contestId: "c1" }, AUTH as any)).resolves.toMatchObject({ status: "joined" });
  });

  test("a student with no class cannot join a class-targeted contest", async () => {
    fakeDb.seed(`students/${UID}`, { name: "Kid" });
    seedContest(["6"]);
    await expect(joinVidyastarContest.run({ contestId: "c1" }, AUTH as any)).rejects.toMatchObject({
      code: "permission-denied",
      message: "Set your class in your profile to join this contest.",
    });
  });

  test("someone who already joined still gets 'already_joined'", async () => {
    fakeDb.seed(`students/${UID}`, { name: "Kid", class: "4" });
    seedContest(["6"]);
    fakeDb.seed("contests/c1/participant/" + UID, { userId: UID });
    await expect(joinVidyastarContest.run({ contestId: "c1" }, AUTH as any)).resolves.toEqual({ status: "already_joined" });
  });
});

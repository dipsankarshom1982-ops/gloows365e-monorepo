// Stage 2.1: what Class 3–5 do and don't see. The UI itself can't run in this
// suite, so the decisions behind it are tested here as pure functions —
// plus the real Learn Fun game data, so a change to a game's classRange is caught.

import { isPrimaryClassLevel } from "../educationConfig";
import { isFeatureHiddenForClass } from "../../../packages/shared-logic/src/education/classFeatureGates";
import { fallbackMissionFor, gamesForClass } from "../../../packages/shared-logic/src/education/learnFunSelection";
import { withPrimarySubjects } from "../../../packages/shared-logic/src/education/subjects";
import { GAMES } from "../../../apps/mobile/lib/learnfun/constants";

describe("isPrimaryClassLevel", () => {
  test("true only for Class 3, 4 and 5", () => {
    for (const cls of [3, 4, 5, "3", "Class 4"]) expect(isPrimaryClassLevel(cls)).toBe(true);
    for (const cls of [6, 7, 8, 9, 10, 11, 12, "12", 2, 13, undefined, null, "", "abc"]) {
      expect(isPrimaryClassLevel(cls)).toBe(false);
    }
  });
});

describe("Discover is hidden for Class 3–5 only", () => {
  test.each([3, 4, 5])("Class %i: the home card and both AI Guru entries are hidden", (cls) => {
    expect(isFeatureHiddenForClass("homeSection", "discover_preview", cls)).toBe(true);
    expect(isFeatureHiddenForClass("aiGuru", "discover", String(cls))).toBe(true);
  });

  test.each([6, 7, 8, 9, 10, 11, 12])("Class %i keeps Discover (unchanged behavior)", (cls) => {
    expect(isFeatureHiddenForClass("homeSection", "discover_preview", cls)).toBe(false);
    expect(isFeatureHiddenForClass("aiGuru", "discover", cls)).toBe(false);
  });

  test("a student with no class is not hidden from anything", () => {
    expect(isFeatureHiddenForClass("homeSection", "discover_preview", undefined)).toBe(false);
    expect(isFeatureHiddenForClass("aiGuru", "discover", "abc")).toBe(false);
  });

  test("nothing else is hidden for Class 3–5", () => {
    for (const key of ["stories", "seekho_preview", "knowledge_hub", "vidyastar_preview"]) {
      expect(isFeatureHiddenForClass("homeSection", key, 4)).toBe(false);
    }
    for (const key of ["ask_guru", "photo_solve", "exam_simulator", "vidyaguru"]) {
      expect(isFeatureHiddenForClass("aiGuru", key, 4)).toBe(false);
    }
  });
});

describe("Learn Fun games by class (real game data)", () => {
  test.each([3, 4, 5])("Class %i is not shown any Class 6-specific game", (cls) => {
    expect(gamesForClass(GAMES, cls)).toEqual([]);
    expect(gamesForClass(GAMES, String(cls))).toEqual([]);
  });

  test.each([6, 7, 8, 9, 10, 11, 12])("Class %i keeps its four games, all written for that class", (cls) => {
    const games = gamesForClass(GAMES, cls);
    expect(games).toHaveLength(4);
    for (const g of games) expect(g.classRange).toEqual([cls]);
  });

  test("an unsupported class gets no games", () => {
    for (const cls of [undefined, null, "", "2", "13", "abc", 0]) expect(gamesForClass(GAMES, cls)).toEqual([]);
  });

  test("inactive and coming-soon games are never returned", () => {
    const games = [
      { id: "a", classRange: [6], isActive: true, isComingSoon: false },
      { id: "b", classRange: [6], isActive: false, isComingSoon: false },
      { id: "c", classRange: [6], isActive: true, isComingSoon: true },
    ];
    expect(gamesForClass(games, 6).map((g) => g.id)).toEqual(["a"]);
  });
});

describe("Learn Fun fallback mission pools", () => {
  const pools = { primary: ["money", "time"], general: ["money", "time", "digital", "goal"] };

  test("Class 3–5 only ever draw from the primary pool, on every weekday", () => {
    for (const cls of [3, 4, 5]) {
      for (let day = 0; day < 7; day++) {
        expect(pools.primary).toContain(fallbackMissionFor(pools, cls, day));
      }
    }
  });

  test("Class 3–5 never get the digital-safety or goal-setting mission", () => {
    const seen = new Set<string | null>();
    for (const cls of [3, 4, 5]) for (let day = 0; day < 7; day++) seen.add(fallbackMissionFor(pools, cls, day));
    expect(seen).toEqual(new Set(["money", "time"]));
  });

  test("other supported classes use the general pool", () => {
    expect(fallbackMissionFor(pools, 8, 2)).toBe("digital");
  });

  test("an unsupported class gets no mission", () => {
    for (const cls of [undefined, "", "2", "13", "abc"]) expect(fallbackMissionFor(pools, cls, 1)).toBeNull();
  });
});

describe("AI Guru subjects", () => {
  const base = ["Computer", "Science", "Math"];

  test("Class 3–5 get EVS first; the base list is otherwise intact", () => {
    for (const cls of [3, 4, 5]) expect(withPrimarySubjects(base, cls)).toEqual(["EVS", ...base]);
  });

  test("every other class, and an unknown class, keeps the standard list", () => {
    for (const cls of [6, 8, 12, undefined, "abc"]) expect(withPrimarySubjects(base, cls)).toEqual(base);
  });

  test("does not mutate the base list", () => {
    withPrimarySubjects(base, 4);
    expect(base).toEqual(["Computer", "Science", "Math"]);
  });
});

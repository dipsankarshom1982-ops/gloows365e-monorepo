// Class targeting for shared content (Knowledge Hub videos): "all" or the
// student's own class shows; untargeted (pre-targeting) content stays visible
// to Class 6–12 but is never silently shown to Class 3–5.

import { isTargetedAtClass } from "../../../packages/shared-logic/src/education/contentTargeting";

describe("isTargetedAtClass", () => {
  test.each([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])("Class %i sees 'all' and content targeting its own class", (cls) => {
    expect(isTargetedAtClass(["all"], String(cls))).toBe(true);
    expect(isTargetedAtClass(["ALL"], cls)).toBe(true);
    expect(isTargetedAtClass([String(cls)], String(cls))).toBe(true);
  });

  test("content targeting other classes is hidden", () => {
    expect(isTargetedAtClass(["10", "11"], "4")).toBe(false);
    expect(isTargetedAtClass(["3"], "8")).toBe(false);
  });

  test("untargeted content stays visible to Class 6–12 (existing behavior)", () => {
    for (const cls of [6, 7, 8, 9, 10, 11, 12]) {
      expect(isTargetedAtClass(undefined, String(cls))).toBe(true);
      expect(isTargetedAtClass([], String(cls))).toBe(true);
    }
  });

  test("untargeted content is never silently shown to Class 3–5", () => {
    for (const cls of [3, 4, 5]) {
      expect(isTargetedAtClass(undefined, String(cls))).toBe(false);
      expect(isTargetedAtClass(null, cls)).toBe(false);
      expect(isTargetedAtClass([], cls)).toBe(false);
    }
  });

  test("a student with no supported class keeps the untargeted behavior but sees no class-specific content", () => {
    for (const stored of [undefined, "", "2", "13", "abc"]) {
      expect(isTargetedAtClass(undefined, stored)).toBe(true);
      expect(isTargetedAtClass(["8"], stored)).toBe(false);
      expect(isTargetedAtClass(["all"], stored)).toBe(true);
    }
  });

  test("tolerates a single string and 'Class N' entries", () => {
    expect(isTargetedAtClass("5", "5")).toBe(true);
    expect(isTargetedAtClass(["Class 4"], "4")).toBe(true);
  });
});

describe("Knowledge Hub for a Class 3–5 student (the empty-state condition)", () => {
  const videos = [
    { id: "legacy-untargeted" },
    { id: "older-only", targetClass: ["9", "10", "11", "12"] },
    { id: "class-6-8", targetClass: ["6", "7", "8"] },
  ];
  const visibleFor = (cls: string, list: Array<{ id: string; targetClass?: string[] }>) =>
    list.filter((v) => isTargetedAtClass(v.targetClass, cls)).map((v) => v.id);

  test("with no video targeted at their class, a Class 3–5 student sees nothing (so the empty state shows)", () => {
    for (const cls of ["3", "4", "5"]) expect(visibleFor(cls, videos)).toEqual([]);
  });

  test("videos targeted at their class or at 'all' appear, and nothing else does", () => {
    const withTargeted = [...videos, { id: "class-4", targetClass: ["4"] }, { id: "everyone", targetClass: ["all"] }];
    expect(visibleFor("4", withTargeted)).toEqual(["class-4", "everyone"]);
    expect(visibleFor("3", withTargeted)).toEqual(["everyone"]);
  });

  test("Class 6–12 still see the untargeted legacy video plus their own targeted ones", () => {
    expect(visibleFor("7", videos)).toEqual(["legacy-untargeted", "class-6-8"]);
    expect(visibleFor("11", videos)).toEqual(["legacy-untargeted", "older-only"]);
  });
});

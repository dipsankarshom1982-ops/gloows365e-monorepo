import * as fs from "fs";
import * as path from "path";
import {
  CLASS_BANDS,
  getClassBand,
  getQuizSubjectPool,
  isPrimaryClassLevel,
  isStreamClassLevel,
  isSupportedClassLevel,
  NON_STREAM_CLASS_LEVELS,
  parseClassLevel,
  STREAM_CLASS_LEVELS,
  SUPPORTED_CLASS_LEVEL_STRINGS,
  SUPPORTED_CLASS_LEVELS,
} from "../educationConfig";

describe("education class config", () => {
  test("supports exactly Class 3 through Class 12", () => {
    expect(SUPPORTED_CLASS_LEVELS).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(SUPPORTED_CLASS_LEVEL_STRINGS).toEqual(["3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);
  });

  test("only Class 11 and 12 have streams", () => {
    expect(STREAM_CLASS_LEVELS).toEqual([11, 12]);
    expect(NON_STREAM_CLASS_LEVELS).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test("bands cover every supported class exactly once", () => {
    const covered = CLASS_BANDS.flatMap((b) => [...b.classes]).sort((a, b) => a - b);
    expect(covered).toEqual([...SUPPORTED_CLASS_LEVELS]);
  });

  test.each([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])("Class %i parses from number, string and 'Class N'", (n) => {
    expect(parseClassLevel(n)).toBe(n);
    expect(parseClassLevel(String(n))).toBe(n);
    expect(parseClassLevel(` Class ${n} `)).toBe(n);
  });

  test.each([0, 1, 2, 13, 6.5, -3, NaN, "", "abc", null, undefined, true, {}])(
    "rejects unsupported value %p instead of coercing it",
    (v) => {
      expect(parseClassLevel(v)).toBeNull();
      expect(isSupportedClassLevel(v)).toBe(false);
      expect(getClassBand(v)).toBeNull();
    }
  );

  test("maps classes to their band", () => {
    expect(getClassBand("3")).toBe("PRIMARY_FOUNDATION");
    expect(getClassBand(5)).toBe("PRIMARY_FOUNDATION");
    expect(getClassBand(6)).toBe("MIDDLE");
    expect(getClassBand(10)).toBe("SECONDARY");
    expect(getClassBand("12")).toBe("SENIOR_SECONDARY");
  });

  test("stream detection covers 11 and 12 only", () => {
    expect(isStreamClassLevel("11")).toBe(true);
    expect(isStreamClassLevel(12)).toBe(true);
    expect(isStreamClassLevel(10)).toBe(false);
    expect(isStreamClassLevel(3)).toBe(false);
    expect(isStreamClassLevel(null)).toBe(false);
  });
});

describe("isPrimaryClassLevel", () => {
  test("matches the Class 3–5 band exactly", () => {
    for (const cls of SUPPORTED_CLASS_LEVELS) {
      expect(isPrimaryClassLevel(cls)).toBe(getClassBand(cls) === "PRIMARY_FOUNDATION");
    }
    expect(isPrimaryClassLevel(undefined)).toBe(false);
  });
});

describe("quiz subject pools", () => {
  test("Class 3–5 get the primary pool, without Science/Social Science/Current Affairs", () => {
    for (const cls of [3, 4, 5]) {
      expect(getQuizSubjectPool(cls)).toEqual([
        "Mathematics", "English", "Environmental Studies (EVS)", "General Knowledge", "Logical Reasoning",
      ]);
    }
  });

  test("Class 6–10 keep the original general pool", () => {
    for (const cls of [6, 7, 8, 9, 10]) {
      expect(getQuizSubjectPool(cls)).toEqual([
        "General Knowledge", "Mathematics", "Science", "English", "Social Science", "Current Affairs", "Logical Reasoning",
      ]);
    }
  });

  test("Class 11–12 have no general pool (their pools are per stream), and unsupported classes have none", () => {
    expect(getQuizSubjectPool(11)).toBeNull();
    expect(getQuizSubjectPool("12")).toBeNull();
    expect(getQuizSubjectPool(2)).toBeNull();
    expect(getQuizSubjectPool(undefined)).toBeNull();
  });
});

describe("education config copies", () => {
  const repoRoot = path.resolve(__dirname, "../../..");
  const canonical = path.join(repoRoot, "packages/shared-logic/src/education/classes.ts");
  const copies = [
    path.join(repoRoot, "apps/admin/src/lib/educationConfig.ts"),
    path.join(repoRoot, "functions/src/educationConfig.ts"),
  ];

  test.each(copies)("%s is identical to the canonical shared-logic file", (copy) => {
    const normalize = (p: string) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
    expect(normalize(copy)).toBe(normalize(canonical));
  });
});

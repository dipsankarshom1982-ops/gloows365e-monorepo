// Server-side class resolution + class-appropriate prompts for AI Guru.
// Language handling (aiLanguage.ts) is intentionally untouched and is
// re-asserted here only to prove the class work didn't displace it.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { FakeFirestore } from "./helpers/fakeFirestore";
import {
  boardClassPhrase,
  classLevelBand,
  getClassLevelInstruction,
  resolveClassLevelForRequest,
  resolveStudentClassLevel,
} from "../aiStudentContext";
import { buildAskAiGuruPrompt } from "../askAiGuru";
import { buildVidyaGuruSystemPrompt } from "../vidyaguru";

const asDb = (fake: FakeFirestore) => fake as unknown as FirebaseFirestore.Firestore;

describe("resolveStudentClassLevel — from the student's own profile only", () => {
  test.each([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])("reads Class %i from students/{uid}", async (cls) => {
    const db = new FakeFirestore();
    db.seed("students/u1", { class: String(cls) });
    await expect(resolveStudentClassLevel("u1", asDb(db))).resolves.toBe(cls);
  });

  test.each([undefined, "", "2", "13", "abc"])("returns null for a missing or unsupported class %p", async (stored) => {
    const db = new FakeFirestore();
    db.seed("students/u1", stored === undefined ? {} : { class: stored });
    await expect(resolveStudentClassLevel("u1", asDb(db))).resolves.toBeNull();
  });

  test("returns null when there is no student doc", async () => {
    await expect(resolveStudentClassLevel("ghost", asDb(new FakeFirestore()))).resolves.toBeNull();
  });
});

describe("resolveClassLevelForRequest — exam/lesson class", () => {
  const seed = (cls?: string) => {
    const db = new FakeFirestore();
    db.seed("students/u1", cls === undefined ? {} : { class: cls });
    return asDb(db);
  };

  test.each([3, 4, 5])("a Class %i student is pinned to their own class, whatever the request says", async (cls) => {
    for (const requested of ["10", "12", 8, undefined, "junk"]) {
      await expect(resolveClassLevelForRequest("u1", seed(String(cls)), requested)).resolves.toBe(cls);
    }
  });

  test("an older student's explicit supported choice is honored", async () => {
    await expect(resolveClassLevelForRequest("u1", seed("8"), "6")).resolves.toBe(6);
    await expect(resolveClassLevelForRequest("u1", seed("8"), 11)).resolves.toBe(11);
  });

  test("an older student falls back to their own class when the request is missing or unsupported", async () => {
    for (const requested of [undefined, "", "2", "13", "junk"]) {
      await expect(resolveClassLevelForRequest("u1", seed("8"), requested)).resolves.toBe(8);
    }
  });

  test("a student with no class uses a supported request, else gets null — never a default", async () => {
    await expect(resolveClassLevelForRequest("u1", seed(undefined), "10")).resolves.toBe(10);
    await expect(resolveClassLevelForRequest("u1", seed(undefined), undefined)).resolves.toBeNull();
    await expect(resolveClassLevelForRequest("u1", seed(undefined), "2")).resolves.toBeNull();
  });
});

describe("class-level prompt guidance", () => {
  test("Class 3–5 get early-primary guidance naming their class", () => {
    for (const cls of [3, 4, 5]) {
      const text = getClassLevelInstruction(cls);
      expect(text).toContain(`Class ${cls} (early primary)`);
      expect(text).toContain("ONE idea at a time");
    }
  });

  test("Class 6–12 add nothing, so their existing prompts are unchanged", () => {
    for (const cls of [6, 7, 8, 9, 10, 11, 12]) expect(getClassLevelInstruction(cls)).toBe("");
  });

  test("an unknown class gets neutral wording, not an assumed level", () => {
    expect(getClassLevelInstruction(null)).toContain("not on record");
    expect(boardClassPhrase("CBSE", null)).toBe("CBSE");
    expect(boardClassPhrase("CBSE", 8)).toBe("CBSE, Class 8");
    expect(classLevelBand(null)).toBeNull();
    expect(classLevelBand(4)).toBe("PRIMARY_FOUNDATION");
    expect(classLevelBand(9)).toBe("SECONDARY");
  });
});

describe("Ask AI Guru prompt", () => {
  test("a Class 3 student gets their class and the primary guidance, in the language they chose", () => {
    const prompt = buildAskAiGuruPrompt("What is a fraction?", 3, "CBSE", "explain", "Bengali");
    expect(prompt).toContain("(CBSE, Class 3)");
    expect(prompt).toContain("LEARNING LEVEL");
    expect(prompt).toContain("CRITICAL LANGUAGE RULE");
    expect(prompt).toContain("respond in Bengali");
  });

  test("a Class 8 student's prompt is unchanged: class named, no extra guidance", () => {
    const prompt = buildAskAiGuruPrompt("What is a fraction?", 8, "CBSE", "explain", "Hindi");
    expect(prompt).toContain("(CBSE, Class 8)");
    expect(prompt).not.toContain("LEARNING LEVEL");
    expect(prompt).toContain("respond in Hindi");
  });

  test("an unknown class never becomes Class 10", () => {
    const prompt = buildAskAiGuruPrompt("Tip please", null, "CBSE", "tip", "English");
    expect(prompt).not.toContain("Class 10");
    expect(prompt).toContain("(CBSE)");
    expect(prompt).toContain("a CBSE student");
    expect(prompt).toContain("not on record");
  });

  test("the tip mode names the student's real class", () => {
    expect(buildAskAiGuruPrompt("x", 4, "CBSE", "tip", "English")).toContain("for a Class 4 CBSE student");
  });
});

describe("VidyaGuru system prompt", () => {
  test("Class 4 gets primary guidance and keeps the language rule", () => {
    const prompt = buildVidyaGuruSystemPrompt("Asha", 4, "Tamil");
    expect(prompt).toContain("Student: Asha, Class 4");
    expect(prompt).toContain("LEARNING LEVEL");
    expect(prompt).toContain("respond in Tamil");
  });

  test("an unknown class is not given a default", () => {
    const prompt = buildVidyaGuruSystemPrompt("Asha", null, "English");
    expect(prompt).toContain("Student: Asha\n");
    expect(prompt).not.toContain("Class 8");
  });
});

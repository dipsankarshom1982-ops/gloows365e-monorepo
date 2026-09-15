// PATH: functions/src/__tests__/aiLanguage.test.ts
//
// Offline unit tests for the centralized Ask AI Guru language handling —
// see ../aiLanguage.ts's header comment for the production bug this
// replaces. resolveStudentLanguage() takes `db` directly (not through
// admin.firestore()), so this only needs FakeFirestore itself, no
// jest.mock("firebase-admin") — see helpers/fakeFirestore.ts's header.

import { FakeFirestore } from "./helpers/fakeFirestore";
import {
  resolveStudentLanguage,
  getLanguageInstruction,
  getDetectOrFallbackInstruction,
  SUPPORTED_LANGUAGE_NAMES,
} from "../aiLanguage";

// resolveStudentLanguage() is typed against the real
// FirebaseFirestore.Firestore interface — cast once here, same as the
// rules-tests' own seed() helper casts rules-unit-testing's firestore().
function resolve(fake: FakeFirestore, uid: string, requestLanguage?: string) {
  return resolveStudentLanguage(uid, fake as unknown as FirebaseFirestore.Firestore, requestLanguage);
}

describe("resolveStudentLanguage — priority order", () => {
  test("Priority 1: an explicit, recognized request language wins even if the saved preference differs", async () => {
    const db = new FakeFirestore();
    db.seed("students/u1", { preferredLanguage: "Bengali" });
    const lang = await resolve(db, "u1", "Hindi");
    expect(lang).toBe("Hindi");
  });

  test("Priority 2: falls back to the student's saved preference when no request language is given", async () => {
    const db = new FakeFirestore();
    db.seed("students/u1", { preferredLanguage: "Tamil" });
    const lang = await resolve(db, "u1");
    expect(lang).toBe("Tamil");
  });

  test("an unrecognized request language is ignored, not trusted — falls through to the saved preference", async () => {
    const db = new FakeFirestore();
    db.seed("students/u1", { preferredLanguage: "Hindi" });
    const lang = await resolve(db, "u1", "Klingon");
    expect(lang).toBe("Hindi");
  });

  test("Priority 3: defaults to English when there's no request language and no saved preference", async () => {
    const db = new FakeFirestore();
    db.seed("students/u1", {}); // profile exists but never set a language
    const lang = await resolve(db, "u1");
    expect(lang).toBe("English");
  });

  test("Priority 3: defaults to English when the student doc doesn't exist at all", async () => {
    const db = new FakeFirestore();
    const lang = await resolve(db, "ghost_uid");
    expect(lang).toBe("English");
  });

  test("language is NEVER undefined/empty for any combination of inputs", async () => {
    const db = new FakeFirestore();
    for (const req of [undefined, "", "not-a-language", "Hindi"]) {
      const lang = await resolve(db, "no_such_uid", req);
      expect(lang).toBeTruthy();
      expect(SUPPORTED_LANGUAGE_NAMES.has(lang)).toBe(true);
    }
  });
});

describe("getLanguageInstruction — unconditional, script-explicit directive", () => {
  test("English gets a plain, simple instruction with no script/Devanagari noise", () => {
    const instruction = getLanguageInstruction("English");
    expect(instruction).toMatch(/English/);
    expect(instruction).not.toMatch(/Devanagari/);
  });

  test("Hindi explicitly names Devanagari script (task's own explicit requirement)", () => {
    const instruction = getLanguageInstruction("Hindi");
    expect(instruction).toMatch(/Hindi/);
    expect(instruction).toMatch(/Devanagari/);
    expect(instruction).toMatch(/MUST/);
  });

  test("Bengali gets its own script call-out, not a generic/English fallback", () => {
    const instruction = getLanguageInstruction("Bengali");
    expect(instruction).toContain("MUST write the ENTIRE response in Bengali");
    expect(instruction).toMatch(/Bengali script/);
  });

  // Regression coverage for the exact bug this module fixes: examSimulator.ts
  // and photoSolve.ts used to hardcode `language === "Hindi" ? ... :
  // language === "Bengali" ? ... : "English"`, silently forcing English for
  // every other supported language. Every one of these must now produce an
  // instruction naming itself, not English.
  test.each(["Tamil", "Telugu", "Marathi", "Gujarati", "Kannada", "Malayalam", "Punjabi", "Urdu", "Odia", "Assamese"])(
    "%s produces its own instruction, not a silent English fallback",
    (language) => {
      const instruction = getLanguageInstruction(language);
      // The old bug: examSimulator.ts/photoSolve.ts's ternary silently
      // produced an English-language instruction for every one of these.
      // The real assertion is that the directive names THIS language, not
      // that the string "English" never appears at all (the trailing
      // "Do not respond in English unless English is the selected
      // language" caveat is intentional and correct for every language).
      expect(instruction).toContain(`MUST write the ENTIRE response in ${language}`);
    }
  );

  test("forbids Hinglish/romanized transliteration unless explicitly requested", () => {
    const instruction = getLanguageInstruction("Hindi");
    expect(instruction).toMatch(/Hinglish/i);
  });
});

describe("getDetectOrFallbackInstruction — chat/voice detect-then-fallback", () => {
  test("the fallback sentence is unconditional and names the preferred language directly", () => {
    const instruction = getDetectOrFallbackInstruction("Hindi");
    expect(instruction).toMatch(/MUST respond in Hindi/);
    expect(instruction).toMatch(/not optional/i);
  });

  test("still instructs matching the student's own input language for non-English input", () => {
    const instruction = getDetectOrFallbackInstruction("Hindi");
    expect(instruction).toMatch(/Detect the language/i);
  });

  test("English preference doesn't append a redundant script note to its own fallback sentence", () => {
    const instruction = getDetectOrFallbackInstruction("English");
    expect(instruction).toContain("you MUST respond in English — the student's own selected app language.");
  });
});

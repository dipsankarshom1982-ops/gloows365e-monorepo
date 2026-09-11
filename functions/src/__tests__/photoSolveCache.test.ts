// PATH: functions/src/__tests__/photoSolveCache.test.ts
//
// Direct regression coverage for the exact scenario the task's "Cache
// test" asked for: the same photographed question, solved once by an
// English-preference student and once by a Hindi-preference student, must
// never share a cache entry. See ../photoSolve.ts's cache-key comment for
// the full context — this used to be imageHash-only (language omitted
// entirely), so the second student's request would get served the first
// student's cached English answer straight out of Redis, bypassing
// buildPhotoSolvePrompt's language instruction altogether.
//
// No Gemini/Redis call needed to prove this: buildPhotoSolveCacheKey() is
// the exact function the real handler calls to decide whether two requests
// are "the same cached thing" — if it produces different keys for
// different languages, a live cache genuinely cannot cross languages,
// full stop.

// photoSolve.ts calls admin.firestore() at module load time — mock
// firebase-admin before importing it, same approach as
// aiGuruSubscription.test.ts, even though this suite only touches the one
// pure, exported cache-key function.
jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { buildPhotoSolveCacheKey } from "../photoSolve";

const SAME_IMAGE = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAAAAAAAD/2wBDAA"; // identical "photo" for every case below

describe("buildPhotoSolveCacheKey — language isolation", () => {
  test("the identical image/class/board produces DIFFERENT cache keys for English vs Hindi", () => {
    const englishKey = buildPhotoSolveCacheKey(SAME_IMAGE, "10", "CBSE", "English");
    const hindiKey    = buildPhotoSolveCacheKey(SAME_IMAGE, "10", "CBSE", "Hindi");
    expect(englishKey).not.toBe(hindiKey);
  });

  test("the identical image/class/board produces DIFFERENT cache keys across every supported language pairing", () => {
    const languages = ["English", "Hindi", "Bengali", "Tamil", "Telugu", "Marathi"];
    const keys = languages.map((lang) => buildPhotoSolveCacheKey(SAME_IMAGE, "10", "CBSE", lang));
    // Every key must be unique — a Set collapses duplicates, so its size
    // staying equal to the input count IS the "no two languages collide"
    // assertion.
    expect(new Set(keys).size).toBe(languages.length);
  });

  test("the SAME image + class + board + language reproduces the SAME key (still cacheable, not always-miss)", () => {
    const keyA = buildPhotoSolveCacheKey(SAME_IMAGE, "10", "CBSE", "Hindi");
    const keyB = buildPhotoSolveCacheKey(SAME_IMAGE, "10", "CBSE", "Hindi");
    expect(keyA).toBe(keyB);
  });

  test("a different image with the same language produces a different key (still image-scoped)", () => {
    const keyA = buildPhotoSolveCacheKey(SAME_IMAGE, "10", "CBSE", "Hindi");
    const keyB = buildPhotoSolveCacheKey(SAME_IMAGE + "different-photo-bytes", "10", "CBSE", "Hindi");
    expect(keyA).not.toBe(keyB);
  });

  test("every key carries the exact language name in plain text (auditable in Redis, not just a hash)", () => {
    const key = buildPhotoSolveCacheKey(SAME_IMAGE, "10", "CBSE", "Bengali");
    expect(key.endsWith(":Bengali")).toBe(true);
  });
});

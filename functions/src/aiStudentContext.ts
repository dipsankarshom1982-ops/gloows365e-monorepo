// PATH: functions/src/aiStudentContext.ts
//
// Server-side student class resolution for every AI Guru feature, alongside
// aiLanguage.ts (which resolves language the same way and is unchanged).
// The class used in a prompt used to come straight from the request body,
// with hardcoded "10"/"8" defaults, so a Class 3 student's request could
// silently be answered at Class 10 level. The class now comes from
// students/{uid}.class, and an unknown class gets neutral, simple wording
// instead of an assumed advanced level.

import { ClassBandId, getClassBand, parseClassLevel } from "./educationConfig";

/** The student's class from their own profile — never from the request. Null if missing or unsupported. */
export async function resolveStudentClassLevel(
  uid: string,
  db: FirebaseFirestore.Firestore
): Promise<number | null> {
  try {
    const snap = await db.collection("students").doc(uid).get();
    return parseClassLevel(snap.data()?.class);
  } catch (err: any) {
    console.warn("[aiStudentContext] Could not read student class:", err?.message);
    return null;
  }
}

/**
 * For features where the class is part of the requested artifact (an exam or
 * lesson "for Class N"). Class 3–5 students are pinned to their own class;
 * older students may pick another supported class (e.g. revising an earlier
 * class), falling back to their profile class.
 */
export async function resolveClassLevelForRequest(
  uid: string,
  db: FirebaseFirestore.Firestore,
  requested: unknown
): Promise<number | null> {
  const own = await resolveStudentClassLevel(uid, db);
  if (own !== null && getClassBand(own) === "PRIMARY_FOUNDATION") return own;
  return parseClassLevel(requested) ?? own;
}

export function classLevelBand(classLevel: number | null): ClassBandId | null {
  return classLevel === null ? null : getClassBand(classLevel);
}

/** "CBSE, Class 8" — or just "CBSE" when the class isn't known. */
export function boardClassPhrase(board: string, classLevel: number | null): string {
  return classLevel === null ? board : `${board}, Class ${classLevel}`;
}

/** Prompt guidance for the student's level. Empty for Class 6–12, whose prompts already name the class. */
export function getClassLevelInstruction(classLevel: number | null): string {
  if (classLevel === null) {
    return "LEARNING LEVEL: The student's class is not on record. Keep the explanation simple and clear, and do not assume an advanced level.";
  }
  if (classLevelBand(classLevel) === "PRIMARY_FOUNDATION") {
    return `LEARNING LEVEL: The student is in Class ${classLevel} (early primary). Use very simple words and short sentences, concrete everyday examples (home, school, animals, food, games), and ONE idea at a time, in a warm, encouraging tone. Avoid technical terms and abstract reasoning. If the question is beyond this level, explain only the basic idea in a simple, age-appropriate way instead of giving an advanced explanation.`;
  }
  return "";
}

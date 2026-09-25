// Canonical class config. Copies live in apps/admin/src/lib/educationConfig.ts and functions/src/educationConfig.ts; functions/src/__tests__/educationConfigSync.test.ts fails if they drift.

export const MIN_CLASS_LEVEL = 3;
export const MAX_CLASS_LEVEL = 12;

export const SUPPORTED_CLASS_LEVELS: readonly number[] = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const SUPPORTED_CLASS_LEVEL_STRINGS: readonly string[] = SUPPORTED_CLASS_LEVELS.map(String);

export const STREAM_CLASS_LEVELS: readonly number[] = [11, 12];
export const NON_STREAM_CLASS_LEVELS: readonly number[] = SUPPORTED_CLASS_LEVELS.filter(
  (c) => !STREAM_CLASS_LEVELS.includes(c)
);

export type ClassBandId = "PRIMARY_FOUNDATION" | "MIDDLE" | "SECONDARY" | "SENIOR_SECONDARY";

export interface ClassBand {
  id: ClassBandId;
  label: string;
  classes: readonly number[];
}

export const CLASS_BANDS: readonly ClassBand[] = [
  { id: "PRIMARY_FOUNDATION", label: "Class 3–5", classes: [3, 4, 5] },
  { id: "MIDDLE", label: "Class 6–8", classes: [6, 7, 8] },
  { id: "SECONDARY", label: "Class 9–10", classes: [9, 10] },
  { id: "SENIOR_SECONDARY", label: "Class 11–12", classes: [11, 12] },
];

export const CLASS_RANGE_LABEL = "Class 3–12";

const GENERAL_QUIZ_SUBJECTS: readonly string[] = [
  "General Knowledge", "Mathematics", "Science", "English",
  "Social Science", "Current Affairs", "Logical Reasoning",
];

// Daily Streak Quiz subject pool per band. Class 11–12 pools are per-stream and live with the generator, so that band is null.
export const QUIZ_SUBJECT_POOLS: Record<ClassBandId, readonly string[] | null> = {
  PRIMARY_FOUNDATION: ["Mathematics", "English", "Environmental Studies (EVS)", "General Knowledge", "Logical Reasoning"],
  MIDDLE: GENERAL_QUIZ_SUBJECTS,
  SECONDARY: GENERAL_QUIZ_SUBJECTS,
  SENIOR_SECONDARY: null,
};

// Accepts 8, "8", " 8 " and "Class 8"; returns null for anything outside the supported range.
export function parseClassLevel(value: unknown): number | null {
  const raw = typeof value === "string" ? value.trim().replace(/^class\s*/i, "") : value;
  if (raw === "" || raw === null || raw === undefined) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isInteger(n) && SUPPORTED_CLASS_LEVELS.includes(n) ? n : null;
}

export function isSupportedClassLevel(value: unknown): boolean {
  return parseClassLevel(value) !== null;
}

export function isStreamClassLevel(value: unknown): boolean {
  const n = parseClassLevel(value);
  return n !== null && STREAM_CLASS_LEVELS.includes(n);
}

export function getClassBand(value: unknown): ClassBandId | null {
  const n = parseClassLevel(value);
  if (n === null) return null;
  return CLASS_BANDS.find((b) => b.classes.includes(n))?.id ?? null;
}

/** True for Class 3–5 (the early-primary band); false for every other class and for a missing/unsupported one. */
export function isPrimaryClassLevel(value: unknown): boolean {
  return getClassBand(value) === "PRIMARY_FOUNDATION";
}

export function getQuizSubjectPool(value: unknown): readonly string[] | null {
  const band = getClassBand(value);
  return band ? QUIZ_SUBJECT_POOLS[band] : null;
}

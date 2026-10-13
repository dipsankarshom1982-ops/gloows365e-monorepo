import { isPrimaryClassLevel } from "./classes";

/** Class 3–5 also get EVS (Environmental Studies), listed first; every other class keeps the given list unchanged. */
export function withPrimarySubjects(baseSubjects: readonly string[], studentClass: unknown): string[] {
  return isPrimaryClassLevel(studentClass) ? ["EVS", ...baseSubjects] : [...baseSubjects];
}

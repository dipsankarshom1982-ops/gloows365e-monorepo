// PATH: functions/src/vidyastarEligibility.ts
// Server-side class eligibility for VidyaStar contests. A contest's
// `targetClass` (set in apps/admin's CreateContest) is a list of class
// strings and/or "all"; clients already filter on it, but a client can
// still call joinVidyastarContest for any contest id, so the join callable
// enforces the same rule here.

import { getClassBand, parseClassLevel } from "./educationConfig";

export type ContestClassEligibility =
  | { eligible: true }
  | { eligible: false; reason: "no-class" | "class-not-targeted" };

function normalizeTargetEntries(targetClass: unknown): string[] {
  return (Array.isArray(targetClass) ? targetClass : [targetClass]).map((v) => String(v).trim().toLowerCase());
}

// True only when every targeted class is in the Class 3–5 band, so a contest's
// shared lesson can be written at that level. Mixed or "all" contests keep the general level.
export function isPrimaryOnlyTarget(targetClass: unknown): boolean {
  if (targetClass === undefined || targetClass === null) return false;
  const entries = normalizeTargetEntries(targetClass);
  if (entries.length === 0 || entries.includes("all")) return false;
  return entries.every((e) => getClassBand(e) === "PRIMARY_FOUNDATION");
}

export function checkContestClassEligibility(targetClass: unknown, studentClass: unknown): ContestClassEligibility {
  // Missing targetClass = open to every class (matches the client-side filter).
  //
  // CLARIFICATION (Stage 2.2, F7 — staging QA flagged this as worth
  // documenting explicitly): this deliberately includes Class 3–5. Unlike
  // Knowledge Hub content (isTargetedAtClass in
  // packages/shared-logic/src/education/contentTargeting.ts), which treats
  // untargeted content as NOT visible to Class 3–5 because it predates any
  // review for that age group, an untargeted contest is NOT given the same
  // treatment here — it stays open to every class, including 3–5, exactly
  // as it always has. If a future stage wants untargeted contests closed to
  // Class 3–5 by default, that is a deliberate policy change to make here,
  // not an oversight to silently "fix".
  if (targetClass === undefined || targetClass === null) return { eligible: true };

  const entries = normalizeTargetEntries(targetClass);
  if (entries.includes("all")) return { eligible: true };

  const cls = parseClassLevel(studentClass);
  if (cls === null) return { eligible: false, reason: "no-class" };

  return entries.some((e) => parseClassLevel(e) === cls)
    ? { eligible: true }
    : { eligible: false, reason: "class-not-targeted" };
}

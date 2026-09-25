import { getClassBand, parseClassLevel } from "./classes";

/**
 * Whether a piece of content is meant for a student's class, given its
 * `targetClass` list (class strings and/or "all"), as set in the admin panel.
 *
 * - "all" or the student's own class → visible.
 * - No targeting at all (missing/empty, i.e. content from before targeting
 *   existed) → still visible to Class 6–12 and to students with no class on
 *   record, but NOT to Class 3–5: untargeted content was never reviewed for
 *   them, so it only reaches them once explicitly targeted at their class or "all".
 */
export function isTargetedAtClass(targetClass: unknown, studentClass: unknown): boolean {
  const entries = (Array.isArray(targetClass) ? targetClass : targetClass == null ? [] : [targetClass])
    .map((v) => String(v).trim().toLowerCase());
  if (entries.includes("all")) return true;

  const cls = parseClassLevel(studentClass);
  if (entries.length === 0) return cls === null || getClassBand(cls) !== "PRIMARY_FOUNDATION";
  return cls !== null && entries.some((e) => parseClassLevel(e) === cls);
}

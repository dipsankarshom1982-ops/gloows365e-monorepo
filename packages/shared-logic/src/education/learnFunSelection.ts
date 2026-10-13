import { getClassBand, parseClassLevel } from "./classes";

/** The active, released games whose classRange includes the student's class. An unsupported class gets none. */
export function gamesForClass<T extends { classRange: number[]; isActive: boolean; isComingSoon: boolean }>(
  games: readonly T[],
  studentClass: unknown
): T[] {
  const cls = parseClassLevel(studentClass);
  if (cls === null) return [];
  return games.filter((g) => g.classRange.includes(cls) && g.isActive && !g.isComingSoon);
}

/**
 * The generic (class-neutral) mission to use when a class has no mission of its
 * own: Class 3–5 draw only from the primary pool, other supported classes from
 * the general pool, and an unsupported class gets none rather than a guess.
 */
export function fallbackMissionFor<T>(
  pools: { primary: readonly T[]; general: readonly T[] },
  studentClass: unknown,
  dayOfWeek: number
): T | null {
  const band = getClassBand(studentClass);
  if (band === null) return null;
  const pool = band === "PRIMARY_FOUNDATION" ? pools.primary : pools.general;
  return pool.length === 0 ? null : pool[dayOfWeek % pool.length];
}

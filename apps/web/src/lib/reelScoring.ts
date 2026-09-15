// PATH: apps/web/src/lib/reelScoring.ts
//
// Personalization scorer for the reel/post feed — used by both the
// home-page preview strip (ShortVideos.tsx, where this logic already
// lived) and the full-screen feed (app/reels/page.tsx, which never used
// it until now — it was just sorted by raw view count).
//
// FEATURE (language priority + scope ranking): language used to be a
// binary match (full credit only for the viewer's exact preferredLanguage,
// zero otherwise). Replaced with a 4-tier cascade — viewer's language, then
// Hindi, then English, then everything else — so e.g. a Bengali-preferring
// viewer sees mostly Bengali reels, then Hindi, then a little English,
// rather than only-Bengali-or-nothing. State works the same way it always
// did (binary: viewer's own state or "All"/Pan-India), per product
// decision — there's no natural "second-best state" the way Hindi is a
// natural second-best language nationally.
//
// This is a SOFT ranking only for language and state: nothing is ever
// hidden by language or state. A Bihar-only post is still visible to a
// viewer in Kerala — it's just sorted lower. Same principle for language:
// a post in an unrecognized language still appears, just ranked behind
// better matches.
//
// Class targeting is different — see matchesClassFilter() below. A reel
// scoped to specific classes is hard-filtered out for students outside
// that set, by product decision. CLASS_MATCH in the POINTS table below
// still contributes to ranking among reels that already passed that
// filter; it isn't a second, redundant gate.

export interface ScorableReel {
  targetClass?:    string[];
  targetLanguage?: string[];
  targetState?:    string[];
  targetInterest?: string[];
  featured?:       boolean;
  // Firestore Timestamp (has .toMillis()/.seconds), a plain Date, or millis —
  // see toMillis() below. Drives recencyScore().
  createdAt?:      unknown;
  views?:          number;
}

export interface ScoringProfile {
  class?:             string;
  preferredLanguage?: string;
  location?:          { state?: string };
  interests?:         string[];
}

// Languages with no dedicated translation/content tier of their own fall
// back to this cascade. Order matters: index 0 is the highest-priority
// fallback after the viewer's own language.
const LANGUAGE_FALLBACK_CASCADE = ["Hindi", "English"] as const;

const POINTS = {
  CLASS_MATCH:        10,
  LANGUAGE_PREFERRED: 12,
  LANGUAGE_HINDI:      7,
  LANGUAGE_ENGLISH:    4,
  LANGUAGE_OTHER:      0,
  INTEREST_MATCH:      6,
  INTEREST_ALL:        2,
  STATE_MATCH:         5,
  FEATURED_BONUS:      3,
  RECENCY_MAX:        15,
  VIEWS_MAX:          10,
} as const;

// Recency fades linearly to 0 over this many days — "reels added last show
// first" without permanently burying older content the moment something
// newer is posted.
const RECENCY_DECAY_DAYS = 7;

// views score = min(VIEWS_MAX, log10(views + 1) * VIEWS_LOG_SCALE) — log
// scale so a single viral reel doesn't permanently dominate every viewer's
// feed regardless of personalization; diminishing returns past a few
// hundred views.
const VIEWS_LOG_SCALE = 3;

export function toMillis(createdAt: unknown): number {
  if (!createdAt) return 0;
  if (typeof createdAt === "number") return createdAt;
  if (createdAt instanceof Date) return createdAt.getTime();
  const ts = createdAt as { toMillis?: () => number; seconds?: number };
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
}

export function recencyScore(createdAt: unknown): number {
  const postedMs = toMillis(createdAt);
  if (!postedMs) return 0;
  const daysSincePosted = (Date.now() - postedMs) / (24 * 60 * 60 * 1000);
  return Math.max(0, POINTS.RECENCY_MAX * (1 - daysSincePosted / RECENCY_DECAY_DAYS));
}

export function viewsScore(views: number | undefined): number {
  if (!views || views <= 0) return 0;
  return Math.min(POINTS.VIEWS_MAX, Math.log10(views + 1) * VIEWS_LOG_SCALE);
}

// Returns the score a single reel earns on the language axis for a given
// viewer. Exported separately from scoreReel so callers that just need to
// label *why* a reel ranked where it did (e.g. a "matches your language"
// badge) can reuse the same tier logic without re-deriving it.
export function languageScore(
  targetLanguage: string[] | undefined,
  preferredLanguage: string | undefined
): number {
  const tl = targetLanguage ?? ["All"];
  if (tl.includes("All")) return POINTS.LANGUAGE_PREFERRED; // untargeted reel suits everyone equally well

  if (preferredLanguage && tl.includes(preferredLanguage)) return POINTS.LANGUAGE_PREFERRED;
  if (tl.includes(LANGUAGE_FALLBACK_CASCADE[0]))            return POINTS.LANGUAGE_HINDI;
  if (tl.includes(LANGUAGE_FALLBACK_CASCADE[1]))            return POINTS.LANGUAGE_ENGLISH;
  return POINTS.LANGUAGE_OTHER;
}

export function scoreReel(reel: ScorableReel, student: ScoringProfile | null): number {
  let score = 0;

  if (student) {
    const tc = reel.targetClass    ?? ["All"];
    const ts = reel.targetState    ?? ["All"];
    const ti = reel.targetInterest ?? ["All"];

    if (tc.includes("All") || (student.class && tc.includes(student.class))) score += POINTS.CLASS_MATCH;

    score += languageScore(reel.targetLanguage, student.preferredLanguage);

    if (ts.includes("All") || (student.location?.state && ts.includes(student.location.state))) {
      score += POINTS.STATE_MATCH;
    }

    if (ti.includes("All")) score += POINTS.INTEREST_ALL;
    else if (student.interests?.some((i) => ti.includes(i))) score += POINTS.INTEREST_MATCH;
  }

  if (reel.featured) score += POINTS.FEATURED_BONUS;

  // Recency + views apply regardless of whether a student profile has
  // resolved yet — a loading/anonymous viewer should still see newest and
  // most-watched content first, same as everyone else.
  return score + recencyScore(reel.createdAt) + viewsScore(reel.views);
}

// FEATURE (class-based hard filter for short reels): unlike language/state/
// interest, which stay soft-ranking-only by deliberate product decision
// (see file header), class targeting on short reels is a hard visibility
// gate, not a ranking signal — admin can restrict a reel to specific
// classes and it must not appear at all to students outside that set.
// scoreReel's CLASS_MATCH contribution above still applies on top of this
// (so a reel doesn't lose its ranking signal once it passes the filter);
// this function is the separate pre-filter callers run the candidate batch
// through before scoring/display.
//
// `student` may be null only transiently (profile still loading) — in that
// case this conservatively shows only "All"-targeted reels, the same
// fallback admin uses as its own default, rather than showing everything
// or nothing.
export function matchesClassFilter(
  reel: { targetClass?: string[] },
  studentClass: string | null | undefined
): boolean {
  const tc = reel.targetClass ?? ["All"];
  if (tc.includes("All")) return true;
  return !!studentClass && tc.includes(studentClass);
}

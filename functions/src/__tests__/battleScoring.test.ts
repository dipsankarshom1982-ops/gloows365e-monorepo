// PATH: functions/src/__tests__/battleScoring.test.ts
//
// Pure function tests — no Firestore, no mocking needed. Covers §31
// "Scoring: deterministic calculation, invalid inputs, scoring caps,
// configuration, reproducibility" (battle isolation is covered by
// battleRanking.test.ts / battleFinalization.test.ts, where scoring
// actually touches battle-scoped data).

import { calculateSubmissionScore, compareEntries, DEFAULT_SCORING_PROFILE } from "../battleScoring";

describe("calculateSubmissionScore", () => {
  test("deterministic: same inputs always produce the same score", () => {
    const inputs = { verifiedLikes: 10, verifiedViews: 40, isApproved: true };
    const a = calculateSubmissionScore(inputs);
    const b = calculateSubmissionScore(inputs);
    expect(a).toBe(b);
  });

  test("uses the default profile's weights when none is passed", () => {
    const score = calculateSubmissionScore({ verifiedLikes: 2, verifiedViews: 3, isApproved: true });
    expect(score).toBe(2 * DEFAULT_SCORING_PROFILE.likeWeight + 3 * DEFAULT_SCORING_PROFILE.viewWeight + DEFAULT_SCORING_PROFILE.participationBonus);
  });

  test("a non-approved submission always scores 0, regardless of engagement", () => {
    const score = calculateSubmissionScore({ verifiedLikes: 9999, verifiedViews: 9999, isApproved: false });
    expect(score).toBe(0);
  });

  test("zero engagement still earns the participation bonus once approved", () => {
    const score = calculateSubmissionScore({ verifiedLikes: 0, verifiedViews: 0, isApproved: true });
    expect(score).toBe(DEFAULT_SCORING_PROFILE.participationBonus);
  });

  test("configuration: a battle-specific profile overrides the default weights", () => {
    const customProfile = { likeWeight: 100, viewWeight: 0, participationBonus: 0 };
    const score = calculateSubmissionScore({ verifiedLikes: 3, verifiedViews: 500, isApproved: true }, customProfile);
    expect(score).toBe(300); // 3 * 100 + 500 * 0 + 0 — views contribute nothing under this profile
  });

  test("negative/invalid-looking inputs don't throw — pure arithmetic, no validation surprises", () => {
    expect(() => calculateSubmissionScore({ verifiedLikes: -5, verifiedViews: 0, isApproved: true })).not.toThrow();
  });
});

describe("compareEntries — deterministic tie-break chain", () => {
  const base = { studentId: "b", score: 100, rawEngagement: 10, approvedAt: 1000 };

  test("higher score wins outright", () => {
    const higher = { ...base, studentId: "a", score: 200 };
    expect(compareEntries(higher, base)).toBeLessThan(0);
  });

  test("tied score: higher raw engagement wins", () => {
    const moreEngaged = { ...base, studentId: "a", rawEngagement: 50 };
    expect(compareEntries(moreEngaged, base)).toBeLessThan(0);
  });

  test("tied score and engagement: earlier approval wins", () => {
    const earlier = { ...base, studentId: "a", approvedAt: 500 };
    expect(compareEntries(earlier, base)).toBeLessThan(0);
  });

  test("tied score, engagement, and approval time: lexically smaller studentId wins (stable, not arbitrary)", () => {
    const a = { ...base, studentId: "aaa" };
    const z = { ...base, studentId: "zzz" };
    expect(compareEntries(a, z)).toBeLessThan(0);
    expect(compareEntries(z, a)).toBeGreaterThan(0);
  });

  test("fully identical entries compare equal (0) — no infinite tie", () => {
    expect(compareEntries(base, { ...base })).toBe(0);
  });

  test("sorting a list with this comparator produces a total, reproducible order", () => {
    const entries = [
      { studentId: "charlie", score: 50, rawEngagement: 5, approvedAt: 100 },
      { studentId: "alice",   score: 90, rawEngagement: 5, approvedAt: 100 },
      { studentId: "bob",     score: 90, rawEngagement: 8, approvedAt: 100 },
    ];
    const sortedOnce = [...entries].sort(compareEntries).map((e) => e.studentId);
    const sortedTwice = [...entries].sort(compareEntries).map((e) => e.studentId);
    expect(sortedOnce).toEqual(["bob", "alice", "charlie"]); // bob: higher engagement at tied score; alice ahead of charlie on raw score
    expect(sortedTwice).toEqual(sortedOnce); // reproducible
  });
});

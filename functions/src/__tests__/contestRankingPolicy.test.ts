// PATH: functions/src/__tests__/contestRankingPolicy.test.ts
//
// Pure unit tests for the VidyaStar Phase 2 official ranking policy —
// no Firestore/emulator involved, this is a plain comparator function.
// Covers Phase 2 Test Plan items 6 (tie score) and 7 (exact tie).

import { assignRanks, compareParticipants, type RankableParticipant } from "../contestRankingPolicy";

describe("Test 6 — tie score: correctAnswers breaks a score tie", () => {
  test("higher correctAnswers ranks above an equal score with fewer correct answers", () => {
    const a: RankableParticipant = { id: "student_a", score: 90, correctAnswers: 9, quizCompletedAt: 2000 };
    const b: RankableParticipant = { id: "student_b", score: 90, correctAnswers: 7, quizCompletedAt: 1000 };
    const ranked = assignRanks([a, b]);
    expect(ranked[0].id).toBe("student_a"); // more correct answers wins, despite completing LATER
    expect(ranked[0].finalRank).toBe(1);
    expect(ranked[1].finalRank).toBe(2);
  });

  test("equal score AND equal correctAnswers falls through to earlier completion time", () => {
    const a: RankableParticipant = { id: "student_a", score: 90, correctAnswers: 9, quizCompletedAt: 1000 };
    const b: RankableParticipant = { id: "student_b", score: 90, correctAnswers: 9, quizCompletedAt: 1500 };
    const ranked = assignRanks([a, b]);
    expect(ranked[0].id).toBe("student_a"); // completed first
  });

  test("a historical doc missing correctAnswers entirely is treated as 0, not excluded or crashed on", () => {
    const withCorrect: RankableParticipant = { id: "student_new", score: 50, correctAnswers: 3, quizCompletedAt: 1000 };
    const legacyNoField: RankableParticipant = { id: "student_old", score: 50, quizCompletedAt: 500 };
    const ranked = assignRanks([legacyNoField, withCorrect]);
    expect(ranked[0].id).toBe("student_new"); // 3 > 0(default)
    expect(ranked.map((r) => r.finalRank)).toEqual([1, 2]);
  });
});

describe("Test 7 — exact tie: deterministic final ordering via uid fallback", () => {
  test("identical score, correctAnswers, AND completion time still produce a unique, deterministic order", () => {
    const a: RankableParticipant = { id: "zzz_student", score: 80, correctAnswers: 8, quizCompletedAt: 1000 };
    const b: RankableParticipant = { id: "aaa_student", score: 80, correctAnswers: 8, quizCompletedAt: 1000 };
    const ranked1 = assignRanks([a, b]);
    const ranked2 = assignRanks([b, a]); // reversed input order
    // uid ASC is the final tie-break — "aaa_student" < "zzz_student"
    expect(ranked1.map((r) => r.id)).toEqual(["aaa_student", "zzz_student"]);
    expect(ranked2.map((r) => r.id)).toEqual(["aaa_student", "zzz_student"]);
    // Ranks are always unique/dense — never #1,#1,#3 for a true tie.
    expect(ranked1.map((r) => r.finalRank)).toEqual([1, 2]);
  });

  test("compareParticipants never returns 0 for two participants with different ids", () => {
    const a: RankableParticipant = { id: "a", score: 10, correctAnswers: 1, quizCompletedAt: 5 };
    const b: RankableParticipant = { id: "b", score: 10, correctAnswers: 1, quizCompletedAt: 5 };
    expect(compareParticipants(a, b)).not.toBe(0);
  });
});

describe("General ranking correctness", () => {
  test("primary sort is score DESC, unaffected by any other field", () => {
    const items: RankableParticipant[] = [
      { id: "low",  score: 10, correctAnswers: 10, quizCompletedAt: 1 },
      { id: "high", score: 90, correctAnswers: 1,  quizCompletedAt: 999 },
      { id: "mid",  score: 50, correctAnswers: 5,  quizCompletedAt: 500 },
    ];
    expect(assignRanks(items).map((r) => r.id)).toEqual(["high", "mid", "low"]);
  });

  test("ranks are sequential starting at 1, one per participant, regardless of input order", () => {
    const items: RankableParticipant[] = Array.from({ length: 12 }, (_, i) => ({
      id: `student_${i}`, score: Math.floor(Math.random() * 100), correctAnswers: i % 5, quizCompletedAt: 1000 + i,
    }));
    const ranked = assignRanks(items);
    expect(ranked.map((r) => r.finalRank)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });
});

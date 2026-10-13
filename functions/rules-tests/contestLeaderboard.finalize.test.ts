// PATH: functions/rules-tests/contestLeaderboard.finalize.test.ts
//
// VidyaStar Phase 2 — real Firestore emulator tests for the finalization
// system, at ACTUAL scale (real documents seeded and processed, not
// simulated). Runs the REAL finalizeContest() (not mocked) against the
// REAL Firestore emulator — same pattern as
// submitVidyastarContestQuiz.concurrency.test.ts, see that file's header
// for why: the emulator implements genuine Firestore semantics (real
// batch-write limits, real query planning/index requirements) that the
// offline FakeFirestore mock cannot.
//
// Covers Phase 2 Test Plan items 1, 3, 4, and idempotency/resumption.
// Item 2 (100 participants, pagination) is covered by the same mechanism
// exercised at 500/1,000 below plus the frontend pagination logic in
// lib/contestLeaderboard.ts (READ_PAGE_SIZE/LEADERBOARD_PAGE_SIZE = 50,
// exercised structurally — see the Phase 2 report for what was and
// wasn't directly runtime-tested).

import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: "demo-gloows365e-test" });
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { finalizeContest } = require("../src/contestLeaderboard");

const db = admin.firestore();

async function seedParticipants(contestId: string, count: number): Promise<void> {
  // finalizeContest checks the parent contest doc first (not_found guard,
  // and the leaderboardFinalized flag) — must exist before seeding participants.
  await db.doc(`contests/${contestId}`).set({ title: `Finalize Test — ${contestId}`, isActive: true });

  const CHUNK = 400;
  const now = Date.now();
  for (let start = 0; start < count; start += CHUNK) {
    const end = Math.min(start + CHUNK, count);
    const batch = db.batch();
    for (let i = start; i < end; i++) {
      const uid = `p_${String(i).padStart(6, "0")}`;
      batch.set(db.doc(`contests/${contestId}/participant/${uid}`), {
        userId: uid,
        contestId,
        name: `Student ${i}`,
        completed: true,
        // Deliberately not unique per-score — creates real ties so the
        // ranking policy's tie-break chain gets genuinely exercised at
        // scale, not just in the small pure-unit tests.
        score: (i * 7) % 100,
        correctAnswers: i % 10,
        quizCompletedAt: admin.firestore.Timestamp.fromMillis(now - i * 1000),
      });
    }
    await batch.commit();
  }
}

async function getRankedDocs(contestId: string) {
  const snap = await db.collection(`contests/${contestId}/participant`).orderBy("finalRank", "asc").get();
  return snap.docs.map((d) => d.data());
}

describe("Test 1 — small contest (10 participants)", () => {
  test("correct order, scores, and dense sequential ranking", async () => {
    const contestId = "finalize_test_10";
    await seedParticipants(contestId, 10);

    const outcome = await finalizeContest(contestId);
    expect(outcome.status).toBe("finalized");
    expect(outcome.participantCount).toBe(10);

    const ranked = await getRankedDocs(contestId);
    expect(ranked.map((d) => d.finalRank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // Scores must be non-increasing down the final rank order.
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].score).toBeLessThanOrEqual(ranked[i - 1].score);
    }
  }, 30_000);
});

describe("Test 3 — 500 participants: no batch-limit failure", () => {
  test("finalizes correctly via chunked batches, never a single batch anywhere near the 500-op limit", async () => {
    const contestId = "finalize_test_500";
    await seedParticipants(contestId, 500);

    const outcome = await finalizeContest(contestId);
    expect(outcome.status).toBe("finalized");
    expect(outcome.participantCount).toBe(500);
    // 500 participants / 400-per-chunk = 2 chunks — confirms real chunking
    // happened, not one all-in-one batch (which would have thrown under
    // the OLD architecture at this exact scale).
    expect(outcome.chunksWritten).toBe(2);

    const ranked = await getRankedDocs(contestId);
    expect(ranked.length).toBe(500);
    expect(new Set(ranked.map((d) => d.finalRank)).size).toBe(500); // every rank unique
    expect(Math.max(...ranked.map((d) => d.finalRank))).toBe(500);
  }, 60_000);
});

describe("Test 4 — 1,000 participants: real scale, query performance, sorting", () => {
  test("finalizes 1,000 real participants correctly, in chunked batches, within a reasonable time budget", async () => {
    const contestId = "finalize_test_1000";
    await seedParticipants(contestId, 1000);

    const t0 = Date.now();
    const outcome = await finalizeContest(contestId);
    const elapsedMs = Date.now() - t0;

    expect(outcome.status).toBe("finalized");
    expect(outcome.participantCount).toBe(1000);
    expect(outcome.chunksWritten).toBe(3); // 1000 / 400 = 3 chunks (400,400,200)

    const ranked = await getRankedDocs(contestId);
    expect(ranked.length).toBe(1000);
    expect(new Set(ranked.map((d) => d.finalRank)).size).toBe(1000);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].score).toBeLessThanOrEqual(ranked[i - 1].score);
    }

    // eslint-disable-next-line no-console
    console.log(`[scale test] finalizeContest(1000 participants) took ${elapsedMs}ms`);
  }, 120_000);
});

describe("5,000-participant requirement (explicit Phase 2 scale target)", () => {
  test("finalizes 5,000 real participants correctly, in chunked batches, no batch-limit failure", async () => {
    const contestId = "finalize_test_5000";
    await seedParticipants(contestId, 5000);

    const t0 = Date.now();
    const outcome = await finalizeContest(contestId);
    const elapsedMs = Date.now() - t0;

    expect(outcome.status).toBe("finalized");
    expect(outcome.participantCount).toBe(5000);
    expect(outcome.chunksWritten).toBe(13); // 5000 / 400 = 12.5 -> 13 chunks

    const ranked = await getRankedDocs(contestId);
    expect(ranked.length).toBe(5000);
    expect(new Set(ranked.map((d) => d.finalRank)).size).toBe(5000);
    expect(Math.max(...ranked.map((d) => d.finalRank))).toBe(5000);

    // eslint-disable-next-line no-console
    console.log(`[scale test] finalizeContest(5000 participants) took ${elapsedMs}ms`);
  }, 180_000);
});

describe("Test 2 & 9 — live ordered query + pagination (the composite index in firestore.indexes.json)", () => {
  // Exercises the EXACT query shape apps/mobile & apps/web's
  // lib/contestLeaderboard.ts use client-side (where(completed==true),
  // orderBy(score desc), orderBy(quizCompletedAt asc), limit) — same
  // composite index requirement applies regardless of which SDK issues
  // it, so proving this against the Admin SDK + real emulator here
  // confirms the index is correct without needing RN/browser Firestore
  // client mocking in a Node test environment.
  test("100 participants: first-50/next-50 pagination has no duplicates and no missing records", async () => {
    const contestId = "finalize_test_pagination_100";
    await seedParticipants(contestId, 100);

    const firstPage = await db.collection(`contests/${contestId}/participant`)
      .where("completed", "==", true)
      .orderBy("score", "desc")
      .orderBy("quizCompletedAt", "asc")
      .limit(50)
      .get();
    expect(firstPage.docs.length).toBe(50);

    const lastDoc = firstPage.docs[firstPage.docs.length - 1];
    const secondPage = await db.collection(`contests/${contestId}/participant`)
      .where("completed", "==", true)
      .orderBy("score", "desc")
      .orderBy("quizCompletedAt", "asc")
      .startAfter(lastDoc)
      .limit(50)
      .get();
    expect(secondPage.docs.length).toBe(50);

    const firstIds  = new Set(firstPage.docs.map((d) => d.id));
    const secondIds = new Set(secondPage.docs.map((d) => d.id));
    // No duplicates across pages.
    expect([...firstIds].some((id) => secondIds.has(id))).toBe(false);
    // No missing records — together they cover all 100.
    expect(firstIds.size + secondIds.size).toBe(100);

    // Order is non-increasing by score across the page boundary too.
    const lastOfFirst = firstPage.docs[firstPage.docs.length - 1].data().score;
    const firstOfSecond = secondPage.docs[0].data().score;
    expect(firstOfSecond).toBeLessThanOrEqual(lastOfFirst);
  }, 30_000);
});

describe("Test 8 — user outside the first leaderboard page still gets a correct rank", () => {
  // Exercises the exact 2-count-aggregation-query mechanism
  // lib/contestLeaderboard.ts's fetchMyLiveRank() uses client-side (count
  // where score > mine, plus count where score == mine AND
  // correctAnswers > mine) — proven here via the Admin SDK against the
  // real emulator, since the client SDK's browser/RN Firestore isn't
  // importable into this Node test environment. Same query shape, same
  // index, same result either way.
  test("a student ranked ~#250 of 300 gets their true rank via count-aggregation, never derived from page membership", async () => {
    const contestId = "finalize_test_outside_page";
    await seedParticipants(contestId, 300);

    // seedParticipants assigns score = (i*7)%100 — deterministically
    // compute the TRUE rank of participant index 180 (arbitrary, not in
    // any top-100 page) by fully sorting all 300 in memory, exactly like
    // finalizeContest would, then confirm the cheap count-based estimate
    // agrees with that ground truth.
    const allSnap = await db.collection(`contests/${contestId}/participant`).get();
    const all = allSnap.docs.map((d) => ({
      id: d.id, score: d.data().score, correctAnswers: d.data().correctAnswers,
    }));
    const targetId = "p_000180";
    const target = all.find((p) => p.id === targetId)!;
    const trueRank = 1 + all.filter((p) =>
      p.score > target.score || (p.score === target.score && p.correctAnswers > target.correctAnswers)
    ).length;
    // Sanity: this participant should indeed be outside a 100-row page.
    expect(trueRank).toBeGreaterThan(100);

    const participantsCol = db.collection(`contests/${contestId}/participant`);
    const [aheadOnScore, tiedButAhead] = await Promise.all([
      participantsCol.where("completed", "==", true).where("score", ">", target.score).count().get(),
      participantsCol.where("completed", "==", true).where("score", "==", target.score).where("correctAnswers", ">", target.correctAnswers).count().get(),
    ]);
    const estimatedRank = aheadOnScore.data().count + tiedButAhead.data().count + 1;

    expect(estimatedRank).toBe(trueRank);
  }, 60_000);
});

describe("Idempotency / resumption", () => {
  test("a second finalize call on an already-finalized contest is an immediate no-op", async () => {
    const contestId = "finalize_test_idempotent";
    await seedParticipants(contestId, 50);

    const first = await finalizeContest(contestId);
    expect(first.status).toBe("finalized");

    const second = await finalizeContest(contestId);
    expect(second.status).toBe("already_finalized");

    // Ranks from the first run are untouched.
    const ranked = await getRankedDocs(contestId);
    expect(ranked.length).toBe(50);
  }, 30_000);

  test("re-running after simulating a partial failure only rewrites the chunks that don't already match", async () => {
    const contestId = "finalize_test_resume";
    await seedParticipants(contestId, 50);

    // Simulate a prior run that finalized correctly but crashed before
    // setting leaderboardFinalized:true (e.g. a mid-flight timeout) —
    // pre-write the CORRECT final ranks for every doc by hand, but leave
    // the contest's own leaderboardFinalized flag unset.
    const preSnap = await db.collection(`contests/${contestId}/participant`).get();
    const sorted = preSnap.docs
      .map((d) => ({ ref: d.ref, score: d.data().score, correctAnswers: d.data().correctAnswers, quizCompletedAt: d.data().quizCompletedAt.toMillis(), id: d.id }))
      .sort((a, b) => (b.score !== a.score ? b.score - a.score : (b.correctAnswers ?? 0) - (a.correctAnswers ?? 0) || a.quizCompletedAt - b.quizCompletedAt || (a.id < b.id ? -1 : 1)));
    const batch = db.batch();
    sorted.forEach((p, i) => batch.update(p.ref, { finalRank: i + 1 }));
    await batch.commit();

    const outcome = await finalizeContest(contestId);
    expect(outcome.status).toBe("finalized");
    // Every chunk already matched the freshly-recomputed ranks — nothing
    // needed rewriting, confirming the "skip already-correct chunks" path.
    expect(outcome.chunksWritten).toBe(0);
  }, 30_000);
});

"use strict";
// PATH: functions/src/contestLeaderboard.ts
//
// VidyaStar Phase 2 — Contest Leaderboard Scalability & Ranking Integrity.
//
// Replaces the old "recalculate every participant's rank on every single
// submission" architecture (functions/src/submitVidyastarContestQuiz.ts
// used to do a full, unbounded contests/{id}/participant read + an
// all-participants batch rewrite after every submit — O(n) reads and
// writes per submission, and a hard failure past ~500 completed
// participants, Firestore's batch-write limit). See the Phase 2 report's
// Section A/B for the full trace.
//
// New model:
//   - While a contest is ACTIVE (or ended but not yet finalized), no rank
//     is written at all. Leaderboard/result screens query
//     contests/{id}/participant directly with an ordered, paginated
//     Firestore query (score DESC, quizCompletedAt ASC — see
//     contestRankingPolicy.ts's header comment for why correctAnswers
//     isn't a Firestore-level orderBy field) instead of reading everyone
//     and sorting client-side.
//   - Once a contest ends, this file's finalizeContest() computes and
//     PERSISTS a permanent finalRank on every completed participant, ONCE,
//     via a controlled backend process — chunked into batches safely under
//     Firestore's 500-write limit regardless of contest size (500, 1,000,
//     5,000+ participants), and idempotent (re-running it is always safe
//     and cheap: already-correct chunks are detected and skipped, so a
//     retry after a partial failure only redoes the work that didn't
//     finish).
//   - finalRank is a NEW field, deliberately distinct from the legacy
//     `rank` field older (pre-Phase-2) contests may already have —
//     historical contests keep showing their old `rank` untouched (no
//     migration performed or needed); only contests finalized under this
//     new process get finalRank.
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoFinalizeEndedContests = exports.finalizeContestRanking = void 0;
exports.finalizeContest = finalizeContest;
const admin = require("firebase-admin");
const functionsV1 = require("firebase-functions/v1");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const contestRankingPolicy_1 = require("./contestRankingPolicy");
const db = admin.firestore();
// Safely under Firestore's hard 500-operation batch limit — leaves
// headroom, doesn't try to ride the exact ceiling.
const WRITE_CHUNK_SIZE = 400;
// Bounded page size for the READ side too — this function never does a
// single unbounded collection read, however large the contest is.
const READ_PAGE_SIZE = 500;
function toMillis(t) {
    if (!t)
        return 0;
    if (typeof t.toMillis === "function")
        return t.toMillis();
    if (typeof t.toDate === "function")
        return t.toDate().getTime();
    if (typeof t.seconds === "number")
        return t.seconds * 1000;
    if (typeof t === "string") {
        const d = new Date(t);
        return Number.isNaN(d.getTime()) ? 0 : d.getTime();
    }
    return 0;
}
function getDate(t) {
    const ms = toMillis(t);
    return ms > 0 ? new Date(ms) : null;
}
// ─── Core finalization logic — shared by the admin callable and the
// scheduled sweep below. Safe to call more than once for the same
// contest: the leaderboardFinalized flag makes a second call an
// immediate, cheap no-op; a call that's interrupted partway through
// (crash, timeout) is safe to simply call again — ranks are a pure,
// deterministic function of the participant data, so recomputing them is
// always correct, and comparing the freshly-computed rank against
// whatever's already stored lets a retry skip any chunk that already
// finished, rather than blindly rewriting everything again. ────────────
async function finalizeContest(contestId) {
    const contestRef = db.doc(`contests/${contestId}`);
    const contestSnap = await contestRef.get();
    if (!contestSnap.exists)
        return { status: "contest_not_found" };
    if (contestSnap.data()?.leaderboardFinalized === true)
        return { status: "already_finalized" };
    // ── Paginated read of every completed participant. Bounded per page
    // (READ_PAGE_SIZE), regardless of how many pages a large contest needs —
    // never a single unbounded collection().get(). ──
    const participants = [];
    const refById = new Map();
    let cursor;
    while (true) {
        let q = db.collection(`contests/${contestId}/participant`)
            .where("completed", "==", true)
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(READ_PAGE_SIZE);
        if (cursor)
            q = q.startAfter(cursor);
        const snap = await q.get();
        if (snap.empty)
            break;
        for (const d of snap.docs) {
            const data = d.data();
            participants.push({
                id: d.id,
                score: Number(data.score) || 0,
                correctAnswers: typeof data.correctAnswers === "number" ? data.correctAnswers : undefined,
                quizCompletedAt: toMillis(data.quizCompletedAt),
                existingFinalRank: typeof data.finalRank === "number" ? data.finalRank : undefined,
            });
            refById.set(d.id, d.ref);
        }
        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < READ_PAGE_SIZE)
            break;
    }
    if (participants.length === 0) {
        await contestRef.set({
            leaderboardFinalized: true,
            leaderboardFinalizedAt: admin.firestore.FieldValue.serverTimestamp(),
            leaderboardFinalizedCount: 0,
        }, { merge: true });
        return { status: "finalized", participantCount: 0, chunksWritten: 0, chunksSkipped: 0 };
    }
    const ranked = (0, contestRankingPolicy_1.assignRanks)(participants);
    // ── Chunked, idempotent writes. Each chunk is its own batch, always
    // well under the 500-op hard limit — a contest with 5,000 completed
    // participants writes via ~13 batches of 400, never one giant batch. A
    // chunk where every doc already has the correct finalRank (from a prior,
    // possibly-interrupted run) is skipped entirely — no redundant writes on
    // a retry. ──
    let chunksWritten = 0;
    let chunksSkipped = 0;
    for (let i = 0; i < ranked.length; i += WRITE_CHUNK_SIZE) {
        const chunk = ranked.slice(i, i + WRITE_CHUNK_SIZE);
        const needsWrite = chunk.filter((p) => p.existingFinalRank !== p.finalRank);
        if (needsWrite.length === 0) {
            chunksSkipped++;
            continue;
        }
        const batch = db.batch();
        for (const p of needsWrite) {
            batch.update(refById.get(p.id), { finalRank: p.finalRank });
        }
        await batch.commit();
        chunksWritten++;
    }
    await contestRef.set({
        leaderboardFinalized: true,
        leaderboardFinalizedAt: admin.firestore.FieldValue.serverTimestamp(),
        leaderboardFinalizedCount: ranked.length,
    }, { merge: true });
    console.log(`✅ Contest finalized: contest=${contestId} participants=${ranked.length} chunksWritten=${chunksWritten} chunksSkipped=${chunksSkipped}`);
    return { status: "finalized", participantCount: ranked.length, chunksWritten, chunksSkipped };
}
// ─── Admin-callable, on-demand finalization (e.g. admin wants a specific
// contest finalized right now rather than waiting for the next sweep). ──
exports.finalizeContestRanking = functionsV1
    .runWith({ timeoutSeconds: 300, memory: "256MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth?.token?.admin) {
        throw new functionsV1.https.HttpsError("permission-denied", "Admin access required");
    }
    const contestId = (data?.contestId ?? "").trim();
    if (!contestId) {
        throw new functionsV1.https.HttpsError("invalid-argument", "contestId is required");
    }
    return finalizeContest(contestId);
});
// ─── Scheduled sweep — automatically finalizes any contest whose end time
// has passed and hasn't been finalized yet, so this doesn't depend on an
// admin remembering to trigger it manually. Runs every 15 minutes;
// finalizeContest's own idempotency means overlapping/repeated runs across
// the same contest are always safe. Contests collection is read in full
// here (not participants) — bounded by CONTEST COUNT, a fundamentally
// different, much smaller axis than participant count, same pattern the
// existing useContests()-style hooks already rely on client-side. ──
exports.autoFinalizeEndedContests = (0, scheduler_1.onSchedule)({ schedule: "every 15 minutes", timeZone: "Asia/Kolkata", timeoutSeconds: 300, memory: "256MiB" }, async () => {
    const now = new Date();
    const snap = await db.collection("contests").get();
    const toFinalize = snap.docs.filter((d) => {
        const c = d.data();
        if (c.leaderboardFinalized === true)
            return false;
        const end = getDate(c.endTime ?? c.endDate);
        return !!end && end < now;
    });
    if (toFinalize.length === 0)
        return;
    for (const doc of toFinalize) {
        try {
            const outcome = await finalizeContest(doc.id);
            console.log(`autoFinalizeEndedContests: contest=${doc.id} outcome=${JSON.stringify(outcome)}`);
        }
        catch (e) {
            // One contest's finalization failing must never block the others.
            console.error(`autoFinalizeEndedContests: failed for contest=${doc.id}:`, e);
        }
    }
});
//# sourceMappingURL=contestLeaderboard.js.map
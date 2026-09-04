// PATH: functions/src/submitVidyastarContestQuiz.ts
//
// SECURITY (VidyaStar Phase 1 — Critical Security & Score Integrity Repair)
// ─────────────────────────────────────────────────────────────────────────
// Previously this function trusted the CLIENT's own `correct`/
// `timeTakenSeconds` fields per answer to compute score — combined with the
// answer key being readable client-side (contests/{id}/lessons/{language}
// was world-readable and the getContestLesson callable returned it
// verbatim), any student could forge a perfect score, rank, V-Coins reward,
// and Starboard points on any contest with zero real participation. See the
// VidyaStar forensic audit's Section 10, Issue #1 for the full trace.
//
// Fixed by:
//   1. The client now submits ONLY {questionIndex, selectedIndex,
//      timeTakenSeconds?} — no `correct` field exists in the request type
//      at all anymore (removed end-to-end, not just ignored).
//   2. This function fetches the authoritative answer key server-side from
//      contests/{id}/lessonAnswers/{language} — a new collection,
//      firestore.rules deny-all, populated only by getContestLesson's
//      Admin SDK write (see functions/src/contestLesson.ts). Grading
//      happens here, independently of anything the client asserted.
//      COMPATIBILITY: every contest live in production before this phase
//      shipped has its lesson generated under the OLD schema — no
//      lessonAnswers doc exists for any of them yet. If one is missing,
//      this function derives the key on-the-fly from the historical
//      lessons/{language} doc's still-embedded lessonJson.quiz (Admin SDK
//      read, never exposed to the client) and backfills lessonAnswers in
//      the same transaction, so grading works immediately for existing
//      contests and self-heals after the first submission per (contest,
//      language) — no bulk data migration performed or needed.
//   3. `language` is resolved server-side from students/{uid}.
//      preferredLanguage — the same source the client itself uses to fetch
//      the quiz — never from a client-supplied parameter, so a client can't
//      pick a different (e.g. easier) language's answer key.
//   4. Every submitted questionIndex/selectedIndex is validated against the
//      real answer key (range, duplicates, exact question count) before
//      grading — "submittedQuestionIds ⊆ contestQuestionIds".
//   5. The entire reward-critical path — claiming the submission (atomic
//      "not yet completed" check + write), persisting the graded result,
//      awarding V-Coins (idempotent via vCoinActivityLocks), and syncing
//      Starboard points — now happens inside ONE Firestore transaction.
//      Two concurrent or replayed submission requests can never both pass
//      the completed-check: Firestore's optimistic concurrency forces the
//      loser to retry, re-read completed:true, and return the *existing*
//      verified result instead of grading/rewarding again.
//
// Explicitly OUT of scope for this phase (tracked separately, not security-
// critical): the per-contest rank recalculation below a contest with ~500+
// completed participants can hit Firestore's 500-write batch ceiling. It's
// unchanged in structure from before — still best-effort, still after the
// reward-critical transaction — because it only affects a *display* number
// (contests/{id}/participant.rank), never score, V-Coins, or Starboard
// points, which are now fully guaranteed correct regardless of this batch's
// outcome. See the VidyaStar audit's Section 4 Issue #2 / Section 13 P1.

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { deriveAnswerKey } from "./contestQuizAnswerKey";

const db = admin.firestore();

// What the client is allowed to submit — no correctness or score fields
// exist here at all. `timeTakenSeconds` is an optional client-measured
// hint; the server clamps it to a sane range rather than trusting it
// outright (Step 2 / "backend must validate timing").
interface ClientAnswer {
  questionIndex:    number;
  selectedIndex:    number | null;
  timeTakenSeconds?: number;
}

interface AnswerKeyEntry { correctAnswerIndex: number; explanation: string; }

interface GradedAnswer {
  questionIndex:    number;
  selectedIndex:    number | null;
  correct:          boolean;
  timeTakenSeconds: number;
}

export const LEADERBOARD_TABS = ["daily", "weekly", "monthly", "yearly"] as const;
export type LeaderboardTab = typeof LEADERBOARD_TABS[number];
const VIDYASTAR_CONTEST_ENTRY = "VIDYASTAR_CONTEST_ENTRY";
const DEFAULT_CONTEST_REWARD  = 50;
const SECONDS_PER_QUESTION    = 30; // matches quiz.tsx's / quiz/page.tsx's fixed per-question timer

// Mirrors the client's getDate — contest docs store either Firestore
// Timestamps or ISO strings depending on how they were created.
function getDate(t: any): Date | null {
  if (!t) return null;
  if (typeof t.toDate === "function") return t.toDate();
  if (t.seconds) return new Date(t.seconds * 1000);
  if (typeof t === "string" && t.length > 0) return new Date(t);
  return null;
}

export const submitVidyastarContestQuiz = functionsV1
  .runWith({ timeoutSeconds: 60, memory: "128MB" })
  .https.onCall(async (
    data: { contestId: string; answers: ClientAnswer[] },
    context
  ) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid       = context.auth.uid; // never trust a uid from the request body
    const contestId = (data?.contestId ?? "").trim();
    const rawAnswers = Array.isArray(data?.answers) ? data.answers : null;

    if (!contestId || !rawAnswers) {
      throw new functionsV1.https.HttpsError("invalid-argument", "Your submission could not be verified. Please try again.");
    }

    const participantRef = db.doc(`contests/${contestId}/participant/${uid}`);
    const contestRef     = db.doc(`contests/${contestId}`);
    const studentRef      = db.doc(`students/${uid}`);
    const userRef          = db.doc(`users/${uid}`);
    const lockRef           = db.doc(`users/${uid}/vCoinActivityLocks/${VIDYASTAR_CONTEST_ENTRY}_${contestId}`);
    const rewardRuleRef      = db.doc(`vCoinRules/${VIDYASTAR_CONTEST_ENTRY}`);

    const result = await db.runTransaction(async (tx) => {
      // ── ALL READS FIRST (Firestore transaction requirement) ──
      const [participantSnap, contestSnap, studentSnap] = await Promise.all([
        tx.get(participantRef),
        tx.get(contestRef),
        tx.get(studentRef),
      ]);

      if (!participantSnap.exists) {
        throw new functionsV1.https.HttpsError("failed-precondition", "You haven't joined this contest.");
      }

      // ── Idempotency: a genuine duplicate/replayed submission returns the
      // already-verified result instead of re-grading or re-rewarding. ──
      if (participantSnap.data()?.completed) {
        return {
          alreadySubmitted: true,
          score: participantSnap.data()?.score ?? 0,
          rank:  participantSnap.data()?.rank  ?? 0,
        };
      }

      if (!contestSnap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "This contest is no longer available.");
      }
      const contest = contestSnap.data() as Record<string, any>;
      const now   = new Date();
      const start = getDate(contest.startTime ?? contest.startDate);
      const end   = getDate(contest.endTime ?? contest.endDate);
      const isLive = !!(start && start <= now && (!end || end > now));
      if (!isLive) {
        throw new functionsV1.https.HttpsError(
          "failed-precondition",
          end && end < now ? "This contest is not currently accepting submissions." : "This contest hasn't started yet."
        );
      }

      // Resolve language the SAME way the client resolves it when fetching
      // the quiz (studentProfile.preferredLanguage ?? "English") — never
      // from a client-supplied field, so a client can't request a
      // different language's (potentially differently-graded) answer key.
      const language = (studentSnap.exists && studentSnap.data()?.preferredLanguage) || "English";
      const answerKeyRef = db.doc(`contests/${contestId}/lessonAnswers/${language}`);
      const lessonRef    = db.doc(`contests/${contestId}/lessons/${language}`);

      const [answerKeySnap, lockSnap, rewardRuleSnap] = await Promise.all([
        tx.get(answerKeyRef),
        tx.get(lockRef),
        tx.get(rewardRuleRef),
      ]);

      let answerKey: AnswerKeyEntry[];
      let needsAnswerKeyBackfill = false;

      if (answerKeySnap.exists) {
        answerKey = (answerKeySnap.data()?.answerKey ?? []) as AnswerKeyEntry[];
      } else {
        // COMPATIBILITY fallback — see header comment. Still a read, still
        // has to happen before any tx write below.
        const lessonSnap = await tx.get(lessonRef);
        const rawQuiz = lessonSnap.exists ? lessonSnap.data()?.lessonJson?.quiz : undefined;
        if (!Array.isArray(rawQuiz) || rawQuiz.length === 0) {
          throw new functionsV1.https.HttpsError("failed-precondition", "Your submission could not be verified. Please try again.");
        }
        answerKey = deriveAnswerKey(rawQuiz, `submitVidyastarContestQuiz fallback (contest=${contestId})`);
        needsAnswerKeyBackfill = true;
      }
      if (answerKey.length === 0) {
        throw new functionsV1.https.HttpsError("failed-precondition", "Your submission could not be verified. Please try again.");
      }

      // ── Validate the submitted payload against the real question set ──
      // submittedQuestionIds ⊆ contestQuestionIds, no duplicates, exactly
      // one answer per question (matches how the real quiz UI always
      // submits — one entry per question, selectedIndex:null if skipped).
      if (rawAnswers.length !== answerKey.length) {
        throw new functionsV1.https.HttpsError("invalid-argument", "Your submission could not be verified. Please try again.");
      }
      const seen = new Set<number>();
      const graded: GradedAnswer[] = [];
      for (const a of rawAnswers) {
        const qIdx = a?.questionIndex;
        if (!Number.isInteger(qIdx) || qIdx < 0 || qIdx >= answerKey.length || seen.has(qIdx)) {
          throw new functionsV1.https.HttpsError("invalid-argument", "Your submission could not be verified. Please try again.");
        }
        seen.add(qIdx);

        let selectedIndex: number | null = null;
        if (a?.selectedIndex !== null && a?.selectedIndex !== undefined) {
          if (!Number.isInteger(a.selectedIndex) || a.selectedIndex < 0) {
            throw new functionsV1.https.HttpsError("invalid-argument", "Your submission could not be verified. Please try again.");
          }
          selectedIndex = a.selectedIndex;
        }

        // Timing is client-measured but server-clamped — never trusted
        // outright. An out-of-range selectedIndex simply can never equal
        // answerKey[qIdx].correctAnswerIndex (which is always validated
        // in-range at generation time — see contestLesson.ts), so it's
        // graded incorrect by construction, no separate options-length
        // check needed here.
        const rawTime = Number(a?.timeTakenSeconds);
        const timeTakenSeconds = Number.isFinite(rawTime)
          ? Math.min(SECONDS_PER_QUESTION, Math.max(0, Math.round(rawTime)))
          : SECONDS_PER_QUESTION;

        const correct = selectedIndex !== null && selectedIndex === answerKey[qIdx].correctAnswerIndex;
        graded.push({ questionIndex: qIdx, selectedIndex, correct, timeTakenSeconds });
      }

      // ── Server-side score calculation — the ONLY authoritative source ──
      const correctAnswers   = graded.filter((a) => a.correct).length;
      const incorrectAnswers = graded.filter((a) => !a.correct && a.selectedIndex !== null).length;
      const unanswered       = graded.filter((a) => a.selectedIndex === null).length;
      const timeBonus = graded.reduce((sum, a) => {
        if (!a.correct) return sum;
        return sum + Math.max(0, Math.floor(5 * (SECONDS_PER_QUESTION - a.timeTakenSeconds) / 25));
      }, 0);
      const totalScore = correctAnswers * 10 + timeBonus;

      // Backfill safety net: joinVidyastarContest denormalizes `name` onto
      // this doc at join time — participants who joined before that fix
      // shipped won't have it.
      let participantName = participantSnap.data()?.name as string | undefined;
      if (!participantName) {
        participantName = studentSnap.exists ? (studentSnap.data()?.name ?? "Student") : "Student";
      }

      // ── ALL WRITES (after every read above) ──
      const nowTs = admin.firestore.FieldValue.serverTimestamp();

      if (needsAnswerKeyBackfill) {
        tx.set(answerKeyRef, { answerKey, updatedAt: nowTs, backfilledFrom: "legacy-lessonJson" });
      }

      tx.set(participantRef, {
        answers: graded,
        timeBonus,
        name: participantName,
        score: totalScore,
        correctAnswers,
        incorrectAnswers,
        unanswered,
        completed: true,
        quizCompletedAt: nowTs,
        updatedAt: nowTs,
      }, { merge: true });

      // V-Coins award — idempotent via lockRef, checked-and-written inside
      // this same transaction so it can never double-fire on a race.
      let vCoinsAwarded = 0;
      if (!lockSnap.exists) {
        const rule = rewardRuleSnap.exists ? (rewardRuleSnap.data() as { isActive?: boolean; rewardAmount?: number }) : null;
        const amount = rule?.isActive && typeof rule.rewardAmount === "number" ? rule.rewardAmount : DEFAULT_CONTEST_REWARD;
        if (amount > 0) {
          vCoinsAwarded = amount;
          tx.set(db.collection(`users/${uid}/vCoinTransactions`).doc(), {
            type:        "CREDIT",
            amount,
            source:      VIDYASTAR_CONTEST_ENTRY,
            title:       "VidyaStar Contest Completed",
            description: "Reward for completing a VidyaStar contest quiz",
            status:      "SUCCESS",
            referenceId: contestId,
            metadata:    { contestId },
            createdAt:   nowTs,
            updatedAt:   nowTs,
          });
          tx.set(userRef, {
            vCoinsBalance:        admin.firestore.FieldValue.increment(amount),
            vCoinsLifetimeEarned: admin.firestore.FieldValue.increment(amount),
            vCoinsUpdatedAt:      nowTs,
          }, { merge: true });
          tx.set(lockRef, {
            source:         VIDYASTAR_CONTEST_ENTRY,
            referenceId:    contestId,
            earnedToday:    amount,
            lastRewardedAt: nowTs,
            createdAt:      nowTs,
          });
        }
      }

      // Starboard sync — only from this now-server-verified totalScore,
      // same "skip if score is 0" behavior as before.
      if (totalScore > 0) {
        const sName  = studentSnap.exists ? ((studentSnap.data()?.name as string) || "Student") : "Student";
        const sState = studentSnap.exists ? (studentSnap.data()?.location?.state as string | undefined) : undefined;
        const sClass = studentSnap.exists && studentSnap.data()?.class != null ? String(studentSnap.data()!.class) : undefined;
        for (const tab of LEADERBOARD_TABS) {
          tx.set(db.doc(`leaderboard/${tab}/entries/${uid}`), {
            name: sName,
            ...(sState ? { state: sState } : {}),
            ...(sClass != null ? { class: sClass } : {}),
            points:    admin.firestore.FieldValue.increment(totalScore),
            updatedAt: nowTs,
          }, { merge: true });
        }
      }

      return { alreadySubmitted: false as const, score: totalScore, vCoinsAwarded };
    });

    if (result.alreadySubmitted) {
      console.log(`⚠️ VidyaStar quiz already submitted (idempotent return): user=${uid} contest=${contestId} score=${result.score} rank=${result.rank}`);
      return { score: result.score, rank: result.rank };
    }

    // ── Best-effort per-contest rank recalculation (display-only, not
    // reward-critical — see header comment for the known scalability
    // ceiling this inherits unchanged from before). ──
    let myRank = 0;
    try {
      const allSnap = await db.collection(`contests/${contestId}/participant`).get();
      const participants = allSnap.docs.map((d) => {
        const pd = d.data();
        return {
          id: d.id,
          ref: d.ref,
          score: d.id === uid ? result.score : (pd.score ?? 0),
          completedAt: d.id === uid ? new Date() : ((pd.quizCompletedAt?.toDate?.() as Date | undefined) ?? new Date(0)),
        };
      });
      participants.sort((a, b) =>
        b.score !== a.score ? b.score - a.score : a.completedAt.getTime() - b.completedAt.getTime()
      );
      myRank = participants.findIndex((p) => p.id === uid) + 1;

      const rankBatch = db.batch();
      participants.forEach((p, i) => rankBatch.update(p.ref, { rank: i + 1 }));
      await rankBatch.commit();
    } catch (e) {
      console.warn(`Rank recalculation failed for contest=${contestId}:`, e);
    }

    console.log(`✅ VidyaStar quiz submitted: user=${uid} contest=${contestId} score=${result.score} rank=${myRank} vCoinsAwarded=${result.vCoinsAwarded}`);
    return { score: result.score, rank: myRank };
  });

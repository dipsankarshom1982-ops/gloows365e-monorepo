import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { callGeminiText, parseJsonFromResponse } from "./gemini";
import { validateLessonJson } from "./validateLesson";

function buildContestLessonPrompt(title: string, description: string, language: string): string {
  return `You are AI Guru, a friendly Indian AI teacher for school students.
Convert the following contest topic into an interactive self-learning lesson.
Rules: Teach at a general school level. Write ALL user-facing text (titles, narration,
questions, options, explanations, everything except the JSON field names themselves)
in ${language}. Style: Simple Explanation. Difficulty: Standard.
Keep each narration under 120 words. Use Indian examples. Return ONLY valid JSON, no markdown.

Contest Title: ${title}
Contest Topic: ${description || `Comprehensive study on the topic: ${title}`}

Return exactly this JSON (populate ALL fields, minimum 5 scenes, 8 quiz, 8 flashcards, 5 keyConcepts):
{"lessonTitle":"","shortIntro":"","estimatedDurationMinutes":0,"learningObjectives":[""],"prerequisites":[""],"storyHook":{"title":"","narration":"","studentMission":""},"scenes":[{"sceneNumber":1,"sceneTitle":"","visualType":"animation","visualDescription":"","narration":"","keyConcept":"","example":"","studentAction":"","checkQuestion":{"question":"","options":["","","",""],"correctAnswerIndex":0,"explanation":""}}],"keyConcepts":[{"term":"","simpleMeaning":"","realLifeExample":""}],"practicalActivity":{"title":"","instructions":[""],"expectedOutput":"","aiEvaluationCriteria":[""]},"flashcards":[{"front":"","back":""}],"quickRevisionNotes":[""],"quiz":[{"question":"","options":["","","",""],"correctAnswerIndex":0,"explanation":"","difficulty":"easy","concept":""}],"finalMission":{"title":"","task":"","successCriteria":[""],"rewardText":""},"commonMistakes":[{"mistake":"","correction":""}],"examTips":[""],"followUpPrompts":[]}`;
}

function buildBannerPrompt(title: string, description: string, language: string): string {
  return `You are a UI designer creating a banner for an educational contest.
Contest Title: "${title}"
Description: "${description}"
Generate a vibrant banner theme for students. Return ONLY this JSON, no markdown:
{"emoji":"","tagline":"","gradientStart":"","gradientEnd":""}

Rules:
- emoji: a single relevant emoji for the topic (e.g. "🧬", "🔢", "🌍")
- tagline: a catchy 5-8 word motivational phrase about the topic, written in ${language}
- gradientStart: a dark hex color (e.g. "#0f0c29")
- gradientEnd: a vibrant/colorful hex color (e.g. "#7c3aed")`;
}

const FALLBACK_BANNER = { emoji: "🌟", tagline: "Learn, Compete & Shine!", gradientStart: "#0f0c29", gradientEnd: "#7c3aed" };

// ── SECURITY (VidyaStar Phase 1 — score integrity) ──────────────────────────
// The AI-generated quiz naturally comes back with correctAnswerIndex/
// explanation embedded per question (see buildContestLessonPrompt above —
// the model is asked for both, since the SAME quiz shape is reused for the
// in-lesson scene checkQuestions, which legitimately do reveal their answer
// immediately as a local, ungraded "check your understanding" prompt).
//
// The contest's final quiz (lessonJson.quiz) is different: it's what
// functions/src/submitVidyastarContestQuiz.ts actually scores and rewards.
// That answer key must never reach the client — not via a direct Firestore
// read of this doc, and not via this callable's own return value (both were
// previously true: contests/{id}/lessons/{language} was world-readable AND
// this function returned lessonJson verbatim, answers included).
//
// Fix: split storage. The PUBLIC doc (this collection, still what the
// callable returns) never carries quiz answers. A new PRIVATE doc —
// contests/{id}/lessonAnswers/{language}, firestore.rules deny-all,
// Admin-SDK-only — carries just the per-question answer key, index-aligned
// with the public quiz array, and is read only by the grading function.
//
// scenes[].checkQuestion is intentionally left untouched: it's never
// submitted anywhere or used for scoring/reward, so it isn't part of this
// trust boundary.
interface QuizAnswerKeyEntry { correctAnswerIndex: number; explanation: string; }

function splitQuizAnswerKey(lessonJson: any): { publicLessonJson: any; answerKey: QuizAnswerKeyEntry[] } {
  const rawQuiz: any[] = Array.isArray(lessonJson?.quiz) ? lessonJson.quiz : [];

  const answerKey: QuizAnswerKeyEntry[] = rawQuiz.map((q, i) => {
    const optionCount = Array.isArray(q?.options) ? q.options.length : 0;
    let correctAnswerIndex = Number(q?.correctAnswerIndex);
    // Defensive: validateLessonJson only checks question/options shape, not
    // that correctAnswerIndex is a valid in-range integer — Gemini has no
    // hard guarantee here. A malformed index would otherwise make every
    // submitted answer to this question silently unscoreable-as-correct.
    if (!Number.isInteger(correctAnswerIndex) || correctAnswerIndex < 0 || correctAnswerIndex >= optionCount) {
      console.warn(`getContestLesson: quiz[${i}] has an invalid correctAnswerIndex (${q?.correctAnswerIndex}) for ${optionCount} options — defaulting to 0`);
      correctAnswerIndex = 0;
    }
    return { correctAnswerIndex, explanation: typeof q?.explanation === "string" ? q.explanation : "" };
  });

  const publicQuiz = rawQuiz.map((q) => ({
    question:   q?.question ?? "",
    options:    Array.isArray(q?.options) ? q.options : [],
    difficulty: q?.difficulty,
    concept:    q?.concept,
  }));

  return { publicLessonJson: { ...lessonJson, quiz: publicQuiz }, answerKey };
}

// Belt-and-suspenders for historical docs: any lesson doc written before
// this fix shipped may still have the raw quiz (with answers) sitting in
// its `lessonJson.quiz`. Rather than migrating that data (explicitly out of
// scope — see the Phase 1 report), every return path re-sanitizes at read
// time, so a pre-fix cached doc can never leak its embedded answer key
// through this callable, regardless of when it was generated.
function sanitizeForClient(lessonJson: any): any {
  if (!lessonJson || !Array.isArray(lessonJson.quiz)) return lessonJson;
  return {
    ...lessonJson,
    quiz: lessonJson.quiz.map((q: any) => ({
      question:   q?.question,
      options:    q?.options,
      difficulty: q?.difficulty,
      concept:    q?.concept,
    })),
  };
}

// Lessons no longer live on the contest doc — a contest is now visible to
// every student regardless of language (admin no longer picks one), and the
// AI generates the lesson lazily, per (contest, language), the first time a
// student in that language opens it. contests/{contestId}/lessons/{language}
// holds one cached doc per language ever actually requested.
//
// Every viewer's request has to be atomic against every OTHER viewer of the
// same (contest, language) hitting this at the same moment — two students
// opening a brand-new Hindi lesson seconds apart must not both trigger a
// full Gemini generation. The transaction below claims "generating" status
// before any AI call happens; a second caller that finds "generating"
// already claimed backs off with `already-exists` instead of racing.
export const getContestLesson = functionsV1
  .runWith({ timeoutSeconds: 300, memory: "512MB", secrets: ["GEMINI_API_KEY"] })
  .https.onCall(async (data: { contestId: string; language: string }, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }

    const contestId = (data?.contestId ?? "").trim();
    const language  = (data?.language ?? "").trim() || "English";
    if (!contestId) {
      throw new functionsV1.https.HttpsError("invalid-argument", "contestId is required");
    }

    const db = admin.firestore();
    const contestRef       = db.doc(`contests/${contestId}`);
    const lessonRef        = contestRef.collection("lessons").doc(language);
    // Private, Admin-SDK-only — firestore.rules denies all client access.
    const lessonAnswersRef = contestRef.collection("lessonAnswers").doc(language);

    const claim = await db.runTransaction(async (tx) => {
      const lessonSnap = await tx.get(lessonRef);
      if (lessonSnap.exists) {
        const existing = lessonSnap.data()!;
        if (existing.status === "completed") return { outcome: "cached" as const, data: existing };
        if (existing.status === "generating") return { outcome: "in-progress" as const };
        // status === "failed" — fall through and let this call retry it.
      }
      tx.set(lessonRef, {
        status: "generating",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return { outcome: "claimed" as const };
    });

    if (claim.outcome === "cached") {
      // Lazy backfill: contests/{id}.banners.{language} was added after
      // some lessons already existed (see the write below and the
      // COMPATIBILITY comment above it) — a pre-fix cached doc won't have
      // populated it yet. Best-effort, never blocks the response.
      contestRef.set({ banners: { [language]: claim.data.bannerMeta } }, { merge: true }).catch(() => {});
      // sanitizeForClient covers historical docs generated before the
      // public/private split shipped — see that function's header comment.
      return { lessonJson: sanitizeForClient(claim.data.lessonJson), bannerMeta: claim.data.bannerMeta, status: "completed" as const };
    }
    if (claim.outcome === "in-progress") {
      throw new functionsV1.https.HttpsError(
        "already-exists",
        "This lesson is already being generated — try again in a few seconds"
      );
    }

    // claim.outcome === "claimed" — this call does the actual generation.
    const contestSnap = await contestRef.get();
    if (!contestSnap.exists) {
      throw new functionsV1.https.HttpsError("not-found", "Contest not found");
    }
    const { title = "", description = "" } = contestSnap.data()!;

    try {
      const [lessonRaw, bannerRaw] = await Promise.all([
        callGeminiText(buildContestLessonPrompt(title, description, language)),
        callGeminiText(buildBannerPrompt(title, description, language)),
      ]);

      const lessonJson = parseJsonFromResponse(lessonRaw);
      validateLessonJson(lessonJson);

      let bannerMeta: object;
      try {
        bannerMeta = parseJsonFromResponse(bannerRaw) as object;
      } catch {
        bannerMeta = FALLBACK_BANNER;
      }

      const { publicLessonJson, answerKey } = splitQuizAnswerKey(lessonJson);

      const batch = db.batch();
      batch.set(lessonRef, {
        lessonJson: publicLessonJson,
        bannerMeta,
        status: "completed",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      batch.set(lessonAnswersRef, {
        answerKey,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      // COMPATIBILITY (VidyaStar Phase 1 validation): useContestBanner.ts
      // (both platforms) reads bannerMeta with a plain, uncalled Firestore
      // getDoc — deliberately not through this callable, since calling it
      // would trigger a full Gemini generation just from rendering a
      // contest card (see that hook's own header comment). Locking
      // contests/{id}/lessons/{language} down to deny-all (Phase 1) broke
      // that direct read. bannerMeta carries no quiz/answer data, so
      // mirroring it onto the contest doc itself — already world-readable
      // to any authenticated user, unaffected by the Phase 1 rule change —
      // keeps that hook working without reopening the answer-key leak.
      batch.set(contestRef, { banners: { [language]: bannerMeta } }, { merge: true });
      await batch.commit();

      return { lessonJson: publicLessonJson, bannerMeta, status: "completed" as const };
    } catch (err: any) {
      const msg: string = err?.message ?? "Unknown error";
      console.error(`getContestLesson error (contest=${contestId} language=${language}):`, msg);
      await lessonRef.set({
        status: "failed",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }).catch(() => {});
      throw new functionsV1.https.HttpsError("internal", "Failed to generate the lesson. Please try again.");
    }
  });

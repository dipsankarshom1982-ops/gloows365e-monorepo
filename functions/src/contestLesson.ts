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
    const contestRef = db.doc(`contests/${contestId}`);
    const lessonRef  = contestRef.collection("lessons").doc(language);

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
      return { lessonJson: claim.data.lessonJson, bannerMeta: claim.data.bannerMeta, status: "completed" as const };
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

      await lessonRef.set({
        lessonJson,
        bannerMeta,
        status: "completed",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      return { lessonJson, bannerMeta, status: "completed" as const };
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

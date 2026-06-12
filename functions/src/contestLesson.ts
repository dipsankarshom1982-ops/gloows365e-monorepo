import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { callGeminiText, parseJsonFromResponse } from "./gemini";
import { validateLessonJson } from "./validateLesson";

function buildContestLessonPrompt(title: string, description: string): string {
  return `You are AI Guru, a friendly Indian AI teacher for school students.
Convert the following contest topic into an interactive self-learning lesson.
Rules: Teach at a general school level. Use English. Style: Simple Explanation. Difficulty: Standard.
Keep each narration under 120 words. Use Indian examples. Return ONLY valid JSON, no markdown.

Contest Title: ${title}
Contest Topic: ${description || `Comprehensive study on the topic: ${title}`}

Return exactly this JSON (populate ALL fields, minimum 5 scenes, 8 quiz, 8 flashcards, 5 keyConcepts):
{"lessonTitle":"","shortIntro":"","estimatedDurationMinutes":0,"learningObjectives":[""],"prerequisites":[""],"storyHook":{"title":"","narration":"","studentMission":""},"scenes":[{"sceneNumber":1,"sceneTitle":"","visualType":"animation","visualDescription":"","narration":"","keyConcept":"","example":"","studentAction":"","checkQuestion":{"question":"","options":["","","",""],"correctAnswerIndex":0,"explanation":""}}],"keyConcepts":[{"term":"","simpleMeaning":"","realLifeExample":""}],"practicalActivity":{"title":"","instructions":[""],"expectedOutput":"","aiEvaluationCriteria":[""]},"flashcards":[{"front":"","back":""}],"quickRevisionNotes":[""],"quiz":[{"question":"","options":["","","",""],"correctAnswerIndex":0,"explanation":"","difficulty":"easy","concept":""}],"finalMission":{"title":"","task":"","successCriteria":[""],"rewardText":""},"commonMistakes":[{"mistake":"","correction":""}],"examTips":[""],"followUpPrompts":[]}`;
}

function buildBannerPrompt(title: string, description: string): string {
  return `You are a UI designer creating a banner for an educational contest.
Contest Title: "${title}"
Description: "${description}"
Generate a vibrant banner theme for students. Return ONLY this JSON, no markdown:
{"emoji":"","tagline":"","gradientStart":"","gradientEnd":""}

Rules:
- emoji: a single relevant emoji for the topic (e.g. "🧬", "🔢", "🌍")
- tagline: a catchy 5-8 word motivational phrase about the topic
- gradientStart: a dark hex color (e.g. "#0f0c29")
- gradientEnd: a vibrant/colorful hex color (e.g. "#7c3aed")`;
}

function setCorsHeaders(res: functionsV1.Response): void {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function verifyAdminToken(req: functionsV1.https.Request): Promise<string> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) throw new Error("UNAUTHENTICATED");
  const decoded = await admin.auth().verifyIdToken(authHeader.split("Bearer ")[1]);

  // Accept custom claim OR presence in admins collection (handles accounts set up outside createAdmin)
  if (decoded.admin || decoded.superAdmin) return decoded.uid;

  const adminDoc = await admin.firestore().collection("admins").doc(decoded.uid).get();
  if (!adminDoc.exists) throw new Error("FORBIDDEN: Not an admin");
  return decoded.uid;
}

export const generateContestLesson = functionsV1
  .runWith({ timeoutSeconds: 300, memory: "512MB", secrets: ["GEMINI_API_KEY"] })
  .https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

    try {
      await verifyAdminToken(req);
    } catch (e: any) {
      const status = e.message === "UNAUTHENTICATED" ? 401 : 403;
      res.status(status).json({ error: e.message }); return;
    }

    const { contestId } = req.body;
    if (!contestId) { res.status(400).json({ error: "contestId required" }); return; }

    const db = admin.firestore();
    const contestRef = db.collection("contests").doc(contestId);

    try {
      const contestSnap = await contestRef.get();
      if (!contestSnap.exists) { res.status(404).json({ error: "Contest not found" }); return; }

      const { title = "", description = "" } = contestSnap.data()!;

      await contestRef.update({
        lessonStatus: "generating",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const [lessonRaw, bannerRaw] = await Promise.all([
        callGeminiText(buildContestLessonPrompt(title, description)),
        callGeminiText(buildBannerPrompt(title, description)),
      ]);

      const lessonJson = parseJsonFromResponse(lessonRaw);
      validateLessonJson(lessonJson);

      let bannerMeta: object;
      try {
        bannerMeta = parseJsonFromResponse(bannerRaw) as object;
      } catch {
        bannerMeta = { emoji: "🌟", tagline: "Learn, Compete & Shine!", gradientStart: "#0f0c29", gradientEnd: "#7c3aed" };
      }

      await contestRef.update({
        lessonJson,
        bannerMeta,
        lessonStatus: "completed",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).json({ success: true, lessonStatus: "completed", bannerMeta });
    } catch (err: any) {
      const msg: string = err?.message ?? "Unknown error";
      console.error("generateContestLesson error:", msg);
      await contestRef.update({
        lessonStatus: "failed",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
      res.status(500).json({ error: msg });
    }
  });

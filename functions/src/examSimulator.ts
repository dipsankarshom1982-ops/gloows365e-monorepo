// PATH: functions/src/examSimulator.ts
// Exam Simulator — two endpoints:
//   generateExam: creates a full mock test (20 Qs) for subject/chapter/class/board
//   evaluateExam: grades submitted answers, returns score + weak topic analysis + board readiness %

import { createHash } from "crypto";
import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { callGeminiText, parseJsonFromResponse } from "./gemini";
import { getRedis, todayIST, TTL, ttlUntilMidnightIST } from "./redish";
import { getSubscription } from "./usageCheck";

const db = admin.firestore();
const FREE_EXAMS_DAILY    = 1;  // free: 1 exam/day
const PREMIUM_EXAMS_DAILY = 20; // premium: 20/day

function setCorsHeaders(res: any): void {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function verifyAuthToken(req: any): Promise<string> {
  const authHeader: string = req.headers.authorization ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("UNAUTHENTICATED");
  const token = authHeader.slice(7);
  const decoded = await admin.auth().verifyIdToken(token);
  return decoded.uid;
}

function buildExamPrompt(
  classLevel: string,
  board: string,
  subject: string,
  chapter: string,
  difficulty: string,
  language: string,
  questionCount: number
): string {
  return `You are an expert ${board} exam question setter for Class ${classLevel} ${subject}.

Generate a ${difficulty} difficulty mock test for the chapter/topic: "${chapter}".
The student's preferred language is ${language} — write questions and options in ${language === "Hindi" ? "Hindi" : language === "Bengali" ? "Bengali" : "English"}.

Return ONLY a valid JSON object:
{
  "examTitle": "<descriptive title>",
  "subject": "${subject}",
  "chapter": "${chapter}",
  "board": "${board}",
  "class": "${classLevel}",
  "difficulty": "${difficulty}",
  "estimatedMinutes": <number between 20 and 40>,
  "questions": [
    {
      "id": 1,
      "type": "mcq",
      "question": "<question text>",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctIndex": <0-3>,
      "explanation": "<why this answer is correct, 1-2 sentences>",
      "marks": <1 or 2>,
      "concept": "<the concept being tested, e.g. 'Newton's Third Law'>",
      "boardImportance": <"low" | "medium" | "high">
    }
  ],
  "totalMarks": <sum of all question marks>,
  "passingMarks": <60% of totalMarks, rounded>
}

Rules:
- Generate exactly ${questionCount} questions.
- Mix question types: 60% conceptual, 25% application/numerical, 15% HOTS.
- Follow ${board} Class ${classLevel} pattern strictly.
- Mark boardImportance "high" for questions that appear frequently in board exams.
- Options must be clearly distinct. No "All of the above" / "None of the above".
- All JSON strings must be valid (escape special chars, no newlines in strings).`;
}

function buildEvaluationPrompt(
  examData: any,
  answers: { questionId: number; selectedIndex: number }[],
  classLevel: string,
  board: string
): string {
  const answerMap = new Map(answers.map((a) => [a.questionId, a.selectedIndex]));
  const results = examData.questions.map((q: any) => ({
    id: q.id,
    concept: q.concept,
    boardImportance: q.boardImportance,
    correct: answerMap.get(q.id) === q.correctIndex,
    selectedIndex: answerMap.get(q.id) ?? -1,
    correctIndex: q.correctIndex,
    marks: q.marks,
  }));

  const correctCount = results.filter((r: any) => r.correct).length;
  const totalMarks = examData.totalMarks;
  const earnedMarks = results
    .filter((r: any) => r.correct)
    .reduce((s: number, r: any) => s + r.marks, 0);
  const weakConcepts = results
    .filter((r: any) => !r.correct)
    .map((r: any) => r.concept);

  return `You are an expert ${board} examiner evaluating a Class ${classLevel} ${examData.subject} mock test.

The student scored ${earnedMarks}/${totalMarks} (${correctCount}/${examData.questions.length} questions correct).
Subject: ${examData.subject} | Chapter: ${examData.chapter}
Weak concepts (answered incorrectly): ${weakConcepts.join(", ") || "None — perfect score!"}

Return ONLY a valid JSON object:
{
  "earnedMarks": ${earnedMarks},
  "totalMarks": ${totalMarks},
  "percentage": ${Math.round((earnedMarks / totalMarks) * 100)},
  "grade": "<A+/A/B+/B/C/D>",
  "boardReadiness": <0-100 integer — how ready for board exam based on this performance>,
  "performanceSummary": "<2-3 sentence honest assessment of performance>",
  "weakConcepts": ${JSON.stringify(weakConcepts)},
  "strongConcepts": ${JSON.stringify(results.filter((r: any) => r.correct).map((r: any) => r.concept))},
  "studyPlan": [
    "<specific action step 1 for improvement>",
    "<specific action step 2>",
    "<specific action step 3>"
  ],
  "predictedBoardScore": "<e.g. '32-38 out of 40' based on performance>",
  "motivationalMessage": "<one genuinely encouraging sentence personalised to their performance>",
  "questionResults": ${JSON.stringify(results.map((r: any) => ({ id: r.id, correct: r.correct, selectedIndex: r.selectedIndex })))}
}`;
}

export const generateExam = onRequest(
  {
    timeoutSeconds: 90,
    memory: "512MiB",
    secrets: ["GEMINI_API_KEY", "REDIS_URL", "REDIS_TOKEN"],
  },
  async (req, res) => {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

    let uid = "";
    try {
      uid = await verifyAuthToken(req);
    } catch {
      res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED" });
      return;
    }

    const { classLevel, board, subject, chapter, difficulty = "Standard", language = "English", questionCount = 15 } = req.body ?? {};

    if (!subject || !chapter) {
      res.status(400).json({ error: "subject and chapter are required", code: "MISSING_PARAMS" });
      return;
    }

    // ── Rate limit ───────────────────────────────────────────────────────────
    try {
      const { isPremium } = await getSubscription(uid, db);
      const dailyLimit = isPremium ? PREMIUM_EXAMS_DAILY : FREE_EXAMS_DAILY;
      const key = `exam:gen:${uid}:${todayIST()}`;

      let used = 0;
      try { const c = await getRedis().get<number>(key); used = c ?? 0; } catch {}

      if (used >= dailyLimit) {
        res.status(429).json({
          error: isPremium
            ? `Daily exam limit reached (${PREMIUM_EXAMS_DAILY}/day).`
            : `Free tier: 1 exam/day. Upgrade for unlimited exams.`,
          code: "LIMIT_REACHED",
          isPremium,
        });
        return;
      }
    } catch {}

    // ── Cache check ──────────────────────────────────────────────────────────
    const cacheKey = `exam:gen:${createHash("sha256")
      .update(`${classLevel}:${board}:${subject}:${chapter}:${difficulty}:${language}`)
      .digest("hex").slice(0, 16)}`;

    try {
      const cached = await getRedis().get<object>(cacheKey);
      if (cached) { res.status(200).json({ ...(cached as any), fromCache: true }); return; }
    } catch {}

    // ── Generate exam ────────────────────────────────────────────────────────
    try {
      const prompt = buildExamPrompt(
        classLevel ?? "10", board ?? "CBSE", subject, chapter,
        difficulty, language, Math.min(Math.max(Number(questionCount), 10), 20)
      );
      const raw = await callGeminiText(prompt);
      const parsed = parseJsonFromResponse(raw) as any;

      if (!parsed?.questions?.length) throw new Error("No questions generated");

      // Assign unique examId
      const examId = `exam_${uid}_${Date.now()}`;
      parsed.examId = examId;
      parsed.createdAt = new Date().toISOString();

      // ── Increment usage ──────────────────────────────────────────────────
      const usageKey = `exam:gen:${uid}:${todayIST()}`;
      try {
        const count = await getRedis().incr(usageKey);
        if (count === 1) await getRedis().expire(usageKey, ttlUntilMidnightIST());
      } catch {}

      // Firestore: store exam for later evaluation
      await db.doc(`examSimulator/${uid}/exams/${examId}`).set({
        ...parsed,
        uid,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Cache exam (1 hr)
      getRedis().set(cacheKey, parsed, { ex: TTL.discoverQuery }).catch(() => {});

      res.status(200).json(parsed);
    } catch (e: any) {
      console.error("generateExam error:", e);
      res.status(500).json({ error: e?.message ?? "Failed to generate exam", code: "AI_ERROR" });
    }
  }
);

export const evaluateExam = onRequest(
  {
    timeoutSeconds: 60,
    memory: "256MiB",
    secrets: ["GEMINI_API_KEY", "REDIS_URL", "REDIS_TOKEN"],
  },
  async (req, res) => {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

    let uid = "";
    try {
      uid = await verifyAuthToken(req);
    } catch {
      res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED" });
      return;
    }

    const { examId, answers } = req.body ?? {};
    if (!examId || !Array.isArray(answers)) {
      res.status(400).json({ error: "examId and answers[] are required", code: "MISSING_PARAMS" });
      return;
    }

    // Load exam from Firestore
    let examData: any;
    try {
      const snap = await db.doc(`examSimulator/${uid}/exams/${examId}`).get();
      if (!snap.exists) {
        res.status(404).json({ error: "Exam not found", code: "NOT_FOUND" });
        return;
      }
      examData = snap.data();
    } catch (e: any) {
      res.status(500).json({ error: "Failed to load exam", code: "DB_ERROR" });
      return;
    }

    try {
      const prompt = buildEvaluationPrompt(examData, answers, examData.class, examData.board);
      const raw = await callGeminiText(prompt);
      const evaluation = parseJsonFromResponse(raw) as any;

      // Save result to Firestore
      await db.doc(`examSimulator/${uid}/exams/${examId}`).update({
        status: "completed",
        evaluation,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Firestore usage stats
      db.doc(`examSimulator/${uid}`).set(
        {
          totalExams: admin.firestore.FieldValue.increment(1),
          lastExamAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});

      res.status(200).json(evaluation);
    } catch (e: any) {
      console.error("evaluateExam error:", e);
      res.status(500).json({ error: e?.message ?? "Failed to evaluate exam", code: "AI_ERROR" });
    }
  }
);
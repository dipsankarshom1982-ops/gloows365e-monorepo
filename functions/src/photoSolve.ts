// PATH: functions/src/photoSolve.ts
// PhotoSolve AI — student snaps a question photo, Gemini Vision returns:
//   • subject detection
//   • step-by-step solution
//   • concept explanation
//   • 3 similar exam-pattern questions
//   • board/class-aware prompt

import { createHash } from "crypto";
import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { callGeminiWithImage, parseJsonFromResponse } from "./gemini";
import { getRedis, todayIST, TTL, ttlUntilMidnightIST } from "./redish";
import { getSubscription } from "./usageCheck";
import { resolveStudentLanguage, getLanguageInstruction } from "./aiLanguage";

const db = admin.firestore();

const FREE_PHOTOSOLVE_DAILY = 3; // free users: 3 solves/day
const PREMIUM_PHOTOSOLVE_DAILY = 50; // premium: 50/day (practical cap)

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

// Extracted as its own pure function (2026-09-06) so the language-isolation
// guarantee below is directly unit-testable without mocking Redis/Gemini —
// see __tests__/aiLanguage.test.ts's cache-key coverage. Exported for that
// reason only; the handler below is still the only real caller.
export function buildPhotoSolveCacheKey(
  imageBase64: string,
  classLevel: string | number,
  board: string,
  language: string
): string {
  const imageHash = createHash("sha256")
    .update(`${imageBase64.slice(0, 500)}:${classLevel}:${board}`)
    .digest("hex")
    .slice(0, 16);
  return `photosolve:cache:${imageHash}:${language}`;
}

// FIX (production, 2026-09-06): used to hardcode a 3-way ternary
// (Hindi/Bengali/Assamese, else English) that silently forced English for
// every other supported language regardless of the student's actual
// selection. Now uses the shared, exhaustive instruction — see
// functions/src/aiLanguage.ts's header comment for the full context.
function buildPhotoSolvePrompt(
  classLevel: string | number,
  board: string,
  language: string
): string {
  return `You are an expert AI tutor for Indian school students, specialised in ${board} curriculum for Class ${classLevel}.

A student has photographed a question or problem. Analyse it carefully and provide a complete solution.

${getLanguageInstruction(language)}
This applies to every text field below — questionText, solution steps, finalAnswer, conceptExplained, examTip, and similarQuestions — not just the top-level summary.

Return ONLY a valid JSON object with this exact structure:
{
  "subject": "<detected subject: Math/Science/Physics/Chemistry/Biology/English/History/Geography/Computer>",
  "questionText": "<the question as you read it from the image, clean text>",
  "solution": {
    "steps": ["<step 1>", "<step 2>", "<step 3>", "..."],
    "finalAnswer": "<the final answer clearly stated>",
    "formula": "<key formula used, if any, else null>"
  },
  "conceptExplained": "<a 2-3 sentence plain-language explanation of the core concept behind this question>",
  "examTip": "<one specific tip for this type of question in board exams>",
  "similarQuestions": [
    {"question": "<similar exam-pattern question 1>", "hint": "<one-line hint>"},
    {"question": "<similar exam-pattern question 2>", "hint": "<one-line hint>"},
    {"question": "<similar exam-pattern question 3>", "hint": "<one-line hint>"}
  ]
}

Rules:
- Solve completely step by step. Do NOT skip steps.
- Use simple language appropriate for Class ${classLevel}.
- If the image is blurry or unreadable, set questionText to "Could not read clearly" and explain in conceptExplained.
- Do NOT use markdown in the step strings — plain sentences only.
- All strings must be valid JSON (escape quotes, no newlines in strings).`;
}

export const photoSolve = onRequest(
  {
    timeoutSeconds: 60,
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

    const { imageBase64, imageMimeType, classLevel, board, language: requestedLanguage } = req.body ?? {};

    if (!imageBase64 || !imageMimeType) {
      res.status(400).json({ error: "imageBase64 and imageMimeType are required", code: "MISSING_IMAGE" });
      return;
    }

    // Priority order per functions/src/aiLanguage.ts: this request's own
    // language field → the student's saved preference looked up
    // server-side → English. Never trusts an unrecognized client value.
    const language = await resolveStudentLanguage(uid, db, requestedLanguage);

    // ── Rate limit check ────────────────────────────────────────────────────
    try {
      const { isPremium } = await getSubscription(uid, db);
      const dailyLimit = isPremium ? PREMIUM_PHOTOSOLVE_DAILY : FREE_PHOTOSOLVE_DAILY;
      const key = `photosolve:${uid}:${todayIST()}`;

      let used = 0;
      try {
        const count = await getRedis().get<number>(key);
        used = count ?? 0;
      } catch { /* Redis unavailable — allow through */ }

      if (used >= dailyLimit) {
        res.status(429).json({
          error: isPremium
            ? `You've reached your daily limit of ${PREMIUM_PHOTOSOLVE_DAILY} solves.`
            : `You've used your ${FREE_PHOTOSOLVE_DAILY} free photo solves for today. Upgrade for more.`,
          code: "LIMIT_REACHED",
          isPremium,
        });
        return;
      }
    } catch (e) {
      console.error("Rate limit check failed:", e);
      // On error, allow through (fail open for UX)
    }

    // ── Check result cache (image hash + class + board + language) ───────────
    // FIX (production, 2026-09-06): this cache key used to omit language
    // entirely — the identical photo solved once in English would then be
    // served straight back to a Hindi-preference student (and vice versa)
    // from cache, bypassing buildPhotoSolvePrompt's language instruction
    // altogether. `language` here is already the fully-resolved value (see
    // resolveStudentLanguage() above), so two students with different
    // preferences solving the same photo now get separate cache entries,
    // one per language — matching every other Ask AI Guru cache
    // (askAiGuru.ts's cacheKey already included language for the same
    // reason; examSimulator.ts's below does too).
    const cacheKey = buildPhotoSolveCacheKey(imageBase64, classLevel, board, language);

    try {
      const cached = await getRedis().get<object>(cacheKey);
      if (cached) {
        res.status(200).json({ ...cached, fromCache: true });
        return;
      }
    } catch { /* Redis unavailable */ }

    // ── Call Gemini Vision ───────────────────────────────────────────────────
    try {
      const prompt = buildPhotoSolvePrompt(classLevel ?? "10", board ?? "CBSE", language);
      const raw = await callGeminiWithImage(prompt, imageBase64, imageMimeType);
      const parsed = parseJsonFromResponse(raw) as any;

      // Validate required fields
      if (!parsed?.solution?.steps || !parsed?.subject) {
        throw new Error("Incomplete response from AI");
      }

      // ── Increment usage ────────────────────────────────────────────────────
      const usageKey = `photosolve:${uid}:${todayIST()}`;
      try {
        const count = await getRedis().incr(usageKey);
        if (count === 1) await getRedis().expire(usageKey, ttlUntilMidnightIST());
      } catch { /* Redis unavailable */ }

      // Firestore usage write (async, non-blocking)
      db.doc(`photoSolveUsage/${uid}/daily/${todayIST()}`).set(
        { solvesUsed: admin.firestore.FieldValue.increment(1), lastUsedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      ).catch(() => {});

      // ── Cache result ───────────────────────────────────────────────────────
      getRedis().set(cacheKey, parsed, { ex: TTL.askGuruAnswer }).catch(() => {});

      res.status(200).json(parsed);
    } catch (e: any) {
      console.error("PhotoSolve error:", e);
      res.status(500).json({ error: e?.message ?? "Failed to solve question", code: "AI_ERROR" });
    }
  }
);
import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { createHash } from "crypto";
import { getRedis, RK, TTL } from "./redish";
import { checkAskGuruLimit, incrementAskGuruUsage } from "./usageCheck";
import { callGeminiText } from "./gemini";

const db = admin.firestore();
const FREE_ASK_GURU_DAILY = 5;

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

// Mode-aware prompt builder
// mode: "doubt" | "explain" | "notes" | "exam" | "summarize" | "tip" | "language"
function buildPrompt(
  question: string,
  classLevel: string | number,
  board: string,
  mode: string
): string {
  const base = `You are an expert AI tutor for Indian school students (${board}, Class ${classLevel}).

CRITICAL LANGUAGE RULE: Detect the language of the student's question and respond in the EXACT SAME language.
- Bengali question → Bengali answer
- Hindi question → Hindi answer
- Tamil question → Tamil answer
- Telugu question → Telugu answer
- Marathi question → Marathi answer
- Gujarati question → Gujarati answer
- Assamese question → Assamese answer
- Odia question → Odia answer
- Malayalam question → Malayalam answer
- Kannada question → Kannada answer
- Punjabi question → Punjabi answer
- Urdu question → Urdu answer
- English question → simple English answer
Do NOT translate. Write naturally in the student's language as a real teacher would.
Do NOT start with "Sure," "Great question!" or "Of course!" — go directly to the content.
Do NOT use markdown symbols like **, ##, or bullet points — plain text only.`;

  const modeInstructions: Record<string, string> = {
    doubt: `The student has a doubt or confusion. Clarify it clearly in 3–5 sentences. Give one real-life example if helpful.`,

    explain: `Explain this concept clearly. Structure: (1) simple definition in 1–2 sentences, (2) how it works in 2–3 sentences, (3) one real-life example. Total: under 100 words.`,

    notes: `Create compact study notes for this topic. Format:
Topic name on first line.
Then 4–6 key points as short numbered lines (no symbols, no bullets).
Then one "Remember:" line with the most important fact.
Keep each point under 15 words.`,

    exam: `Give exam preparation help for this topic. Include:
1. Most likely exam question types (2–3 examples)
2. Key facts to memorise (3–4 points)
3. One common mistake students make
4. One exam tip
Keep it sharp and exam-focused.`,

    summarize: `Summarise this chapter or topic in exactly 5 key points. Number them 1 to 5. Each point must be one clear sentence. End with: "Most important: [the single most critical concept]"`,

    tip: `Give one personalised daily study tip for a Class ${classLevel} ${board} student asking about: "${question}". Make it specific, actionable, and encouraging. 2–3 sentences maximum.`,

    language: `The student wants to understand this in their own language. Detect their language from the question. Give a warm, teacher-like explanation in that language. Use simple everyday words — avoid technical jargon. 4–6 sentences.`,
  };

  const modeText = modeInstructions[mode] ?? modeInstructions.doubt;

  return `${base}

Task: ${modeText}

Student's question: "${question}"

Answer:`;
}

export const askAiGuruQuestion = onRequest(
  {
    timeoutSeconds: 30,
    memory: "256MiB",
    secrets: ["GEMINI_API_KEY", "REDIS_URL", "REDIS_TOKEN"],
  },
  async (req, res) => {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST")   { res.status(405).json({ error: "Method not allowed" }); return; }

    let uid = "";
    try {
      uid = await verifyAuthToken(req);
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const {
      question   = "",
      classLevel = "10",
      board      = "CBSE",
      mode       = "doubt",   // new param — default to doubt
    } = req.body;

    if (!String(question).trim()) {
      res.status(400).json({ error: "Question is required" });
      return;
    }

    // Usage check
    try {
      await checkAskGuruLimit(uid, db);
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (msg.startsWith("FREE_LIMIT_REACHED:")) {
        res.status(429).json({
          error: msg.slice("FREE_LIMIT_REACHED:".length),
          code:  "LIMIT_REACHED",
          limit: FREE_ASK_GURU_DAILY,
        });
      } else {
        res.status(500).json({ error: "Usage check failed" });
      }
      return;
    }

    try {
      const questionStr = String(question).trim();
      const modeStr     = String(mode).trim() || "doubt";

      // Cache key includes mode so different modes don't collide
      let cached: string | null = null;
      let cacheKey = "";
      let redis;
      try {
        redis = getRedis();
        const cacheHash = createHash("sha256")
          .update(`${questionStr.toLowerCase()}:${classLevel}:${board}:${modeStr}`)
          .digest("hex")
          .slice(0, 16);
        cacheKey = RK.askGuruAnswer(cacheHash);
        cached = await redis.get<string>(cacheKey);
      } catch (redisErr: any) {
        console.warn("[AskAiGuru] Redis unavailable:", redisErr?.message);
      }

      if (cached) {
        await incrementAskGuruUsage(uid, db);
        const answer = typeof cached === "string" ? cached : JSON.parse(cached as any);
        res.json({ answer, mode: modeStr });
        return;
      }

      const prompt = buildPrompt(questionStr, classLevel, board, modeStr);
      const raw    = await callGeminiText(prompt);
      const answer = raw.replace(/^Answer:\s*/i, "").trim();

      if (redis && cacheKey) {
        redis.set(cacheKey, answer, { ex: TTL.askGuruAnswer }).catch(() => {});
      }
      await incrementAskGuruUsage(uid, db);

      res.json({ answer, mode: modeStr });
    } catch (err: any) {
      console.error("[AskAiGuru] error:", err?.message);
      res.status(500).json({ error: "Could not get an answer. Please try again." });
    }
  }
);

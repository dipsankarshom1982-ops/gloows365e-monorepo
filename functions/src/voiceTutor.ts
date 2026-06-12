// PATH: functions/src/voiceTutor.ts
// Voice Tutor — student speaks a doubt in Hindi/Bengali/Assamese/English.
//   voiceTutorAnswer: receives audio base64, transcribes + answers via Gemini,
//                     returns answer text + TTS-ready breakdown for client-side TTS.
//
// Architecture:
//   Client records audio (expo-av) → sends base64 → Gemini processes audio
//   → returns answer text → client plays TTS via expo-speech
//
// Premium only — free users get upgrade prompt.

import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { callGeminiWithAudio, callGeminiText, parseJsonFromResponse } from "./gemini";
import { getRedis, todayIST, ttlUntilMidnightIST } from "./redish";
import { getSubscription } from "./usageCheck";

const db = admin.firestore();
const FREE_VOICE_DAILY    = 3;   // free: 3 voice queries/day
const PREMIUM_VOICE_DAILY = 100; // premium: 100/day

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

function buildVoiceTutorPrompt(classLevel: string, board: string): string {
  return `You are an expert AI tutor for Indian school students (${board}, Class ${classLevel}).

A student has sent you an audio question. First, transcribe what they said, then answer it.

Return ONLY a valid JSON object:
{
  "transcribedQuestion": "<what the student said, exactly>",
  "detectedLanguage": "<English | Hindi | Bengali | Assamese | Tamil | Telugu | Other>",
  "answer": "<your complete answer in the SAME language the student used. If Hindi, answer in Hindi. If Bengali, answer in Bengali. Use simple, friendly language as a real teacher would.>",
  "keyPoints": ["<main point 1>", "<main point 2>", "<main point 3 if needed>"],
  "followUpSuggestion": "<one suggested follow-up question to deepen understanding>",
  "subject": "<detected subject: Math/Science/etc>"
}

Rules:
- Answer in the SAME language as the question. This is critical.
- Be warm and encouraging — like a real tutor.
- Keep answer under 150 words — clear and spoken-friendly (it will be read aloud via TTS).
- Do NOT use markdown, asterisks, or formatting symbols.
- If audio is unclear, set transcribedQuestion to "Could not hear clearly" and ask to try again.`;
}

function buildTextVoiceTutorPrompt(
  question: string,
  detectedLanguage: string,
  classLevel: string,
  board: string
): string {
  return `You are an expert AI tutor for Indian school students (${board}, Class ${classLevel}).

Student's question (in ${detectedLanguage}): "${question}"

Return ONLY a valid JSON object:
{
  "answer": "<your complete answer in ${detectedLanguage}. Use simple, friendly language. Max 120 words.>",
  "keyPoints": ["<main point 1>", "<main point 2>"],
  "followUpSuggestion": "<one follow-up question>",
  "subject": "<detected subject>"
}

Rules:
- Answer in ${detectedLanguage} only.
- No markdown or symbols — plain spoken sentences only.
- Be encouraging.`;
}

export const voiceTutorAnswer = onRequest(
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

    const {
      audioBase64,
      audioMimeType,
      textQuestion,      // fallback: if client sends text instead of audio
      detectedLanguage,
      classLevel,
      board,
    } = req.body ?? {};

    const hasAudio = audioBase64 && audioMimeType;
    const hasText  = textQuestion?.trim();

    if (!hasAudio && !hasText) {
      res.status(400).json({ error: "audioBase64 or textQuestion is required", code: "MISSING_INPUT" });
      return;
    }

    // ── Rate limit check ────────────────────────────────────────────────────
    try {
      const { isPremium } = await getSubscription(uid, db);
      const dailyLimit = isPremium ? PREMIUM_VOICE_DAILY : FREE_VOICE_DAILY;
      const key = `voicetutor:${uid}:${todayIST()}`;

      let used = 0;
      try { const c = await getRedis().get<number>(key); used = c ?? 0; } catch {}

      if (used >= dailyLimit) {
        res.status(429).json({
          error: isPremium
            ? `Daily voice tutor limit reached (${PREMIUM_VOICE_DAILY}/day).`
            : `Free tier: ${FREE_VOICE_DAILY} voice questions/day. Upgrade for unlimited.`,
          code: "LIMIT_REACHED",
          isPremium,
        });
        return;
      }
    } catch {}

    // ── Call Gemini ─────────────────────────────────────────────────────────
    try {
      let parsed: any;

      if (hasAudio) {
        // Full audio processing via Gemini audio understanding
        const prompt = buildVoiceTutorPrompt(classLevel ?? "10", board ?? "CBSE");
        const raw = await callGeminiWithAudio(prompt, audioBase64, audioMimeType);
        parsed = parseJsonFromResponse(raw);
      } else {
        // Text fallback (client already transcribed or typed)
        const lang = detectedLanguage ?? "English";
        const prompt = buildTextVoiceTutorPrompt(hasText, lang, classLevel ?? "10", board ?? "CBSE");
        const raw = await callGeminiText(prompt);
        parsed = parseJsonFromResponse(raw);
        parsed.transcribedQuestion = hasText;
        parsed.detectedLanguage = lang;
      }

      if (!parsed?.answer) throw new Error("No answer in AI response");

      // ── Increment usage ──────────────────────────────────────────────────
      const usageKey = `voicetutor:${uid}:${todayIST()}`;
      try {
        const count = await getRedis().incr(usageKey);
        if (count === 1) await getRedis().expire(usageKey, ttlUntilMidnightIST());
      } catch {}

      // Firestore usage write
      db.doc(`voiceTutorUsage/${uid}/daily/${todayIST()}`).set(
        { questionsUsed: admin.firestore.FieldValue.increment(1), lastUsedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      ).catch(() => {});

      res.status(200).json(parsed);
    } catch (e: any) {
      console.error("voiceTutorAnswer error:", e);
      res.status(500).json({ error: e?.message ?? "Failed to process voice question", code: "AI_ERROR" });
    }
  }
);

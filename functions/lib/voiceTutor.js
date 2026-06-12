"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.voiceTutorAnswer = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const gemini_1 = require("./gemini");
const redish_1 = require("./redish");
const usageCheck_1 = require("./usageCheck");
const db = admin.firestore();
const FREE_VOICE_DAILY = 3; // free: 3 voice queries/day
const PREMIUM_VOICE_DAILY = 100; // premium: 100/day
function setCorsHeaders(res) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
async function verifyAuthToken(req) {
    const authHeader = req.headers.authorization ?? "";
    if (!authHeader.startsWith("Bearer "))
        throw new Error("UNAUTHENTICATED");
    const token = authHeader.slice(7);
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid;
}
function buildVoiceTutorPrompt(classLevel, board) {
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
function buildTextVoiceTutorPrompt(question, detectedLanguage, classLevel, board) {
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
exports.voiceTutorAnswer = (0, https_1.onRequest)({
    timeoutSeconds: 60,
    memory: "512MiB",
    secrets: ["GEMINI_API_KEY", "REDIS_URL", "REDIS_TOKEN"],
}, async (req, res) => {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    let uid = "";
    try {
        uid = await verifyAuthToken(req);
    }
    catch {
        res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED" });
        return;
    }
    const { audioBase64, audioMimeType, textQuestion, // fallback: if client sends text instead of audio
    detectedLanguage, classLevel, board, } = req.body ?? {};
    const hasAudio = audioBase64 && audioMimeType;
    const hasText = textQuestion?.trim();
    if (!hasAudio && !hasText) {
        res.status(400).json({ error: "audioBase64 or textQuestion is required", code: "MISSING_INPUT" });
        return;
    }
    // ── Rate limit check ────────────────────────────────────────────────────
    try {
        const { isPremium } = await (0, usageCheck_1.getSubscription)(uid, db);
        const dailyLimit = isPremium ? PREMIUM_VOICE_DAILY : FREE_VOICE_DAILY;
        const key = `voicetutor:${uid}:${(0, redish_1.todayIST)()}`;
        let used = 0;
        try {
            const c = await (0, redish_1.getRedis)().get(key);
            used = c ?? 0;
        }
        catch { }
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
    }
    catch { }
    // ── Call Gemini ─────────────────────────────────────────────────────────
    try {
        let parsed;
        if (hasAudio) {
            // Full audio processing via Gemini audio understanding
            const prompt = buildVoiceTutorPrompt(classLevel ?? "10", board ?? "CBSE");
            const raw = await (0, gemini_1.callGeminiWithAudio)(prompt, audioBase64, audioMimeType);
            parsed = (0, gemini_1.parseJsonFromResponse)(raw);
        }
        else {
            // Text fallback (client already transcribed or typed)
            const lang = detectedLanguage ?? "English";
            const prompt = buildTextVoiceTutorPrompt(hasText, lang, classLevel ?? "10", board ?? "CBSE");
            const raw = await (0, gemini_1.callGeminiText)(prompt);
            parsed = (0, gemini_1.parseJsonFromResponse)(raw);
            parsed.transcribedQuestion = hasText;
            parsed.detectedLanguage = lang;
        }
        if (!parsed?.answer)
            throw new Error("No answer in AI response");
        // ── Increment usage ──────────────────────────────────────────────────
        const usageKey = `voicetutor:${uid}:${(0, redish_1.todayIST)()}`;
        try {
            const count = await (0, redish_1.getRedis)().incr(usageKey);
            if (count === 1)
                await (0, redish_1.getRedis)().expire(usageKey, (0, redish_1.ttlUntilMidnightIST)());
        }
        catch { }
        // Firestore usage write
        db.doc(`voiceTutorUsage/${uid}/daily/${(0, redish_1.todayIST)()}`).set({ questionsUsed: admin.firestore.FieldValue.increment(1), lastUsedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(() => { });
        res.status(200).json(parsed);
    }
    catch (e) {
        console.error("voiceTutorAnswer error:", e);
        res.status(500).json({ error: e?.message ?? "Failed to process voice question", code: "AI_ERROR" });
    }
});
//# sourceMappingURL=voiceTutor.js.map
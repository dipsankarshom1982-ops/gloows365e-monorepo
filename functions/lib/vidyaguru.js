"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vidyaguruChat = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const axios_1 = require("axios");
const gemini_1 = require("./gemini");
const usageCheck_1 = require("./usageCheck");
const db = admin.firestore();
// ─── Helpers ──────────────────────────────────────────────────────────────────
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
// ─── Language detection by Unicode script ─────────────────────────────────────
function detectLanguageFromScript(text) {
    if (/[ऀ-ॿ]/.test(text))
        return "hi"; // Devanagari → Hindi / Marathi
    if (/[ঀ-৿]/.test(text))
        return "bn"; // Bengali (also covers Assamese)
    if (/[஀-௿]/.test(text))
        return "ta"; // Tamil
    if (/[ఀ-౿]/.test(text))
        return "te"; // Telugu
    if (/[઀-૿]/.test(text))
        return "gu"; // Gujarati
    if (/[ಀ-೿]/.test(text))
        return "kn"; // Kannada
    if (/[ഀ-ൿ]/.test(text))
        return "ml"; // Malayalam
    if (/[଀-୿]/.test(text))
        return "or"; // Odia
    if (/[਀-੿]/.test(text))
        return "pa"; // Gurmukhi → Punjabi
    return "en";
}
// ─── TTS voice mapping ────────────────────────────────────────────────────────
function getTTSVoice(language) {
    const map = {
        hi: { languageCode: "hi-IN", name: "hi-IN-Wavenet-D" },
        bn: { languageCode: "bn-IN", name: "bn-IN-Wavenet-A" },
        ta: { languageCode: "ta-IN", name: "ta-IN-Wavenet-D" },
        te: { languageCode: "te-IN", name: "te-IN-Wavenet-D" },
        gu: { languageCode: "gu-IN", name: "gu-IN-Wavenet-A" },
        kn: { languageCode: "kn-IN", name: "kn-IN-Wavenet-A" },
        ml: { languageCode: "ml-IN", name: "ml-IN-Wavenet-A" },
        mr: { languageCode: "mr-IN", name: "mr-IN-Wavenet-A" },
        pa: { languageCode: "pa-IN", name: "pa-IN-Wavenet-A" },
        or: { languageCode: "en-IN", name: "en-IN-Wavenet-D" }, // no Odia Wavenet, use EN-IN
    };
    return map[language] ?? { languageCode: "en-IN", name: "en-IN-Wavenet-D" };
}
async function synthesizeSpeech(text, language) {
    const apiKey = process.env.GOOGLE_TTS_API_KEY;
    if (!apiKey)
        throw new Error("GOOGLE_TTS_API_KEY not configured");
    const voice = getTTSVoice(language);
    // Strip markdown/emojis for cleaner TTS
    const cleanText = text
        .replace(/[*_`#~]/g, "")
        .replace(/\p{Emoji_Presentation}/gu, "")
        .slice(0, 4500); // TTS limit
    const response = await axios_1.default.post(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
        input: { text: cleanText },
        voice,
        audioConfig: { audioEncoding: "MP3", speakingRate: 0.92, pitch: -1.0, volumeGainDb: 1.0 },
    }, { timeout: 15000 });
    return response.data.audioContent; // base64 MP3
}
// ─── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(studentName, classLevel) {
    const langInstruction = `Automatically detect the language the student is using — from their typed message or spoken audio — and always reply in that SAME language. Examples:
- Student writes in Hindi → reply in Hindi
- Student speaks in Bengali → reply in Bengali
- Student uses Hinglish (Hindi+English mix) → match their style
- Student uses Tamil, Telugu, Gujarati, Kannada, Malayalam, Marathi, Punjabi, Assamese, Odia, or any other Indian language → reply in that language
- If language is unclear or mixed → default to clear, friendly English`;
    return `You are VidyaGuru AI — a warm, caring AI teacher and personal mentor for students.

Student: ${studentName}, Class ${classLevel}

Language rule (CRITICAL): ${langInstruction}

Your personality:
- Warm, encouraging, patient, and genuinely caring
- Speak like a brilliant favourite teacher — never robotic
- Always address the student by their first name
- Celebrate curiosity: "Great question!", "I love that you asked this!"
- Use simple language and relatable, real-life examples
- Keep answers conversational (3–6 sentences for simple questions, structured for complex ones)
- End every response with a gentle invitation: "Does that make sense?" or "Want me to explain more?"
- If the student seems confused or sad, offer extra encouragement

Rules:
- NEVER shame or talk down to students
- NEVER give unsafe, political, or inappropriate content
- If asked off-topic questions, gently redirect back to learning
- Support all Indian curriculum boards (CBSE, ICSE, State)
- For exam-related questions, give exam-ready answers with key points`;
}
function buildTextPrompt(systemPrompt, conversationHistory, message) {
    const history = conversationHistory
        .slice(-6) // Keep last 6 messages for context
        .map((m) => `${m.role === "student" ? "Student" : "VidyaGuru"}: ${m.text}`)
        .join("\n");
    return `${systemPrompt}

${history ? `Previous conversation:\n${history}\n` : ""}
Student: ${message}

VidyaGuru:`;
}
function buildAudioPrompt(systemPrompt, conversationHistory) {
    const history = conversationHistory
        .slice(-6)
        .map((m) => `${m.role === "student" ? "Student" : "VidyaGuru"}: ${m.text}`)
        .join("\n");
    return `${systemPrompt}

${history ? `Previous conversation:\n${history}\n` : ""}
The student has sent a voice message. First, understand what they are asking (transcribe mentally), then respond warmly and helpfully as VidyaGuru.
Format your response as: [STUDENT SAID: <brief transcription>]\n[VIDYAGURU: <your warm response>]

VidyaGuru:`;
}
function buildFollowUps(language) {
    const sets = {
        en: ["Explain again simply", "Give me an example", "How to write in exam?", "Explain in Hindi"],
        hi: ["फिर से समझाएं", "उदाहरण दें", "परीक्षा में कैसे लिखें?", "और आसान बनाएं"],
        bn: ["আবার বলুন", "উদাহরণ দিন", "পরীক্ষায় কীভাবে লিখব?", "সহজ করুন"],
    };
    return sets[language] ?? sets.en;
}
// ─── Parse audio prompt response ──────────────────────────────────────────────
function parseAudioResponse(raw) {
    const studentMatch = raw.match(/\[STUDENT SAID:\s*(.*?)\]/s);
    const guruMatch = raw.match(/\[VIDYAGURU:\s*(.*?)\]?\s*$/s) ?? raw.match(/VidyaGuru:\s*([\s\S]+)/);
    const transcribedText = studentMatch?.[1]?.trim() ?? "";
    const answer = guruMatch?.[1]?.trim() ?? raw.replace(/\[STUDENT SAID:.*?\]/s, "").trim();
    return { transcribedText, answer };
}
// ─── Cloud Function ───────────────────────────────────────────────────────────
exports.vidyaguruChat = (0, https_1.onRequest)({ timeoutSeconds: 60, memory: "512MiB", secrets: ["GEMINI_API_KEY", "GOOGLE_TTS_API_KEY", "REDIS_URL", "REDIS_TOKEN"] }, async (req, res) => {
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
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        await (0, usageCheck_1.checkVidyaGuruLimit)(uid, db);
    }
    catch (err) {
        const msg = err?.message ?? "";
        if (msg.startsWith("FREE_LIMIT_REACHED:")) {
            res.status(429).json({ error: msg.replace("FREE_LIMIT_REACHED:", ""), code: "FREE_LIMIT_REACHED" });
        }
        else {
            res.status(500).json({ error: "Usage check failed" });
        }
        return;
    }
    try {
        const { message, audioBase64, audioMimeType, conversationHistory = [], studentName = "Student", classLevel = "8", } = req.body;
        const systemPrompt = buildSystemPrompt(studentName, classLevel);
        let answer = "";
        let transcribedText;
        if (audioBase64 && audioMimeType) {
            const prompt = buildAudioPrompt(systemPrompt, conversationHistory);
            const rawText = await (0, gemini_1.callGeminiWithAudio)(prompt, audioBase64, audioMimeType);
            const parsed = parseAudioResponse(rawText);
            answer = parsed.answer;
            transcribedText = parsed.transcribedText || undefined;
        }
        else {
            const prompt = buildTextPrompt(systemPrompt, conversationHistory, message ?? "");
            answer = await (0, gemini_1.callGeminiText)(prompt);
            // Strip any "VidyaGuru:" prefix Gemini may include
            answer = answer.replace(/^VidyaGuru:\s*/i, "").trim();
        }
        // Detect the language of the response by its Unicode script, then use the
        // matching TTS voice so the reply sounds natural in the student's language.
        const detectedLanguage = detectLanguageFromScript(answer);
        // Google Cloud TTS
        let audioBase64Response = "";
        try {
            audioBase64Response = await synthesizeSpeech(answer, detectedLanguage);
        }
        catch (ttsErr) {
            console.warn("TTS failed (non-fatal):", ttsErr?.message);
            // Continue without audio — client will show text-only
        }
        // Increment usage + persist conversation (fire-and-forget)
        await (0, usageCheck_1.incrementVidyaGuruUsage)(uid, db);
        const batch = db.batch();
        const convRef = db.collection("vidyaguruConversations").doc(uid).collection("messages");
        if (transcribedText) {
            batch.set(convRef.doc(), {
                role: "student", text: transcribedText,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else if (message) {
            batch.set(convRef.doc(), {
                role: "student", text: message,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        batch.set(convRef.doc(), {
            role: "guru", text: answer,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        batch.commit().catch(() => { });
        res.json({
            answer,
            transcribedText,
            audioBase64: audioBase64Response,
            followUps: buildFollowUps(detectedLanguage),
        });
    }
    catch (err) {
        console.error("vidyaguruChat error:", err?.message);
        res.status(500).json({ error: "Failed to get response from VidyaGuru. Please try again." });
    }
});
//# sourceMappingURL=vidyaguru.js.map
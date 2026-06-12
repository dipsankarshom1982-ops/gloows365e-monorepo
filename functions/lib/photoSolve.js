"use strict";
// PATH: functions/src/photoSolve.ts
// PhotoSolve AI — student snaps a question photo, Gemini Vision returns:
//   • subject detection
//   • step-by-step solution
//   • concept explanation
//   • 3 similar exam-pattern questions
//   • board/class-aware prompt
Object.defineProperty(exports, "__esModule", { value: true });
exports.photoSolve = void 0;
const crypto_1 = require("crypto");
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const gemini_1 = require("./gemini");
const redish_1 = require("./redish");
const usageCheck_1 = require("./usageCheck");
const db = admin.firestore();
const FREE_PHOTOSOLVE_DAILY = 3; // free users: 3 solves/day
const PREMIUM_PHOTOSOLVE_DAILY = 50; // premium: 50/day (practical cap)
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
function buildPhotoSolvePrompt(classLevel, board, language) {
    return `You are an expert AI tutor for Indian school students, specialised in ${board} curriculum for Class ${classLevel}.

A student has photographed a question or problem. Analyse it carefully and provide a complete solution.

Respond in ${language === "Hindi" ? "Hindi" : language === "Bengali" ? "Bengali" : language === "Assamese" ? "Assamese" : "English"}.

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
exports.photoSolve = (0, https_1.onRequest)({
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
    const { imageBase64, imageMimeType, classLevel, board, language } = req.body ?? {};
    if (!imageBase64 || !imageMimeType) {
        res.status(400).json({ error: "imageBase64 and imageMimeType are required", code: "MISSING_IMAGE" });
        return;
    }
    // ── Rate limit check ────────────────────────────────────────────────────
    try {
        const { isPremium } = await (0, usageCheck_1.getSubscription)(uid, db);
        const dailyLimit = isPremium ? PREMIUM_PHOTOSOLVE_DAILY : FREE_PHOTOSOLVE_DAILY;
        const key = `photosolve:${uid}:${(0, redish_1.todayIST)()}`;
        let used = 0;
        try {
            const count = await (0, redish_1.getRedis)().get(key);
            used = count ?? 0;
        }
        catch { /* Redis unavailable — allow through */ }
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
    }
    catch (e) {
        console.error("Rate limit check failed:", e);
        // On error, allow through (fail open for UX)
    }
    // ── Check result cache (image hash + class + board) ──────────────────────
    const imageHash = (0, crypto_1.createHash)("sha256")
        .update(`${imageBase64.slice(0, 500)}:${classLevel}:${board}`)
        .digest("hex")
        .slice(0, 16);
    const cacheKey = `photosolve:cache:${imageHash}`;
    try {
        const cached = await (0, redish_1.getRedis)().get(cacheKey);
        if (cached) {
            res.status(200).json({ ...cached, fromCache: true });
            return;
        }
    }
    catch { /* Redis unavailable */ }
    // ── Call Gemini Vision ───────────────────────────────────────────────────
    try {
        const prompt = buildPhotoSolvePrompt(classLevel ?? "10", board ?? "CBSE", language ?? "English");
        const raw = await (0, gemini_1.callGeminiWithImage)(prompt, imageBase64, imageMimeType);
        const parsed = (0, gemini_1.parseJsonFromResponse)(raw);
        // Validate required fields
        if (!parsed?.solution?.steps || !parsed?.subject) {
            throw new Error("Incomplete response from AI");
        }
        // ── Increment usage ────────────────────────────────────────────────────
        const usageKey = `photosolve:${uid}:${(0, redish_1.todayIST)()}`;
        try {
            const count = await (0, redish_1.getRedis)().incr(usageKey);
            if (count === 1)
                await (0, redish_1.getRedis)().expire(usageKey, (0, redish_1.ttlUntilMidnightIST)());
        }
        catch { /* Redis unavailable */ }
        // Firestore usage write (async, non-blocking)
        db.doc(`photoSolveUsage/${uid}/daily/${(0, redish_1.todayIST)()}`).set({ solvesUsed: admin.firestore.FieldValue.increment(1), lastUsedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(() => { });
        // ── Cache result ───────────────────────────────────────────────────────
        (0, redish_1.getRedis)().set(cacheKey, parsed, { ex: redish_1.TTL.askGuruAnswer }).catch(() => { });
        res.status(200).json(parsed);
    }
    catch (e) {
        console.error("PhotoSolve error:", e);
        res.status(500).json({ error: e?.message ?? "Failed to solve question", code: "AI_ERROR" });
    }
});
//# sourceMappingURL=photoSolve.js.map
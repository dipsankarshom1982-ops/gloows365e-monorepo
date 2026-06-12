"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callGeminiText = callGeminiText;
exports.callGeminiWithImage = callGeminiWithImage;
exports.callGeminiWithAudio = callGeminiWithAudio;
exports.parseJsonFromResponse = parseJsonFromResponse;
const generative_ai_1 = require("@google/generative-ai");
let _genAI = null;
function getGenAI() {
    if (!_genAI) {
        const key = process.env.GEMINI_API_KEY;
        if (!key)
            throw new Error("GEMINI_API_KEY secret not configured");
        _genAI = new generative_ai_1.GoogleGenerativeAI(key);
    }
    return _genAI;
}
async function callGeminiText(prompt) {
    const model = getGenAI().getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    return result.response.text();
}
async function callGeminiWithImage(prompt, imageBase64, imageMimeType) {
    const model = getGenAI().getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent([
        { inlineData: { data: imageBase64, mimeType: imageMimeType } },
        prompt,
    ]);
    return result.response.text();
}
async function callGeminiWithAudio(prompt, audioBase64, mimeType) {
    const model = getGenAI().getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent([
        { inlineData: { data: audioBase64, mimeType: mimeType } },
        prompt,
    ]);
    return result.response.text();
}
function parseJsonFromResponse(raw) {
    // Strip thinking blocks (gemini-2.5-flash may include <thinking>...</thinking>)
    let cleaned = raw.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();
    // Strip markdown code fences
    cleaned = cleaned
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
    // Extract the outermost JSON object as a fallback
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
        cleaned = cleaned.slice(start, end + 1);
    }
    return JSON.parse(cleaned);
}
//# sourceMappingURL=gemini.js.map
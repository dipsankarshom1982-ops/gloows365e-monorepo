"use strict";
// PATH: functions/src/restartEducationAdvisor.ts
// Cloud Function for the Restart My Education AI Advisor.
// Uses Gemini (same as rest of app). Stores/loads chat history in Firestore.
// Called via httpsCallable from the mobile app.
Object.defineProperty(exports, "__esModule", { value: true });
exports.restartEducationAdvisor = void 0;
const admin = require("firebase-admin");
const functionsV1 = require("firebase-functions/v1");
const gemini_1 = require("./gemini");
const db = admin.firestore();
const SYSTEM_PROMPT = `You are a compassionate Education Advisor for the "Restart My Education" programme in India.

Your role is to help adults (18+) who have discontinued their education to find suitable pathways to continue learning.

Speak warmly, encouragingly, and simply. Use short paragraphs. Avoid jargon.

You can guide users about:
- NIOS (National Institute of Open Schooling) for Class 10 and 12
- State Open Schools across India
- IGNOU (Indira Gandhi National Open University) for graduation
- ITI (Industrial Training Institutes) for vocational skills
- Skill India and PMKVY programmes
- Distance learning universities
- Free government schemes for education

Rules:
1. Be empathetic — many users face financial difficulties or shame about not finishing school
2. Give practical, actionable steps
3. Detect the language of the user's message and respond in the SAME language (Hindi, Bengali, Tamil, Telugu, Marathi, or English)
4. Never use the word "failure" negatively — education gaps are common and completely fixable
5. Keep responses concise (under 150 words)
6. End each response with one short encouraging sentence
7. Do NOT use markdown, bullet points with asterisks, or formatting symbols — plain sentences only`;
exports.restartEducationAdvisor = functionsV1
    .runWith({
    timeoutSeconds: 60,
    memory: "256MB",
    secrets: ["GEMINI_API_KEY"],
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const message = (data.message ?? "").trim();
    if (!message) {
        throw new functionsV1.https.HttpsError("invalid-argument", "Message is required");
    }
    // Load existing chat history from Firestore (last 10 messages for context)
    let history = [];
    try {
        const chatSnap = await db.doc(`restartEducationChats/${uid}`).get();
        if (chatSnap.exists) {
            const msgs = (chatSnap.data()?.messages ?? []);
            // Take last 10 messages to keep prompt manageable
            history = msgs.slice(-10).map((m) => ({
                role: m.role,
                content: m.content,
            }));
        }
    }
    catch (e) {
        console.warn("[restartAdvisor] Could not load chat history:", e);
    }
    // Build prompt with conversation history
    const conversationText = history.length > 0
        ? history.map((m) => `${m.role === "user" ? "User" : "Advisor"}: ${m.content}`).join("\n")
        : "";
    const fullPrompt = `${SYSTEM_PROMPT}

${conversationText ? `Previous conversation:\n${conversationText}\n` : ""}
User: ${message}

Advisor:`;
    let reply = "";
    try {
        const raw = await (0, gemini_1.callGeminiText)(fullPrompt);
        // Strip "Advisor:" prefix if Gemini echoes it
        reply = raw.replace(/^Advisor:\s*/i, "").trim();
    }
    catch (e) {
        console.error("[restartAdvisor] Gemini error:", e?.message);
        throw new functionsV1.https.HttpsError("internal", "Could not get a response. Please try again.");
    }
    // Save updated chat to Firestore
    const newUserMsg = { role: "user", content: message, timestamp: Date.now() };
    const newAssistantMsg = { role: "assistant", content: reply, timestamp: Date.now() };
    try {
        const chatRef = db.doc(`restartEducationChats/${uid}`);
        const chatSnap = await chatRef.get();
        const existingMessages = chatSnap.exists
            ? (chatSnap.data()?.messages ?? [])
            : [];
        const updatedMessages = [...existingMessages, newUserMsg, newAssistantMsg];
        const messageCount = Math.floor(updatedMessages.filter((m) => m.role === "user").length);
        await chatRef.set({
            userId: uid,
            messages: updatedMessages,
            messageCount,
            leadCaptured: chatSnap.data()?.leadCaptured ?? false,
            lastActivity: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    catch (e) {
        console.warn("[restartAdvisor] Could not save chat:", e);
        // Non-fatal — still return the reply
    }
    return { reply };
});
//# sourceMappingURL=restartEducationAdvisor.js.map
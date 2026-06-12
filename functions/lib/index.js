"use strict";
// PATH: functions/src/index.ts
/**
 * admin-web/src/main.tsx — OPTIMIZED
 *
 * All 35 pages are now lazy-loaded with React.lazy() + Suspense.
 * Only the current route's code is downloaded on first visit.
 * Subsequent routes load in ~100ms from the Vite chunk cache.
 *
 * Also added vite.config optimization (see vite.config.ts output).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.followUp = exports.generateLesson = exports.onPostCreated = exports.updateSkillboard = exports.getReferralLeaderboard = exports.applyReferral = exports.onContestParticipantWrite = exports.generateContestLesson = exports.removeAdmin = exports.getUserSubscriptionHistory = exports.createCoupon = exports.createComboPlan = exports.createAdmin = exports.approveContent = exports.recordAdEvent = exports.getAds = exports.claimAdReward = exports.aggregateAdAnalytics = exports.aiGuruPaymentSuccess = exports.aiGuruCreateSubscription = exports.aiGuruCheckoutPage = exports.voiceTutorAnswer = exports.generateExam = exports.evaluateExam = exports.photoSolve = exports.restartEducationAdvisor = exports.askAiGuruQuestion = exports.getPersonalizedDashboard = exports.getVCoinBalance = exports.claimVCoinReward = exports.getReelsFeed = exports.getHomeFeed = exports.getLeaderboard = exports.seekhoUpdateRevisionQueue = exports.seekhoOnChapterComplete = exports.seekhoGetDailyStudyPlan = exports.seekhoDailyRevisionReminder = exports.seekhoCreateSubscription = exports.vidyaguruChat = exports.discoverTrending = exports.discoverSearch = void 0;
const admin = require("firebase-admin");
const functionsV1 = require("firebase-functions/v1");
const firestore_1 = require("firebase-functions/v2/firestore");
const gemini_1 = require("./gemini");
const redish_1 = require("./redish");
const usageCheck_1 = require("./usageCheck");
const validateLesson_1 = require("./validateLesson");
admin.initializeApp();
const db = admin.firestore();
// ── Discover AI ────────────────────────────────────────────────────────────
var discover_1 = require("./discover");
Object.defineProperty(exports, "discoverSearch", { enumerable: true, get: function () { return discover_1.discoverSearch; } });
Object.defineProperty(exports, "discoverTrending", { enumerable: true, get: function () { return discover_1.discoverTrending; } });
// ── VidyaGuru AI Teacher ───────────────────────────────────────────────────
var vidyaguru_1 = require("./vidyaguru");
Object.defineProperty(exports, "vidyaguruChat", { enumerable: true, get: function () { return vidyaguru_1.vidyaguruChat; } });
// ── Seekho module ──────────────────────────────────────────────────────────
var seekho_1 = require("./seekho");
Object.defineProperty(exports, "seekhoCreateSubscription", { enumerable: true, get: function () { return seekho_1.seekhoCreateSubscription; } });
Object.defineProperty(exports, "seekhoDailyRevisionReminder", { enumerable: true, get: function () { return seekho_1.seekhoDailyRevisionReminder; } });
Object.defineProperty(exports, "seekhoGetDailyStudyPlan", { enumerable: true, get: function () { return seekho_1.seekhoGetDailyStudyPlan; } });
Object.defineProperty(exports, "seekhoOnChapterComplete", { enumerable: true, get: function () { return seekho_1.seekhoOnChapterComplete; } });
Object.defineProperty(exports, "seekhoUpdateRevisionQueue", { enumerable: true, get: function () { return seekho_1.seekhoUpdateRevisionQueue; } });
// ── Leaderboard ────────────────────────────────────────────────────────────
var leaderboard_1 = require("./leaderboard");
Object.defineProperty(exports, "getLeaderboard", { enumerable: true, get: function () { return leaderboard_1.getLeaderboard; } });
// ── Feed (home + reels) ────────────────────────────────────────────────────
var feed_1 = require("./feed");
Object.defineProperty(exports, "getHomeFeed", { enumerable: true, get: function () { return feed_1.getHomeFeed; } });
Object.defineProperty(exports, "getReelsFeed", { enumerable: true, get: function () { return feed_1.getReelsFeed; } });
// ── VCoins ─────────────────────────────────────────────────────────────────
var vcoins_1 = require("./vcoins");
Object.defineProperty(exports, "claimVCoinReward", { enumerable: true, get: function () { return vcoins_1.claimVCoinReward; } });
Object.defineProperty(exports, "getVCoinBalance", { enumerable: true, get: function () { return vcoins_1.getVCoinBalance; } });
// ── AI Personalized Dashboard ───────────────────────────────────────────────
var personalDashboard_1 = require("./personalDashboard");
Object.defineProperty(exports, "getPersonalizedDashboard", { enumerable: true, get: function () { return personalDashboard_1.getPersonalizedDashboard; } });
// ── Ask AI Guru (Sarvam AI) ─────────────────────────────────────────────────
var askAiGuru_1 = require("./askAiGuru");
Object.defineProperty(exports, "askAiGuruQuestion", { enumerable: true, get: function () { return askAiGuru_1.askAiGuruQuestion; } });
var restartEducationAdvisor_1 = require("./restartEducationAdvisor");
Object.defineProperty(exports, "restartEducationAdvisor", { enumerable: true, get: function () { return restartEducationAdvisor_1.restartEducationAdvisor; } });
// ── PhotoSolve AI ────────────────────────────────────────────────────────────
var photoSolve_1 = require("./photoSolve");
Object.defineProperty(exports, "photoSolve", { enumerable: true, get: function () { return photoSolve_1.photoSolve; } });
// ── Exam Simulator ───────────────────────────────────────────────────────────
var examSimulator_1 = require("./examSimulator");
Object.defineProperty(exports, "evaluateExam", { enumerable: true, get: function () { return examSimulator_1.evaluateExam; } });
Object.defineProperty(exports, "generateExam", { enumerable: true, get: function () { return examSimulator_1.generateExam; } });
// ── Voice Tutor ──────────────────────────────────────────────────────────────
var voiceTutor_1 = require("./voiceTutor");
Object.defineProperty(exports, "voiceTutorAnswer", { enumerable: true, get: function () { return voiceTutor_1.voiceTutorAnswer; } });
// ── AI Guru Subscription (Razorpay) ────────────────────────────────────────────
var aiGuruSubscription_1 = require("./aiGuruSubscription");
Object.defineProperty(exports, "aiGuruCheckoutPage", { enumerable: true, get: function () { return aiGuruSubscription_1.aiGuruCheckoutPage; } });
Object.defineProperty(exports, "aiGuruCreateSubscription", { enumerable: true, get: function () { return aiGuruSubscription_1.aiGuruCreateSubscription; } });
Object.defineProperty(exports, "aiGuruPaymentSuccess", { enumerable: true, get: function () { return aiGuruSubscription_1.aiGuruPaymentSuccess; } });
// ── Unified Ads System ─────────────────────────────────────────────────────────
var ads_1 = require("./ads");
Object.defineProperty(exports, "aggregateAdAnalytics", { enumerable: true, get: function () { return ads_1.aggregateAdAnalytics; } });
Object.defineProperty(exports, "claimAdReward", { enumerable: true, get: function () { return ads_1.claimAdReward; } });
Object.defineProperty(exports, "getAds", { enumerable: true, get: function () { return ads_1.getAds; } });
Object.defineProperty(exports, "recordAdEvent", { enumerable: true, get: function () { return ads_1.recordAdEvent; } });
// ── Admin Management ───────────────────────────────────────────────────────────
var adminManagement_1 = require("./adminManagement");
Object.defineProperty(exports, "approveContent", { enumerable: true, get: function () { return adminManagement_1.approveContent; } });
Object.defineProperty(exports, "createAdmin", { enumerable: true, get: function () { return adminManagement_1.createAdmin; } });
Object.defineProperty(exports, "createComboPlan", { enumerable: true, get: function () { return adminManagement_1.createComboPlan; } });
Object.defineProperty(exports, "createCoupon", { enumerable: true, get: function () { return adminManagement_1.createCoupon; } });
Object.defineProperty(exports, "getUserSubscriptionHistory", { enumerable: true, get: function () { return adminManagement_1.getUserSubscriptionHistory; } });
Object.defineProperty(exports, "removeAdmin", { enumerable: true, get: function () { return adminManagement_1.removeAdmin; } });
// ── Contest Lesson Generation ──────────────────────────────────────────────────
var contestLesson_1 = require("./contestLesson");
Object.defineProperty(exports, "generateContestLesson", { enumerable: true, get: function () { return contestLesson_1.generateContestLesson; } });
// ── VidyaStar Board Aggregation ───────────────────────────────────────────────
var vidyastarBoard_1 = require("./vidyastarBoard");
Object.defineProperty(exports, "onContestParticipantWrite", { enumerable: true, get: function () { return vidyastarBoard_1.onContestParticipantWrite; } });
// ── Referral System ───────────────────────────────────────────────────────────  ← NEW
var referral_1 = require("./referral");
Object.defineProperty(exports, "applyReferral", { enumerable: true, get: function () { return referral_1.applyReferral; } });
Object.defineProperty(exports, "getReferralLeaderboard", { enumerable: true, get: function () { return referral_1.getReferralLeaderboard; } });
// ───────────────────────────────────────────────────────────
// FUNCTION 1: updateSkillboard
// Triggers on any post write — updates skillboard + ranks
// ───────────────────────────────────────────────────────────
exports.updateSkillboard = (0, firestore_1.onDocumentWritten)({ document: "posts/{postId}", secrets: ["REDIS_URL", "REDIS_TOKEN"] }, async (event) => {
    const change = event.data;
    if (!change)
        return null;
    const after = change.after.exists
        ? change.after.data()
        : null;
    // Only process skill battle reels
    if (!after || after.postType !== "reel" || !after.isSkillBattle) {
        return null;
    }
    const userId = after.userId;
    const month = after.month;
    const cls = after.class !== undefined ? String(after.class) : "";
    if (!userId || !month || !cls) {
        console.warn("⚠️ Missing userId, month or class — skipping");
        return null;
    }
    // ── Get location from post ────────────────────────────
    let city = after.location?.city ?? "";
    let district = after.location?.district ?? "";
    let state = after.location?.state ?? "";
    let pincode = after.location?.pincode ?? "";
    // ── Fallback: fetch location from students collection ─
    if (!district || !state || !pincode) {
        try {
            const studentSnap = await db
                .collection("students")
                .doc(userId)
                .get();
            if (studentSnap.exists) {
                const student = studentSnap.data();
                city = city || student.location?.city || "";
                district = district || student.location?.district || "";
                state = state || student.location?.state || "";
                pincode = pincode || student.location?.pincode || "";
                console.log(`📍 Location from students: ${pincode}/${district}/${state}`);
            }
        }
        catch (err) {
            console.error("❌ Failed to fetch student location:", err);
        }
    }
    // ── Aggregate all qualifying posts for this user+month ─
    const postsSnap = await db
        .collection("posts")
        .where("userId", "==", userId)
        .where("month", "==", month)
        .where("postType", "==", "reel")
        .where("isSkillBattle", "==", true)
        .get();
    let totalLikes = 0;
    let totalViews = 0;
    let totalWatchtime = 0;
    let totalShares = 0;
    let totalComments = 0;
    postsSnap.forEach((postDoc) => {
        const p = postDoc.data();
        totalLikes += p.likes ?? 0;
        totalViews += p.views ?? 0;
        totalWatchtime += p.watchTime ?? 0;
        totalShares += p.shares ?? 0;
        totalComments += p.comments ?? 0;
    });
    const totalScore = totalLikes * 5 +
        totalComments * 3 +
        totalShares * 4 +
        totalViews * 1 +
        totalWatchtime * 2;
    console.log(`📊 Score for ${userId}: ${totalScore} | ` +
        `likes=${totalLikes} comments=${totalComments} ` +
        `shares=${totalShares} views=${totalViews} watchtime=${totalWatchtime}`);
    const skillboardId = `${userId}_${cls}_${month}`;
    const skillboardRef = db.collection("skillboard").doc(skillboardId);
    const docData = {
        userId,
        name: after.name ?? "",
        profilePic: after.profilePic ?? "",
        school: after.school ?? "",
        class: cls,
        location: {
            city,
            district,
            state,
            pincode,
            country: "India",
        },
        month,
        totalLikes,
        totalViews,
        totalWatchtime,
        totalShares,
        totalComments,
        totalScore,
        ranks: {
            local: 0,
            district: 0,
            state: 0,
            india: 0,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await skillboardRef.set(docData);
    console.log(`✅ Skillboard doc written: ${skillboardId} | score: ${totalScore}`);
    await Promise.all([
        recalculateRank("india", { class: cls, month }),
        recalculateRank("state", { class: cls, month, "location.state": state }),
        recalculateRank("district", { class: cls, month, "location.district": district }),
        recalculateRank("local", { class: cls, month, "location.pincode": pincode }),
    ]);
    return null;
});
// ───────────────────────────────────────────────────────────
// FUNCTION 2: onPostCreated
// ───────────────────────────────────────────────────────────
exports.onPostCreated = (0, firestore_1.onDocumentWritten)({ document: "posts/{postId}", secrets: ["REDIS_URL", "REDIS_TOKEN"] }, async (event) => {
    const change = event.data;
    if (!change)
        return null;
    const wasCreated = !change.before.exists && change.after.exists;
    if (!wasCreated)
        return null;
    const post = change.after.data();
    if (!post?.battleId || !post?.isSkillBattle)
        return null;
    try {
        await db
            .collection("skillBattles")
            .doc(post.battleId)
            .update({
            participantCount: admin.firestore.FieldValue.increment(1),
        });
        console.log(`✅ participantCount incremented for battle: ${post.battleId}`);
    }
    catch (err) {
        console.error("❌ Failed to increment participantCount:", err);
    }
    const cls = post.class !== undefined ? String(post.class) : "all";
    (0, redish_1.getRedis)().del(redish_1.RK.homeFeed("all"), redish_1.RK.homeFeed(cls), redish_1.RK.reelsFeed("all"), redish_1.RK.reelsFeed(cls)).catch(() => { });
    return null;
});
// ───────────────────────────────────────────────────────────
// HELPER: verifyAuthToken
// ───────────────────────────────────────────────────────────
async function verifyAuthToken(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer "))
        throw new Error("UNAUTHENTICATED");
    const decoded = await admin.auth().verifyIdToken(auth.split("Bearer ")[1]);
    return decoded.uid;
}
function setCorsHeaders(res) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
function buildLessonPromptInline(body) {
    const { board, classLevel, subject, chapter, topic, language, difficulty, lessonStyle, inputText } = body;
    return `You are AI Guru, a friendly Indian AI teacher for school students.\nConvert the content into an interactive self-learning lesson.\nRules: Teach at Class ${classLevel} level, ${board} board. Use ${language}. Style: ${lessonStyle}. Difficulty: ${difficulty}.\nKeep each narration under 120 words. Use Indian examples. Return ONLY valid JSON, no markdown.\n\nBoard: ${board}, Class: ${classLevel}, Subject: ${subject}, Chapter: ${chapter}, Topic: ${topic ?? "Full Chapter"}\n\nStudent Content:\n${inputText || `Create a comprehensive lesson on "${chapter}" for Class ${classLevel} ${subject} (${board}).`}\n\nReturn exactly this JSON (populate ALL fields, minimum 5 scenes, 8 quiz, 8 flashcards, 5 keyConcepts):\n{"lessonTitle":"","shortIntro":"","estimatedDurationMinutes":0,"learningObjectives":[""],"prerequisites":[""],"storyHook":{"title":"","narration":"","studentMission":""},"scenes":[{"sceneNumber":1,"sceneTitle":"","visualType":"animation","visualDescription":"","narration":"","keyConcept":"","example":"","studentAction":"","checkQuestion":{"question":"","options":["","","",""],"correctAnswerIndex":0,"explanation":""}}],"keyConcepts":[{"term":"","simpleMeaning":"","realLifeExample":""}],"practicalActivity":{"title":"","instructions":[""],"expectedOutput":"","aiEvaluationCriteria":[""]},"flashcards":[{"front":"","back":""}],"quickRevisionNotes":[""],"quiz":[{"question":"","options":["","","",""],"correctAnswerIndex":0,"explanation":"","difficulty":"easy","concept":""}],"finalMission":{"title":"","task":"","successCriteria":[""],"rewardText":""},"commonMistakes":[{"mistake":"","correction":""}],"examTips":[""],"followUpPrompts":["Explain this chapter again in simpler way","Give me real-life examples","Take my test","Create revision notes"]}`;
}
exports.generateLesson = functionsV1
    .runWith({ timeoutSeconds: 300, memory: "512MB", secrets: ["GEMINI_API_KEY"] })
    .https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    let uid;
    let lessonId;
    try {
        uid = await verifyAuthToken(req);
    }
    catch {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        await (0, usageCheck_1.checkGenerationLimit)(uid, db);
        const { board, classLevel, subject, chapter, topic = "", language, difficulty, lessonStyle, inputText = "", imageBase64, imageMimeType } = req.body;
        const inputType = imageBase64 ? "image" : inputText.trim() ? "text" : "topic";
        const lessonRef = await db.collection("aiGuruLessons").add({
            uid, board, classLevel, subject, chapter, topic, language,
            difficulty, lessonStyle, inputType,
            inputText: inputType === "text" ? inputText : "",
            status: "generating", aiModel: "gemini-2.5-flash", progress: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        lessonId = lessonRef.id;
        const prompt = buildLessonPromptInline(req.body);
        const rawResponse = imageBase64 && imageMimeType
            ? await (0, gemini_1.callGeminiWithImage)(prompt, imageBase64, imageMimeType)
            : await (0, gemini_1.callGeminiText)(prompt);
        const lessonJson = (0, gemini_1.parseJsonFromResponse)(rawResponse);
        (0, validateLesson_1.validateLessonJson)(lessonJson);
        await lessonRef.update({
            status: "completed", lessonJson, progress: 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await (0, usageCheck_1.incrementGenerationUsage)(uid, db);
        res.status(200).json({ lessonId, lessonJson });
    }
    catch (err) {
        const msg = err?.message ?? "Unknown error";
        console.error("generateLesson error:", msg);
        if (lessonId) {
            await db.doc(`aiGuruLessons/${lessonId}`).update({
                status: "failed", errorMessage: msg,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }).catch(() => { });
        }
        if (msg.startsWith("FREE_LIMIT_REACHED:")) {
            res.status(429).json({ error: msg.replace("FREE_LIMIT_REACHED:", ""), code: "FREE_LIMIT_REACHED" });
        }
        else if (msg.includes("GEMINI_API_KEY")) {
            res.status(500).json({ error: "AI service not configured. Contact support.", code: "CONFIG_ERROR" });
        }
        else if (msg.includes("quota") || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
            res.status(429).json({ error: "AI is busy right now. Please wait a minute and try again.", code: "QUOTA_EXCEEDED" });
        }
        else if (msg.includes("Missing required field") || msg.includes("Expected at least")) {
            res.status(500).json({ error: "AI returned an incomplete lesson. Please try again.", code: "VALIDATION_ERROR" });
        }
        else {
            res.status(500).json({ error: msg });
        }
    }
});
exports.followUp = functionsV1
    .runWith({ timeoutSeconds: 120, memory: "256MB", secrets: ["GEMINI_API_KEY"] })
    .https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    let uid;
    try {
        uid = await verifyAuthToken(req);
    }
    catch {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        await (0, usageCheck_1.checkFollowUpLimit)(uid, db);
        const { lessonId, question, language = "English", mode = "ask_doubt" } = req.body;
        if (!lessonId || !question) {
            res.status(400).json({ error: "lessonId and question required" });
            return;
        }
        const lessonSnap = await db.doc(`aiGuruLessons/${lessonId}`).get();
        if (!lessonSnap.exists || lessonSnap.data()?.uid !== uid) {
            res.status(403).json({ error: "Lesson not found or access denied" });
            return;
        }
        const lesson = lessonSnap.data();
        const modeMap = {
            explain_simple: "Explain in the simplest possible way.",
            real_life_example: "Give 2-3 relatable real-life Indian examples.",
            translate: `Translate the explanation into ${language}.`,
            ask_doubt: "Answer the student's doubt clearly, step by step.",
            generate_more_questions: "Generate 3 new MCQ practice questions on this concept.",
            exam_focus: "Give exam tips and likely exam questions.",
            evaluate_practical: "Evaluate the student's practical activity and give feedback.",
        };
        const prompt = `You are AI Guru helping a Class ${lesson.classLevel} student about "${lesson.chapter}" (${lesson.subject}, ${lesson.board}).\nLanguage: ${language}. ${modeMap[mode] ?? "Answer helpfully."}\nStudent input: ${question}\nReturn ONLY this JSON (no markdown): {"answer":"","example":"","miniQuestion":"","miniQuestionAnswer":"","suggestedNextAction":""}`;
        const raw = await (0, gemini_1.callGeminiText)(prompt);
        const parsed = (0, gemini_1.parseJsonFromResponse)(raw);
        await (0, usageCheck_1.incrementFollowUpUsage)(uid, db);
        res.status(200).json(parsed);
    }
    catch (err) {
        console.error("followUp error:", err.message);
        if (err.message?.startsWith("FREE_LIMIT_REACHED:")) {
            res.status(429).json({ error: err.message.replace("FREE_LIMIT_REACHED:", ""), code: "FREE_LIMIT_REACHED" });
        }
        else {
            res.status(500).json({ error: "Failed to process your question." });
        }
    }
});
// ───────────────────────────────────────────────────────────
// HELPER: recalculateRank
// ───────────────────────────────────────────────────────────
async function recalculateRank(scopeKey, filters) {
    if (scopeKey !== "india") {
        const scopeFieldMap = {
            state: "location.state",
            district: "location.district",
            local: "location.pincode",
        };
        const scopeField = scopeFieldMap[scopeKey];
        const scopeValue = filters[scopeField] ?? "";
        if (!scopeValue) {
            console.warn(`⚠️ Skipping ${scopeKey} rank — scope value is empty`);
            return;
        }
    }
    try {
        let q = db.collection("skillboard");
        for (const [field, value] of Object.entries(filters)) {
            if (value && value.trim() !== "") {
                q = q.where(field, "==", value);
            }
        }
        const snap = await q
            .orderBy("totalScore", "desc")
            .limit(100)
            .get();
        if (snap.empty) {
            console.log(`ℹ️ No docs found for ${scopeKey} rank — skipping batch`);
            return;
        }
        const batch = db.batch();
        snap.docs.forEach((rankDoc, index) => {
            batch.update(rankDoc.ref, {
                [`ranks.${scopeKey}`]: index + 1,
            });
        });
        await batch.commit();
        if (scopeKey === "india") {
            const top50 = snap.docs.slice(0, 50).map((d) => ({ id: d.id, ...d.data() }));
            const cacheKey = redish_1.RK.leaderboard("india", filters.class ?? "", filters.month ?? "");
            (0, redish_1.getRedis)().set(cacheKey, top50, { ex: redish_1.TTL.leaderboard }).catch(() => { });
        }
        console.log(`✅ ${scopeKey} ranks updated for ${snap.size} students ` +
            `(class=${filters.class}, month=${filters.month})`);
    }
    catch (err) {
        console.error(`❌ recalculateRank(${scopeKey}) failed:`, err);
    }
}
//# sourceMappingURL=index.js.map
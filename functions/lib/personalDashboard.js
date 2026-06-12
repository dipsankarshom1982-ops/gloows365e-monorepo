"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPersonalizedDashboard = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const gemini_1 = require("./gemini");
const redish_1 = require("./redish");
const db = admin.firestore();
// ─── Helpers (same pattern as vidyaguru.ts) ───────────────────────────────────
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
// ─── Gemini prompt ────────────────────────────────────────────────────────────
function buildInsightPrompt(studentName, classLevel, board, interests, learnScore, revisionDueCount, language) {
    const interestStr = interests.length > 0 ? interests.slice(0, 3).join(", ") : "academics";
    const langNote = language !== "English"
        ? `Write the tip in ${language}.`
        : "Write the tip in friendly English.";
    return `You are a caring AI study coach for Indian school students.

Student: ${studentName}, Class ${classLevel}, Board: ${board}
Interests: ${interestStr}
LearnScore: ${learnScore}/100
Revision concepts due today: ${revisionDueCount}
${langNote}

Write a SHORT, warm, personalised daily study tip for ${studentName}:
- Exactly 2-3 sentences. No more.
- Reference their class level or board if relevant.
- Mention revision briefly if revisionDue > 0.
- Be encouraging and specific, not generic.
- Plain sentences only — no markdown, no bullets.
- Address them by first name.

Daily tip:`;
}
// ─── Subject emoji helper ─────────────────────────────────────────────────────
const SUBJECT_EMOJI = {
    computer: "💻", science: "🔬", math: "🔢", mathematics: "🔢",
    english: "📖", "social science": "🌍", hindi: "🇮🇳", bengali: "🅱️",
    physics: "⚡", chemistry: "⚗️", biology: "🧬", history: "📜",
    geography: "🗺️", economics: "📊",
};
function subjectEmoji(subject) {
    return SUBJECT_EMOJI[subject.toLowerCase()] ?? "📚";
}
// ─── Cloud Function ───────────────────────────────────────────────────────────
exports.getPersonalizedDashboard = (0, https_1.onRequest)({ timeoutSeconds: 30, memory: "512MiB", secrets: ["GEMINI_API_KEY", "REDIS_URL", "REDIS_TOKEN"] }, async (req, res) => {
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
        const redis = (0, redish_1.getRedis)();
        const cacheKey = redish_1.RK.dashboard(uid);
        // ── Cache hit ────────────────────────────────────────────────────────────
        const cached = await redis.get(cacheKey);
        if (cached) {
            res.json(typeof cached === "string" ? JSON.parse(cached) : cached);
            return;
        }
        // ── Parse request body ────────────────────────────────────────────────────
        const { studentName = "Student", classLevel = "10", board = "CBSE", interests = [], language = "English", learnScore = 0, } = req.body;
        const today = (0, redish_1.todayIST)();
        const now = Date.now();
        // ── Parallel Firestore queries ────────────────────────────────────────────
        const [revisionSnap, activitySnap, progressSnap, lessonsSnap, coursesResult, usageResult] = await Promise.allSettled([
            // 1. Revision queue
            db.collection("seekho_revision_queue")
                .where("userId", "==", uid)
                .get(),
            // 2. Recent vCoin transactions
            db.collection("users").doc(uid).collection("vCoinTransactions")
                .orderBy("createdAt", "desc")
                .limit(5)
                .get(),
            // 3. Seekho progress (incomplete courses)
            db.collection("seekho_progress")
                .where("userId", "==", uid)
                .where("percentComplete", "<", 100)
                .limit(10)
                .get(),
            // 4. Recent AI Guru lessons
            db.collection("aiGuruLessons")
                .where("userId", "==", uid)
                .orderBy("createdAt", "desc")
                .limit(3)
                .get(),
            // 5. Seekho courses (via Redis cache)
            (async () => {
                const cacheK = redish_1.RK.seekhoCourses(Number(classLevel), board);
                const hit = await redis.get(cacheK);
                if (hit)
                    return typeof hit === "string" ? JSON.parse(hit) : hit;
                const snap = await db.collection("seekho_courses")
                    .where("class", "==", Number(classLevel))
                    .where("board", "==", board)
                    .limit(20)
                    .get();
                const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                await redis.set(cacheK, JSON.stringify(docs), { ex: redish_1.TTL.seekhoCourses });
                return docs;
            })(),
            // 6. Usage today (aiGuru + vidyaGuru)
            Promise.allSettled([
                db.collection("aiGuruUsage").doc(uid).collection("daily").doc(today).get(),
                db.collection("vidyaguruUsage").doc(uid).collection("daily").doc(today).get(),
            ]),
        ]);
        // ── Process revision queue ────────────────────────────────────────────────
        let revisionDueCount = 0;
        const revisionItems = [];
        if (revisionSnap.status === "fulfilled") {
            for (const d of revisionSnap.value.docs) {
                const data = d.data();
                const nextReview = data.nextReviewAt?.toMillis?.() ?? 0;
                if (nextReview <= now) {
                    revisionDueCount++;
                    if (revisionItems.length < 3) {
                        revisionItems.push({ conceptTag: data.conceptTag ?? d.id, docId: d.id });
                    }
                }
            }
        }
        // ── Process recent activities ─────────────────────────────────────────────
        const recentActivities = [];
        if (activitySnap.status === "fulfilled") {
            for (const d of activitySnap.value.docs) {
                const data = d.data();
                recentActivities.push({
                    id: d.id,
                    activityId: data.activityId ?? data.type ?? "activity",
                    amount: data.amount ?? 0,
                    type: data.type ?? "CREDIT",
                    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
                });
            }
        }
        // ── Process study plan ────────────────────────────────────────────────────
        const studyPlan = [];
        if (progressSnap.status === "fulfilled" && coursesResult.status === "fulfilled") {
            const courses = {};
            for (const c of coursesResult.value) {
                courses[c.id] = c;
            }
            for (const d of progressSnap.value.docs) {
                if (studyPlan.length >= 3)
                    break;
                const prog = d.data();
                const course = courses[prog.courseId];
                if (!course)
                    continue;
                studyPlan.push({
                    courseId: prog.courseId,
                    subject: course.subject ?? "Study",
                    chapterTitle: prog.lastChapterTitle ?? course.title ?? "Chapter",
                    chapterNumber: prog.lastChapterNumber ?? 1,
                    percentComplete: prog.percentComplete ?? 0,
                });
            }
        }
        // ── Process recent AI lessons ─────────────────────────────────────────────
        const recentLessons = [];
        if (lessonsSnap.status === "fulfilled") {
            for (const d of lessonsSnap.value.docs) {
                const data = d.data();
                recentLessons.push({
                    lessonId: d.id,
                    subject: data.subject ?? "Study",
                    chapter: data.chapter ?? data.chapterName ?? "Lesson",
                    status: data.status ?? "completed",
                    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
                    emoji: subjectEmoji(data.subject ?? ""),
                });
            }
        }
        // ── Process usage stats ───────────────────────────────────────────────────
        let lessonsGenerated = 0;
        let followUps = 0;
        let vidyaGuruChats = 0;
        if (usageResult.status === "fulfilled") {
            const [aiGuruResult, vidyaGuruResult] = usageResult.value;
            if (aiGuruResult.status === "fulfilled" && aiGuruResult.value.exists) {
                const d = aiGuruResult.value.data();
                lessonsGenerated = d.generationsUsed ?? 0;
                followUps = d.followUpsUsed ?? 0;
            }
            if (vidyaGuruResult.status === "fulfilled" && vidyaGuruResult.value.exists) {
                vidyaGuruChats = vidyaGuruResult.value.data()?.questionsUsed ?? 0;
            }
        }
        // ── Generate AI insight ───────────────────────────────────────────────────
        let aiInsight = `Keep learning every day, ${studentName}! Consistency is the key to success.`;
        try {
            const prompt = buildInsightPrompt(studentName, classLevel, board, interests, learnScore, revisionDueCount, language);
            const raw = await (0, gemini_1.callGeminiText)(prompt);
            const cleaned = raw.replace(/^Daily tip:\s*/i, "").trim();
            if (cleaned.length > 10)
                aiInsight = cleaned;
        }
        catch (e) {
            console.warn("[Dashboard] Gemini insight failed (non-fatal):", e?.message);
        }
        // ── Assemble & cache ──────────────────────────────────────────────────────
        const payload = {
            aiInsight,
            revisionDueCount,
            revisionItems,
            recentActivities,
            studyPlan,
            recentLessons,
            usageToday: { lessonsGenerated, followUps, vidyaGuruChats },
        };
        await redis.set(cacheKey, JSON.stringify(payload), { ex: redish_1.TTL.dashboard });
        res.json(payload);
    }
    catch (err) {
        console.error("[Dashboard] error:", err?.message);
        res.status(500).json({ error: "Failed to load dashboard. Please try again." });
    }
});
//# sourceMappingURL=personalDashboard.js.map
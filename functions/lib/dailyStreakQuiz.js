"use strict";
// PATH: functions/src/dailyStreakQuiz.ts
//
// Daily Streak Quiz — server-side answer validation.
//
// Why this can't be client-side: every other quiz-like feature in this app
// (VidyaStar contest quiz) scores answers in the client. That's fine there
// because contest scores only feed a leaderboard. Daily Streak Quiz pays
// out real V-Coins + XP and gates the 52-week Ambassador Program, so the
// correct answer must never reach the client before it submits, and
// "one submission per day" has to be enforced here, not just in the UI.
//
// V-Coins integration: reuses the existing claimVCoinReward activity
// catalogue in vcoins.ts (added "daily_streak_quiz": 5 coins, max 1/day)
// rather than duplicating wallet-credit logic — same Firestore field
// (`users/{uid}.vCoins`, NOT vCoinsBalance) and same vCoinTransactions
// subcollection every other reward path already writes to.
//
// XP integration: increments students/{uid}.LearnFunXP directly — the same
// field hooks/useLearnFun.ts (mobile) reads/writes for every other
// LearnFun activity. There is no Cloud Function for XP elsewhere in this
// project (the mobile client writes it with a plain updateDoc), so this
// mirrors that rather than inventing a new pattern.
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyStreakQuizReminder = exports.applyForAmbassadorProgram = exports.submitDailyStreakQuizAnswer = exports.getTodaysStreakQuizQuestion = void 0;
const admin = require("firebase-admin");
const functionsV1 = require("firebase-functions/v1");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const axios_1 = require("axios");
const redish_1 = require("./redish");
const gemini_1 = require("./gemini");
const db = admin.firestore();
// ─── Config ─────────────────────────────────────────────────────────────────
const XP_REWARD = 10;
const MAX_WEEKLY_PROGRESS = 7;
const AMBASSADOR_WEEKS = 52;
function yesterdayIST() {
    const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
    const istMs = Date.now() + IST_OFFSET_MS - 24 * 60 * 60 * 1000;
    return new Date(istMs).toISOString().slice(0, 10);
}
const EMPTY_PROGRESS = {
    currentStreak: 0,
    weeklyProgress: 0,
    completedWeeks: 0,
    lastCompletedDate: null,
    ambassadorEligible: false,
};
function buildQuestionTranslationPrompt(q, language) {
    return `Translate the following school quiz question, its four multiple-choice
options, and its answer explanation into ${language}, for a Class ${q.class} student
in India. This is a factual quiz — translate meaning accurately, do not change
which option is correct, do not reorder or add/remove options. Keep numbers,
formulas, and proper nouns as-is unless they need natural transliteration.
Return ONLY valid JSON, no markdown, in exactly this shape:
{"question":"","optionA":"","optionB":"","optionC":"","optionD":"","explanation":""}

Question: ${q.question}
A: ${q.optionA}
B: ${q.optionB}
C: ${q.optionC}
D: ${q.optionD}
Explanation: ${q.explanation}`;
}
function isValidTranslatedText(v) {
    if (!v || typeof v !== "object")
        return false;
    const t = v;
    return ["question", "optionA", "optionB", "optionC", "optionD", "explanation"]
        .every((k) => typeof t[k] === "string" && t[k].trim().length > 0);
}
async function getOrTranslateQuestion(questionId, question, language) {
    const translationRef = db.doc(`dailyStreakQuizQuestions/${questionId}/translations/${language}`);
    const claim = await db.runTransaction(async (tx) => {
        const snap = await tx.get(translationRef);
        if (snap.exists) {
            const existing = snap.data();
            if (existing.status === "completed")
                return { outcome: "cached", data: existing };
            if (existing.status === "generating")
                return { outcome: "in-progress" };
            // status === "failed" — fall through and let this call retry it.
        }
        tx.set(translationRef, {
            status: "generating",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return { outcome: "claimed" };
    });
    if (claim.outcome === "cached")
        return claim.data;
    if (claim.outcome === "in-progress") {
        throw new functionsV1.https.HttpsError("already-exists", "This question is being translated — try again in a few seconds");
    }
    try {
        const raw = await (0, gemini_1.callGeminiText)(buildQuestionTranslationPrompt(question, language));
        const translated = (0, gemini_1.parseJsonFromResponse)(raw);
        if (!isValidTranslatedText(translated)) {
            throw new Error("Translation response missing required fields");
        }
        await translationRef.set({
            ...translated,
            status: "completed",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return translated;
    }
    catch (err) {
        console.error(`getOrTranslateQuestion error (question=${questionId} language=${language}):`, err);
        await translationRef.set({
            status: "failed",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }).catch(() => { });
        throw new functionsV1.https.HttpsError("internal", "Failed to translate the question. Please try again.");
    }
}
// ─── getTodaysStreakQuizQuestion ────────────────────────────────────────────
// No params — class, language, and date are all derived server-side from
// the authenticated uid + students/{uid}, never from client input, so a
// student can't request another class's question.
exports.getTodaysStreakQuizQuestion = functionsV1
    .runWith({ timeoutSeconds: 60, memory: "256MB", secrets: ["REDIS_URL", "REDIS_TOKEN", "GEMINI_API_KEY"] })
    .https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const studentSnap = await db.doc(`students/${uid}`).get();
    if (!studentSnap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "Student profile not found");
    }
    const student = studentSnap.data();
    const studentClass = Number(student.class ?? 0);
    const preferredLanguage = student.preferredLanguage ?? "English";
    const today = (0, redish_1.todayIST)();
    // Canonical question is always authored in English by admin — see the
    // translation section above for how non-English students get it.
    const snap = await db
        .collection("dailyStreakQuizQuestions")
        .where("status", "==", "active")
        .where("class", "==", studentClass)
        .where("language", "==", "English")
        .where("publishDate", "==", today)
        .limit(1)
        .get();
    if (snap.empty)
        return null;
    const questionId = snap.docs[0].id;
    const question = snap.docs[0].data();
    const display = preferredLanguage === "English"
        ? {
            question: question.question,
            optionA: question.optionA,
            optionB: question.optionB,
            optionC: question.optionC,
            optionD: question.optionD,
            explanation: question.explanation,
        }
        : await getOrTranslateQuestion(questionId, question, preferredLanguage);
    // Cache which question we resolved for this uid/date so submit can
    // re-validate cheaply without a second composite query — best effort,
    // submit always re-checks Firestore directly regardless.
    try {
        await (0, redish_1.getRedis)().set(redish_1.RK.streakQuizQuestion(uid, today), questionId, { ex: 86400 });
    }
    catch { /* Redis unavailable — non-fatal, submit doesn't depend on this */ }
    const daySnap = await db
        .doc(`studentDailyStreakProgress/${uid}`)
        .collection("days")
        .doc(today)
        .get();
    return {
        questionId,
        date: today,
        subject: question.subject,
        question: display.question,
        optionA: display.optionA,
        optionB: display.optionB,
        optionC: display.optionC,
        optionD: display.optionD,
        alreadySubmitted: daySnap.exists,
    };
});
// ─── submitDailyStreakQuizAnswer ────────────────────────────────────────────
exports.submitDailyStreakQuizAnswer = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "128MB", secrets: ["REDIS_URL", "REDIS_TOKEN"] })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const { questionId, selectedOption } = data;
    if (!questionId || !["A", "B", "C", "D"].includes(selectedOption)) {
        throw new functionsV1.https.HttpsError("invalid-argument", "Missing or invalid params");
    }
    const today = (0, redish_1.todayIST)();
    const yesterday = yesterdayIST();
    // ── Redis fast-path lock (best effort — Firestore transaction below is
    // the real source of truth if Redis is unavailable or this races) ──
    try {
        const lockKey = redish_1.RK.streakQuizSubmitLock(uid, today);
        const locked = await (0, redish_1.getRedis)().setnx(lockKey, 1);
        if (locked === 0) {
            throw new functionsV1.https.HttpsError("already-exists", "Already submitted today");
        }
        await (0, redish_1.getRedis)().expire(lockKey, 86400);
    }
    catch (e) {
        if (e instanceof functionsV1.https.HttpsError && e.code === "already-exists")
            throw e;
        console.warn("dailyStreakQuiz Redis lock check failed — falling through to Firestore check:", e);
    }
    const questionRef = db.collection("dailyStreakQuizQuestions").doc(questionId);
    const progressRef = db.doc(`studentDailyStreakProgress/${uid}`);
    const dayRef = progressRef.collection("days").doc(today);
    const studentRef = db.doc(`students/${uid}`);
    const result = await db.runTransaction(async (tx) => {
        const [questionSnap, progressSnap, daySnap, studentSnap] = await Promise.all([
            tx.get(questionRef),
            tx.get(progressRef),
            tx.get(dayRef),
            tx.get(studentRef),
        ]);
        if (!questionSnap.exists) {
            throw new functionsV1.https.HttpsError("not-found", "Question not found");
        }
        if (daySnap.exists) {
            throw new functionsV1.https.HttpsError("already-exists", "Already submitted today");
        }
        const question = questionSnap.data();
        const student = studentSnap.data() ?? {};
        // The student was shown a translated version already (translation
        // happened during getTodaysStreakQuizQuestion, before they could ever
        // reach submit) — this is a cache read only, never a new generation.
        // Falls back to the canonical English explanation if for some reason
        // it's missing (translation failed, or somehow never ran).
        const preferredLanguage = student.preferredLanguage ?? "English";
        let explanation = question.explanation ?? "";
        if (preferredLanguage !== "English") {
            const translationSnap = await tx.get(db.doc(`dailyStreakQuizQuestions/${questionId}/translations/${preferredLanguage}`));
            if (translationSnap.exists && translationSnap.data()?.status === "completed") {
                explanation = translationSnap.data()?.explanation ?? explanation;
            }
        }
        // Re-validate this is genuinely today's question for this student —
        // never trust the client just because it knows a questionId.
        if (question.status !== "active" ||
            question.publishDate !== today ||
            Number(question.class) !== Number(student.class ?? -1)) {
            throw new functionsV1.https.HttpsError("failed-precondition", "This question is no longer valid for today");
        }
        const isCorrect = selectedOption === question.correctOption;
        const progress = progressSnap.exists
            ? { ...EMPTY_PROGRESS, ...progressSnap.data() }
            : EMPTY_PROGRESS;
        let weeklyProgress = progress.weeklyProgress;
        let completedWeeks = progress.completedWeeks;
        let vCoinsAwarded = 0;
        let xpAwarded = 0;
        if (isCorrect) {
            const continuingStreak = progress.lastCompletedDate === yesterday;
            weeklyProgress = continuingStreak ? weeklyProgress + 1 : 1;
            if (weeklyProgress >= MAX_WEEKLY_PROGRESS) {
                if (completedWeeks < AMBASSADOR_WEEKS)
                    completedWeeks += 1;
                weeklyProgress = 0;
            }
            xpAwarded = XP_REWARD;
            // vCoinsAwarded is reported optimistically here for the response —
            // the actual credit happens via claimVCoinReward below, AFTER this
            // transaction commits (Firestore transactions can't call other
            // Cloud Functions / Redis-gated logic mid-transaction). If that
            // claim is rejected (e.g. Redis lock race), the streak/XP for this
            // answer still stand — a student should never lose streak progress
            // because of a wallet-side hiccup.
            vCoinsAwarded = 5;
            tx.set(studentRef, {
                LearnFunXP: admin.firestore.FieldValue.increment(xpAwarded),
            }, { merge: true });
        }
        const ambassadorEligible = completedWeeks >= AMBASSADOR_WEEKS;
        tx.set(progressRef, {
            currentStreak: weeklyProgress,
            weeklyProgress,
            completedWeeks,
            lastCompletedDate: isCorrect ? today : progress.lastCompletedDate ?? null,
            ambassadorEligible,
        }, { merge: true });
        tx.set(dayRef, {
            date: today,
            questionId,
            selectedOption,
            isCorrect,
            dailyStreak: weeklyProgress,
            weeklyProgress,
            completedWeeks,
            vCoinsEarned: vCoinsAwarded,
            xpEarned: xpAwarded,
            submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {
            isCorrect,
            correctOption: question.correctOption,
            explanation,
            vCoinsAwarded,
            xpAwarded,
            streak: {
                currentStreak: weeklyProgress,
                weeklyProgress,
                completedWeeks,
                lastCompletedDate: isCorrect ? today : progress.lastCompletedDate ?? null,
                ambassadorEligible,
            },
            ambassadorEligible,
        };
    });
    // ── Credit V-Coins via the existing, authoritative reward path ──────
    // Runs after the transaction commits so streak/XP are never blocked
    // by Redis/wallet issues. referenceId = questionId means this can
    // never double-pay even if retried.
    if (result.isCorrect) {
        try {
            await claimDailyStreakQuizVCoins(uid, questionId);
        }
        catch (e) {
            console.warn(`dailyStreakQuiz: V-Coin credit failed for uid=${uid} question=${questionId} — streak/XP already saved:`, e);
        }
    }
    console.log(`${result.isCorrect ? "✅" : "❌"} DailyStreakQuiz: uid=${uid} question=${questionId} ` +
        `correct=${result.isCorrect} streak=${result.streak.weeklyProgress}/${MAX_WEEKLY_PROGRESS} ` +
        `weeks=${result.streak.completedWeeks}`);
    return result;
});
// Mirrors the exact write claimVCoinReward (vcoins.ts) performs for the
// "daily_streak_quiz" activity — done inline here instead of an internal
// httpsCallable-to-httpsCallable call (Cloud Functions can't easily call
// each other as callables; calling the same Firestore + Redis logic
// directly is the standard pattern already used by claimAdReward in
// ads.ts, which writes its own V-Coins batch rather than calling
// claimVCoinReward over the wire).
async function claimDailyStreakQuizVCoins(uid, questionId) {
    const activityId = "daily_streak_quiz";
    const coins = 5;
    const today = (0, redish_1.todayIST)();
    try {
        const lockKey = redish_1.RK.vcoinLock(uid, activityId, `${today}:${questionId}`);
        const locked = await (0, redish_1.getRedis)().setnx(lockKey, 1);
        if (locked === 0)
            return; // already credited for this question today
        await (0, redish_1.getRedis)().expire(lockKey, 86400);
    }
    catch (e) {
        console.warn("dailyStreakQuiz vcoin Redis lock failed — continuing (Firestore tx is source of truth):", e);
    }
    const year = new Date(Date.now() + 5.5 * 60 * 60 * 1000).getUTCFullYear();
    const yearField = `vCoinsYear_${year}`;
    const userRef = db.doc(`users/${uid}`);
    const txRef = userRef.collection("vCoinTransactions").doc();
    const batch = db.batch();
    batch.set(txRef, {
        amount: coins,
        type: "CREDIT",
        status: "SUCCESS",
        activityId,
        referenceId: questionId,
        year,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.set(userRef, {
        vCoins: admin.firestore.FieldValue.increment(coins),
        vCoinsLifetimeEarned: admin.firestore.FieldValue.increment(coins),
        [yearField]: admin.firestore.FieldValue.increment(coins),
    }, { merge: true });
    await batch.commit();
    (0, redish_1.getRedis)().del(redish_1.RK.vcoinBalance(uid)).catch(() => { });
}
// ─── applyForAmbassadorProgram ──────────────────────────────────────────────
exports.applyForAmbassadorProgram = functionsV1
    .runWith({ timeoutSeconds: 15, memory: "128MB" })
    .https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const progressRef = db.doc(`studentDailyStreakProgress/${uid}`);
    const snap = await progressRef.get();
    const completedWeeks = snap.exists ? (snap.data()?.completedWeeks ?? 0) : 0;
    if (completedWeeks < AMBASSADOR_WEEKS) {
        throw new functionsV1.https.HttpsError("failed-precondition", "Complete 52 weekly streaks before applying");
    }
    if (!snap.data()?.ambassadorAppliedAt) {
        await progressRef.set({ ambassadorAppliedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }
    return { success: true };
});
// ─── dailyStreakQuizReminder (scheduled — 6 PM IST) ─────────────────────────
// Mirrors seekhoDailyRevisionReminder's exact pattern in seekho.ts.
//
// NOTE: the collectionGroup("days").where("date", "==", today) query below
// needs a Firestore index — Firestore will throw with a direct console
// link to create it the first time this runs if it's missing. Collection
// group: "days", field: "date", scope: Collection group, order: Ascending
// (or just click the link in the error).
exports.dailyStreakQuizReminder = (0, scheduler_1.onSchedule)({
    schedule: "30 12 * * *", // 12:30 UTC = 18:00 IST
    timeZone: "Asia/Kolkata",
    memory: "256MiB",
}, async (_event) => {
    const today = (0, redish_1.todayIST)();
    // Students who already completed today — one collectionGroup query
    // instead of a per-student read loop (scales with today's submissions,
    // not with total students who have ever played).
    const completedSnap = await db
        .collectionGroup("days")
        .where("date", "==", today)
        .get();
    const completedUids = new Set(completedSnap.docs.map((d) => d.ref.parent.parent?.id).filter((id) => !!id));
    const studentsSnap = await db
        .collection("students")
        .where("pushToken", "!=", null)
        .get();
    const pushBatch = [];
    studentsSnap.docs.forEach((d) => {
        if (completedUids.has(d.id))
            return;
        const pushToken = d.data().pushToken;
        if (!pushToken)
            return;
        pushBatch.push({
            to: pushToken,
            title: "🔥 Your Daily Streak Quiz is waiting!",
            body: "Answer today's question and earn 5 VCoins.",
        });
    });
    console.log(`Sending Daily Streak Quiz reminders to ${pushBatch.length} students`);
    if (pushBatch.length > 0) {
        await sendExpoPushNotificationBatch(pushBatch);
    }
});
// ─── Push helper ─────────────────────────────────────────────────────────────
// Identical to seekho.ts's sendExpoPushNotificationBatch — duplicated
// locally rather than exported/shared from seekho.ts since that file
// doesn't currently export it; consolidate into a shared module if a
// third caller shows up.
async function sendExpoPushNotificationBatch(messages) {
    const CHUNK = 100;
    for (let i = 0; i < messages.length; i += CHUNK) {
        await axios_1.default.post("https://exp.host/--/api/v2/push/send", messages.slice(i, i + CHUNK), {
            headers: { "Content-Type": "application/json" },
        }).catch((e) => console.warn("Daily Streak Quiz push batch failed:", e));
    }
}
//# sourceMappingURL=dailyStreakQuiz.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seekhoDailyRevisionReminder = exports.seekhoGetDailyStudyPlan = exports.seekhoCreateSubscription = exports.seekhoUpdateRevisionQueue = exports.seekhoOnChapterComplete = void 0;
const admin = require("firebase-admin");
const functionsV1 = require("firebase-functions/v1");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const crypto = require("crypto");
const axios_1 = require("axios");
const redish_1 = require("./redish");
const db = admin.firestore();
// ─── 1. onChapterComplete ─────────────────────────────────────────────────────
exports.seekhoOnChapterComplete = functionsV1
    .runWith({ timeoutSeconds: 60, memory: "256MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    const { courseId } = data;
    const userId = context.auth.uid;
    if (!courseId) {
        throw new functionsV1.https.HttpsError("invalid-argument", "courseId required");
    }
    const progressRef = db.doc(`seekho_progress/${userId}_${courseId}`);
    const courseRef = db.doc(`seekho_courses/${courseId}`);
    const [progressSnap, courseSnap] = await Promise.all([
        progressRef.get(),
        courseRef.get(),
    ]);
    if (!courseSnap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "Course not found");
    }
    const course = courseSnap.data();
    if (progressSnap.exists && progressSnap.data()?.chapterCompleted) {
        return { alreadyCompleted: true };
    }
    const batch = db.batch();
    batch.set(progressRef, { chapterCompleted: true }, { merge: true });
    batch.update(db.doc(`students/${userId}`), {
        learnScore: admin.firestore.FieldValue.increment(200),
    });
    batch.set(db.doc(`leaderboard/${userId}`), {
        learnScore: admin.firestore.FieldValue.increment(200),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await batch.commit();
    // Invalidate today's study plan cache for this user
    (0, redish_1.getRedis)().del(redish_1.RK.seekhoPlan(userId, (0, redish_1.todayIST)())).catch(() => { });
    const studentSnap = await db.doc(`students/${userId}`).get();
    const pushToken = studentSnap.data()?.pushToken;
    if (pushToken) {
        sendExpoPushNotification(pushToken, {
            title: "Chapter complete! 🎉",
            body: `You finished "${course.chapterTitle}"! Go compete on VidyaStar 🏆`,
            data: { screen: "seekho", courseId },
        }).catch((e) => console.warn("Push notification failed:", e));
    }
    console.log(`✅ Chapter complete: user=${userId} course=${courseId} +200 XP`);
    return { success: true, xpAwarded: 200 };
});
// ─── 2. updateRevisionQueue (SM-2) ────────────────────────────────────────────
exports.seekhoUpdateRevisionQueue = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "128MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    const userId = context.auth.uid;
    const { results } = data;
    if (!results?.length)
        return { updated: 0 };
    const conceptMap = {};
    for (const r of results) {
        if (!r.correct) {
            if (!conceptMap[r.conceptTag])
                conceptMap[r.conceptTag] = [];
            conceptMap[r.conceptTag].push(r.questionId);
        }
    }
    const batch = db.batch();
    let count = 0;
    for (const [conceptTag, questionIds] of Object.entries(conceptMap)) {
        const docId = `${userId}_${conceptTag.replace(/\s+/g, "_")}`;
        const ref = db.doc(`seekho_revision_queue/${docId}`);
        const snap = await ref.get();
        let easeFactor = 2.5;
        if (snap.exists)
            easeFactor = snap.data().easeFactor;
        const quality = 2;
        const newEaseFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
        const newInterval = 1;
        batch.set(ref, {
            userId,
            conceptTag,
            questionIds: [...new Set([...(snap.data()?.questionIds ?? []), ...questionIds])],
            nextReviewAt: admin.firestore.Timestamp.fromMillis(Date.now() + newInterval * 86400000),
            interval: newInterval,
            easeFactor: newEaseFactor,
        }, { merge: true });
        count++;
    }
    for (const r of results) {
        if (r.correct) {
            const docId = `${userId}_${r.conceptTag.replace(/\s+/g, "_")}`;
            const ref = db.doc(`seekho_revision_queue/${docId}`);
            const snap = await ref.get();
            if (!snap.exists)
                continue;
            const existing = snap.data();
            const quality = r.responseTimeMs < 5000 ? 5 : r.responseTimeMs < 10000 ? 4 : 3;
            const newEF = Math.max(1.3, existing.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
            const newInterval = existing.interval === 0 ? 1
                : existing.interval === 1 ? 6
                    : Math.round(existing.interval * newEF);
            batch.update(ref, {
                interval: newInterval,
                easeFactor: newEF,
                nextReviewAt: admin.firestore.Timestamp.fromMillis(Date.now() + newInterval * 86400000),
            });
        }
    }
    await batch.commit();
    return { updated: count };
});
exports.seekhoCreateSubscription = functionsV1
    .runWith({
    timeoutSeconds: 60,
    memory: "128MB",
    secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
})
    .https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    const userId = context.auth.uid;
    const keyId = process.env["RAZORPAY_KEY_ID"] ?? "";
    const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? "";
    // ── Phase 2: Verify payment ───────────────────────────────────────────────
    if ("razorpayPaymentId" in data) {
        const { razorpayPaymentId, razorpayOrderId, razorpaySignature, plan, selectedClass } = data;
        const expectedSig = crypto
            .createHmac("sha256", keySecret)
            .update(`${razorpayOrderId}|${razorpayPaymentId}`)
            .digest("hex");
        if (expectedSig !== razorpaySignature) {
            throw new functionsV1.https.HttpsError("permission-denied", "Payment verification failed");
        }
        const classAccess = plan === "pro"
            ? [6, 7, 8, 9, 10, 11, 12]
            : selectedClass ? [selectedClass] : [];
        const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 24 * 3600 * 1000);
        await db.doc(`seekho_subscriptions/${userId}`).set({
            userId, plan, classAccess, expiresAt,
            razorpayPaymentId,
            razorpayOrderId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        (0, redish_1.getRedis)().del(redish_1.RK.seekhoSub(userId)).catch(() => { });
        console.log(`✅ Seekho subscription verified: user=${userId} plan=${plan}`);
        return { success: true, plan, classAccess };
    }
    // ── Phase 1: Create Razorpay order ───────────────────────────────────────
    const { amountPaise, plan, selectedClass, billingCycle = "monthly" } = data;
    if (!keyId || !keySecret) {
        throw new functionsV1.https.HttpsError("failed-precondition", "Razorpay keys not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET secrets.");
    }
    try {
        const response = await axios_1.default.post("https://api.razorpay.com/v1/orders", {
            amount: amountPaise,
            currency: "INR",
            receipt: `seekho_${plan}_${userId}_${Date.now()}`,
            notes: { plan, selectedClass: selectedClass ?? "all", billingCycle, userId },
        }, {
            auth: { username: keyId, password: keySecret },
            timeout: 10000,
        });
        const razorpayOrderId = response.data.id;
        console.log(`✅ Seekho Razorpay order created: ${razorpayOrderId} plan=${plan}`);
        return { razorpayOrderId };
    }
    catch (err) {
        console.error("Razorpay order creation failed:", err?.response?.data ?? err?.message);
        throw new functionsV1.https.HttpsError("internal", "Failed to create payment order");
    }
});
// ─── 4. getDailyStudyPlan ─────────────────────────────────────────────────────
exports.seekhoGetDailyStudyPlan = functionsV1
    .runWith({ timeoutSeconds: 30, memory: "128MB" })
    .https.onCall(async (_data, context) => {
    if (!context.auth)
        throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    const userId = context.auth.uid;
    const today = (0, redish_1.todayIST)();
    const cacheKey = redish_1.RK.seekhoPlan(userId, today);
    // ── Cache hit ──────────────────────────────────────────
    try {
        const cached = await (0, redish_1.getRedis)().get(cacheKey);
        if (cached)
            return cached;
    }
    catch { /* Redis unavailable */ }
    // ── Firestore queries ──────────────────────────────────
    const studentSnap = await db.doc(`students/${userId}`).get();
    const student = studentSnap.data() ?? {};
    const studentClass = Number(student.class) || 10;
    const studentBoard = student.board ?? "CBSE";
    // Check cached courses list
    const coursesKey = redish_1.RK.seekhoCourses(studentClass, studentBoard);
    let courseDocs = [];
    try {
        const cachedCourses = await (0, redish_1.getRedis)().get(coursesKey);
        if (cachedCourses) {
            courseDocs = cachedCourses;
        }
        else {
            const snap = await db
                .collection("seekho_courses")
                .where("class", "==", studentClass)
                .where("board", "==", studentBoard)
                .orderBy("chapterNumber")
                .get();
            courseDocs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
            (0, redish_1.getRedis)().set(coursesKey, courseDocs, { ex: redish_1.TTL.seekhoCourses }).catch(() => { });
        }
    }
    catch {
        const snap = await db
            .collection("seekho_courses")
            .where("class", "==", studentClass)
            .where("board", "==", studentBoard)
            .orderBy("chapterNumber")
            .get();
        courseDocs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    }
    const progressSnap = await db
        .collection("seekho_progress")
        .where("userId", "==", userId)
        .get();
    const progressMap = {};
    progressSnap.docs.forEach((d) => { progressMap[d.data().courseId] = d.data(); });
    const plan = [];
    for (const { id, data: course } of courseDocs) {
        const progress = progressMap[id];
        if (progress?.chapterCompleted)
            continue;
        plan.push({
            courseId: id,
            subject: course.subject,
            chapterTitle: course.chapterTitle,
            chapterNumber: course.chapterNumber,
            percentComplete: progress?.percentComplete ?? 0,
        });
    }
    const revisionSnap = await db
        .collection("seekho_revision_queue")
        .where("userId", "==", userId)
        .get();
    const dueRevisions = revisionSnap.docs
        .filter((d) => d.data().nextReviewAt?.toMillis() <= Date.now())
        .map((d) => ({ docId: d.id, conceptTag: d.data().conceptTag }));
    const response = {
        courses: plan.slice(0, 5),
        revisionsDue: dueRevisions.length,
        revisionItems: dueRevisions,
    };
    // ── Cache result ───────────────────────────────────────
    (0, redish_1.getRedis)().set(cacheKey, response, { ex: redish_1.TTL.seekhoPlan }).catch(() => { });
    return response;
});
// ─── 5. dailyRevisionReminder (scheduled — 6 PM IST) ─────────────────────────
exports.seekhoDailyRevisionReminder = (0, scheduler_1.onSchedule)({
    schedule: "30 12 * * *",
    timeZone: "Asia/Kolkata",
    memory: "256MiB",
}, async (_event) => {
    const now = admin.firestore.Timestamp.now();
    const snap = await db
        .collection("seekho_revision_queue")
        .where("nextReviewAt", "<=", now)
        .get();
    const userMap = {};
    snap.docs.forEach((d) => {
        const uid = d.data().userId;
        userMap[uid] = (userMap[uid] ?? 0) + 1;
    });
    const userIds = Object.keys(userMap);
    console.log(`Sending revision reminders to ${userIds.length} users`);
    const pushBatch = [];
    for (const uid of userIds) {
        const studentSnap = await db.doc(`students/${uid}`).get();
        const pushToken = studentSnap.data()?.pushToken;
        if (pushToken) {
            pushBatch.push({
                to: pushToken,
                title: "Time to revise! 📚",
                body: `You have ${userMap[uid]} concept${userMap[uid] === 1 ? "" : "s"} due for revision today.`,
            });
        }
    }
    if (pushBatch.length > 0) {
        await sendExpoPushNotificationBatch(pushBatch);
    }
});
// ─── Push helpers ─────────────────────────────────────────────────────────────
async function sendExpoPushNotification(pushToken, payload) {
    await axios_1.default.post("https://exp.host/--/api/v2/push/send", { to: pushToken, title: payload.title, body: payload.body, data: payload.data ?? {}, sound: "default" }, { headers: { "Content-Type": "application/json" } });
}
async function sendExpoPushNotificationBatch(messages) {
    const CHUNK = 100;
    for (let i = 0; i < messages.length; i += CHUNK) {
        await axios_1.default.post("https://exp.host/--/api/v2/push/send", messages.slice(i, i + CHUNK), {
            headers: { "Content-Type": "application/json" },
        }).catch((e) => console.warn("Push batch failed:", e));
    }
}
//# sourceMappingURL=seekho.js.map
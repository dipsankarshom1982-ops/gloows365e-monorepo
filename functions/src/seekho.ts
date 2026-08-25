import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as crypto from "crypto";
import axios from "axios";
import { getRedis, todayIST, TTL, RK } from "./redish";

const db = admin.firestore();


// ─── Types ────────────────────────────────────────────────────────────────────

interface PracticeResult {
  courseId: string;
  questionId: string;
  conceptTag: string;
  correct: boolean;
  responseTimeMs: number;
}

interface RevisionQueueDoc {
  userId: string;
  conceptTag: string;
  questionIds: string[];
  nextReviewAt: admin.firestore.Timestamp;
  interval: number;
  easeFactor: number;
}

// ─── 1. onChapterComplete ─────────────────────────────────────────────────────

export const seekhoOnChapterComplete = functionsV1
  .runWith({ timeoutSeconds: 60, memory: "256MB" })
  .https.onCall(async (data: { courseId: string }, context) => {
    if (!context.auth) throw new functionsV1.https.HttpsError("unauthenticated", "Login required");

    const { courseId } = data;
    const userId = context.auth.uid;

    if (!courseId) {
      throw new functionsV1.https.HttpsError("invalid-argument", "courseId required");
    }

    const progressRef = db.doc(`seekho_progress/${userId}_${courseId}`);
    const courseRef   = db.doc(`seekho_courses/${courseId}`);

    const [progressSnap, courseSnap] = await Promise.all([
      progressRef.get(),
      courseRef.get(),
    ]);

    if (!courseSnap.exists) {
      throw new functionsV1.https.HttpsError("not-found", "Course not found");
    }

    const course = courseSnap.data()!;

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
      updatedAt:  admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    await batch.commit();

    // Invalidate today's study plan cache for this user
    getRedis().del(RK.seekhoPlan(userId, todayIST())).catch(() => {});

    const studentSnap = await db.doc(`students/${userId}`).get();
    const pushToken: string | undefined = studentSnap.data()?.pushToken;
    if (pushToken) {
      sendExpoPushNotification(pushToken, {
        title: "Chapter complete! 🎉",
        body:  `You finished "${course.chapterTitle}"! Go compete on VidyaStar 🏆`,
        data:  { screen: "seekho", courseId },
      }).catch((e) => console.warn("Push notification failed:", e));
    }

    console.log(`✅ Chapter complete: user=${userId} course=${courseId} +200 XP`);
    return { success: true, xpAwarded: 200 };
  });

// ─── 2. updateRevisionQueue (SM-2) ────────────────────────────────────────────

export const seekhoUpdateRevisionQueue = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "128MB" })
  .https.onCall(async (data: { results: PracticeResult[] }, context) => {
    if (!context.auth) throw new functionsV1.https.HttpsError("unauthenticated", "Login required");

    const userId = context.auth.uid;
    const { results } = data;

    if (!results?.length) return { updated: 0 };

    const conceptMap: Record<string, string[]> = {};
    for (const r of results) {
      if (!r.correct) {
        if (!conceptMap[r.conceptTag]) conceptMap[r.conceptTag] = [];
        conceptMap[r.conceptTag].push(r.questionId);
      }
    }

    const batch = db.batch();
    let count = 0;

    for (const [conceptTag, questionIds] of Object.entries(conceptMap)) {
      const docId = `${userId}_${conceptTag.replace(/\s+/g, "_")}`;
      const ref   = db.doc(`seekho_revision_queue/${docId}`);
      const snap  = await ref.get();

      let easeFactor = 2.5;
      if (snap.exists) easeFactor = (snap.data() as RevisionQueueDoc).easeFactor;

      const quality      = 2;
      const newEaseFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
      const newInterval  = 1;

      batch.set(ref, {
        userId,
        conceptTag,
        questionIds: [...new Set([...(snap.data()?.questionIds ?? []), ...questionIds])],
        nextReviewAt: admin.firestore.Timestamp.fromMillis(Date.now() + newInterval * 86_400_000),
        interval: newInterval,
        easeFactor: newEaseFactor,
      } satisfies Partial<RevisionQueueDoc>, { merge: true });
      count++;
    }

    for (const r of results) {
      if (r.correct) {
        const docId = `${userId}_${r.conceptTag.replace(/\s+/g, "_")}`;
        const ref   = db.doc(`seekho_revision_queue/${docId}`);
        const snap  = await ref.get();
        if (!snap.exists) continue;

        const existing = snap.data() as RevisionQueueDoc;
        const quality  = r.responseTimeMs < 5000 ? 5 : r.responseTimeMs < 10000 ? 4 : 3;
        const newEF    = Math.max(1.3, existing.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
        const newInterval =
          existing.interval === 0 ? 1
          : existing.interval === 1 ? 6
          : Math.round(existing.interval * newEF);

        batch.update(ref, {
          interval:     newInterval,
          easeFactor:   newEF,
          nextReviewAt: admin.firestore.Timestamp.fromMillis(Date.now() + newInterval * 86_400_000),
        });
      }
    }

    await batch.commit();
    return { updated: count };
  });

// ─── 3. seekhoCreateSubscription ─────────────────────────────────────────────
// Two-phase callable:
//   Phase 1 — no razorpayPaymentId → creates Razorpay order, returns razorpayOrderId
//   Phase 2 — has razorpayPaymentId → verifies HMAC + writes subscription to Firestore
//
// Price/plan trust model: mirrors aiGuruSubscription.ts's
// aiGuruSubscriptionOrders fix. Phase 1 resolves the real price
// server-side (SEEKHO_PLAN_PRICES below, not the client's amountPaise) and
// writes it to seekho_subscription_orders/{orderId}; Phase 2 reads
// plan/selectedClass/billingCycle back from THAT doc, never from its own
// request payload. Previously Phase 1 charged whatever amountPaise the
// client sent with no check against plan/cycle, and Phase 2 independently
// trusted whatever plan/selectedClass the client asserted in a completely
// separate call — so a genuine low-value payment's valid signature could
// be replayed here with plan: "pro" to grant full class 6-12 access
// regardless of what was actually paid.
const SEEKHO_PLAN_PRICES: Record<"plus" | "pro", { monthly: number; annual: number }> = {
  // Rupees, matching apps/mobile/lib/seekho/constants.ts's PLAN_CONFIG —
  // no Firestore-backed plan config exists for Seekho yet (unlike AI
  // Guru's subscriptionPlans collection), so this is the trusted source
  // until/unless that gets unified. Keep in sync with PLAN_CONFIG if
  // prices ever change there.
  plus: { monthly: 149, annual: 999 },
  pro:  { monthly: 299, annual: 1999 },
};

function resolveSeekhoPlanPrice(plan: "plus" | "pro", billingCycle: "monthly" | "annual"): number {
  const prices = SEEKHO_PLAN_PRICES[plan];
  if (!prices) {
    throw new functionsV1.https.HttpsError("invalid-argument", "Unknown plan");
  }
  const priceRupees = billingCycle === "annual" ? prices.annual : prices.monthly;
  return Math.round(priceRupees * 100);
}

type SeekhoOrderRequest = {
  plan: "plus" | "pro";
  selectedClass?: number;
  billingCycle?: "monthly" | "annual";
};

type SeekhoVerifyRequest = {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
};

export const seekhoCreateSubscription = functionsV1
  .runWith({
    timeoutSeconds: 60,
    memory: "128MB",
    secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
  })
  .https.onCall(async (
    data: SeekhoOrderRequest | SeekhoVerifyRequest,
    context
  ) => {
    if (!context.auth) throw new functionsV1.https.HttpsError("unauthenticated", "Login required");

    const userId    = context.auth.uid;
    const keyId     = process.env["RAZORPAY_KEY_ID"]     ?? "";
    const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? "";

    // ── Phase 2: Verify payment ───────────────────────────────────────────────
    if ("razorpayPaymentId" in data) {
      const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = data;

      const expectedSig = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      if (expectedSig !== razorpaySignature) {
        throw new functionsV1.https.HttpsError("permission-denied", "Payment verification failed");
      }

      const orderRef = db.doc(`seekho_subscription_orders/${razorpayOrderId}`);
      const result = await db.runTransaction(async (tx) => {
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists) {
          throw new functionsV1.https.HttpsError("not-found", "Order not found");
        }
        const order = orderSnap.data()!;
        if (order.userId !== userId) {
          throw new functionsV1.https.HttpsError("permission-denied", "This order doesn't belong to you");
        }

        const classAccess: number[] =
          order.plan === "pro"
            ? [6, 7, 8, 9, 10, 11, 12]
            : order.selectedClass ? [order.selectedClass] : [];

        if (order.status === "paid") {
          return { alreadyActivated: true as const, plan: order.plan, classAccess };
        }

        const now = admin.firestore.FieldValue.serverTimestamp();
        const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 24 * 3600 * 1000);

        tx.set(db.doc(`seekho_subscriptions/${userId}`), {
          userId, plan: order.plan, classAccess, expiresAt,
          razorpayPaymentId,
          razorpayOrderId,
          createdAt: now,
          updatedAt: now,
        });
        tx.update(orderRef, { status: "paid", razorpayPaymentId, paidAt: now });

        return { alreadyActivated: false as const, plan: order.plan, classAccess };
      });

      getRedis().del(RK.seekhoSub(userId)).catch(() => {});
      console.log(`✅ Seekho subscription verified: user=${userId} plan=${result.plan}`);
      return { success: true, plan: result.plan, classAccess: result.classAccess };
    }

    // ── Phase 1: Create Razorpay order ───────────────────────────────────────
    // Price is resolved server-side from SEEKHO_PLAN_PRICES — the client
    // only says WHICH plan/cycle it wants, never what it costs.
    const { plan, selectedClass, billingCycle = "monthly" } = data;

    if (!plan || (plan !== "plus" && plan !== "pro")) {
      throw new functionsV1.https.HttpsError("invalid-argument", 'plan must be "plus" or "pro"');
    }
    if (!keyId || !keySecret) {
      throw new functionsV1.https.HttpsError(
        "failed-precondition",
        "Razorpay keys not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET secrets."
      );
    }

    const amountPaise = resolveSeekhoPlanPrice(plan, billingCycle);

    try {
      const response = await axios.post(
        "https://api.razorpay.com/v1/orders",
        {
          amount:   amountPaise,
          currency: "INR",
          receipt:  `seekho_${plan}_${userId}_${Date.now()}`,
          notes:    { plan, selectedClass: selectedClass ?? "all", billingCycle, userId },
        },
        {
          auth:    { username: keyId, password: keySecret },
          timeout: 10_000,
        }
      );

      const razorpayOrderId: string = response.data.id;

      // Written from the resolved plan price, not from anything the
      // client sent — this is what Phase 2 trusts from here on.
      await db.doc(`seekho_subscription_orders/${razorpayOrderId}`).set({
        userId, plan, selectedClass: selectedClass ?? null, billingCycle,
        amountPaise,
        status:    "created",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Seekho Razorpay order created: ${razorpayOrderId} plan=${plan} cycle=${billingCycle} amountPaise=${amountPaise}`);
      return { razorpayOrderId };
    } catch (err: any) {
      console.error("Razorpay order creation failed:", err?.response?.data ?? err?.message);
      throw new functionsV1.https.HttpsError("internal", "Failed to create payment order");
    }
  });

// ─── 4. getDailyStudyPlan ─────────────────────────────────────────────────────

export const seekhoGetDailyStudyPlan = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "128MB" })
  .https.onCall(async (_data, context) => {
    if (!context.auth) throw new functionsV1.https.HttpsError("unauthenticated", "Login required");

    const userId   = context.auth.uid;
    const today    = todayIST();
    const cacheKey = RK.seekhoPlan(userId, today);

    // ── Cache hit ──────────────────────────────────────────
    try {
      const cached = await getRedis().get(cacheKey);
      if (cached) return cached;
    } catch { /* Redis unavailable */ }

    // ── Firestore queries ──────────────────────────────────
    const studentSnap = await db.doc(`students/${userId}`).get();
    const student     = studentSnap.data() ?? {};
    const studentClass: number = Number(student.class) || 10;
    const studentBoard: string = student.board ?? "CBSE";

    // Check cached courses list
    const coursesKey = RK.seekhoCourses(studentClass, studentBoard);
    let courseDocs: Array<{ id: string; data: admin.firestore.DocumentData }> = [];

    try {
      const cachedCourses = await getRedis().get<typeof courseDocs>(coursesKey);
      if (cachedCourses) {
        courseDocs = cachedCourses;
      } else {
        const snap = await db
          .collection("seekho_courses")
          .where("class", "==", studentClass)
          .where("board", "==", studentBoard)
          .orderBy("chapterNumber")
          .get();
        courseDocs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
        getRedis().set(coursesKey, courseDocs, { ex: TTL.seekhoCourses }).catch(() => {});
      }
    } catch {
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

    const progressMap: Record<string, admin.firestore.DocumentData> = {};
    progressSnap.docs.forEach((d) => { progressMap[d.data().courseId] = d.data(); });

    const plan: Array<{
      courseId: string; subject: string; chapterTitle: string;
      chapterNumber: number; percentComplete: number;
    }> = [];

    for (const { id, data: course } of courseDocs) {
      const progress = progressMap[id];
      if (progress?.chapterCompleted) continue;
      plan.push({
        courseId: id,
        subject:         course.subject,
        chapterTitle:    course.chapterTitle,
        chapterNumber:   course.chapterNumber,
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
      courses:       plan.slice(0, 5),
      revisionsDue:  dueRevisions.length,
      revisionItems: dueRevisions,
    };

    // ── Cache result ───────────────────────────────────────
    getRedis().set(cacheKey, response, { ex: TTL.seekhoPlan }).catch(() => {});

    return response;
  });

// ─── 5. dailyRevisionReminder (scheduled — 6 PM IST) ─────────────────────────

export const seekhoDailyRevisionReminder = onSchedule(
  {
    schedule:  "30 12 * * *",
    timeZone:  "Asia/Kolkata",
    memory:    "256MiB",
  },
  async (_event) => {
    const now = admin.firestore.Timestamp.now();

    const snap = await db
      .collection("seekho_revision_queue")
      .where("nextReviewAt", "<=", now)
      .get();

    const userMap: Record<string, number> = {};
    snap.docs.forEach((d) => {
      const uid: string = d.data().userId;
      userMap[uid] = (userMap[uid] ?? 0) + 1;
    });

    const userIds = Object.keys(userMap);
    console.log(`Sending revision reminders to ${userIds.length} users`);

    const pushBatch: Array<{ to: string; title: string; body: string }> = [];

    for (const uid of userIds) {
      const studentSnap = await db.doc(`students/${uid}`).get();
      const pushToken: string | undefined = studentSnap.data()?.pushToken;
      if (pushToken) {
        pushBatch.push({
          to:    pushToken,
          title: "Time to revise! 📚",
          body:  `You have ${userMap[uid]} concept${userMap[uid] === 1 ? "" : "s"} due for revision today.`,
        });
      }
    }

    if (pushBatch.length > 0) {
      await sendExpoPushNotificationBatch(pushBatch);
    }
  }
);

// ─── Push helpers ─────────────────────────────────────────────────────────────

async function sendExpoPushNotification(
  pushToken: string,
  payload: { title: string; body: string; data?: Record<string, unknown> }
): Promise<void> {
  await axios.post(
    "https://exp.host/--/api/v2/push/send",
    { to: pushToken, title: payload.title, body: payload.body, data: payload.data ?? {}, sound: "default" },
    { headers: { "Content-Type": "application/json" } }
  );
}

async function sendExpoPushNotificationBatch(
  messages: Array<{ to: string; title: string; body: string }>
): Promise<void> {
  const CHUNK = 100;
  for (let i = 0; i < messages.length; i += CHUNK) {
    await axios.post("https://exp.host/--/api/v2/push/send", messages.slice(i, i + CHUNK), {
      headers: { "Content-Type": "application/json" },
    }).catch((e) => console.warn("Push batch failed:", e));
  }
}

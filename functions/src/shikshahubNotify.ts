// PATH: functions/src/shikshahubNotify.ts
// ShikshaHub notifications phase — small helper used by instantHelp.ts,
// tutorPayouts.ts, and tutorReviews.ts to notify a student or tutor about
// a ShikshaHub event.
//
// In-app: writes notifications/{uid}/items/{autoId} — the EXACT schema
// apps/mobile's app/notifications.tsx already reads (title, body, type,
// read, createdAt) and firestore.rules already scopes to
// `request.auth.uid == userId` for both the parent doc and the items
// subcollection, so no rules change was needed for either side to read
// its own inbox.
//
// Push: reuses students/{uid}.pushToken (student) and, on the tutor side,
// TWO independent token fields for two unrelated mechanisms —
// tutors/{uid}.pushToken (apps/tutor-mobile's Expo token, tutor push
// notifications phase) sent via the exact same Expo push-send pattern
// dailyStreakQuiz.ts/seekho.ts already use
// (https://exp.host/--/api/v2/push/send — duplicated locally there too,
// "consolidate into a shared module if a third caller shows up" per its
// own comment, so this keeps that convention rather than refactoring two
// already-working functions to import from here), and
// tutors/{uid}.webPushToken (apps/tutor's browser Web Push token, Web
// push notifications phase) sent via the Admin SDK's
// admin.messaging().send() — no separate server key needed, unlike Expo.
// Both can be present at once (a tutor may use the mobile app AND the
// web dashboard) and are attempted independently.
//
// Both notify functions are best-effort: a notification failure must
// never fail the ShikshaHub action that triggered it (a session ending,
// a payout being marked paid, etc.), so callers fire-and-log rather than
// let a thrown error here propagate.

import * as admin from "firebase-admin";
import axios from "axios";

const db = admin.firestore();

export type ShikshaHubNotificationType =
  | "instant_help" | "payout" | "review" | "shikshahub"
  // Tutor Profile Completion & Verification Dashboard — profile
  // submitted/verified/rejected events. Kept in sync with the client-side
  // copy of this union in packages/shared-logic/src/types/notification.ts
  // (server code doesn't import that package — see this file's own header
  // on why token/push logic is duplicated rather than shared).
  | "tutor_verification";

export type ShikshaHubNotification = {
  title: string;
  body: string;
  type: ShikshaHubNotificationType;
};

async function writeInAppNotification(uid: string, notif: ShikshaHubNotification): Promise<void> {
  await db.collection("notifications").doc(uid).collection("items").add({
    title: notif.title,
    body: notif.body,
    type: notif.type,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function sendExpoPushBatch(messages: Array<{ to: string; title: string; body: string }>): Promise<void> {
  if (messages.length === 0) return;
  await axios.post("https://exp.host/--/api/v2/push/send", messages, {
    headers: { "Content-Type": "application/json" },
  }).catch((e) => console.warn("shikshahubNotify: push send failed:", e?.message ?? e));
}

/** Student-facing: in-app notification + best-effort push. */
export async function notifyStudent(uid: string, notif: ShikshaHubNotification): Promise<void> {
  try {
    await writeInAppNotification(uid, notif);
  } catch (e) {
    console.warn(`shikshahubNotify: in-app write failed for student ${uid}:`, e);
  }
  try {
    const snap = await db.doc(`students/${uid}`).get();
    const pushToken = snap.exists ? (snap.data()?.pushToken as string | undefined) : undefined;
    if (pushToken) {
      await sendExpoPushBatch([{ to: pushToken, title: notif.title, body: notif.body }]);
    }
  } catch (e) {
    console.warn(`shikshahubNotify: push send failed for student ${uid}:`, e);
  }
}

/** Tutor-facing: in-app notification + best-effort push. Two push
 *  mechanisms can coexist independently — apps/tutor-mobile's Expo token
 *  (pushToken) and apps/tutor's web push token (webPushToken, Web push
 *  notifications phase) — since they're unrelated token formats sent
 *  through unrelated APIs. Neither ever blocks the other or the in-app
 *  write above; each is its own best-effort attempt. */
export async function notifyTutor(uid: string, notif: ShikshaHubNotification): Promise<void> {
  try {
    await writeInAppNotification(uid, notif);
  } catch (e) {
    console.warn(`shikshahubNotify: in-app write failed for tutor ${uid}:`, e);
  }
  try {
    const snap = await db.doc(`tutors/${uid}`).get();
    const data = snap.exists ? snap.data() : undefined;
    const pushToken = data?.pushToken as string | undefined;
    const webPushToken = data?.webPushToken as string | undefined;
    if (pushToken) {
      await sendExpoPushBatch([{ to: pushToken, title: notif.title, body: notif.body }]);
    }
    if (webPushToken) {
      await admin.messaging().send({
        token: webPushToken,
        notification: { title: notif.title, body: notif.body },
      }).catch((e) => console.warn(`shikshahubNotify: web push send failed for tutor ${uid}:`, e?.message ?? e));
    }
  } catch (e) {
    console.warn(`shikshahubNotify: push send failed for tutor ${uid}:`, e);
  }
}

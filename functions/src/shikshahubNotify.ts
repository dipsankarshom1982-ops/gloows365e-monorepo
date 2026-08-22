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
// Push (students only, this phase — see this phase's scoping discussion):
// reuses students/{uid}.pushToken and the exact same Expo push-send
// pattern dailyStreakQuiz.ts/seekho.ts already use
// (https://exp.host/--/api/v2/push/send). That pattern is duplicated
// locally there too ("consolidate into a shared module if a third caller
// shows up" — its own comment) rather than exported from either file, so
// this keeps that same convention instead of refactoring two unrelated,
// already-working functions to import from here.
//
// Tutors have no push-token registration anywhere in this codebase yet
// (neither apps/tutor nor apps/tutor-mobile) — notifyTutor is in-app only
// by design, not a missing feature here.
//
// Both notify functions are best-effort: a notification failure must
// never fail the ShikshaHub action that triggered it (a session ending,
// a payout being marked paid, etc.), so callers fire-and-log rather than
// let a thrown error here propagate.

import * as admin from "firebase-admin";
import axios from "axios";

const db = admin.firestore();

export type ShikshaHubNotificationType = "instant_help" | "payout" | "review" | "shikshahub";

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

/** Tutor-facing: in-app notification only — no push-token infra exists for tutors yet. */
export async function notifyTutor(uid: string, notif: ShikshaHubNotification): Promise<void> {
  try {
    await writeInAppNotification(uid, notif);
  } catch (e) {
    console.warn(`shikshahubNotify: in-app write failed for tutor ${uid}:`, e);
  }
}

// PATH: functions/src/tutorMessaging.ts
// ShikshaHub — tutor-student messaging phase. A student can start a
// conversation with any tutor directly from their profile page — no
// booking required, this is the "ask before you book" surface the old
// disabled "Contact Tutor" placeholder was meant to fill. A tutor can
// only ever REPLY inside a conversation a student has already started —
// tutors can never cold-message a student, closing the obvious spam
// vector a bidirectional-initiation design would open.
//
// One conversation per student-tutor pair:
// tutorConversations/{studentUid}_{tutorUid} — the doc id itself IS the
// pair, same "deterministic id, no query needed to check existence"
// pattern tutorReviews/{sessionId|bookingId} already uses. "_" is a safe
// separator: every uid here comes from Firebase Auth's own
// auto-generated alphanumeric uid, which never contains "_" (this app
// never sets a custom uid).
//
// Real-time delivery is plain Firestore onSnapshot on the messages
// subcollection — no separate realtime infra needed.
//
// Client never writes tutorConversations/{id} or its messages
// subcollection directly (firestore.rules: allow write: if false), same
// closed-write pattern every ShikshaHub collection uses. sendTutorMessage
// (create/append) and markConversationRead (unread reset) are the only
// two ways either doc ever changes.

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { notifyStudent, notifyTutor } from "./shikshahubNotify";

const db = admin.firestore();

const MAX_MESSAGE_LENGTH = 2000;

function conversationIdFor(studentUid: string, tutorUid: string): string {
  return `${studentUid}_${tutorUid}`;
}

// ─── sendTutorMessage ────────────────────────────────────────────────────────
export const sendTutorMessage = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "256MB" })
  .https.onCall(async (data: { peerUid?: string; text?: string }, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const callerUid = context.auth.uid;
    const { peerUid, text } = data ?? {};
    if (!peerUid || typeof peerUid !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "peerUid is required");
    }
    if (peerUid === callerUid) {
      throw new functionsV1.https.HttpsError("invalid-argument", "Cannot message yourself");
    }
    const trimmedText = typeof text === "string" ? text.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
    if (!trimmedText) {
      throw new functionsV1.https.HttpsError("invalid-argument", "text is required");
    }

    // Authoritative role resolution — always by real doc existence, never
    // by trusting the custom claim alone. requestBooking's own claim check
    // is a cheap pre-reject on a function only students ever call; this
    // function serves both roles, so there's no safe "skip a read" shortcut
    // to take — a tutor account created before the claim-setting flow ran
    // (or any other reason the claim could be absent) must still resolve
    // correctly. Both reads happen in parallel to keep the cost the same
    // as the old single-path version.
    const [studentSnap, tutorSnap] = await Promise.all([
      db.doc(`students/${callerUid}`).get(),
      db.doc(`tutors/${callerUid}`).get(),
    ]);

    let senderRole: "student" | "tutor";
    let studentUid: string;
    let tutorUid: string;
    let peerStudentSnap: FirebaseFirestore.DocumentSnapshot;
    let peerTutorSnap: FirebaseFirestore.DocumentSnapshot;

    if (studentSnap.exists) {
      senderRole = "student";
      studentUid = callerUid;
      tutorUid = peerUid;
      peerStudentSnap = studentSnap;
      peerTutorSnap = await db.doc(`tutors/${tutorUid}`).get();
      if (!peerTutorSnap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "Tutor not found");
      }
    } else if (tutorSnap.exists) {
      senderRole = "tutor";
      tutorUid = callerUid;
      studentUid = peerUid;
      peerTutorSnap = tutorSnap;
      peerStudentSnap = await db.doc(`students/${studentUid}`).get();
      if (!peerStudentSnap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "Student not found");
      }
    } else {
      throw new functionsV1.https.HttpsError("permission-denied", "Only student or tutor accounts can send messages");
    }

    const conversationId = conversationIdFor(studentUid, tutorUid);
    const conversationRef = db.doc(`tutorConversations/${conversationId}`);
    const messageRef = conversationRef.collection("messages").doc();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const preview = trimmedText.slice(0, 120);

    await db.runTransaction(async (tx) => {
      const convSnap = await tx.get(conversationRef);

      if (!convSnap.exists) {
        if (senderRole === "tutor") {
          throw new functionsV1.https.HttpsError(
            "failed-precondition",
            "You can only reply to a conversation a student has started"
          );
        }
        tx.set(conversationRef, {
          studentUid,
          tutorUid,
          studentName: (peerStudentSnap.data()?.name as string | undefined) ?? "",
          tutorName: (peerTutorSnap.data()?.name as string | undefined) ?? "",
          lastMessageText: preview,
          lastMessageAt: now,
          lastMessageSenderUid: callerUid,
          studentUnreadCount: 0,
          tutorUnreadCount: 1,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        const conv = convSnap.data()!;
        if (conv.studentUid !== callerUid && conv.tutorUid !== callerUid) {
          throw new functionsV1.https.HttpsError("permission-denied", "This conversation isn't yours");
        }
        tx.update(conversationRef, {
          lastMessageText: preview,
          lastMessageAt: now,
          lastMessageSenderUid: callerUid,
          updatedAt: now,
          ...(senderRole === "student"
            ? { tutorUnreadCount: admin.firestore.FieldValue.increment(1) }
            : { studentUnreadCount: admin.firestore.FieldValue.increment(1) }),
        });
      }

      tx.set(messageRef, {
        senderUid: callerUid,
        senderRole,
        text: trimmedText,
        createdAt: now,
      });
    });

    console.log(`✅ Message sent: conversation=${conversationId} sender=${callerUid} (${senderRole})`);

    const notify = senderRole === "student" ? notifyTutor : notifyStudent;
    const recipientUid = senderRole === "student" ? tutorUid : studentUid;
    const senderName = senderRole === "student"
      ? ((peerStudentSnap.data()?.name as string | undefined) || "A student")
      : ((peerTutorSnap.data()?.name as string | undefined) || "Your tutor");
    await notify(recipientUid, {
      title: `💬 New message from ${senderName}`,
      body: preview,
      type: "shikshahub",
    }).catch((e) => console.warn("sendTutorMessage: notify failed:", e));

    return { conversationId, messageId: messageRef.id };
  });

// ─── markConversationRead ────────────────────────────────────────────────────
// Resets the caller's own unread counter to 0 — the other party's
// counter is untouched, same "each side owns only its own read state"
// shape notifications/{uid}'s per-item `read` flag already follows.
export const markConversationRead = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "256MB" })
  .https.onCall(async (data: { conversationId?: string }, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    const callerUid = context.auth.uid;
    const { conversationId } = data ?? {};
    if (!conversationId || typeof conversationId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "conversationId is required");
    }

    const conversationRef = db.doc(`tutorConversations/${conversationId}`);
    const snap = await conversationRef.get();
    if (!snap.exists) {
      throw new functionsV1.https.HttpsError("not-found", "Conversation not found");
    }
    const conv = snap.data()!;
    if (conv.studentUid !== callerUid && conv.tutorUid !== callerUid) {
      throw new functionsV1.https.HttpsError("permission-denied", "This conversation isn't yours");
    }

    await conversationRef.update(
      conv.studentUid === callerUid ? { studentUnreadCount: 0 } : { tutorUnreadCount: 0 }
    );

    return { conversationId };
  });

// packages/shared-logic/src/types/conversation.ts
// ShikshaHub — tutor-student messaging phase.
// tutorConversations/{studentUid}_{tutorUid} — one conversation per
// student-tutor pair, the doc id itself is the pair (see
// functions/src/tutorMessaging.ts's header comment for why "_" is a safe,
// collision-free separator here). Client never writes this or its
// messages subcollection directly (firestore.rules: allow write: if
// false); sendTutorMessage (create/append) and markConversationRead
// (unread reset) are the only two ways either ever changes.

export type TutorConversation = {
  id?: string; // = `${studentUid}_${tutorUid}`
  studentUid: string;
  tutorUid: string;

  // Display-only snapshots, taken when the conversation is first created —
  // never re-read live, never trusted for authorization (studentUid/
  // tutorUid are, exclusively), same rule bookings/{id}'s studentName/
  // tutorName already follow.
  studentName?: string;
  tutorName?: string;

  lastMessageText?: string; // capped preview, not the full message
  lastMessageAt?: unknown; // Firestore Timestamp
  lastMessageSenderUid?: string;

  // Each side owns only its own unread counter — sending a message
  // increments the OTHER party's counter; markConversationRead only ever
  // resets the caller's own.
  studentUnreadCount?: number;
  tutorUnreadCount?: number;

  createdAt?: unknown; // Firestore Timestamp
  updatedAt?: unknown; // Firestore Timestamp
};

// tutorConversations/{conversationId}/messages/{messageId}
export type TutorMessage = {
  id?: string;
  senderUid: string;
  senderRole: "student" | "tutor";

  // Trimmed and capped server-side (see functions/src/tutorMessaging.ts) —
  // never rendered as HTML anywhere, only ever plain text.
  text: string;

  createdAt?: unknown; // Firestore Timestamp
};

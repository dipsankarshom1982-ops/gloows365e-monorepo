// PATH: apps/web/src/services/skillGuruSessions.ts
// Renamed from vidyaguruSessions.ts as part of the VidyaGuru → SkillGuru
// rebuild. Firestore collection renamed from "vidyaGuruSessions" to
// "skillGuruSessions" to match — this is a fresh collection, so existing
// VidyaGuru chat history simply won't carry over into SkillGuru, which
// is appropriate: SkillGuru is a different tool with a different
// purpose, not a continuation of the same conversations.
//
// One document per session (a session = one continuous conversation,
// starting fresh each time the screen mounts), not one document per
// message — same convention as before.

import { getFirestore, doc, setDoc, getDoc, arrayUnion, serverTimestamp } from "firebase/firestore";

export interface StoredMessage {
  id:        string;
  role:      "guru" | "student";
  text:      string;
  createdAt: number;
}

function sessionRef(uid: string, sessionId: string) {
  return doc(getFirestore(), "skillGuruSessions", uid, "sessions", sessionId);
}

// Creates the session doc on first message (idempotent via merge — safe to
// call even if something already created it, e.g. a retry).
export async function ensureSession(uid: string, sessionId: string): Promise<void> {
  await setDoc(sessionRef(uid, sessionId), {
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// Appends one or more messages to the session's messages array.
// arrayUnion is safe for concurrent appends (e.g. a retry after a flaky
// network call landing twice) only if message ids are unique, which they
// are here (see id generation in the page component) — arrayUnion dedupes
// by deep-equality, but distinct ids make every entry unique regardless.
export async function appendMessages(uid: string, sessionId: string, messages: StoredMessage[]): Promise<void> {
  if (messages.length === 0) return;
  await setDoc(sessionRef(uid, sessionId), {
    messages:  arrayUnion(...messages),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// Loads a previous session's messages, e.g. for a future "resume last
// chat" entry point. Not yet wired into the UI in this pass — the page
// always starts a fresh session — but the read path is here so resuming
// is a small follow-up, not a new schema design.
export async function loadSession(uid: string, sessionId: string): Promise<StoredMessage[]> {
  const snap = await getDoc(sessionRef(uid, sessionId));
  if (!snap.exists()) return [];
  const data = snap.data();
  return (data.messages as StoredMessage[]) ?? [];
}

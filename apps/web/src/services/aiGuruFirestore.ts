// PATH: apps/web/src/services/aiGuruFirestore.ts
// Mirror of apps/mobile/services/aiGuruFirestore.ts — Firestore reads/writes
// for AI Guru lessons, usage limits, and subscription status.

import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { AiGuruLesson, AiGuruUsage, QuizAttempt } from "@/lib/aiGuru/types";
import { FREE_DAILY_LESSONS } from "@/lib/aiGuru/constants";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getLesson(lessonId: string): Promise<AiGuruLesson | null> {
  const snap = await getDoc(doc(db, "aiGuruLessons", lessonId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as AiGuruLesson;
}

export async function getUserLessons(uid: string): Promise<AiGuruLesson[]> {
  const snap = await getDocs(
    query(
      collection(db, "aiGuruLessons"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AiGuruLesson));
}

export function listenLessonStatus(
  lessonId: string,
  callback: (lesson: AiGuruLesson) => void
): () => void {
  return onSnapshot(doc(db, "aiGuruLessons", lessonId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() } as AiGuruLesson);
  });
}

export async function updateLessonProgress(
  lessonId: string,
  sceneIndex: number,
  totalScenes: number
): Promise<void> {
  const progress = totalScenes > 0 ? Math.round((sceneIndex / totalScenes) * 100) : 0;
  await updateDoc(doc(db, "aiGuruLessons", lessonId), { progress });
}

export async function saveQuizAttempt(
  lessonId: string,
  attempt: Omit<QuizAttempt, "id">
): Promise<string> {
  const ref = await addDoc(
    collection(db, "aiGuruLessons", lessonId, "quizAttempts"),
    attempt
  );
  return ref.id;
}

export async function getLatestQuizAttempt(
  lessonId: string,
  uid: string
): Promise<QuizAttempt | null> {
  const snap = await getDocs(
    query(
      collection(db, "aiGuruLessons", lessonId, "quizAttempts"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc")
    )
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as QuizAttempt;
}

export async function getQuizAttempt(
  lessonId: string,
  attemptId: string
): Promise<QuizAttempt | null> {
  const snap = await getDoc(
    doc(db, "aiGuruLessons", lessonId, "quizAttempts", attemptId)
  );
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as QuizAttempt;
}

export async function checkUsage(uid: string): Promise<AiGuruUsage> {
  const snap = await getDoc(doc(db, "aiGuruUsage", uid, "daily", todayKey()));
  if (!snap.exists()) return { generationsUsed: 0, quizAttempts: 0, lastGeneratedAt: null };
  return snap.data() as AiGuruUsage;
}

// FIX (tester access): testers/admins (users/{uid}.role — same field
// admin's "Grant Tester Access" button on Students.tsx sets, and the one
// FeatureFlagsContext/AppConfigContext already read to bypass disabled
// modules/features) get treated as subscribed here too, so premium AI
// Guru features and lesson quotas never block them without requiring a
// real subscriptions/{uid} doc. Self-contained (checked internally) so
// every existing caller of isSubscribed()/getRemainingLessons() picks
// this up automatically with no call-site changes.
export async function isSubscribed(uid: string): Promise<boolean> {
  try {
    const userSnap = await getDoc(doc(db, "users", uid));
    const role = userSnap.exists() ? userSnap.data().role : undefined;
    if (role === "tester" || role === "admin") return true;

    const snap = await getDoc(doc(db, "subscriptions", uid));
    if (!snap.exists()) return false;
    const data = snap.data();
    const endDate = data.endDate?.toMillis?.() ?? 0;
    return data.status === "active" && endDate > Date.now();
  } catch {
    return false;
  }
}

export async function getRemainingLessons(uid: string): Promise<number> {
  const subscribed = await isSubscribed(uid);
  if (subscribed) return Infinity;
  const usage = await checkUsage(uid);
  return Math.max(0, FREE_DAILY_LESSONS - (usage.generationsUsed ?? 0));
}

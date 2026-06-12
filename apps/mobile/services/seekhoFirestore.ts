import { db } from "@/lib/firebase";
import type {
  SeekhoCourse,
  SeekhoLesson,
  SeekhoPracticeQuestion,
  SeekhoProgress,
  SeekhoRevisionItem,
  SeekhoSubscription,
} from "@/lib/seekho/types";
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";

// ─── Courses ──────────────────────────────────────────────────────────────────

export async function getCoursesByClassBoard(
  cls: number,
  board: string,
  subject?: string
): Promise<SeekhoCourse[]> {
  try {
    // Single where clause avoids composite index requirement; filter board/subject in memory
    const snap = await getDocs(
      query(collection(db, "seekho_courses"), where("class", "==", cls))
    );
    const courses: SeekhoCourse[] = snap.docs.map((d) => ({
      courseId: d.id,
      ...(d.data() as Omit<SeekhoCourse, "courseId">),
    }));
    return courses
      .filter((c) => c.board === board && (!subject || c.subject === subject))
      .sort((a, b) => a.chapterNumber - b.chapterNumber);
  } catch (e) {
    console.warn("getCoursesByClassBoard:", e);
    return [];
  }
}

export async function getCourseById(courseId: string): Promise<SeekhoCourse | null> {
  try {
    const snap = await getDoc(doc(db, "seekho_courses", courseId));
    if (!snap.exists()) return null;
    return { courseId: snap.id, ...(snap.data() as Omit<SeekhoCourse, "courseId">) };
  } catch (e) {
    console.warn("getCourseById:", e);
    return null;
  }
}

// ─── Lessons ──────────────────────────────────────────────────────────────────

export async function getLessonsByCourse(courseId: string): Promise<SeekhoLesson[]> {
  try {
    const snap = await getDocs(
      query(collection(db, "seekho_lessons"), where("courseId", "==", courseId))
    );
    const lessons: SeekhoLesson[] = snap.docs.map((d) => ({
      lessonId: d.id,
      ...(d.data() as Omit<SeekhoLesson, "lessonId">),
    }));
    return lessons.sort((a, b) => a.lessonNumber - b.lessonNumber);
  } catch (e) {
    console.warn("getLessonsByCourse:", e);
    return [];
  }
}

export async function getLessonById(lessonId: string): Promise<SeekhoLesson | null> {
  try {
    const snap = await getDoc(doc(db, "seekho_lessons", lessonId));
    if (!snap.exists()) return null;
    return { lessonId: snap.id, ...(snap.data() as Omit<SeekhoLesson, "lessonId">) };
  } catch (e) {
    console.warn("getLessonById:", e);
    return null;
  }
}

// ─── Practice questions ───────────────────────────────────────────────────────

export async function getPracticeByChapter(
  courseId: string
): Promise<SeekhoPracticeQuestion[]> {
  try {
    const snap = await getDocs(
      query(collection(db, "seekho_practice"), where("courseId", "==", courseId))
    );
    return snap.docs.map((d) => ({
      questionId: d.id,
      ...(d.data() as Omit<SeekhoPracticeQuestion, "questionId">),
    }));
  } catch (e) {
    console.warn("getPracticeByChapter:", e);
    return [];
  }
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export async function getProgressForUser(
  userId: string,
  courseId: string
): Promise<SeekhoProgress | null> {
  try {
    const snap = await getDoc(doc(db, "seekho_progress", `${userId}_${courseId}`));
    if (!snap.exists()) return null;
    return { progressId: snap.id, ...(snap.data() as Omit<SeekhoProgress, "progressId">) };
  } catch (e) {
    console.warn("getProgressForUser:", e);
    return null;
  }
}

export async function loadAllProgressForUser(
  userId: string
): Promise<Record<string, SeekhoProgress>> {
  try {
    const snap = await getDocs(
      query(collection(db, "seekho_progress"), where("userId", "==", userId))
    );
    const result: Record<string, SeekhoProgress> = {};
    snap.docs.forEach((d) => {
      const data = { progressId: d.id, ...(d.data() as Omit<SeekhoProgress, "progressId">) };
      result[data.courseId] = data;
    });
    return result;
  } catch (e) {
    console.warn("loadAllProgressForUser:", e);
    return {};
  }
}

export async function upsertLessonComplete(
  userId: string,
  courseId: string,
  lessonId: string,
  totalLessons: number
): Promise<void> {
  try {
    const ref = doc(db, "seekho_progress", `${userId}_${courseId}`);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, {
        userId,
        courseId,
        completedLessons: [lessonId],
        practiceScores: {},
        percentComplete: 1 / Math.max(totalLessons, 1),
        lastAccessedAt: serverTimestamp(),
        chapterCompleted: false,
      });
    } else {
      const data = snap.data() as SeekhoProgress;
      const completedLessons = data.completedLessons.includes(lessonId)
        ? data.completedLessons
        : [...data.completedLessons, lessonId];
      await updateDoc(ref, {
        completedLessons: arrayUnion(lessonId),
        percentComplete: completedLessons.length / Math.max(totalLessons, 1),
        lastAccessedAt: serverTimestamp(),
      });
    }
  } catch (e) {
    console.warn("upsertLessonComplete:", e);
  }
}

export async function upsertPracticeScore(
  userId: string,
  courseId: string,
  questionId: string,
  correct: boolean
): Promise<void> {
  try {
    const ref = doc(db, "seekho_progress", `${userId}_${courseId}`);
    // Dot-notation update to avoid overwriting other questions
    await setDoc(ref, { [`practiceScores.${questionId}`]: correct }, { merge: true });
  } catch (e) {
    console.warn("upsertPracticeScore:", e);
  }
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export async function getSubscription(userId: string): Promise<SeekhoSubscription | null> {
  try {
    const snap = await getDoc(doc(db, "seekho_subscriptions", userId));
    if (!snap.exists()) return null;
    const data = snap.data() as SeekhoSubscription;
    // Treat as free if expired
    const expiresAt = (data.expiresAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
    if (expiresAt < Date.now()) return null;
    return data;
  } catch (e) {
    console.warn("getSubscription:", e);
    return null;
  }
}

// ─── Revision queue ───────────────────────────────────────────────────────────

export async function getRevisionQueue(userId: string): Promise<SeekhoRevisionItem[]> {
  try {
    const snap = await getDocs(
      query(collection(db, "seekho_revision_queue"), where("userId", "==", userId))
    );
    return snap.docs.map((d) => ({
      docId: d.id,
      ...(d.data() as Omit<SeekhoRevisionItem, "docId">),
    }));
  } catch (e) {
    console.warn("getRevisionQueue:", e);
    return [];
  }
}

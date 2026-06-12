// Requires: npm install zustand
// react-native-razorpay: npx expo install react-native-razorpay (needs Expo Dev Client)

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  DailyPlanItem,
  SeekhoAccessResult,
  SeekhoBoard,
  SeekhoCourse,
  SeekhoProgress,
  SeekhoRevisionItem,
  SeekhoSubscription,
} from "@/lib/seekho/types";
import {
  upsertLessonComplete,
  upsertPracticeScore,
} from "@/services/seekhoFirestore";

// ─── State shape ──────────────────────────────────────────────────────────────

interface SeekhoState {
  selectedClass: number;
  selectedBoard: SeekhoBoard;
  currentSubscription: SeekhoSubscription | null;
  courseProgress: Record<string, SeekhoProgress>;
  revisionQueue: SeekhoRevisionItem[];
  dailyPlan: DailyPlanItem[];
}

// ─── Actions ──────────────────────────────────────────────────────────────────

interface SeekhoActions {
  setClassBoard: (cls: number, board: SeekhoBoard) => void;
  setSubscription: (sub: SeekhoSubscription | null) => void;
  setRevisionQueue: (queue: SeekhoRevisionItem[]) => void;
  setDailyPlan: (plan: DailyPlanItem[]) => void;
  setCourseProgress: (progress: Record<string, SeekhoProgress>) => void;

  markLessonComplete: (courseId: string, lessonId: string, totalLessons: number) => void;
  submitPracticeAnswer: (courseId: string, questionId: string, correct: boolean) => void;
  markChapterComplete: (courseId: string) => void;

  // Synchronous access check — no async
  checkAccess: (course: SeekhoCourse) => SeekhoAccessResult;
}

type SeekhoStore = SeekhoState & SeekhoActions;

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSeekhoStore = create<SeekhoStore>()(
  persist(
    (set, get) => ({
      // ── Initial state ──────────────────────────────────────────────────────
      selectedClass: 10,
      selectedBoard: "CBSE",
      currentSubscription: null,
      courseProgress: {},
      revisionQueue: [],
      dailyPlan: [],

      // ── Setters ────────────────────────────────────────────────────────────
      setClassBoard: (cls, board) => set({ selectedClass: cls, selectedBoard: board }),
      setSubscription: (sub) => set({ currentSubscription: sub }),
      setRevisionQueue: (queue) => set({ revisionQueue: queue }),
      setDailyPlan: (plan) => set({ dailyPlan: plan }),
      setCourseProgress: (progress) => set({ courseProgress: progress }),

      // ── Mark lesson complete (optimistic + background Firestore write) ──────
      markLessonComplete: (courseId, lessonId, totalLessons) => {
        set((state) => {
          const prev = state.courseProgress[courseId] ?? emptyProgress(courseId);
          if (prev.completedLessons.includes(lessonId)) return state;

          const completedLessons = [...prev.completedLessons, lessonId];
          const percentComplete = completedLessons.length / Math.max(totalLessons, 1);
          const updated: SeekhoProgress = {
            ...prev,
            completedLessons,
            percentComplete,
            lastAccessedAt: Date.now(),
          };
          return {
            courseProgress: { ...state.courseProgress, [courseId]: updated },
          };
        });

        // Fire-and-forget Firestore write
        const userId = get().currentSubscription?.userId;
        if (userId) {
          upsertLessonComplete(userId, courseId, lessonId, totalLessons).catch(
            (e) => console.warn("seekho markLessonComplete write failed:", e)
          );
        }
      },

      // ── Submit practice answer ─────────────────────────────────────────────
      submitPracticeAnswer: (courseId, questionId, correct) => {
        set((state) => {
          const prev = state.courseProgress[courseId] ?? emptyProgress(courseId);
          const practiceScores = { ...prev.practiceScores, [questionId]: correct };
          const updated: SeekhoProgress = { ...prev, practiceScores };
          return {
            courseProgress: { ...state.courseProgress, [courseId]: updated },
          };
        });

        const userId = get().currentSubscription?.userId;
        if (userId) {
          upsertPracticeScore(userId, courseId, questionId, correct).catch(
            (e) => console.warn("seekho submitPracticeAnswer write failed:", e)
          );
        }
      },

      // ── Mark chapter completed ─────────────────────────────────────────────
      markChapterComplete: (courseId) => {
        set((state) => {
          const prev = state.courseProgress[courseId] ?? emptyProgress(courseId);
          const updated: SeekhoProgress = { ...prev, chapterCompleted: true };
          return {
            courseProgress: { ...state.courseProgress, [courseId]: updated },
          };
        });
      },

      // ── Synchronous access check ───────────────────────────────────────────
      checkAccess: (course) => {
        const { currentSubscription, selectedClass } = get();

        if (course.isFree) return { allowed: true };

        if (!currentSubscription) return { allowed: false, reason: "not_subscribed" };

        if (currentSubscription.plan === "pro") return { allowed: true };

        if (currentSubscription.plan === "plus") {
          const classToCheck = course.class || selectedClass;
          return currentSubscription.classAccess.includes(classToCheck)
            ? { allowed: true }
            : { allowed: false, reason: "wrong_class" };
        }

        return { allowed: false, reason: "not_subscribed" };
      },
    }),
    {
      name: "seekho-store",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist class/board selection; progress & subscription fetched fresh
      partialize: (state) => ({
        selectedClass: state.selectedClass,
        selectedBoard: state.selectedBoard,
      }),
    }
  )
);

// ─── Helper ───────────────────────────────────────────────────────────────────

function emptyProgress(courseId: string): SeekhoProgress {
  return {
    progressId: "",
    userId: "",
    courseId,
    completedLessons: [],
    practiceScores: {},
    percentComplete: 0,
    lastAccessedAt: Date.now(),
    chapterCompleted: false,
  };
}

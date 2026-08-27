"use client";

// PATH: apps/web/src/services/getContestLesson.ts
// Mirrors mobile services/getContestLesson.ts. Lessons are generated
// lazily, per (contest, language), the first time a student in that
// language opens it — see functions/src/contestLesson.ts's
// getContestLesson. Cached after the first successful generation, so most
// calls just return the already-generated content.

import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

export interface ContestLessonResult {
  lessonJson: any;
  bannerMeta: any;
  status: "completed";
}

const getContestLessonCF = httpsCallable<{ contestId: string; language: string }, ContestLessonResult>(
  functions,
  "getContestLesson"
);

export async function getContestLesson(contestId: string, language: string): Promise<ContestLessonResult> {
  const { data } = await getContestLessonCF({ contestId, language });
  return data;
}

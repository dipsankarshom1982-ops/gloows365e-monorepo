// packages/shared-logic/src/types/aiGuru.ts

export type FollowUpMode = "explain" | "notes" | "exam" | "doubt" | "summarize" | "tip" | "language";

export interface LessonSetup {
  subject: string;
  class: string | number;
  board: string;
  language: string;
  mode?: FollowUpMode;
}

export interface LessonJson {
  title: string;
  summary: string;
  content: any[];
}

export interface FollowUpResponse {
  answer: string;
  lessonId: string;
}

export interface AiNotebookEntry {
  id: string;
  question: string;
  answer: string;
  subject?: string;
  createdAt: any;
  uid: string;
}

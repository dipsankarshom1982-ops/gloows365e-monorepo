// PATH: apps/web/src/services/examSimulatorApi.ts
// Direct port of mobile's services/examSimulatorApi.ts.
//
// FIX (bug report — "review AI Guru sub-pages"): the exam-simulator page
// was calling `${CF_URL}/generateExamQuestions` directly with inline
// fetch() — that endpoint does not exist on the backend at all (the real
// exported function is `generateExam`, from functions/src/examSimulator.ts,
// exported via index.ts). The page also never called the matching
// `evaluateExam` endpoint — it graded answers client-side by comparing
// against a correctAnswerIndex field that the real generateExam response
// doesn't even return (it's `correctIndex`, withheld from the client
// entirely until evaluateExam grades it server-side). This file restores
// the real two-call contract.

import { auth } from "@/lib/firebase";
import { CLOUD_FUNCTION_URL } from "@/lib/aiGuru/constants";

async function getToken(): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("User not authenticated");
  return token;
}

async function post<T>(path: string, body: object): Promise<T> {
  const token = await getToken();
  const resp = await fetch(`${CLOUD_FUNCTION_URL}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) {
    const err: any = new Error(data.error ?? "Exam request failed");
    err.code = data.code ?? "UNKNOWN";
    err.status = resp.status;
    if (data.creditBalance   !== undefined) err.creditBalance   = data.creditBalance;
    if (data.creditsRequired !== undefined) err.creditsRequired = data.creditsRequired;
    throw err;
  }
  return data as T;
}

export interface ExamQuestion {
  id: number;
  type: "mcq";
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  marks: number;
  concept: string;
  boardImportance: "low" | "medium" | "high";
}

export interface GeneratedExam {
  examId: string;
  examTitle: string;
  subject: string;
  chapter: string;
  board: string;
  class: string;
  difficulty: string;
  estimatedMinutes: number;
  questions: ExamQuestion[];
  totalMarks: number;
  passingMarks: number;
  fromCache?: boolean;
}

export interface ExamEvaluation {
  earnedMarks: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  boardReadiness: number;
  performanceSummary: string;
  weakConcepts: string[];
  strongConcepts: string[];
  studyPlan: string[];
  predictedBoardScore: string;
  motivationalMessage: string;
  questionResults: { id: number; correct: boolean; selectedIndex: number }[];
}

export async function generateExam(params: {
  classLevel: string;
  board: string;
  subject: string;
  chapter: string;
  difficulty?: string;
  language?: string;
  questionCount?: number;
}): Promise<GeneratedExam> {
  return post<GeneratedExam>("generateExam", params);
}

export async function evaluateExam(params: {
  examId: string;
  answers: { questionId: number; selectedIndex: number }[];
}): Promise<ExamEvaluation> {
  return post<ExamEvaluation>("evaluateExam", params);
}

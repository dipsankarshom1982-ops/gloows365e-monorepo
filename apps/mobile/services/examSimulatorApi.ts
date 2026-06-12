// PATH: services/examSimulatorApi.ts
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

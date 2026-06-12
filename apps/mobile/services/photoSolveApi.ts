// PATH: services/photoSolveApi.ts
import { auth } from "@/lib/firebase";
import { CLOUD_FUNCTION_URL } from "@/lib/aiGuru/constants";

async function getToken(): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("User not authenticated");
  return token;
}

export interface PhotoSolveSolution {
  subject: string;
  questionText: string;
  solution: {
    steps: string[];
    finalAnswer: string;
    formula: string | null;
  };
  conceptExplained: string;
  examTip: string;
  similarQuestions: { question: string; hint: string }[];
  fromCache?: boolean;
}

export async function solvePhotoQuestion(params: {
  imageBase64: string;
  imageMimeType: string;
  classLevel: string;
  board: string;
  language: string;
}): Promise<PhotoSolveSolution> {
  const token = await getToken();
  const url = `${CLOUD_FUNCTION_URL}/photoSolve`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  const data = await resp.json();
  if (!resp.ok) {
    const err: any = new Error(data.error ?? "PhotoSolve failed");
    err.code = data.code ?? "UNKNOWN";
    err.status = resp.status;
    throw err;
  }
  return data as PhotoSolveSolution;
}

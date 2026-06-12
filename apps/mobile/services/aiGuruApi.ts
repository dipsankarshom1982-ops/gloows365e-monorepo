import { auth } from "@/lib/firebase";
import { CLOUD_FUNCTION_URL } from "@/lib/aiGuru/constants";
import { LessonSetup, LessonJson, FollowUpResponse, FollowUpMode } from "@/lib/aiGuru/types";

async function getToken(): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("User not authenticated");
  return token;
}

async function post<T>(path: string, body: object): Promise<T> {
  const token = await getToken();
  const url = `${CLOUD_FUNCTION_URL}/${path}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  if (!resp.ok) {
    const err: any = new Error(data.error ?? "Request failed");
    err.code = data.code ?? "UNKNOWN";
    err.status = resp.status;
    throw err;
  }
  return data as T;
}

export interface GenerateLessonResult {
  lessonId: string;
  lessonJson: LessonJson;
}

export async function generateLesson(
  setup: LessonSetup,
  inputText: string,
  imageBase64?: string,
  imageMimeType?: string
): Promise<GenerateLessonResult> {
  return post<GenerateLessonResult>("generateLesson", {
    ...setup,
    inputText,
    imageBase64,
    imageMimeType,
  });
}

export async function sendFollowUp(
  lessonId: string,
  question: string,
  language: string,
  mode: FollowUpMode
): Promise<FollowUpResponse> {
  return post<FollowUpResponse>("followUp", { lessonId, question, language, mode });
}

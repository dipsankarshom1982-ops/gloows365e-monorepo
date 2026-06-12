// packages/shared-logic/src/services/aiGuruApi.ts
//
// ✅ Shared — works on mobile, web, and admin.
// Pure fetch + Firebase Auth token. Zero platform deps.

import { getSharedAuth } from "../lib/firebaseConfig";
import type { LessonSetup, LessonJson, FollowUpResponse, FollowUpMode } from "../types/aiGuru";

const CLOUD_FUNCTION_URL =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_CLOUD_FUNCTION_URL ??
      process.env.EXPO_PUBLIC_CLOUD_FUNCTION_URL ??
      "https://us-central1-gloows-03b6sz.cloudfunctions.net"
    : "https://us-central1-gloows-03b6sz.cloudfunctions.net";

async function getToken(): Promise<string> {
  const token = await getSharedAuth().currentUser?.getIdToken();
  if (!token) throw new Error("User not authenticated");
  return token;
}

async function post<T>(path: string, body: object): Promise<T> {
  const token = await getToken();
  const resp = await fetch(`${CLOUD_FUNCTION_URL}/${path}`, {
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
    err.code   = data.code   ?? "UNKNOWN";
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
    ...setup, inputText, imageBase64, imageMimeType,
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

export async function callCloudFunction<T>(name: string, body: object): Promise<T> {
  return post<T>(name, body);
}

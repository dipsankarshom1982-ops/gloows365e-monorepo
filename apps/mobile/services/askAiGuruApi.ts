import { auth } from "@/lib/firebase";

const BASE_URL = (process.env.EXPO_PUBLIC_CLOUD_FUNCTION_URL as string) ?? "";

async function getToken(): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("User not authenticated");
  return token;
}

export interface AskGuruPayload {
  question:   string;
  classLevel: string | number;
  board:      string;
  mode?:      string;   // "doubt" | "explain" | "notes" | "exam" | "summarize" | "tip" | "language"
}

export interface AskGuruResponse {
  answer: string;
  mode?:  string;
}

export interface AskGuruLimitError extends Error {
  code:   "LIMIT_REACHED";
  limit:  number;
  status: 429;
}

export async function askAiGuruQuestion(
  payload: AskGuruPayload
): Promise<AskGuruResponse> {
  const token = await getToken();
  const resp = await fetch(`${BASE_URL}/askAiGuruQuestion`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json();

  if (!resp.ok) {
    const err: any = new Error(data.error ?? "Ask AI Guru failed");
    err.code   = data.code   ?? "UNKNOWN";
    err.status = resp.status;
    err.limit  = data.limit  ?? 10;
    throw err;
  }

  return data as AskGuruResponse;
}

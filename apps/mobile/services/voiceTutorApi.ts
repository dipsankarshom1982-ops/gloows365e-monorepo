// PATH: services/voiceTutorApi.ts
import { auth } from "@/lib/firebase";
import { CLOUD_FUNCTION_URL } from "@/lib/aiGuru/constants";

async function getToken(): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("User not authenticated");
  return token;
}

export interface VoiceTutorResponse {
  transcribedQuestion: string;
  detectedLanguage: string;
  answer: string;
  keyPoints: string[];
  followUpSuggestion: string;
  subject: string;
}

export async function askVoiceTutor(params: {
  audioBase64?: string;
  audioMimeType?: string;
  textQuestion?: string;
  detectedLanguage?: string;
  classLevel: string;
  board: string;
}): Promise<VoiceTutorResponse> {
  const token = await getToken();
  const resp = await fetch(`${CLOUD_FUNCTION_URL}/voiceTutorAnswer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  });
  const data = await resp.json();
  if (!resp.ok) {
    const err: any = new Error(data.error ?? "Voice tutor request failed");
    err.code = data.code ?? "UNKNOWN";
    err.status = resp.status;
    throw err;
  }
  return data as VoiceTutorResponse;
}

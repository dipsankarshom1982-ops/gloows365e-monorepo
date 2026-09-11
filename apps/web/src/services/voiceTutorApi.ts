// PATH: apps/web/src/services/voiceTutorApi.ts
// Direct port of mobile's services/voiceTutorApi.ts.
//
// FIX: the voice-tutor page was calling the generic `/askAiGuruQuestion`
// endpoint (built for the "Ask AI Guru" chat feature, mode: "explain")
// instead of the real dedicated `/voiceTutorAnswer` endpoint
// (functions/src/voiceTutor.ts). The real endpoint has its own server-side
// rate limit (3/day free, 100/day premium — different numbers from
// askAiGuruQuestion's 5/day), its own usage tracking, and returns a
// structured response (keyPoints, followUpSuggestion, subject) tuned for
// spoken/TTS playback — none of which askAiGuruQuestion provides.
//
// Web has no native audio recording, so it only ever uses the textQuestion
// path below (transcription happens client-side via the browser's
// SpeechRecognition API before this is called) — the audioBase64 path
// exists in the type for parity with mobile's contract but isn't used here.

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
    if (data.creditBalance   !== undefined) err.creditBalance   = data.creditBalance;
    if (data.creditsRequired !== undefined) err.creditsRequired = data.creditsRequired;
    throw err;
  }
  return data as VoiceTutorResponse;
}

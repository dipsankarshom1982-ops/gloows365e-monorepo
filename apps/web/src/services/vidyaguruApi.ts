// PATH: apps/web/src/services/vidyaguruApi.ts
//
// Mirrors mobile services/vidyaguruApi.ts's request/response shape exactly
// (minus audio — see ai-guru/vidyaguru/page.tsx for why voice is out of
// scope for this pass).
//
// FIX: the old web vidyaguru/page.tsx called /askAiGuruQuestion — the
// generic single-turn ask endpoint also used by ask/page.tsx — instead of
// /vidyaguruChat, the dedicated VidyaGuru endpoint mobile correctly calls.
// This meant web's VidyaGuru never sent conversationHistory at all (the
// generic endpoint's payload shape has no field for it), so every message
// was answered with zero memory of what was just discussed, and never
// received the followUps suggestions /vidyaguruChat returns either.

import { auth } from "@/lib/firebase";

const BASE_URL = (process.env.NEXT_PUBLIC_CLOUD_FUNCTION_URL as string) ?? "";

async function getToken(): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("User not authenticated");
  return token;
}

export interface ConversationTurn {
  role: "guru" | "student";
  text: string;
}

export interface VidyaGuruPayload {
  message: string;
  conversationHistory: ConversationTurn[];
  studentName: string;
  classLevel:  string | number;
  language:    string;
}

export interface VidyaGuruResponse {
  answer:    string;
  followUps: string[];
}

export async function askVidyaGuru(payload: VidyaGuruPayload): Promise<VidyaGuruResponse> {
  const token = await getToken();
  const resp = await fetch(`${BASE_URL}/vidyaguruChat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json();
  if (!resp.ok) {
    const err: any = new Error(data.error ?? "VidyaGuru request failed");
    err.code   = data.code ?? "UNKNOWN";
    err.status = resp.status;
    if (data.creditBalance   !== undefined) err.creditBalance   = data.creditBalance;
    if (data.creditsRequired !== undefined) err.creditsRequired = data.creditsRequired;
    throw err;
  }
  // followUps defaults to [] — older backend responses (or a partial
  // rollout) may not include it yet, and the UI should degrade gracefully
  // (no suggestion chips) rather than throw on a missing field.
  return { answer: data.answer, followUps: data.followUps ?? [] };
}

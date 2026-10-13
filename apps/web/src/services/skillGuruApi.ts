// PATH: apps/web/src/services/skillGuruApi.ts
// Renamed from vidyaguruApi.ts as part of the VidyaGuru → SkillGuru
// rebuild — see lib/aiGuru/skillGuruDomains.ts for the reasoning.
//
// BACKEND CONTRACT UNCHANGED: still calls /vidyaguruChat. That Cloud
// Function lives outside this repo and can't be renamed from here, so
// the endpoint URL stays as-is — only the client-side identity (file
// name, types, exported function name) changes to SkillGuru. The
// request payload shape is also unchanged (still
// {message, conversationHistory, studentName, classLevel, language});
// callers now prepend a skill-context tag to `message` (see
// buildSkillContextPrefix in skillGuruDomains.ts) to keep replies
// anchored to skills coaching rather than generic syllabus tutoring,
// since there's no backend-side category field to add for that.
//
// Mirrors mobile services/skillGuruApi.ts's request/response shape
// exactly (minus audio — voice is out of scope for this pass, same as
// the prior VidyaGuru web build).

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

export interface SkillGuruPayload {
  message: string;
  conversationHistory: ConversationTurn[];
  studentName: string;
  classLevel:  string | number;
  language:    string;
}

export interface SkillGuruResponse {
  answer:    string;
  followUps: string[];
}

export async function askSkillGuru(payload: SkillGuruPayload): Promise<SkillGuruResponse> {
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
    const err: any = new Error(data.error ?? "SkillGuru request failed");
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

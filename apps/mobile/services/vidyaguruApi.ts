import { auth } from "@/lib/firebase";
import * as FileSystem from "expo-file-system/legacy";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";

const BASE_URL = (process.env.EXPO_PUBLIC_CLOUD_FUNCTION_URL as string) ?? "";

async function getToken(): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("User not authenticated");
  return token;
}

export interface VidyaGuruPayload {
  message?: string;
  audioBase64?: string;
  audioMimeType?: string;
  conversationHistory: { role: string; text: string }[];
  studentName: string;
  classLevel: string | number;
  language: string;
}

export interface VidyaGuruResponse {
  answer: string;
  transcribedText?: string;
  audioBase64: string;
  followUps: string[];
}

export async function askVidyaGuru(payload: VidyaGuruPayload): Promise<VidyaGuruResponse> {
  const token = await getToken();
  const resp = await fetch(`${BASE_URL}/vidyaguruChat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json();
  if (!resp.ok) {
    const err: any = new Error(data.error ?? "VidyaGuru request failed");
    err.code = data.code ?? "UNKNOWN";
    err.status = resp.status;
    throw err;
  }
  return data as VidyaGuruResponse;
}

// Write base64 MP3 to cache and play it
export async function playGuruAudio(base64: string): Promise<ReturnType<typeof createAudioPlayer>> {
  // Switch audio session to playback mode — critical after a recording session.
  // On iOS this changes AVAudioSession category from PlayAndRecord → Playback
  // (PlayAndRecord routes to earpiece by default, so audio would be inaudible).
  // On Android this returns audio focus to media playback.
  try {
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  } catch (e) {
    console.warn("[VidyaGuru] setAudioModeAsync failed:", e);
  }

  const path = `${FileSystem.cacheDirectory}guru_response_${Date.now()}.mp3`;
  await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });

  const player = createAudioPlayer({ uri: path });

  // The native AudioPlayer loads the source asynchronously. Calling play()
  // immediately can be a no-op on Android before the MediaPlayer is prepared.
  // A short wait lets the native layer finish initializing the player.
  await new Promise<void>((resolve) => setTimeout(resolve, 250));
  player.play();
  return player;
}

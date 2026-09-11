/**
 * Cloudflare Stream helpers
 *
 * Uploads video through your Cloudflare Worker (/upload endpoint)
 * which proxies to CF Stream API server-side.
 *
 * This avoids all client-side TUS/format/CORS issues — the worker
 * handles authentication and multipart encoding on the server.
 *
 * Uses expo-file-system uploadAsync for native streaming — no OOM.
 *
 * SECURITY (2026-09-11 audit P0 fix): the Worker now requires a verified
 * Firebase ID token on every request — uploadToStream() sends it as a
 * Bearer Authorization header and returns the Worker's signed
 * `ownershipToken` alongside the usual uid/playbackUrl/thumbnailUrl.
 * Callers (Createreelscreen.tsx) MUST forward that token, unmodified,
 * into submitSkillBattleReel / createBattleSubmission — those callables
 * reject a submission with no valid token. See cloudflare-worker.js's
 * header and functions/src/mediaOwnership.ts for the full design.
 */
import {
  cacheDirectory,
  copyAsync,
  deleteAsync,
  getInfoAsync,
} from "expo-file-system/legacy";
import { auth } from "@/lib/firebase";

const CF_CUSTOMER_CODE = "cif09s9962jkfc36";
const WORKER_URL       = process.env.EXPO_PUBLIC_CF_WORKER_URL ?? "";

// SECURITY FIX (2026-09-11 audit P0): the Worker now requires a verified
// Firebase ID token before issuing any upload authorization — see
// cloudflare-worker.js's header for the full design. Same
// getIdToken()-then-Authorization-header pattern already used throughout
// services/*Api.ts for calling this app's other authenticated HTTP
// endpoints (aiGuruApi.ts etc.) — not a new convention for this codebase.
async function getAuthHeader(): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("You must be signed in to upload.");
  return `Bearer ${token}`;
}

export function streamPlaybackUrl(videoId: string): string {
  return `https://customer-${CF_CUSTOMER_CODE}.cloudflarestream.com/${videoId}/manifest/video.m3u8`;
}

export function streamThumbnailUrl(videoId: string, timeSecs = 1): string {
  return `https://customer-${CF_CUSTOMER_CODE}.cloudflarestream.com/${videoId}/thumbnails/thumbnail.jpg?time=${timeSecs}s`;
}

// Resolves any mediaUrl format to a playable HLS URL.
// Handles: raw 32-char video ID, cloudflarestream.com URL,
// videodelivery.net URL, or plain fallback URL.
export function resolveStreamUrl(mediaUrl?: string): string | null {
  if (!mediaUrl) return null;
  if (/^[a-zA-Z0-9]{32}$/.test(mediaUrl.trim())) {
    return streamPlaybackUrl(mediaUrl.trim());
  }
  const cfMatch = mediaUrl.match(/cloudflarestream\.com\/([a-zA-Z0-9]+)/);
  if (cfMatch?.[1]) return streamPlaybackUrl(cfMatch[1]);
  const vdMatch = mediaUrl.match(/videodelivery\.net\/([a-zA-Z0-9]+)/);
  if (vdMatch?.[1]) return streamPlaybackUrl(vdMatch[1]);
  return mediaUrl;
}

// ── Step 1: Not needed anymore — worker handles full upload ───
// Kept for compatibility — returns a dummy uploadURL pointing to worker
export async function getStreamUploadUrl(title?: string): Promise<{
  uploadURL:    string;
  videoId:      string;
  playbackUrl:  string;
  thumbnailUrl: string;
}> {
  if (!WORKER_URL || WORKER_URL.includes("YOUR_WORKER"))
    throw new Error("EXPO_PUBLIC_CF_WORKER_URL not configured");

  // Return worker /upload endpoint as the uploadURL
  // videoId/playbackUrl/thumbnailUrl will be filled after actual upload
  return {
    uploadURL:    `${WORKER_URL}/upload`,
    videoId:      "",
    playbackUrl:  "",
    thumbnailUrl: "",
  };
}

// ── Upload video through worker proxy ─────────────────────────
// Uses XMLHttpRequest so upload.onprogress fires real byte-level progress.
// uploadAsync (expo-file-system) only resolves at 100% with no intermediate events.
export async function uploadToStream(
  uploadURL:   string,
  localUri:    string,
  onProgress?: (pct: number) => void,
  title?:      string
): Promise<{ uid: string; playbackUrl: string; thumbnailUrl: string; ownershipToken: string }> {
  console.log("[CF-2] localUri:", localUri.slice(0, 60));
  console.log("[CF-2] Uploading via worker proxy:", uploadURL);

  // Fetched BEFORE the upload starts — fail fast on a signed-out user
  // rather than after uploading a potentially large file for nothing.
  const authHeader = await getAuthHeader();

  // Ensure stable file:// URI (content:// URIs crash XHR on Android)
  let uploadUri  = localUri;
  let cacheUri: string | null = null;
  if (localUri.startsWith("content://")) {
    cacheUri  = `${cacheDirectory}cf_${Date.now()}.mp4`;
    await copyAsync({ from: localUri, to: cacheUri });
    uploadUri = cacheUri;
    console.log("[CF-2] Copied content:// to cache");
  }

  try {
    const info = await getInfoAsync(uploadUri);
    if (!info.exists) throw new Error("Video file not found: " + uploadUri);

    console.log("[CF-2] Sending to worker via XHR...");

    const result = await new Promise<{ uid: string; playbackUrl: string; thumbnailUrl: string; ownershipToken: string }>(
      (resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Real byte-level progress during upload
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            // Cap at 95% — last 5% reserved for server processing + response
            onProgress(Math.min(Math.round((event.loaded / event.total) * 95), 95));
          }
        };

        xhr.onload = () => {
          console.log("[CF-2] Worker response status:", xhr.status);
          console.log("[CF-2] Worker response:", xhr.responseText?.slice(0, 300));
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              if (!data.uid) {
                reject(new Error(`Worker response missing uid: ${xhr.responseText.slice(0, 200)}`));
                return;
              }
              // SECURITY FIX (2026-09-11 audit P0): a response with no
              // ownershipToken means the Worker either hasn't been
              // redeployed with the auth fix yet, or is misconfigured —
              // either way, submission would be rejected server-side
              // anyway (mediaOwnership.ts requires it), so fail here with
              // an honest message rather than silently uploading media
              // nothing can ever submit.
              if (!data.ownershipToken) {
                reject(new Error("Upload succeeded but the server did not return an ownership token. Please try again later."));
                return;
              }
              onProgress?.(100);
              console.log("[CF-2] ✅ Upload complete. uid:", data.uid);
              resolve({
                uid:            data.uid,
                playbackUrl:    data.playbackUrl  ?? streamPlaybackUrl(data.uid),
                thumbnailUrl:   data.thumbnailUrl ?? streamThumbnailUrl(data.uid),
                ownershipToken: data.ownershipToken,
              });
            } catch (e) {
              reject(new Error(`Failed to parse worker response: ${xhr.responseText.slice(0, 200)}`));
            }
          } else if (xhr.status === 401) {
            reject(new Error("Your session has expired. Please sign in again and retry the upload."));
          } else {
            reject(new Error(`Worker upload failed — HTTP ${xhr.status}: ${xhr.responseText?.slice(0, 300)}`));
          }
        };

        xhr.onerror   = () => reject(new Error("Network error during upload"));
        xhr.ontimeout = () => reject(new Error("Upload timed out"));

        xhr.open("POST", uploadURL);
        xhr.setRequestHeader("Content-Type",  "video/mp4");
        xhr.setRequestHeader("X-Video-Title", title ?? "Vidya Reel");
        xhr.setRequestHeader("Authorization", authHeader);

        // React Native XHR reads file:// URI natively and streams raw bytes
        xhr.send({ uri: uploadUri, type: "video/mp4", name: "upload.mp4" } as any);
      }
    );

    return result;
  } finally {
    if (cacheUri) deleteAsync(cacheUri, { idempotent: true }).catch(() => {});
  }
}
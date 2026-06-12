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
 */
import {
  cacheDirectory,
  copyAsync,
  deleteAsync,
  getInfoAsync,
} from "expo-file-system/legacy";

const CF_CUSTOMER_CODE = "cif09s9962jkfc36";
const WORKER_URL       = process.env.EXPO_PUBLIC_CF_WORKER_URL ?? "";

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
): Promise<{ uid: string; playbackUrl: string; thumbnailUrl: string }> {
  console.log("[CF-2] localUri:", localUri.slice(0, 60));
  console.log("[CF-2] Uploading via worker proxy:", uploadURL);

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

    const result = await new Promise<{ uid: string; playbackUrl: string; thumbnailUrl: string }>(
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
              onProgress?.(100);
              console.log("[CF-2] ✅ Upload complete. uid:", data.uid);
              resolve({
                uid:          data.uid,
                playbackUrl:  data.playbackUrl  ?? streamPlaybackUrl(data.uid),
                thumbnailUrl: data.thumbnailUrl ?? streamThumbnailUrl(data.uid),
              });
            } catch (e) {
              reject(new Error(`Failed to parse worker response: ${xhr.responseText.slice(0, 200)}`));
            }
          } else {
            reject(new Error(`Worker upload failed — HTTP ${xhr.status}: ${xhr.responseText?.slice(0, 300)}`));
          }
        };

        xhr.onerror   = () => reject(new Error("Network error during upload"));
        xhr.ontimeout = () => reject(new Error("Upload timed out"));

        xhr.open("POST", uploadURL);
        xhr.setRequestHeader("Content-Type",  "video/mp4");
        xhr.setRequestHeader("X-Video-Title", title ?? "Vidya Reel");

        // React Native XHR reads file:// URI natively and streams raw bytes
        xhr.send({ uri: uploadUri, type: "video/mp4", name: "upload.mp4" } as any);
      }
    );

    return result;
  } finally {
    if (cacheUri) deleteAsync(cacheUri, { idempotent: true }).catch(() => {});
  }
}
// PATH: apps/web/src/lib/cloudflareStream.ts
// Web equivalent of mobile lib/cloudflareStream.ts.
// Same Cloudflare Worker proxy (/upload endpoint handles CF Stream auth
// server-side) — the only difference from mobile is the upload source:
// mobile streams a local file:// URI, the browser already has a File/Blob
// in memory from the <input type="file"> picker, so we send that directly.

const CF_CUSTOMER_CODE = "cif09s9962jkfc36";
const WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? "";

export function streamPlaybackUrl(videoId: string): string {
  return `https://customer-${CF_CUSTOMER_CODE}.cloudflarestream.com/${videoId}/manifest/video.m3u8`;
}

export function streamThumbnailUrl(videoId: string, timeSecs = 1): string {
  return `https://customer-${CF_CUSTOMER_CODE}.cloudflarestream.com/${videoId}/thumbnails/thumbnail.jpg?time=${timeSecs}s`;
}

// Resolves any mediaUrl format to a playable HLS URL.
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

export function checkStreamConfigured(): void {
  if (!WORKER_URL || WORKER_URL.includes("YOUR_WORKER")) {
    throw new Error("NEXT_PUBLIC_CF_WORKER_URL not configured");
  }
}

// ── Manifest polling — used by the reels feed to know when a freshly
//    uploaded video has finished encoding on Cloudflare's side ──────────
export function extractCfVideoId(url: string): string | null {
  const match = url?.match(/cloudflarestream\.com\/([a-zA-Z0-9]+)\//);
  return match?.[1] ?? null;
}

export async function waitForManifest(
  manifestUrl: string,
  onAttempt: (attempt: number, max: number) => void,
  intervalMs = 2_000,
  maxAttempts = 20
): Promise<boolean> {
  const videoId = extractCfVideoId(manifestUrl);
  if (!videoId) return false;
  const statusUrl = WORKER_URL ? `${WORKER_URL}/video-status?uid=${videoId}` : null;

  for (let i = 1; i <= maxAttempts; i++) {
    onAttempt(i, maxAttempts);
    try {
      if (statusUrl) {
        const res = await fetch(statusUrl);
        if (res.status === 200) {
          const data = await res.json().catch(() => ({}));
          if (data.readyToStream === true || data.state === "ready") return true;
        } else if (res.status === 404) {
          const mRes = await fetch(manifestUrl, { method: "GET" });
          if (mRes.status === 200) return true;
        }
      } else {
        const res = await fetch(manifestUrl, { method: "GET" });
        if (res.status === 200) return true;
      }
    } catch { /* keep polling */ }
    if (i < maxAttempts) await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

// ── Upload a browser File/Blob through the worker proxy ───────────────────
// Uses XMLHttpRequest so upload.onprogress fires real byte-level progress
// (fetch() doesn't expose upload progress in browsers).
export async function uploadToStream(
  file: File,
  onProgress?: (pct: number) => void,
  title?: string
): Promise<{ uid: string; playbackUrl: string; thumbnailUrl: string }> {
  checkStreamConfigured();
  const uploadURL = `${WORKER_URL}/upload`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        // Cap at 95% — last 5% reserved for server processing + response
        onProgress(Math.min(Math.round((event.loaded / event.total) * 95), 95));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (!data.uid) {
            reject(new Error(`Worker response missing uid: ${xhr.responseText.slice(0, 200)}`));
            return;
          }
          onProgress?.(100);
          resolve({
            uid:          data.uid,
            playbackUrl:  data.playbackUrl  ?? streamPlaybackUrl(data.uid),
            thumbnailUrl: data.thumbnailUrl ?? streamThumbnailUrl(data.uid),
          });
        } catch {
          reject(new Error(`Failed to parse worker response: ${xhr.responseText.slice(0, 200)}`));
        }
      } else {
        reject(new Error(`Worker upload failed — HTTP ${xhr.status}: ${xhr.responseText?.slice(0, 300)}`));
      }
    };

    xhr.onerror   = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));

    xhr.open("POST", uploadURL);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.setRequestHeader("X-Video-Title", title ?? "Vidya Reel");
    xhr.send(file);
  });
}

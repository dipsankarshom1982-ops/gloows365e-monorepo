/**
 * Cloudflare Worker — Cloudflare Stream upload proxy
 *
 * Two endpoints:
 *   POST /create-upload-url  → returns uploadURL + playback info (unchanged)
 *   POST /upload             → proxies the video binary directly to Cloudflare Stream
 *                              so the app never deals with Cloudflare auth or format issues
 *
 * DEPLOY: paste into Workers & Pages → same "vidya-stream" worker → Save & Deploy
 */

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Video-Title",
  "Content-Type":                 "application/json",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(request.url);

    // /video-status is a read-only probe — allow GET
    if (url.pathname === "/video-status") {
      if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405, headers: CORS });
      const videoUid = url.searchParams.get("uid");
      if (!videoUid) return new Response(JSON.stringify({ error: "Missing uid" }), { status: 400, headers: CORS });

      if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
        return new Response(JSON.stringify({ error: "Worker env vars not configured" }), { status: 500, headers: CORS });
      }

      try {
        const res = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream/${videoUid}`,
          { headers: { "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}` } }
        );
        const data = await res.json();
        if (!data.success) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: CORS });

        return new Response(
          JSON.stringify({ state: data.result.status?.state, readyToStream: data.result.readyToStream }),
          { headers: CORS }
        );
      } catch (e) {
        return new Response(JSON.stringify({ error: "CF API fetch failed", detail: String(e) }), { status: 502, headers: CORS });
      }
    }

    if (request.method !== "POST")   return new Response("Method Not Allowed", { status: 405 });

    // ── Route 1: /create-upload-url ──────────────────────────────
    if (url.pathname === "/create-upload-url" || url.pathname === "/") {
      return handleCreateUploadUrl(request, env);
    }

    // ── Route 2: /upload ─────────────────────────────────────────
    if (url.pathname === "/upload") {
      return handleUpload(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};

// ── /create-upload-url ────────────────────────────────────────
async function handleCreateUploadUrl(request, env) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream/direct_upload`,
    {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ maxDurationSeconds: 300 }),
    }
  );

  const data = await res.json();
  if (!data.success) {
    return new Response(JSON.stringify({ error: "CF Stream error", detail: data.errors }), {
      status: 502, headers: CORS,
    });
  }

  const uid          = data.result.uid;
  const subdomain    = env.CLOUDFLARE_CUSTOMER_SUBDOMAIN ?? "";
  const playbackUrl  = subdomain
    ? `https://customer-${subdomain}.cloudflarestream.com/${uid}/manifest/video.m3u8`
    : null;
  const thumbnailUrl = subdomain
    ? `https://customer-${subdomain}.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg?time=1s`
    : null;

  return new Response(
    JSON.stringify({ uploadURL: data.result.uploadURL, uid, playbackUrl, thumbnailUrl }),
    { headers: CORS }
  );
}

// ── /upload ───────────────────────────────────────────────────
// Accepts raw video binary from the app and uploads to CF Stream API directly.
// Returns { uid, playbackUrl, thumbnailUrl } on success.
async function handleUpload(request, env) {
  const title     = request.headers.get("X-Video-Title") ?? "Vidya Reel";
  const videoBlob = await request.blob();

  if (!videoBlob || videoBlob.size === 0) {
    return new Response(JSON.stringify({ error: "Empty video body" }), {
      status: 400, headers: CORS,
    });
  }

  console.log("Worker: uploading", videoBlob.size, "bytes to CF Stream");

  // Build multipart form — this is what CF Stream /stream endpoint expects
  const form = new FormData();
  form.append("file", videoBlob, "reel.mp4");

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream`,
    {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        // Do NOT set Content-Type — fetch sets multipart boundary automatically
      },
      body: form,
    }
  );

  const data = await res.json();
  console.log("Worker: CF Stream response status:", res.status);

  if (!data.success) {
    return new Response(
      JSON.stringify({ error: "CF Stream upload failed", detail: data.errors }),
      { status: 502, headers: CORS }
    );
  }

  const uid          = data.result.uid;
  const subdomain    = env.CLOUDFLARE_CUSTOMER_SUBDOMAIN ?? "";
  const playbackUrl  = subdomain
    ? `https://customer-${subdomain}.cloudflarestream.com/${uid}/manifest/video.m3u8`
    : null;
  const thumbnailUrl = subdomain
    ? `https://customer-${subdomain}.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg?time=1s`
    : null;

  return new Response(
    JSON.stringify({ uid, playbackUrl, thumbnailUrl }),
    { headers: CORS }
  );
}
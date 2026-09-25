/**
 * Cloudflare Worker — Cloudflare Stream upload proxy
 *
 * Three endpoints:
 *   POST /create-upload-url  → returns uploadURL + playback info
 *   POST /upload             → proxies the video binary directly to Cloudflare Stream
 *                              so the app never deals with Cloudflare auth or format issues
 *   GET  /video-status       → read-only processing-status probe (unchanged by this fix —
 *                              out of scope, see the 2026-09-11 audit: it exposes no
 *                              upload/write capability, just the state of an already-known uid)
 *
 * AUTHENTICATION + MEDIA OWNERSHIP (2026-09-11 audit P0 fix)
 * ─────────────────────────────────────────────────────────────────────────
 * Both /create-upload-url and /upload used to accept ANY request — no
 * Firebase identity check, no binding between the resulting Cloudflare
 * Stream video and any uid. Anyone who found this Worker's URL could
 * upload unlimited video to Gloows365's paid Cloudflare Stream account,
 * and functions/src/{battleSubmissions,skillBattleSubmission}.ts had no
 * way to prove a submitted mediaRef/mediaUrl actually belonged to the
 * submitting student (see those files' own "MEDIA OWNERSHIP" headers).
 *
 * Fixed by:
 *   1. Both endpoints now REQUIRE `Authorization: Bearer <Firebase ID
 *      token>`. The token is verified right here, in the Worker, against
 *      Google's public JWKS (RS256) — no Firebase Admin SDK, no
 *      service-account private key, no secret of any kind needed for
 *      this step, since it's a public-key signature check. This is
 *      Google's own documented approach for verifying Firebase ID tokens
 *      outside a Node/Admin-SDK environment (which Cloudflare Workers'
 *      V8-isolate runtime is — no Node APIs, no npm install step; this
 *      file is still deployed by pasting it into the dashboard, so it
 *      intentionally has zero external dependencies — only native
 *      fetch/atob/btoa/crypto.subtle).
 *   2. The verified token's `sub` claim (never a client-supplied field)
 *      becomes the ONLY uid this Worker ever trusts. It's attached to the
 *      Cloudflare Stream video itself via the `meta` field (so the
 *      video's ownership is traceable at Cloudflare's own layer too —
 *      but see point 3 for why that traceability isn't what's actually
 *      enforced downstream).
 *   3. The Worker mints a short-lived (30 min), HMAC-SHA256-signed
 *      "ownership token" binding {uid, videoUid, iat, exp}, using a
 *      secret (WORKER_OWNERSHIP_SECRET) known ONLY to this Worker and to
 *      functions/src/mediaOwnership.ts — never sent to, or derivable by,
 *      the mobile client. This token is returned alongside the usual
 *      uploadURL/uid/playbackUrl/thumbnailUrl fields. The mobile app
 *      forwards it, unmodified, to createBattleSubmission /
 *      submitSkillBattleReel, which independently verify the signature
 *      before ever creating a submission — see that file's header for
 *      why a signed token was chosen over re-querying Cloudflare's API
 *      from Cloud Functions (would need a SECOND Cloudflare credential
 *      provisioned into Cloud Functions; this needs none there).
 *
 * REQUIRED WORKER ENVIRONMENT (set in the Cloudflare dashboard, next to
 * the existing CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN /
 * CLOUDFLARE_CUSTOMER_SUBDOMAIN bindings):
 *   - FIREBASE_PROJECT_ID       — the Firebase project id (public, not a
 *                                 secret — the same value already shipped
 *                                 to the app as EXPO_PUBLIC_FIREBASE_PROJECT_ID).
 *                                 Production: "gloows-03b6sz".
 *   - WORKER_OWNERSHIP_SECRET   — a NEW secret, random 32+ bytes, shared
 *                                 ONLY with Cloud Functions' own
 *                                 WORKER_OWNERSHIP_SECRET (provisioned via
 *                                 `firebase functions:secrets:set
 *                                 WORKER_OWNERSHIP_SECRET`). Generate once
 *                                 (e.g. `openssl rand -base64 32`) and set
 *                                 the IDENTICAL value in both places —
 *                                 mismatched secrets make every submission
 *                                 fail closed (reject), never fail open.
 *                                 Mark as a Cloudflare Worker "Secret"
 *                                 binding, not a plaintext env var.
 *
 * DEPLOY: paste into Workers & Pages → same "vidya-stream" worker → Save & Deploy.
 * This is a source change only — it has no effect until (a) it's actually
 * redeployed to Cloudflare AND (b) both new env values above are set.
 */

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  // Authorization added — the new required auth header.
  "Access-Control-Allow-Headers": "Content-Type, X-Video-Title, Authorization",
  "Content-Type":                 "application/json",
};

// CORS DECISION (2026-09-11 audit, §9): left permissive (`*`) deliberately,
// not tightened. This Worker is called from native mobile code (React
// Native's XHR/fetch on iOS/Android), which does not send an `Origin`
// header the way a browser does and is not subject to the browser
// same-origin/CORS model at all — so a CORS allowlist here would protect
// nothing for the actual client, only a hypothetical browser-based caller
// this Worker doesn't currently serve. Authentication (the Firebase ID
// token check below) is the real, enforced control for every caller,
// browser or not — CORS is not, and must never be treated as, a substitute
// for it. If a browser-based caller (e.g. a future web upload flow) is
// ever added, restrict this to that flow's actual origin at that time
// rather than guessing one now.

// ─── Firebase ID token verification (no Admin SDK, no service account) ────
// Verifies a Firebase ID token's RS256 signature against Google's public
// JWKS and checks the standard Firebase claims — the same checks the
// Admin SDK's verifyIdToken performs, reimplemented with only Web APIs
// since firebase-admin cannot run in the Workers runtime (no Node APIs).

const GOOGLE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const JWKS_DEFAULT_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour, if Google's response omits Cache-Control

// Module-scope cache — persists across requests on a warm Worker isolate
// (not guaranteed across cold starts, which is fine: it's a cache of
// PUBLIC keys, not a secret or a security boundary, so a cache miss just
// costs one extra fetch, never a security regression).
let jwksCache = null; // { keys: JWK[], expiresAtMs: number }

async function getGoogleJwks() {
  const now = Date.now();
  if (jwksCache && jwksCache.expiresAtMs > now) return jwksCache.keys;

  const res = await fetch(GOOGLE_JWKS_URL);
  if (!res.ok) throw new AuthError("jwks_fetch_failed", "Could not fetch identity verification keys");
  const body = await res.json();
  if (!body || !Array.isArray(body.keys)) throw new AuthError("jwks_malformed", "Identity verification keys malformed");

  let maxAgeMs = JWKS_DEFAULT_MAX_AGE_MS;
  const cacheControl = res.headers.get("Cache-Control") || "";
  const match = cacheControl.match(/max-age=(\d+)/);
  if (match) maxAgeMs = Math.max(60_000, parseInt(match[1], 10) * 1000);

  jwksCache = { keys: body.keys, expiresAtMs: now + maxAgeMs };
  return body.keys;
}

function base64UrlToUint8Array(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeJwtPart(b64url) {
  const bytes = base64UrlToUint8Array(b64url);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

// Thrown for every authentication failure — the message is safe to log
// server-side (console.error) but the HTTP handler NEVER echoes it back
// to the caller verbatim (see jsonError()'s generic 401 body below), so a
// caller probing this endpoint can't learn which specific check failed.
class AuthError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Verifies a Firebase ID token per Firebase's documented manual-verification
 * algorithm. Returns the verified uid (the token's `sub` claim) or throws
 * AuthError. Never trusts anything in the token before the signature check
 * passes.
 */
async function verifyFirebaseIdToken(idToken, projectId) {
  if (!projectId) throw new AuthError("server_misconfigured", "FIREBASE_PROJECT_ID not configured");
  if (typeof idToken !== "string" || idToken.length === 0) {
    throw new AuthError("missing_token", "Missing ID token");
  }

  const parts = idToken.split(".");
  if (parts.length !== 3) throw new AuthError("malformed_token", "Malformed ID token");
  const [headerB64, payloadB64, signatureB64] = parts;

  let header, payload;
  try {
    header = decodeJwtPart(headerB64);
    payload = decodeJwtPart(payloadB64);
  } catch {
    throw new AuthError("malformed_token", "Malformed ID token");
  }

  if (header.alg !== "RS256") throw new AuthError("bad_alg", "Unexpected token algorithm");
  if (!header.kid) throw new AuthError("malformed_token", "Missing key id");

  const keys = await getGoogleJwks();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new AuthError("unknown_key", "Unknown signing key");

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signatureBytes = base64UrlToUint8Array(signatureB64);
  const signatureOk = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, signatureBytes, signingInput);
  if (!signatureOk) throw new AuthError("bad_signature", "Invalid token signature");

  // ── Claims — same set the Admin SDK's verifyIdToken checks ──
  const nowSec = Date.now() / 1000;
  if (typeof payload.exp !== "number" || payload.exp <= nowSec) {
    throw new AuthError("expired", "Token expired");
  }
  if (typeof payload.iat !== "number" || payload.iat > nowSec + 60) {
    throw new AuthError("not_yet_valid", "Token issued in the future");
  }
  if (typeof payload.auth_time !== "number" || payload.auth_time > nowSec + 60) {
    throw new AuthError("bad_auth_time", "Invalid auth_time");
  }
  if (payload.aud !== projectId) {
    throw new AuthError("bad_audience", "Token audience mismatch");
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new AuthError("bad_issuer", "Token issuer mismatch");
  }
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new AuthError("bad_subject", "Token missing subject");
  }

  return { uid: payload.sub };
}

/**
 * Reads and verifies the Authorization header. Throws AuthError on any
 * failure — callers must catch it and respond with the generic 401 below.
 */
async function requireFirebaseAuth(request, env) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new AuthError("missing_header", "Missing or malformed Authorization header");
  const { uid } = await verifyFirebaseIdToken(match[1], env.FIREBASE_PROJECT_ID);
  return uid;
}

// Every authentication failure returns exactly this shape — no token
// contents, no internal verification reason, no Cloudflare account
// details, no stack trace. The real reason is only ever console.error'd
// (Worker-side logs, never sent in the response).
function unauthorizedResponse(err) {
  console.error("Worker auth rejected:", err && err.code, err && err.message);
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
}

// ─── Ownership token (HMAC-SHA256, Web Crypto — no Node `crypto`) ────────
// Wire format: base64url(JSON payload) + "." + base64url(HMAC-SHA256
// signature over that exact string) — verified Functions-side by
// functions/src/mediaOwnership.ts, which MUST stay byte-for-byte
// compatible with this encoding (see that file's test helper).

const OWNERSHIP_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function mintOwnershipToken(uid, videoUid, secret) {
  const now = Date.now();
  const payload = { uid, videoUid, iat: now, exp: now + OWNERSHIP_TOKEN_TTL_MS };
  const payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  const sigB64 = uint8ArrayToBase64Url(new Uint8Array(sigBuf));

  return `${payloadB64}.${sigB64}`;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(request.url);

    // /video-status is a read-only probe — unchanged by this fix, see
    // header comment. Out of scope for the P0 (no upload/write capability).
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
      let uid;
      try {
        uid = await requireFirebaseAuth(request, env);
      } catch (err) {
        return unauthorizedResponse(err);
      }
      return handleCreateUploadUrl(request, env, uid);
    }

    // ── Route 2: /upload ─────────────────────────────────────────
    if (url.pathname === "/upload") {
      let uid;
      try {
        uid = await requireFirebaseAuth(request, env);
      } catch (err) {
        return unauthorizedResponse(err);
      }
      return handleUpload(request, env, uid);
    }

    return new Response("Not Found", { status: 404 });
  },
};

// ── /create-upload-url ────────────────────────────────────────
// `uid` here is ALWAYS the verified Firebase uid from requireFirebaseAuth
// above — never anything from the request body/query. The client cannot
// choose another user's uid; there is nowhere in this handler that reads
// a client-supplied uid at all.
async function handleCreateUploadUrl(request, env, uid) {
  if (!env.WORKER_OWNERSHIP_SECRET) {
    return new Response(JSON.stringify({ error: "Worker not configured for secure uploads" }), { status: 500, headers: CORS });
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream/direct_upload`,
    {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type":  "application/json",
      },
      // meta.uid ties the video to the verified uploader at Cloudflare's
      // own layer — a defense-in-depth provenance record, not what this
      // system actually relies on for enforcement (that's the signed
      // ownership token below, checked independently server-side by
      // Cloud Functions without needing a second Cloudflare credential).
      body: JSON.stringify({ maxDurationSeconds: 300, meta: { uid, source: "gloows365-skillbattle" } }),
    }
  );

  const data = await res.json();
  if (!data.success) {
    return new Response(JSON.stringify({ error: "CF Stream error", detail: data.errors }), {
      status: 502, headers: CORS,
    });
  }

  const cfUid       = data.result.uid;
  const subdomain    = env.CLOUDFLARE_CUSTOMER_SUBDOMAIN ?? "";
  const playbackUrl  = subdomain
    ? `https://customer-${subdomain}.cloudflarestream.com/${cfUid}/manifest/video.m3u8`
    : null;
  const thumbnailUrl = subdomain
    ? `https://customer-${subdomain}.cloudflarestream.com/${cfUid}/thumbnails/thumbnail.jpg?time=1s`
    : null;

  const ownershipToken = await mintOwnershipToken(uid, cfUid, env.WORKER_OWNERSHIP_SECRET);

  return new Response(
    JSON.stringify({ uploadURL: data.result.uploadURL, uid: cfUid, playbackUrl, thumbnailUrl, ownershipToken }),
    { headers: CORS }
  );
}

// ── /upload ───────────────────────────────────────────────────
// Accepts raw video binary from the app and uploads to CF Stream API directly.
// Returns { uid, playbackUrl, thumbnailUrl, ownershipToken } on success.
// `uid` (parameter, the verified Firebase uid) — same trust rule as
// handleCreateUploadUrl above: always from requireFirebaseAuth, never
// from the request.
async function handleUpload(request, env, uid) {
  if (!env.WORKER_OWNERSHIP_SECRET) {
    return new Response(JSON.stringify({ error: "Worker not configured for secure uploads" }), { status: 500, headers: CORS });
  }

  const title     = request.headers.get("X-Video-Title") ?? "Vidya Reel";
  const videoBlob = await request.blob();

  if (!videoBlob || videoBlob.size === 0) {
    return new Response(JSON.stringify({ error: "Empty video body" }), {
      status: 400, headers: CORS,
    });
  }

  console.log("Worker: uploading", videoBlob.size, "bytes to CF Stream for uid", uid);

  // Build multipart form — this is what CF Stream /stream endpoint expects.
  // `meta` carries the same verified-uid provenance tag as
  // handleCreateUploadUrl's direct_upload call above.
  const form = new FormData();
  form.append("file", videoBlob, "reel.mp4");
  form.append("meta", JSON.stringify({ uid, source: "gloows365-skillbattle", title }));

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

  const cfUid       = data.result.uid;
  const subdomain    = env.CLOUDFLARE_CUSTOMER_SUBDOMAIN ?? "";
  const playbackUrl  = subdomain
    ? `https://customer-${subdomain}.cloudflarestream.com/${cfUid}/manifest/video.m3u8`
    : null;
  const thumbnailUrl = subdomain
    ? `https://customer-${subdomain}.cloudflarestream.com/${cfUid}/thumbnails/thumbnail.jpg?time=1s`
    : null;

  const ownershipToken = await mintOwnershipToken(uid, cfUid, env.WORKER_OWNERSHIP_SECRET);

  return new Response(
    JSON.stringify({ uid: cfUid, playbackUrl, thumbnailUrl, ownershipToken }),
    { headers: CORS }
  );
}

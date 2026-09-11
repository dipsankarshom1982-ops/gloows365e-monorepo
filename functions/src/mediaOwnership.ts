// PATH: functions/src/mediaOwnership.ts
//
// Verifies the short-lived, HMAC-signed media-ownership token issued by
// the Cloudflare Stream upload Worker (apps/mobile/cloudflare-worker.js)
// after IT verifies the caller's Firebase ID token — see that file's
// header for the full "why a signed token" reasoning.
//
// Closes the P0 finding from the 2026-09-11 Free Student Launch Readiness
// Audit: neither /create-upload-url nor /upload used to verify who was
// calling them, and createBattleSubmission/submitSkillBattleReel trusted
// a client-supplied mediaUrl/mediaRef with no way to prove it was
// actually uploaded by the submitting student. The Worker now verifies
// the caller's Firebase identity (RS256 against Google's public JWKS —
// no service-account secret involved on the Worker side) BEFORE issuing
// a Cloudflare Stream upload authorization, and mints a token binding
// {uid, videoUid} signed with a secret shared ONLY between the Worker
// and these two Cloud Functions (WORKER_OWNERSHIP_SECRET, a Firebase
// Functions secret — never sent to, or readable by, the mobile client).
// This file is the Functions-side half of that pair: it verifies the
// signature, expiry, and that both the uid and the video actually
// referenced in the submission match what the Worker attested.
//
// Mirrors financial/checkoutSignature.ts's timing-safe-HMAC-compare shape
// (same `crypto` module, same "return a result, never throw on a
// mismatch" contract) — not a new verification style for this codebase.
//
// This file only ever VERIFIES — it deliberately does not export a
// signing/minting function; minting is the Worker's job, in the Worker's
// own runtime (Web Crypto, not Node's `crypto`, since Cloudflare Workers
// have no `crypto.createHmac`). Tests that need a valid token mint one
// locally against the exact same wire format — see
// __tests__/helpers/mediaOwnershipTestHelper.ts.

import * as crypto from "crypto";

export interface MediaOwnershipPayload {
  uid: string;
  videoUid: string;
  iat: number; // ms epoch — when the Worker minted this token
  exp: number; // ms epoch — token is invalid at/after this instant
}

export interface MediaOwnershipCheckResult {
  valid: boolean;
  // Internal-only — for server logs. Never send this string to the
  // client; every rejection reason maps to the SAME generic, safe
  // "could not verify media ownership" message at the call site (see
  // battleSubmissions.ts / skillBattleSubmission.ts), so a caller
  // probing this endpoint can't learn WHY a forged token failed.
  reason?: "server_misconfigured" | "missing_token" | "malformed_token"
    | "bad_signature" | "expired" | "not_yet_valid" | "uid_mismatch" | "media_mismatch";
}

function base64UrlDecodeToString(input: string): string | null {
  try {
    return Buffer.from(input, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Verifies a media-ownership token minted by the Cloudflare Worker.
 *
 * `expectedUid` MUST always be the AUTHENTICATED Cloud Function caller's
 * own uid (`context.auth.uid`) — never a client-supplied value — so a
 * token that's structurally valid but was minted for a different uid is
 * still rejected (closes "Attack C: forged UID").
 *
 * `mediaRefOrUrl` is the mediaRef/mediaUrl the client is trying to
 * submit; the token's `videoUid` must be a substring of it, so a token
 * minted for one upload can't be replayed against a different (e.g.
 * someone else's) media reference (closes "Attack D: cross-user media
 * claim").
 */
export function verifyMediaOwnershipToken(
  token: unknown,
  expectedUid: string,
  mediaRefOrUrl: unknown,
  secret: string,
): MediaOwnershipCheckResult {
  if (typeof secret !== "string" || secret.length === 0) {
    // Misconfiguration (secret not provisioned yet), not a client error.
    return { valid: false, reason: "server_misconfigured" };
  }
  if (typeof token !== "string" || token.length === 0) {
    return { valid: false, reason: "missing_token" };
  }

  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false, reason: "malformed_token" };
  const [payloadB64, signatureB64] = parts;
  if (!payloadB64 || !signatureB64) return { valid: false, reason: "malformed_token" };

  // ── Signature check first, before ever trusting the decoded payload — ──
  let providedSigBuf: Buffer;
  try {
    providedSigBuf = Buffer.from(signatureB64, "base64url");
  } catch {
    return { valid: false, reason: "malformed_token" };
  }
  const expectedSigBuf = crypto.createHmac("sha256", secret).update(payloadB64).digest();
  // timingSafeEqual throws on a length mismatch — checked explicitly
  // first so a forged/truncated signature is just "not verified", not an
  // uncaught exception, matching checkoutSignature.ts's own pattern.
  if (expectedSigBuf.length !== providedSigBuf.length) return { valid: false, reason: "bad_signature" };
  if (!crypto.timingSafeEqual(expectedSigBuf, providedSigBuf)) return { valid: false, reason: "bad_signature" };

  // ── Only now decode/trust the payload — the signature above proves ──
  // it was produced by the Worker, not forged by a client.
  const payloadJson = base64UrlDecodeToString(payloadB64);
  if (!payloadJson) return { valid: false, reason: "malformed_token" };

  let payload: Partial<MediaOwnershipPayload>;
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    return { valid: false, reason: "malformed_token" };
  }
  if (
    typeof payload.uid !== "string" || payload.uid.length === 0 ||
    typeof payload.videoUid !== "string" || payload.videoUid.length === 0 ||
    typeof payload.iat !== "number" || !Number.isFinite(payload.iat) ||
    typeof payload.exp !== "number" || !Number.isFinite(payload.exp)
  ) {
    return { valid: false, reason: "malformed_token" };
  }

  const now = Date.now();
  if (payload.exp <= now) return { valid: false, reason: "expired" };
  // Small forward-clock tolerance for clock skew between the Worker and
  // this Function's host — same order of magnitude as Firebase ID
  // token verification's own leeway.
  if (payload.iat > now + 30_000) return { valid: false, reason: "not_yet_valid" };

  if (payload.uid !== expectedUid) return { valid: false, reason: "uid_mismatch" };

  if (typeof mediaRefOrUrl !== "string" || mediaRefOrUrl.length === 0 || !mediaRefOrUrl.includes(payload.videoUid)) {
    return { valid: false, reason: "media_mismatch" };
  }

  return { valid: true };
}

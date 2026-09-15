// PATH: functions/src/__tests__/helpers/mediaOwnershipTestHelper.ts
//
// Test-only token minting for ../mediaOwnership.ts's
// verifyMediaOwnershipToken. Production tokens are minted by the
// Cloudflare Worker (apps/mobile/cloudflare-worker.js) using Web Crypto,
// not by Cloud Functions — this file exists so tests can produce a
// structurally-real token without spinning up a Workers runtime. It's a
// deliberate, independent re-implementation of the exact same wire
// format (base64url(JSON payload) + "." + base64url(HMAC-SHA256)), not
// an import of production signing code — there isn't any to import, by
// design (see mediaOwnership.ts's header on why this file only verifies).

import * as crypto from "crypto";
import type { MediaOwnershipPayload } from "../../mediaOwnership";

export const TEST_OWNERSHIP_SECRET = "test_worker_ownership_secret";

export function mintMediaOwnershipToken(
  payload: Partial<MediaOwnershipPayload> & { uid: string; videoUid: string },
  secret: string = TEST_OWNERSHIP_SECRET,
): string {
  const now = Date.now();
  const full: MediaOwnershipPayload = {
    iat: now,
    exp: now + 30 * 60 * 1000, // matches the Worker's real 30-minute TTL
    ...payload,
  };
  const payloadB64 = Buffer.from(JSON.stringify(full), "utf8").toString("base64url");
  const sigB64 = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sigB64}`;
}

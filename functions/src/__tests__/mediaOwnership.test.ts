// PATH: functions/src/__tests__/mediaOwnership.test.ts
//
// Offline unit tests for mediaOwnership.ts's verifyMediaOwnershipToken —
// the Functions-side half of the Cloudflare Stream authentication +
// media-ownership fix (2026-09-11 audit P0). No firebase-admin mocking
// needed — this is a pure function over a signed token string.

import * as crypto from "crypto";
import { verifyMediaOwnershipToken } from "../mediaOwnership";
import { mintMediaOwnershipToken, TEST_OWNERSHIP_SECRET } from "./helpers/mediaOwnershipTestHelper";

const UID = "student_1";
const VIDEO_UID = "cfvid1234567890abcdef1234567890ab";
const MEDIA_URL = `https://customer-abc123.cloudflarestream.com/${VIDEO_UID}/manifest/video.m3u8`;

describe("verifyMediaOwnershipToken — happy path", () => {
  test("a freshly minted, correctly targeted token is accepted", () => {
    const token = mintMediaOwnershipToken({ uid: UID, videoUid: VIDEO_UID });
    const result = verifyMediaOwnershipToken(token, UID, MEDIA_URL, TEST_OWNERSHIP_SECRET);
    expect(result.valid).toBe(true);
  });

  test("accepts a bare videoUid as mediaRef (canonical-engine shape)", () => {
    const token = mintMediaOwnershipToken({ uid: UID, videoUid: VIDEO_UID });
    const result = verifyMediaOwnershipToken(token, UID, VIDEO_UID, TEST_OWNERSHIP_SECRET);
    expect(result.valid).toBe(true);
  });
});

describe("verifyMediaOwnershipToken — Attack A/B: missing or malformed token", () => {
  test("rejects a missing token", () => {
    expect(verifyMediaOwnershipToken(undefined, UID, MEDIA_URL, TEST_OWNERSHIP_SECRET))
      .toMatchObject({ valid: false, reason: "missing_token" });
    expect(verifyMediaOwnershipToken("", UID, MEDIA_URL, TEST_OWNERSHIP_SECRET))
      .toMatchObject({ valid: false, reason: "missing_token" });
  });

  test("rejects a non-string token", () => {
    expect(verifyMediaOwnershipToken(12345, UID, MEDIA_URL, TEST_OWNERSHIP_SECRET))
      .toMatchObject({ valid: false, reason: "missing_token" });
  });

  test("rejects a malformed token (no signature segment)", () => {
    expect(verifyMediaOwnershipToken("not-a-real-token", UID, MEDIA_URL, TEST_OWNERSHIP_SECRET))
      .toMatchObject({ valid: false, reason: "malformed_token" });
  });

  test("rejects a token with an unparsable payload segment", () => {
    const badPayload = Buffer.from("not json", "utf8").toString("base64url");
    const sig = crypto.createHmac("sha256", TEST_OWNERSHIP_SECRET).update(badPayload).digest("base64url");
    expect(verifyMediaOwnershipToken(`${badPayload}.${sig}`, UID, MEDIA_URL, TEST_OWNERSHIP_SECRET))
      .toMatchObject({ valid: false, reason: "malformed_token" });
  });

  test("rejects a token whose payload is missing required fields", () => {
    const partial = Buffer.from(JSON.stringify({ uid: UID }), "utf8").toString("base64url");
    const sig = crypto.createHmac("sha256", TEST_OWNERSHIP_SECRET).update(partial).digest("base64url");
    expect(verifyMediaOwnershipToken(`${partial}.${sig}`, UID, MEDIA_URL, TEST_OWNERSHIP_SECRET))
      .toMatchObject({ valid: false, reason: "malformed_token" });
  });
});

describe("verifyMediaOwnershipToken — Attack: forged/tampered signature", () => {
  test("rejects a token signed with the wrong secret", () => {
    const token = mintMediaOwnershipToken({ uid: UID, videoUid: VIDEO_UID }, "wrong_secret");
    expect(verifyMediaOwnershipToken(token, UID, MEDIA_URL, TEST_OWNERSHIP_SECRET))
      .toMatchObject({ valid: false, reason: "bad_signature" });
  });

  test("rejects a token whose payload was tampered with after signing (re-targeted uid)", () => {
    const token = mintMediaOwnershipToken({ uid: "student_1", videoUid: VIDEO_UID });
    const [payloadB64, sig] = token.split(".");
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    payload.uid = "student_2"; // attacker edits the decoded payload...
    const tamperedB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const tamperedToken = `${tamperedB64}.${sig}`; // ...but reuses the ORIGINAL signature
    expect(verifyMediaOwnershipToken(tamperedToken, "student_2", MEDIA_URL, TEST_OWNERSHIP_SECRET))
      .toMatchObject({ valid: false, reason: "bad_signature" });
  });

  test("rejects a signature of the wrong length", () => {
    const token = mintMediaOwnershipToken({ uid: UID, videoUid: VIDEO_UID });
    const [payloadB64] = token.split(".");
    expect(verifyMediaOwnershipToken(`${payloadB64}.short`, UID, MEDIA_URL, TEST_OWNERSHIP_SECRET))
      .toMatchObject({ valid: false, reason: "bad_signature" });
  });
});

describe("verifyMediaOwnershipToken — expiry", () => {
  test("rejects an expired token", () => {
    const past = Date.now() - 60_000;
    const token = mintMediaOwnershipToken({ uid: UID, videoUid: VIDEO_UID, iat: past - 1000, exp: past });
    expect(verifyMediaOwnershipToken(token, UID, MEDIA_URL, TEST_OWNERSHIP_SECRET))
      .toMatchObject({ valid: false, reason: "expired" });
  });

  test("rejects a token issued too far in the future (clock-skew guard)", () => {
    const future = Date.now() + 10 * 60 * 1000;
    const token = mintMediaOwnershipToken({ uid: UID, videoUid: VIDEO_UID, iat: future, exp: future + 60_000 });
    expect(verifyMediaOwnershipToken(token, UID, MEDIA_URL, TEST_OWNERSHIP_SECRET))
      .toMatchObject({ valid: false, reason: "not_yet_valid" });
  });
});

describe("verifyMediaOwnershipToken — Attack C: forged UID", () => {
  test("a token minted for one uid is rejected when checked against a different expected uid", () => {
    const token = mintMediaOwnershipToken({ uid: "student_1", videoUid: VIDEO_UID });
    // Caller is authenticated as student_2 but tries to use student_1's token.
    expect(verifyMediaOwnershipToken(token, "student_2", MEDIA_URL, TEST_OWNERSHIP_SECRET))
      .toMatchObject({ valid: false, reason: "uid_mismatch" });
  });
});

describe("verifyMediaOwnershipToken — Attack D: cross-user media claim", () => {
  test("User B cannot submit User A's mediaRef using User A's token as if it were their own upload for a different video", () => {
    // User A's real, valid token for User A's own video.
    const tokenForVideoA = mintMediaOwnershipToken({ uid: "student_a", videoUid: "video_a_uid" });
    // User B (authenticated as student_b) tries to reuse it against a
    // DIFFERENT video (video_b_uid, which they don't actually own either).
    const result = verifyMediaOwnershipToken(tokenForVideoA, "student_b", "https://.../video_b_uid/manifest/video.m3u8", TEST_OWNERSHIP_SECRET);
    expect(result.valid).toBe(false); // fails on uid_mismatch first
  });

  test("a token for video A cannot be used to claim video B, even for the SAME uid", () => {
    const token = mintMediaOwnershipToken({ uid: UID, videoUid: "video_a_uid" });
    const result = verifyMediaOwnershipToken(token, UID, "https://.../video_b_uid/manifest/video.m3u8", TEST_OWNERSHIP_SECRET);
    expect(result).toMatchObject({ valid: false, reason: "media_mismatch" });
  });
});

describe("verifyMediaOwnershipToken — server misconfiguration fails closed", () => {
  test("rejects everything if no secret is configured, rather than skipping verification", () => {
    const token = mintMediaOwnershipToken({ uid: UID, videoUid: VIDEO_UID });
    expect(verifyMediaOwnershipToken(token, UID, MEDIA_URL, ""))
      .toMatchObject({ valid: false, reason: "server_misconfigured" });
  });
});

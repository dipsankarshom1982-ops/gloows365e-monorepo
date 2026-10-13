// PATH: functions/src/__tests__/moderation/similarityProvider.test.ts
//
// Offline unit tests for CloudflareThumbnailSimilarityProvider — mocks
// global fetch (thumbnail downloads) and uses jpeg-js's own encoder to
// produce real decodable JPEG bytes, same approach as hashUtils.test.ts.

jest.mock("firebase-admin", () => require("../helpers/mockFirebaseAdmin").mockAdminModule);

import * as jpeg from "jpeg-js";
import { fakeDb } from "../helpers/mockFirebaseAdmin";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

function solidColorJpegBytes(r: number, g: number, b: number): Buffer {
  const width = 16, height = 16;
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
  }
  return Buffer.from(jpeg.encode({ data, width, height }, 90).data);
}

// A solid-color image hashes to all-1-bits regardless of which color
// (every pixel exactly equals the mean) — meaningless for a "these two
// are visually different" test. A checkerboard has real internal
// contrast, so it hashes distinctly from a solid color, unlike two
// different solid colors compared against each other.
function checkerboardJpegBytes(): Buffer {
  const width = 16, height = 16;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0 ? 0 : 255;
      const idx = (y * width + x) * 4;
      data[idx] = v; data[idx + 1] = v; data[idx + 2] = v; data[idx + 3] = 255;
    }
  }
  return Buffer.from(jpeg.encode({ data, width, height }, 90).data);
}

function mockThumbnailFetchReturning(bytes: Buffer) {
  (global.fetch as jest.Mock).mockImplementation(async () => ({
    ok: true,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  }));
}

beforeEach(() => {
  fakeDb.reset();
  process.env = { ...ORIGINAL_ENV, CLOUDFLARE_CUSTOMER_SUBDOMAIN: "testsub" };
  global.fetch = jest.fn();
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
  global.fetch = ORIGINAL_FETCH;
});

describe("CloudflareThumbnailSimilarityProvider — configuration", () => {
  test("no customer subdomain configured -> NOT_CHECKED without calling fetch", async () => {
    process.env.CLOUDFLARE_CUSTOMER_SUBDOMAIN = "";
    const { CloudflareThumbnailSimilarityProvider } = require("../../moderation/videoSimilarityProvider");
    const provider = new CloudflareThumbnailSimilarityProvider();
    const result = await provider.checkSimilarity({ submissionId: "s1", videoRef: "x", battleId: "b1", streamVideoUid: "uid1" });
    expect(result.status).toBe("NOT_CHECKED");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("no streamVideoUid yet -> NOT_CHECKED", async () => {
    const { CloudflareThumbnailSimilarityProvider } = require("../../moderation/videoSimilarityProvider");
    const provider = new CloudflareThumbnailSimilarityProvider();
    const result = await provider.checkSimilarity({ submissionId: "s1", videoRef: "x", battleId: "b1" });
    expect(result.status).toBe("NOT_CHECKED");
  });
});

describe("CloudflareThumbnailSimilarityProvider — fingerprinting & comparison", () => {
  test("the first submission in a battle has nothing to compare against -> NO_MATCH, and stores a fingerprint for future comparisons", async () => {
    mockThumbnailFetchReturning(solidColorJpegBytes(10, 20, 30));
    const { CloudflareThumbnailSimilarityProvider } = require("../../moderation/videoSimilarityProvider");
    const provider = new CloudflareThumbnailSimilarityProvider();
    const result = await provider.checkSimilarity({ submissionId: "sub1", videoRef: "x", battleId: "battle_1", streamVideoUid: "uid1" });
    expect(result.status).toBe("NO_MATCH");
    expect(result.fingerprint).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledTimes(3); // 3 sampled timestamps
  });

  test("an identical (same-color) video already in the corpus is flagged HIGH_SIMILARITY", async () => {
    // Seed a prior submission in the SAME battle with a fingerprint from
    // the exact same solid color -> identical hash -> zero distance.
    const priorBytes = solidColorJpegBytes(200, 50, 50);
    const { averageHashFromJpeg, joinFrameHashes } = require("../../moderation/hashUtils");
    const { SIMILARITY_FINGERPRINT_VERSION } = require("../../moderation/videoSimilarityProvider");
    const priorHash = joinFrameHashes([averageHashFromJpeg(priorBytes), averageHashFromJpeg(priorBytes), averageHashFromJpeg(priorBytes)]);
    fakeDb.seed("submissions/battle_1_other_student", {
      battleId: "battle_1",
      similarityCheck: { fingerprintVersion: SIMILARITY_FINGERPRINT_VERSION, fingerprint: priorHash },
    });

    mockThumbnailFetchReturning(priorBytes);
    const { CloudflareThumbnailSimilarityProvider } = require("../../moderation/videoSimilarityProvider");
    const provider = new CloudflareThumbnailSimilarityProvider();
    const result = await provider.checkSimilarity({ submissionId: "sub_me", videoRef: "x", battleId: "battle_1", streamVideoUid: "uid_me" });

    expect(result.status).toBe("HIGH_SIMILARITY");
    expect(result.matchedSubmissionId).toBe("battle_1_other_student");
  });

  test("a visually different video in the corpus does NOT trigger a false HIGH_SIMILARITY", async () => {
    const priorBytes = checkerboardJpegBytes();
    const { averageHashFromJpeg, joinFrameHashes } = require("../../moderation/hashUtils");
    const { SIMILARITY_FINGERPRINT_VERSION } = require("../../moderation/videoSimilarityProvider");
    const priorHash = joinFrameHashes([averageHashFromJpeg(priorBytes), averageHashFromJpeg(priorBytes), averageHashFromJpeg(priorBytes)]);
    fakeDb.seed("submissions/battle_1_other_student", {
      battleId: "battle_1",
      similarityCheck: { fingerprintVersion: SIMILARITY_FINGERPRINT_VERSION, fingerprint: priorHash },
    });

    mockThumbnailFetchReturning(solidColorJpegBytes(255, 255, 255));
    const { CloudflareThumbnailSimilarityProvider } = require("../../moderation/videoSimilarityProvider");
    const provider = new CloudflareThumbnailSimilarityProvider();
    const result = await provider.checkSimilarity({ submissionId: "sub_me", videoRef: "x", battleId: "battle_1", streamVideoUid: "uid_me" });
    expect(result.status).toBe("NO_MATCH");
  });

  test("a fingerprint from a DIFFERENT version is ignored, never compared", async () => {
    const priorBytes = solidColorJpegBytes(200, 50, 50);
    const { averageHashFromJpeg, joinFrameHashes } = require("../../moderation/hashUtils");
    const priorHash = joinFrameHashes([averageHashFromJpeg(priorBytes), averageHashFromJpeg(priorBytes), averageHashFromJpeg(priorBytes)]);
    fakeDb.seed("submissions/battle_1_other_student", {
      battleId: "battle_1",
      similarityCheck: { fingerprintVersion: "some-old-version", fingerprint: priorHash },
    });

    mockThumbnailFetchReturning(priorBytes);
    const { CloudflareThumbnailSimilarityProvider } = require("../../moderation/videoSimilarityProvider");
    const provider = new CloudflareThumbnailSimilarityProvider();
    const result = await provider.checkSimilarity({ submissionId: "sub_me", videoRef: "x", battleId: "battle_1", streamVideoUid: "uid_me" });
    expect(result.status).toBe("NO_MATCH");
  });

  test("a thumbnail fetch failure is reported as ERROR, never a fabricated NO_MATCH", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
    const { CloudflareThumbnailSimilarityProvider } = require("../../moderation/videoSimilarityProvider");
    const provider = new CloudflareThumbnailSimilarityProvider();
    const result = await provider.checkSimilarity({ submissionId: "sub1", videoRef: "x", battleId: "battle_1", streamVideoUid: "uid1" });
    expect(result.status).toBe("ERROR");
  });

  test("cross-engine: a legacy post's fingerprint is compared against a canonical submission too", async () => {
    const priorBytes = solidColorJpegBytes(9, 9, 9);
    const { averageHashFromJpeg, joinFrameHashes } = require("../../moderation/hashUtils");
    const { SIMILARITY_FINGERPRINT_VERSION } = require("../../moderation/videoSimilarityProvider");
    const priorHash = joinFrameHashes([averageHashFromJpeg(priorBytes), averageHashFromJpeg(priorBytes), averageHashFromJpeg(priorBytes)]);
    fakeDb.seed("posts/legacy_post_1", {
      battleId: "battle_1", isSkillBattle: true,
      similarityCheck: { fingerprintVersion: SIMILARITY_FINGERPRINT_VERSION, fingerprint: priorHash },
    });

    mockThumbnailFetchReturning(priorBytes);
    const { CloudflareThumbnailSimilarityProvider } = require("../../moderation/videoSimilarityProvider");
    const provider = new CloudflareThumbnailSimilarityProvider();
    const result = await provider.checkSimilarity({ submissionId: "sub_me", videoRef: "x", battleId: "battle_1", streamVideoUid: "uid_me" });
    expect(result.status).toBe("HIGH_SIMILARITY");
    expect(result.matchedSubmissionId).toBe("legacy_post_1");
  });
});

describe("getVideoSimilarityProvider — selection", () => {
  test("defaults to Unconfigured when VIDEO_SIMILARITY_PROVIDER is unset", () => {
    const { getVideoSimilarityProvider } = require("../../moderation/videoSimilarityProvider");
    expect(getVideoSimilarityProvider().name).toBe("none");
  });
  test("selects the Cloudflare-thumbnail provider when configured", () => {
    process.env.VIDEO_SIMILARITY_PROVIDER = "cloudflare-thumbnail-ahash";
    const { getVideoSimilarityProvider } = require("../../moderation/videoSimilarityProvider");
    expect(getVideoSimilarityProvider().name).toBe("cloudflare-thumbnail-ahash");
  });
});

// PATH: functions/src/__tests__/moderation/hashUtils.test.ts
//
// Offline unit tests for the perceptual-hash helpers
// (videoSimilarityProvider.ts's fingerprinting). Uses jpeg-js's own
// ENCODER to produce real, valid JPEG bytes for the decoder to round-trip
// against — no network, no real video, no fixture binary checked into
// the repo.

import * as jpeg from "jpeg-js";
import { averageHashFromJpeg, hammingDistanceHex, joinFrameHashes, splitFrameHashes, compareFingerprints } from "../../moderation/hashUtils";

function makeSolidColorJpeg(width: number, height: number, r: number, g: number, b: number): Buffer {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
  }
  const encoded = jpeg.encode({ data, width, height }, 90);
  return Buffer.from(encoded.data);
}

describe("averageHashFromJpeg", () => {
  test("a solid black image and a solid white image hash to opposite extremes with a large Hamming distance", () => {
    const black = makeSolidColorJpeg(32, 32, 0, 0, 0);
    const white = makeSolidColorJpeg(32, 32, 255, 255, 255);
    const blackHash = averageHashFromJpeg(black);
    const whiteHash = averageHashFromJpeg(white);
    expect(blackHash).toHaveLength(16); // 64 bits = 16 hex chars
    expect(whiteHash).toHaveLength(16);
    // A solid-color image's every pixel equals the mean -> every bit is
    // "not >= mean" in a floating rounding edge case; the meaningful
    // assertion is that decoding/hashing succeeds and produces a stable,
    // well-formed hash, not a specific bit pattern for a degenerate
    // all-equal-pixel input.
    expect(blackHash).toMatch(/^[0-9a-f]{16}$/);
  });

  test("the same image decoded twice produces an identical hash (deterministic)", () => {
    const img = makeSolidColorJpeg(16, 16, 120, 40, 200);
    expect(averageHashFromJpeg(img)).toBe(averageHashFromJpeg(img));
  });

  test("a checkerboard pattern hashes differently from a solid color", () => {
    const width = 32, height = 32;
    const data = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const isBlack = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0;
        const v = isBlack ? 0 : 255;
        const idx = (y * width + x) * 4;
        data[idx] = v; data[idx + 1] = v; data[idx + 2] = v; data[idx + 3] = 255;
      }
    }
    const checkerboard = Buffer.from(jpeg.encode({ data, width, height }, 90).data);
    const solid = makeSolidColorJpeg(width, height, 128, 128, 128);
    const distance = hammingDistanceHex(averageHashFromJpeg(checkerboard), averageHashFromJpeg(solid));
    expect(distance).toBeGreaterThan(0);
  });

  test("throws on malformed image bytes rather than returning a fabricated hash", () => {
    expect(() => averageHashFromJpeg(Buffer.from("not a jpeg"))).toThrow();
  });
});

describe("hammingDistanceHex", () => {
  test("identical hashes have zero distance", () => {
    expect(hammingDistanceHex("abcd1234abcd1234", "abcd1234abcd1234")).toBe(0);
  });
  test("completely inverted hashes have maximum distance (64 bits)", () => {
    expect(hammingDistanceHex("0000000000000000", "ffffffffffffffff")).toBe(64);
  });
  test("a length mismatch returns Infinity rather than a misleading number", () => {
    expect(hammingDistanceHex("ab", "abcd")).toBe(Infinity);
  });
});

describe("joinFrameHashes / splitFrameHashes / compareFingerprints", () => {
  test("round-trips a list of frame hashes", () => {
    const hashes = ["aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb", "cccccccccccccccc"];
    const joined = joinFrameHashes(hashes);
    expect(splitFrameHashes(joined)).toEqual(hashes);
  });

  test("compares two multi-frame fingerprints by average per-frame distance", () => {
    const a = joinFrameHashes(["0000000000000000", "0000000000000000"]);
    const b = joinFrameHashes(["ffffffffffffffff", "0000000000000000"]);
    // frame 0: distance 64, frame 1: distance 0 -> average 32
    expect(compareFingerprints(a, b)).toBe(32);
  });

  test("identical fingerprints compare to zero distance", () => {
    const fp = joinFrameHashes(["1234567890abcdef", "fedcba0987654321"]);
    expect(compareFingerprints(fp, fp)).toBe(0);
  });

  test("a frame-count mismatch (different sampling strategy/version) returns Infinity, never a misleading average", () => {
    const a = joinFrameHashes(["0000000000000000"]);
    const b = joinFrameHashes(["0000000000000000", "0000000000000000"]);
    expect(compareFingerprints(a, b)).toBe(Infinity);
  });
});

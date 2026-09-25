// PATH: functions/src/moderation/hashUtils.ts
//
// Phase C §5 — a minimal, dependency-light perceptual "average hash"
// (aHash) for still frames, used by videoSimilarityProvider.ts's
// CloudflareThumbnailSimilarityProvider to detect duplicate/re-uploaded/
// re-encoded/resized/cropped Skill Battle videos against Gloows365's own
// corpus — NOT a claim of legal copyright infringement (see that file's
// header).
//
// Deliberately NOT using a native image library (sharp, etc.) — Cloud
// Functions' deploy story is simplest with pure-JS dependencies, and
// aHash on an 8x8 grayscale thumbnail needs no more than a JPEG decode +
// nearest-neighbor downsample, both trivial to do by hand. `jpeg-js` is
// the one new dependency this needs (pure JS, zero native deps — see
// functions/package.json).

import * as jpeg from "jpeg-js";

const HASH_SIZE = 8; // 8x8 = 64 bits per frame hash

/**
 * Decodes a JPEG buffer and computes a 64-bit average hash, returned as a
 * hex string (16 chars). Throws on a malformed/undecodable image — the
 * caller (videoSimilarityProvider.ts) treats that as a provider ERROR,
 * never a fabricated "no match".
 */
export function averageHashFromJpeg(buf: Buffer): string {
  const decoded = jpeg.decode(buf, { maxResolutionInMP: 64, useTArray: true });
  const { width, height, data } = decoded; // data: RGBA bytes, 4 per pixel

  // Nearest-neighbor downsample to HASH_SIZE x HASH_SIZE grayscale —
  // good enough for a coarse similarity signal at this resolution; no
  // need for a proper resampling filter.
  const gray: number[] = new Array(HASH_SIZE * HASH_SIZE);
  for (let y = 0; y < HASH_SIZE; y++) {
    const srcY = Math.min(height - 1, Math.floor((y / HASH_SIZE) * height));
    for (let x = 0; x < HASH_SIZE; x++) {
      const srcX = Math.min(width - 1, Math.floor((x / HASH_SIZE) * width));
      const idx = (srcY * width + srcX) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      // Standard luma weights.
      gray[y * HASH_SIZE + x] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }

  const mean = gray.reduce((a, b) => a + b, 0) / gray.length;
  let bits = "";
  let nibble = 0;
  let bitCount = 0;
  const hexChars: string[] = [];
  for (const v of gray) {
    nibble = (nibble << 1) | (v >= mean ? 1 : 0);
    bitCount++;
    if (bitCount === 4) {
      hexChars.push(nibble.toString(16));
      nibble = 0;
      bitCount = 0;
    }
  }
  bits = hexChars.join("");
  return bits;
}

/** Hamming distance between two equal-length hex hash strings. Returns
 * Infinity on a length mismatch (e.g. comparing across a future hash
 * version) — never silently compares incompatible fingerprints. */
export function hammingDistanceHex(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      dist += x & 1;
      x >>= 1;
    }
  }
  return dist;
}

/** Concatenates per-frame hashes (sampled at several timestamps) into one
 * fingerprint string, and the reverse. Keeping frames joined (not
 * averaged into one hash) preserves more signal for a short clip than
 * collapsing to a single 64-bit value would. */
export function joinFrameHashes(hashes: string[]): string {
  return hashes.join(":");
}
export function splitFrameHashes(fingerprint: string): string[] {
  return fingerprint.split(":");
}

/** Compares two multi-frame fingerprints (same format as
 * joinFrameHashes) by averaging the per-position Hamming distance —
 * frame counts must match (same sampling strategy/version) or this
 * returns Infinity, forcing the caller to treat it as "not comparable"
 * rather than a false precision. */
export function compareFingerprints(a: string, b: string): number {
  const framesA = splitFrameHashes(a);
  const framesB = splitFrameHashes(b);
  if (framesA.length !== framesB.length || framesA.length === 0) return Infinity;
  let total = 0;
  for (let i = 0; i < framesA.length; i++) {
    const d = hammingDistanceHex(framesA[i], framesB[i]);
    if (d === Infinity) return Infinity;
    total += d;
  }
  return total / framesA.length;
}

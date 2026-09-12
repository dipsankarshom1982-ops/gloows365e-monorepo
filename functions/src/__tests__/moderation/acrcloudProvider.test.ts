// PATH: functions/src/__tests__/moderation/acrcloudProvider.test.ts
//
// Offline unit tests for AcrCloudCopyrightDetectionProvider — mocks
// global fetch rather than hitting a real ACRCloud account.

// Neither this file nor sightengineProvider.test.ts has a top-level
// import/export otherwise — without one, TS treats a .ts file as a
// global SCRIPT rather than a module, so top-level consts here would
// collide with same-named ones in every other such file under ts-jest's
// program-wide type-check (confirmed: this exact collision happened
// before this line was added). export {} forces module scope.
export {};

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

function setConfigured() {
  process.env.ACRCLOUD_HOST = "identify-eu-west-1.acrcloud.com";
  process.env.ACRCLOUD_ACCESS_KEY = "test_key";
  process.env.ACRCLOUD_ACCESS_SECRET = "test_secret";
}

const SAMPLE = { bytes: Buffer.from("fake audio bytes"), contentType: "audio/mp4" };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = jest.fn();
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
  global.fetch = ORIGINAL_FETCH;
});

describe("AcrCloudCopyrightDetectionProvider — configuration", () => {
  test("not configured returns NOT_CONFIGURED without calling fetch", async () => {
    const { AcrCloudCopyrightDetectionProvider } = require("../../moderation/copyrightDetectionProvider");
    const provider = new AcrCloudCopyrightDetectionProvider();
    const result = await provider.checkCopyright({ submissionId: "s1", videoRef: "https://x/y.m3u8" });
    expect(result.status).toBe("NOT_CONFIGURED");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("configured but no audio sample yet reports UNKNOWN (honest 'not yet checked'), never NOT_CONFIGURED or a fabricated pass", async () => {
    setConfigured();
    const { AcrCloudCopyrightDetectionProvider } = require("../../moderation/copyrightDetectionProvider");
    const provider = new AcrCloudCopyrightDetectionProvider();
    const result = await provider.checkCopyright({ submissionId: "s1", videoRef: "https://x/y.m3u8" });
    expect(result.status).toBe("UNKNOWN");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("AcrCloudCopyrightDetectionProvider — identification results", () => {
  test("a clean successful call with no music match is NO_MATCH", async () => {
    setConfigured();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true, json: async () => ({ status: { code: 0, msg: "Success" }, metadata: {} }),
    });
    const { AcrCloudCopyrightDetectionProvider } = require("../../moderation/copyrightDetectionProvider");
    const provider = new AcrCloudCopyrightDetectionProvider();
    const result = await provider.checkCopyright({ submissionId: "s1", videoRef: "https://x/y.m3u8", audioSample: SAMPLE });
    expect(result.status).toBe("NO_MATCH");
  });

  test("a high-confidence match (>= threshold) is CONFIRMED_MATCH", async () => {
    setConfigured();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: { code: 0 },
        metadata: { music: [{ title: "Some Song", score: 95, play_offset_ms: 5000, acrid: "abc" }] },
      }),
    });
    const { AcrCloudCopyrightDetectionProvider } = require("../../moderation/copyrightDetectionProvider");
    const provider = new AcrCloudCopyrightDetectionProvider();
    const result = await provider.checkCopyright({ submissionId: "s1", videoRef: "https://x/y.m3u8", audioSample: SAMPLE });
    expect(result.status).toBe("CONFIRMED_MATCH");
    expect(result.matchedWork).toBe("Some Song");
    expect(result.confidence).toBe(95);
    expect(result.matchStartSeconds).toBe(5);
  });

  test("a low-confidence match (< threshold) is POSSIBLE_MATCH, not an automatic infringement verdict", async () => {
    setConfigured();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: { code: 0 }, metadata: { music: [{ title: "Faint Match", score: 40 }] } }),
    });
    const { AcrCloudCopyrightDetectionProvider } = require("../../moderation/copyrightDetectionProvider");
    const provider = new AcrCloudCopyrightDetectionProvider();
    const result = await provider.checkCopyright({ submissionId: "s1", videoRef: "https://x/y.m3u8", audioSample: SAMPLE });
    expect(result.status).toBe("POSSIBLE_MATCH");
  });

  test("a non-zero status code (unverified failure taxonomy) is UNKNOWN, never NO_MATCH", async () => {
    setConfigured();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true, json: async () => ({ status: { code: 3003, msg: "Rate limited" } }),
    });
    const { AcrCloudCopyrightDetectionProvider } = require("../../moderation/copyrightDetectionProvider");
    const provider = new AcrCloudCopyrightDetectionProvider();
    const result = await provider.checkCopyright({ submissionId: "s1", videoRef: "https://x/y.m3u8", audioSample: SAMPLE });
    expect(result.status).toBe("UNKNOWN");
  });

  test("a malformed response (no status.code) is UNKNOWN", async () => {
    setConfigured();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    const { AcrCloudCopyrightDetectionProvider } = require("../../moderation/copyrightDetectionProvider");
    const provider = new AcrCloudCopyrightDetectionProvider();
    const result = await provider.checkCopyright({ submissionId: "s1", videoRef: "https://x/y.m3u8", audioSample: SAMPLE });
    expect(result.status).toBe("UNKNOWN");
  });

  test("a network error is UNKNOWN, never silently treated as clean", async () => {
    setConfigured();
    (global.fetch as jest.Mock).mockRejectedValue(new Error("timeout"));
    const { AcrCloudCopyrightDetectionProvider } = require("../../moderation/copyrightDetectionProvider");
    const provider = new AcrCloudCopyrightDetectionProvider();
    const result = await provider.checkCopyright({ submissionId: "s1", videoRef: "https://x/y.m3u8", audioSample: SAMPLE });
    expect(result.status).toBe("UNKNOWN");
  });

  test("a sample over the 5MB cap is truncated, not rejected outright", async () => {
    setConfigured();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ status: { code: 0 }, metadata: {} }) });
    const { AcrCloudCopyrightDetectionProvider } = require("../../moderation/copyrightDetectionProvider");
    const provider = new AcrCloudCopyrightDetectionProvider();
    const bigSample = { bytes: Buffer.alloc(6 * 1024 * 1024, 1), contentType: "audio/mp4" };
    const result = await provider.checkCopyright({ submissionId: "s1", videoRef: "https://x/y.m3u8", audioSample: bigSample });
    expect(result.status).toBe("NO_MATCH"); // didn't error out on the oversized input
    expect(global.fetch).toHaveBeenCalled();
  });
});

describe("getCopyrightDetectionProvider — selection", () => {
  test("defaults to Unconfigured when COPYRIGHT_PROVIDER is unset", () => {
    const { getCopyrightDetectionProvider } = require("../../moderation/copyrightDetectionProvider");
    expect(getCopyrightDetectionProvider().name).toBe("none");
  });
  test("selects ACRCloud when COPYRIGHT_PROVIDER=acrcloud", () => {
    process.env.COPYRIGHT_PROVIDER = "acrcloud";
    const { getCopyrightDetectionProvider } = require("../../moderation/copyrightDetectionProvider");
    expect(getCopyrightDetectionProvider().name).toBe("acrcloud");
  });
});

// PATH: functions/src/__tests__/moderation/sightengineProvider.test.ts
//
// Offline unit tests for SightengineVideoModerationProvider — mocks
// global fetch (Node 20's native implementation, what the provider
// actually calls) rather than hitting a real Sightengine account. Only
// the SUBMIT half is under test here (fast, synchronous kickoff) — the
// actual result arrives via sightengineWebhook.test.ts.

export {}; // force module scope — see acrcloudProvider.test.ts's identical note

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

function setConfigured() {
  process.env.SIGHTENGINE_API_USER = "test_user";
  process.env.SIGHTENGINE_API_SECRET = "test_secret";
  process.env.SIGHTENGINE_CALLBACK_URL = "https://example.com/callback";
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = jest.fn();
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
  global.fetch = ORIGINAL_FETCH;
});

describe("SightengineVideoModerationProvider — configuration", () => {
  test("not configured (missing env) returns NOT_CONFIGURED without ever calling fetch", async () => {
    const { SightengineVideoModerationProvider } = require("../../moderation/videoModerationProvider");
    const provider = new SightengineVideoModerationProvider();
    const result = await provider.analyzeVideo({ submissionId: "s1", videoRef: "https://example.com/v.m3u8" });
    expect(result.status).toBe("NOT_CONFIGURED");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("SightengineVideoModerationProvider — job submission", () => {
  test("a successful submission returns PROCESSING with the media id as jobId", async () => {
    setConfigured();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success", media: { id: "med_abc123" } }),
    });
    const { SightengineVideoModerationProvider } = require("../../moderation/videoModerationProvider");
    const provider = new SightengineVideoModerationProvider();
    const result = await provider.analyzeVideo({ submissionId: "s1", videoRef: "https://example.com/v.m3u8" });

    expect(result.status).toBe("PROCESSING");
    expect(result.jobId).toBe("med_abc123");
    expect(result.provider).toBe("sightengine");
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("stream_url=");
    expect(calledUrl).toContain("api.sightengine.com");
  });

  test("Sightengine reporting failure status is a FAILED result, never treated as a pass", async () => {
    setConfigured();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: "failure", error: { message: "invalid stream_url" } }),
    });
    const { SightengineVideoModerationProvider } = require("../../moderation/videoModerationProvider");
    const provider = new SightengineVideoModerationProvider();
    const result = await provider.analyzeVideo({ submissionId: "s1", videoRef: "bad-url" });
    expect(result.status).toBe("FAILED");
  });

  test("an HTTP error response is a FAILED result", async () => {
    setConfigured();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500, json: async () => null });
    const { SightengineVideoModerationProvider } = require("../../moderation/videoModerationProvider");
    const provider = new SightengineVideoModerationProvider();
    const result = await provider.analyzeVideo({ submissionId: "s1", videoRef: "https://example.com/v.m3u8" });
    expect(result.status).toBe("FAILED");
  });

  test("a network error (fetch throws) is a FAILED result, never silently swallowed", async () => {
    setConfigured();
    (global.fetch as jest.Mock).mockRejectedValue(new Error("ECONNRESET"));
    const { SightengineVideoModerationProvider } = require("../../moderation/videoModerationProvider");
    const provider = new SightengineVideoModerationProvider();
    const result = await provider.analyzeVideo({ submissionId: "s1", videoRef: "https://example.com/v.m3u8" });
    expect(result.status).toBe("FAILED");
  });

  test("a malformed JSON response (no media.id) is a FAILED result", async () => {
    setConfigured();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ status: "success" }) });
    const { SightengineVideoModerationProvider } = require("../../moderation/videoModerationProvider");
    const provider = new SightengineVideoModerationProvider();
    const result = await provider.analyzeVideo({ submissionId: "s1", videoRef: "https://example.com/v.m3u8" });
    expect(result.status).toBe("FAILED");
  });
});

describe("getVideoModerationProvider — selection", () => {
  test("defaults to Unconfigured when VIDEO_MODERATION_PROVIDER is unset", () => {
    const { getVideoModerationProvider } = require("../../moderation/videoModerationProvider");
    expect(getVideoModerationProvider().name).toBe("none");
  });
  test("selects Sightengine when VIDEO_MODERATION_PROVIDER=sightengine", () => {
    process.env.VIDEO_MODERATION_PROVIDER = "sightengine";
    const { getVideoModerationProvider } = require("../../moderation/videoModerationProvider");
    expect(getVideoModerationProvider().name).toBe("sightengine");
  });
});

// PATH: functions/src/__tests__/moderation/providers.test.ts
//
// Offline unit tests for the three moderation provider abstractions —
// verifies every default/unconfigured path fails safe (never fakes a
// pass) and that the AWS Rekognition stub correctly detects missing
// configuration without attempting a real call.

import { getVideoModerationProvider, AwsRekognitionVideoModerationProvider } from "../../moderation/videoModerationProvider";
import { getCopyrightDetectionProvider } from "../../moderation/copyrightDetectionProvider";
import { getVideoSimilarityProvider } from "../../moderation/videoSimilarityProvider";

const INPUT = { submissionId: "sub_1", videoRef: "video_1" };

describe("getVideoModerationProvider (default selection)", () => {
  test("returns NOT_CONFIGURED with no labels and no job id", async () => {
    const result = await getVideoModerationProvider().analyzeVideo(INPUT);
    expect(result.status).toBe("NOT_CONFIGURED");
    expect(result.labels).toEqual([]);
    expect(result.jobId).toBeNull();
  });
});

describe("AwsRekognitionVideoModerationProvider — configuration detection", () => {
  const ORIGINAL_ENV = { ...process.env };
  afterEach(() => { process.env = { ...ORIGINAL_ENV }; });

  test("returns NOT_CONFIGURED (never a fabricated pass) when AWS env vars are absent", async () => {
    delete process.env.AWS_REGION;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_REKOGNITION_ROLE_ARN;
    const result = await new AwsRekognitionVideoModerationProvider().analyzeVideo(INPUT);
    expect(result.status).toBe("NOT_CONFIGURED");
    expect(result.error).toBeTruthy();
  });

  test("with credentials present but no S3 ingestion pipeline implemented, fails honestly rather than pretending success", async () => {
    process.env.AWS_REGION = "ap-south-1";
    process.env.AWS_ACCESS_KEY_ID = "fake";
    process.env.AWS_SECRET_ACCESS_KEY = "fake";
    process.env.AWS_REKOGNITION_ROLE_ARN = "arn:aws:iam::123456789012:role/fake";
    const result = await new AwsRekognitionVideoModerationProvider().analyzeVideo(INPUT);
    expect(result.status).toBe("FAILED");
    expect(result.labels).toEqual([]);
  });
});

describe("getCopyrightDetectionProvider (default selection)", () => {
  test("returns NOT_CONFIGURED, never NO_MATCH — a missing provider must never be mistaken for a clean check", async () => {
    const result = await getCopyrightDetectionProvider().checkCopyright(INPUT);
    expect(result.status).toBe("NOT_CONFIGURED");
    expect(result.confidence).toBeNull();
  });
});

describe("getVideoSimilarityProvider (default selection)", () => {
  test("returns NOT_CHECKED, never NO_MATCH — a missing provider must never be mistaken for verified-unique", async () => {
    const result = await getVideoSimilarityProvider().checkSimilarity({ ...INPUT, battleId: "battle_1" });
    expect(result.status).toBe("NOT_CHECKED");
    expect(result.similarityScore).toBeNull();
  });
});

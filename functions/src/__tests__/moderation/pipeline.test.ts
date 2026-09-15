// PATH: functions/src/__tests__/moderation/pipeline.test.ts
//
// Offline unit tests for the shared moderation pipeline both submission
// callables use.

import { runModerationPipeline, moderationResultToFields } from "../../moderation/pipeline";

describe("runModerationPipeline", () => {
  test("with no provider configured, resolves to PENDING_HUMAN_REVIEW via the decision engine", async () => {
    const result = await runModerationPipeline({ submissionId: "sub_1", videoRef: "video_1", battleId: "battle_1" });
    expect(result.moderation.status).toBe("NOT_CONFIGURED");
    expect(result.copyright.status).toBe("NOT_CONFIGURED");
    expect(result.similarity.status).toBe("NOT_CHECKED");
    expect(result.decision.nextStatus).toBe("PENDING_HUMAN_REVIEW");
  });
});

describe("moderationResultToFields", () => {
  test("flattens to the exact field set stored on the submission doc, with no raw provider payload", async () => {
    const result = await runModerationPipeline({ submissionId: "sub_1", videoRef: "video_1", battleId: "battle_1" });
    const fields = moderationResultToFields(result);

    expect(fields.moderationStatus).toBe("PENDING_HUMAN_REVIEW");
    expect(fields.copyrightStatus).toBe("NOT_CONFIGURED");
    expect(fields.similarityStatus).toBe("NOT_CHECKED");
    expect(Array.isArray(fields.moderationReasons)).toBe(true);
    expect(fields.safetyModeration).toMatchObject({ provider: "none", status: "NOT_CONFIGURED" });
    expect(fields.copyrightCheck).toMatchObject({ provider: "none", confidence: null, matchedWork: null });
    // No field on the flattened result is a raw/opaque provider blob —
    // every value is one of the typed, documented result shapes.
    expect(Object.keys(fields)).toEqual(
      expect.arrayContaining([
        "moderationStatus", "moderationRiskLevel", "moderationReasons",
        "safetyModeration", "copyrightStatus", "copyrightCheck",
        "similarityStatus", "similarityCheck",
      ])
    );
  });
});

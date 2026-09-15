// PATH: functions/src/moderation/pipeline.ts
//
// Single shared entry point both submission callables
// (battleSubmissions.ts's createBattleSubmission, skillBattleSubmission.ts's
// submitSkillBattleReel) use to run the three automated checks and the
// decision engine — so there is exactly one place that wires providers
// together, not two slightly-different copies.
//
// PHASE A: every provider is the Unconfigured* stub (see each provider
// file), so every call here resolves instantly with no network I/O and
// every submission routes to PENDING_HUMAN_REVIEW via the decision
// engine's fail-closed default. Running this inline (awaited within the
// callable, not queued) is safe ONLY because of that — see this file's
// own note below and battleSubmissions.ts's brief §16 reference for why
// a REAL provider (Phase C) must move this to an async queued job
// instead of blocking the callable.
//
// TODO (Phase C, once a real provider exists): once any of the three
// providers can take longer than a trivial stub-resolve, this MUST
// become a queued/async job (Cloud Tasks or a Firestore-triggered
// function) rather than an inline await inside the callable — the
// mobile client must never block on a real AI/vendor call (brief §16:
// "Do not make the mobile client wait for every AI provider operation").
// Phase A intentionally does not build that queue since there is nothing
// slow to queue yet; building an untestable async pipeline now would be
// exactly the kind of premature, unverifiable complexity this project
// has avoided elsewhere.

import { getVideoModerationProvider } from "./videoModerationProvider";
import { getCopyrightDetectionProvider } from "./copyrightDetectionProvider";
import { getVideoSimilarityProvider } from "./videoSimilarityProvider";
import { evaluateModerationDecision } from "./decisionEngine";
import {
  CopyrightCheckResult,
  ModerationDecision,
  SimilarityCheckResult,
  VideoModerationResult,
} from "./types";

export interface ModerationPipelineInput {
  submissionId: string;
  videoRef: string;
  battleId: string;
}

export interface ModerationPipelineResult {
  moderation: VideoModerationResult;
  copyright: CopyrightCheckResult;
  similarity: SimilarityCheckResult;
  decision: ModerationDecision;
}

export async function runModerationPipeline(input: ModerationPipelineInput): Promise<ModerationPipelineResult> {
  const { submissionId, videoRef, battleId } = input;

  const [moderation, copyright, similarity] = await Promise.all([
    getVideoModerationProvider().analyzeVideo({ submissionId, videoRef }),
    getCopyrightDetectionProvider().checkCopyright({ submissionId, videoRef }),
    getVideoSimilarityProvider().checkSimilarity({ submissionId, videoRef, battleId }),
  ]);

  const decision = evaluateModerationDecision(moderation, copyright, similarity);

  return { moderation, copyright, similarity, decision };
}

// Converts a provider result into the flat field set both submission
// docs store — kept in one place so the two engines' schemas can't drift
// apart. Deliberately excludes any raw provider payload (brief §3: "Do
// NOT store unnecessary raw provider responses").
export function moderationResultToFields(result: ModerationPipelineResult) {
  return {
    moderationStatus: result.decision.nextStatus,
    moderationRiskLevel: result.decision.riskLevel,
    moderationReasons: result.decision.reasons,
    safetyModeration: {
      provider: result.moderation.provider,
      jobId: result.moderation.jobId,
      status: result.moderation.status,
      labels: result.moderation.labels,
      processedAt: result.moderation.processedAt,
      error: result.moderation.error,
    },
    copyrightStatus: result.copyright.status,
    copyrightCheck: {
      provider: result.copyright.provider,
      confidence: result.copyright.confidence,
      matchedWork: result.copyright.matchedWork,
      matchStartSeconds: result.copyright.matchStartSeconds,
      matchEndSeconds: result.copyright.matchEndSeconds,
      providerReference: result.copyright.providerReference,
      processedAt: result.copyright.processedAt,
      error: result.copyright.error,
    },
    similarityStatus: result.similarity.status,
    similarityCheck: {
      provider: result.similarity.provider,
      fingerprintVersion: result.similarity.fingerprintVersion,
      similarityScore: result.similarity.similarityScore,
      matchedSubmissionId: result.similarity.matchedSubmissionId,
      processedAt: result.similarity.processedAt,
      error: result.similarity.error,
    },
  };
}

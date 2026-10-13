// PATH: functions-cloudflare/src/moderation/pipeline.ts
//
// MIRRORED FILE — this code is mirrored from functions/src/moderation for
// isolated Firebase deployment (the "cloudflare-webhook" codebase, added
// so handleCloudflareStreamWebhook can be discovered/deployed without
// loading the entire ~190-function "default" codebase). Changes to the
// canonical moderation implementation at functions/src/moderation/pipeline.ts
// must be mirrored here until a shared package/drift-check is introduced.
// Do not diverge the two copies' behavior.
//
// Original header follows unchanged:
//
// PATH: functions/src/moderation/pipeline.ts
//
// Single shared entry point every moderation call site uses to run the
// three automated checks and the decision engine — so there is exactly
// one place that wires providers together, not several slightly-different
// copies. Phase A/B call sites (battleSubmissions.ts's
// createBattleSubmission, skillBattleSubmission.ts's submitSkillBattleReel)
// are UNCHANGED by Phase C — see below for why.
//
// PHASE C — WHY THIS IS STILL SAFE TO CALL INLINE AT SUBMISSION CREATION:
// video moderation's "kickoff" (SightengineVideoModerationProvider.
// analyzeVideo, videoModerationProvider.ts) is a fast synchronous HTTP
// call that SUBMITS a job and returns immediately — it does not wait for
// the actual analysis, which arrives later via sightengineWebhook.ts.
// Copyright and similarity, however, physically CANNOT run yet at
// submission-creation time: the video is still uploading/encoding in
// Cloudflare Stream, so there is no audio to sample and no thumbnail to
// hash. Rather than call those two providers with nothing to give them,
// runModerationPipeline only calls them when the caller actually HAS
// that data (input.audioSample / input.streamVideoUid) — i.e. from
// streamWebhook.ts, AFTER Cloudflare Stream reports the video ready.
// At submission-creation time (audioSample/streamVideoUid both absent),
// copyright/similarity resolve to the same honest "not yet checked"
// placeholders as Phase A's stubs did (UNKNOWN/NOT_CHECKED — both
// already fail-closed/unresolved in decisionEngine.ts), so this
// function's behavior for every EXISTING call site is byte-for-byte
// unchanged. See streamWebhook.ts for the actual async re-run that
// happens once the video is ready.

import { getVideoModerationProvider } from "./videoModerationProvider";
import { getCopyrightDetectionProvider, CopyrightCheckInput } from "./copyrightDetectionProvider";
import { getVideoSimilarityProvider, SimilarityCheckInput } from "./videoSimilarityProvider";
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
  // Phase C — only populate these from streamWebhook.ts, once Cloudflare
  // Stream has actually finished processing the video. See this file's
  // header for why an absent value here is an honest "not yet", never an
  // error.
  streamVideoUid?: string;
  audioSample?: CopyrightCheckInput["audioSample"];
}

export interface ModerationPipelineResult {
  moderation: VideoModerationResult;
  copyright: CopyrightCheckResult;
  similarity: SimilarityCheckResult;
  decision: ModerationDecision;
}

export async function runModerationPipeline(input: ModerationPipelineInput): Promise<ModerationPipelineResult> {
  const { submissionId, videoRef, battleId, streamVideoUid, audioSample } = input;

  // Always call every provider — each one already knows how to answer
  // honestly when it's unconfigured (NOT_CONFIGURED/NOT_CHECKED, ignoring
  // input entirely) versus configured-but-missing-data-yet (UNKNOWN/
  // NOT_CHECKED, see copyrightDetectionProvider.ts's/
  // videoSimilarityProvider.ts's own "no audioSample"/"no streamVideoUid"
  // branches). Pre-empting the call here as a shortcut would have (and
  // did, before this fix) changed the UNCONFIGURED case's result too —
  // this way every existing call site's behavior is genuinely unchanged.
  const similarityInput: SimilarityCheckInput = { submissionId, videoRef, battleId, streamVideoUid };

  const [moderation, copyright, similarity] = await Promise.all([
    getVideoModerationProvider().analyzeVideo({ submissionId, videoRef }),
    getCopyrightDetectionProvider().checkCopyright({ submissionId, videoRef, audioSample }),
    getVideoSimilarityProvider().checkSimilarity(similarityInput),
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
      fingerprint: result.similarity.fingerprint,
      similarityScore: result.similarity.similarityScore,
      matchedSubmissionId: result.similarity.matchedSubmissionId,
      processedAt: result.similarity.processedAt,
      error: result.similarity.error,
    },
    // Denormalized (Phase C) — the ONLY reason a copy of this lives at
    // the top level too: sightengineWebhook.ts needs to look a
    // submission up by Sightengine's job id with a simple equality
    // query, and neither real Firestore nor this repo's offline
    // FakeFirestore test mock (see __tests__/helpers/fakeFirestore.ts)
    // needs to support querying into a nested map field for that to work.
    safetyModerationJobId: result.moderation.jobId,
  };
}

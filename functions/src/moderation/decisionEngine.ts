// PATH: functions/src/moderation/decisionEngine.ts
//
// THE single place that turns automated-check results into a moderation
// status. No other file may independently decide "this is safe enough to
// publish" — every call site routes through evaluateModerationDecision()
// so there is exactly one, auditable, testable policy, not several
// slightly-different copies scattered across the two submission
// callables (brief: "Do not scatter numeric thresholds across the
// codebase").
//
// FAIL-CLOSED BY DESIGN: if ANY of the three checks did not produce a
// real, configured result (video moderation NOT_CONFIGURED/FAILED,
// copyright NOT_CONFIGURED/UNKNOWN, similarity NOT_CHECKED/ERROR), the
// decision is ALWAYS PENDING_HUMAN_REVIEW, regardless of what the other
// checks found — a missing check is never treated as "passed" (brief
// §10). Since every provider in this Phase A build is an
// Unconfigured*Provider stub (see the three provider files), every
// submission that reaches this engine today routes to
// PENDING_HUMAN_REVIEW — a deliberate, honest consequence of no
// automated provider being live yet, not a bug.
//
// AUTO_REJECT_HIGH_RISK / AUTO_APPROVE_LOW_RISK are OFF by default —
// turning either on is a product/legal policy decision this codebase
// should never make unilaterally (see the final implementation report's
// "REQUIRES HUMAN/LEGAL/POLICY DECISION" section). With both off, a
// fully-configured HIGH or LOW risk result still lands in
// PENDING_HUMAN_REVIEW, same as an unconfigured one — a human is always
// in the loop until the product explicitly opts out for one direction.

import {
  CopyrightCheckResult,
  ModerationDecision,
  ModerationRiskLevel,
  SimilarityCheckResult,
  VideoModerationResult,
} from "./types";

// Env-overridable, never hardcoded inline at each call site.
function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
function envFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "true" || raw === "1";
}

export const MODERATION_HIGH_THRESHOLD = envNumber("MODERATION_HIGH_THRESHOLD", 90);
export const MODERATION_REVIEW_THRESHOLD = envNumber("MODERATION_REVIEW_THRESHOLD", 60);
export const AUTO_REJECT_HIGH_RISK = envFlag("AUTO_REJECT_HIGH_RISK", false);
export const AUTO_APPROVE_LOW_RISK = envFlag("AUTO_APPROVE_LOW_RISK", false);

function riskFromModeration(result: VideoModerationResult): { risk: ModerationRiskLevel | null; reasons: string[] } {
  if (result.status !== "COMPLETED") {
    return { risk: null, reasons: [`Safety moderation ${result.status.toLowerCase()}`] };
  }
  const topConfidence = result.labels.reduce((max, l) => Math.max(max, l.confidence), 0);
  if (topConfidence >= MODERATION_HIGH_THRESHOLD) {
    return { risk: "HIGH_RISK", reasons: [`Safety label confidence ${topConfidence} >= high threshold ${MODERATION_HIGH_THRESHOLD}`] };
  }
  if (topConfidence >= MODERATION_REVIEW_THRESHOLD) {
    return { risk: "MEDIUM_RISK", reasons: [`Safety label confidence ${topConfidence} >= review threshold ${MODERATION_REVIEW_THRESHOLD}`] };
  }
  return { risk: "LOW_RISK", reasons: [] };
}

function riskFromCopyright(result: CopyrightCheckResult): { risk: ModerationRiskLevel | null; reasons: string[] } {
  switch (result.status) {
    case "NOT_CONFIGURED":
    case "UNKNOWN":
      return { risk: null, reasons: [`Copyright check ${result.status.toLowerCase().replace("_", " ")}`] };
    case "CONFIRMED_MATCH":
      return { risk: "HIGH_RISK", reasons: ["Copyright match confirmed by provider"] };
    case "POSSIBLE_MATCH":
    case "LICENSE_INFORMATION_REQUIRED":
      return { risk: "MEDIUM_RISK", reasons: [`Copyright status: ${result.status}`] };
    case "NO_MATCH":
      return { risk: "LOW_RISK", reasons: [] };
  }
}

function riskFromSimilarity(result: SimilarityCheckResult): { risk: ModerationRiskLevel | null; reasons: string[] } {
  switch (result.status) {
    case "NOT_CHECKED":
    case "ERROR":
      return { risk: null, reasons: [`Similarity check ${result.status.toLowerCase().replace("_", " ")}`] };
    case "HIGH_SIMILARITY":
      return { risk: "MEDIUM_RISK", reasons: [`High similarity to submission ${result.matchedSubmissionId ?? "unknown"}`] };
    case "LOW_SIMILARITY":
    case "NO_MATCH":
      return { risk: "LOW_RISK", reasons: [] };
  }
}

const RISK_ORDER: Record<ModerationRiskLevel, number> = { LOW_RISK: 0, MEDIUM_RISK: 1, HIGH_RISK: 2 };

export function evaluateModerationDecision(
  moderation: VideoModerationResult,
  copyright: CopyrightCheckResult,
  similarity: SimilarityCheckResult,
): ModerationDecision {
  const parts = [
    riskFromModeration(moderation),
    riskFromCopyright(copyright),
    riskFromSimilarity(similarity),
  ];

  const reasons = parts.flatMap((p) => p.reasons);
  const anyUnresolved = parts.some((p) => p.risk === null);

  // Highest configured risk among the checks that actually ran — used
  // only to decide auto-reject eligibility below; an unresolved check
  // always wins the routing decision regardless of this value.
  const highestConfiguredRisk: ModerationRiskLevel = parts.reduce<ModerationRiskLevel>((acc, p) => {
    if (!p.risk) return acc;
    return RISK_ORDER[p.risk] > RISK_ORDER[acc] ? p.risk : acc;
  }, "LOW_RISK");

  if (anyUnresolved) {
    return {
      riskLevel: highestConfiguredRisk,
      nextStatus: "PENDING_HUMAN_REVIEW",
      reasons: reasons.length ? reasons : ["One or more checks did not run"],
    };
  }

  if (highestConfiguredRisk === "HIGH_RISK") {
    return {
      riskLevel: "HIGH_RISK",
      nextStatus: AUTO_REJECT_HIGH_RISK ? "REJECTED" : "PENDING_HUMAN_REVIEW",
      reasons,
    };
  }
  if (highestConfiguredRisk === "MEDIUM_RISK") {
    return { riskLevel: "MEDIUM_RISK", nextStatus: "PENDING_HUMAN_REVIEW", reasons };
  }
  // LOW_RISK, every check configured and clean.
  return {
    riskLevel: "LOW_RISK",
    nextStatus: AUTO_APPROVE_LOW_RISK ? "APPROVED" : "PENDING_HUMAN_REVIEW",
    reasons: reasons.length ? reasons : ["All automated checks passed"],
  };
}

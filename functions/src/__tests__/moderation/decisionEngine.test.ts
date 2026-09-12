// PATH: functions/src/__tests__/moderation/decisionEngine.test.ts
//
// Offline unit tests for the centralized moderation decision engine.
// No firebase-admin mocking needed — this is pure functions over typed
// result objects.

import { evaluateModerationDecision } from "../../moderation/decisionEngine";
import {
  CopyrightCheckResult,
  SimilarityCheckResult,
  VideoModerationResult,
} from "../../moderation/types";

function moderation(overrides: Partial<VideoModerationResult> = {}): VideoModerationResult {
  return { provider: "none", jobId: null, status: "NOT_CONFIGURED", labels: [], processedAt: Date.now(), error: null, ...overrides };
}
function copyright(overrides: Partial<CopyrightCheckResult> = {}): CopyrightCheckResult {
  return {
    provider: "none", status: "NOT_CONFIGURED", confidence: null, matchedWork: null,
    matchStartSeconds: null, matchEndSeconds: null, providerReference: null, processedAt: Date.now(), error: null,
    ...overrides,
  };
}
function similarity(overrides: Partial<SimilarityCheckResult> = {}): SimilarityCheckResult {
  return {
    provider: "none", fingerprintVersion: null, status: "NOT_CHECKED", similarityScore: null,
    matchedSubmissionId: null, processedAt: Date.now(), error: null,
    ...overrides,
  };
}

describe("evaluateModerationDecision — fail-closed defaults (no provider configured)", () => {
  test("all three unconfigured routes to PENDING_HUMAN_REVIEW, never APPROVED", () => {
    const decision = evaluateModerationDecision(moderation(), copyright(), similarity());
    expect(decision.nextStatus).toBe("PENDING_HUMAN_REVIEW");
    expect(decision.reasons.length).toBeGreaterThan(0);
  });

  test("a FAILED moderation result is treated the same as unconfigured — never a pass", () => {
    const decision = evaluateModerationDecision(
      moderation({ status: "FAILED", error: "provider error" }),
      copyright({ status: "NO_MATCH" }),
      similarity({ status: "NO_MATCH" }),
    );
    expect(decision.nextStatus).toBe("PENDING_HUMAN_REVIEW");
  });

  test("copyright UNKNOWN is treated as unresolved, not a pass", () => {
    const decision = evaluateModerationDecision(
      moderation({ status: "COMPLETED", labels: [] }),
      copyright({ status: "UNKNOWN" }),
      similarity({ status: "NO_MATCH" }),
    );
    expect(decision.nextStatus).toBe("PENDING_HUMAN_REVIEW");
  });

  test("similarity ERROR is treated as unresolved, not verified-unique", () => {
    const decision = evaluateModerationDecision(
      moderation({ status: "COMPLETED", labels: [] }),
      copyright({ status: "NO_MATCH" }),
      similarity({ status: "ERROR", error: "provider timeout" }),
    );
    expect(decision.nextStatus).toBe("PENDING_HUMAN_REVIEW");
  });
});

describe("evaluateModerationDecision — risk computation when everything IS configured", () => {
  test("all clean and fully configured is LOW_RISK, but still PENDING_HUMAN_REVIEW by default (AUTO_APPROVE_LOW_RISK off)", () => {
    const decision = evaluateModerationDecision(
      moderation({ status: "COMPLETED", labels: [{ name: "safe", confidence: 5 }] }),
      copyright({ status: "NO_MATCH" }),
      similarity({ status: "NO_MATCH" }),
    );
    expect(decision.riskLevel).toBe("LOW_RISK");
    expect(decision.nextStatus).toBe("PENDING_HUMAN_REVIEW");
  });

  test("a label at/above the high threshold (default 90) is HIGH_RISK, but still PENDING_HUMAN_REVIEW by default (AUTO_REJECT_HIGH_RISK off)", () => {
    const decision = evaluateModerationDecision(
      moderation({ status: "COMPLETED", labels: [{ name: "explicit_nudity", confidence: 95 }] }),
      copyright({ status: "NO_MATCH" }),
      similarity({ status: "NO_MATCH" }),
    );
    expect(decision.riskLevel).toBe("HIGH_RISK");
    expect(decision.nextStatus).toBe("PENDING_HUMAN_REVIEW");
  });

  test("a label between the review and high thresholds (default 60-90) is MEDIUM_RISK -> PENDING_HUMAN_REVIEW", () => {
    const decision = evaluateModerationDecision(
      moderation({ status: "COMPLETED", labels: [{ name: "suggestive", confidence: 75 }] }),
      copyright({ status: "NO_MATCH" }),
      similarity({ status: "NO_MATCH" }),
    );
    expect(decision.riskLevel).toBe("MEDIUM_RISK");
    expect(decision.nextStatus).toBe("PENDING_HUMAN_REVIEW");
  });

  test("a confirmed copyright match is HIGH_RISK even if the video itself is visually clean", () => {
    const decision = evaluateModerationDecision(
      moderation({ status: "COMPLETED", labels: [] }),
      copyright({ status: "CONFIRMED_MATCH", confidence: 98, matchedWork: "Some Track" }),
      similarity({ status: "NO_MATCH" }),
    );
    expect(decision.riskLevel).toBe("HIGH_RISK");
    expect(decision.nextStatus).toBe("PENDING_HUMAN_REVIEW");
  });

  test("a possible copyright match or license-required is MEDIUM_RISK, not an automatic rejection", () => {
    const decision = evaluateModerationDecision(
      moderation({ status: "COMPLETED", labels: [] }),
      copyright({ status: "POSSIBLE_MATCH", confidence: 55 }),
      similarity({ status: "NO_MATCH" }),
    );
    expect(decision.riskLevel).toBe("MEDIUM_RISK");
  });

  test("high similarity to another submission is MEDIUM_RISK, never automatic proof of infringement", () => {
    const decision = evaluateModerationDecision(
      moderation({ status: "COMPLETED", labels: [] }),
      copyright({ status: "NO_MATCH" }),
      similarity({ status: "HIGH_SIMILARITY", similarityScore: 0.94, matchedSubmissionId: "battle_1_other_student" }),
    );
    expect(decision.riskLevel).toBe("MEDIUM_RISK");
    expect(decision.reasons.some((r) => r.includes("battle_1_other_student"))).toBe(true);
  });

  test("the highest risk across all three checks wins, not just the first one evaluated", () => {
    const decision = evaluateModerationDecision(
      moderation({ status: "COMPLETED", labels: [{ name: "safe", confidence: 2 }] }), // LOW
      copyright({ status: "NO_MATCH" }),                                              // LOW
      similarity({ status: "HIGH_SIMILARITY", similarityScore: 0.99 }),               // MEDIUM
    );
    expect(decision.riskLevel).toBe("MEDIUM_RISK");
  });
});

describe("evaluateModerationDecision — explicit policy opt-in (AUTO_REJECT_HIGH_RISK / AUTO_APPROVE_LOW_RISK)", () => {
  const ORIGINAL_ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
  });

  test("AUTO_REJECT_HIGH_RISK=true auto-rejects a fully-configured HIGH_RISK result", () => {
    jest.resetModules();
    process.env.AUTO_REJECT_HIGH_RISK = "true";
    const { evaluateModerationDecision: evaluate } = require("../../moderation/decisionEngine");
    const decision = evaluate(
      moderation({ status: "COMPLETED", labels: [{ name: "graphic_violence", confidence: 99 }] }),
      copyright({ status: "NO_MATCH" }),
      similarity({ status: "NO_MATCH" }),
    );
    expect(decision.nextStatus).toBe("REJECTED");
  });

  test("AUTO_APPROVE_LOW_RISK=true auto-approves a fully-configured LOW_RISK result", () => {
    jest.resetModules();
    process.env.AUTO_APPROVE_LOW_RISK = "true";
    const { evaluateModerationDecision: evaluate } = require("../../moderation/decisionEngine");
    const decision = evaluate(
      moderation({ status: "COMPLETED", labels: [] }),
      copyright({ status: "NO_MATCH" }),
      similarity({ status: "NO_MATCH" }),
    );
    expect(decision.nextStatus).toBe("APPROVED");
  });

  test("AUTO_APPROVE_LOW_RISK=true never approves an unconfigured/unresolved check — still PENDING_HUMAN_REVIEW", () => {
    jest.resetModules();
    process.env.AUTO_APPROVE_LOW_RISK = "true";
    const { evaluateModerationDecision: evaluate } = require("../../moderation/decisionEngine");
    const decision = evaluate(moderation(), copyright({ status: "NO_MATCH" }), similarity({ status: "NO_MATCH" }));
    expect(decision.nextStatus).toBe("PENDING_HUMAN_REVIEW");
  });
});

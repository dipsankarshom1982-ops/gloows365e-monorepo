// apps/tutor/src/lib/dashboardStatus.ts
// Tutor Profile Completion & Verification Dashboard — pure, framework-
// agnostic copy/lookup helpers shared by every apps/tutor/src/components/
// dashboard/* component. Mirrored (not shared as a package — same
// web/mobile duplication convention this session's onboarding work
// already established) at apps/tutor-mobile/lib/dashboardStatus.ts; keep
// both in sync when editing either one.
//
// profileStatus is `undefined` for any tutor who hasn't reached Step 5's
// Submit yet — nothing ever writes "draft"/"incomplete" even though the
// type allows them (see functions/src/tutorAccounts.ts's
// submitTutorOnboarding/reviewTutorOnboarding, the only two writers).
// This file treats that "not yet submitted" state as the single "draft"
// bucket rather than trying to distinguish draft vs incomplete.

import type { TutorOnboardingProfileStatus } from "@gloows/shared-logic";

export type DashboardStatusKey = "draft" | "under_review" | "verified" | "rejected" | "suspended";

export function resolveDashboardStatus(profileStatus?: TutorOnboardingProfileStatus | null): DashboardStatusKey {
  switch (profileStatus) {
    case "verified": return "verified";
    case "rejected": return "rejected";
    case "suspended": return "suspended";
    case "under_review":
    case "submitted": return "under_review";
    default: return "draft"; // undefined | "draft" | "incomplete"
  }
}

export function greetingKeyForHour(hour: number): "dashGreetingMorning" | "dashGreetingAfternoon" | "dashGreetingEvening" {
  if (hour < 12) return "dashGreetingMorning";
  if (hour < 17) return "dashGreetingAfternoon";
  return "dashGreetingEvening";
}

export const STATUS_META: Record<DashboardStatusKey, {
  icon: string;
  labelKey: string;
  descriptionKey: string;
  subtitleKey: string; // dashboard header subtitle for this status
  ctaKey: string;
}> = {
  draft: {
    icon: "🟡",
    labelKey: "dashStatusDraftLabel",
    descriptionKey: "dashStatusDraftDesc",
    subtitleKey: "dashSubtitleDraft",
    ctaKey: "dashCtaContinueSetup",
  },
  under_review: {
    icon: "🔵",
    labelKey: "dashStatusUnderReviewLabel",
    descriptionKey: "dashStatusUnderReviewDesc",
    subtitleKey: "dashSubtitleUnderReview",
    ctaKey: "dashCtaCompleteVerification",
  },
  verified: {
    icon: "🟢",
    labelKey: "dashStatusVerifiedLabel",
    descriptionKey: "dashStatusVerifiedDesc",
    subtitleKey: "dashSubtitleVerified",
    ctaKey: "dashCtaViewPublicProfile",
  },
  rejected: {
    icon: "🔴",
    labelKey: "dashStatusRejectedLabel",
    descriptionKey: "dashStatusRejectedDesc",
    subtitleKey: "dashSubtitleRejected",
    ctaKey: "dashCtaFixIssues",
  },
  suspended: {
    icon: "⚫",
    labelKey: "dashStatusSuspendedLabel",
    descriptionKey: "dashStatusSuspendedDesc",
    subtitleKey: "dashSubtitleSuspended",
    ctaKey: "dashCtaContactSupport",
  },
};

// 5-stage journey per the spec. "rejected" swaps the last two stages for
// a "changes required -> resubmission" branch rather than showing
// Under Review/Verified as still-pending.
export type TimelineStageState = "done" | "current" | "upcoming" | "warning";
export type TimelineStage = { labelKey: string; state: TimelineStageState };

export function timelineStages(status: DashboardStatusKey, onboardingCompleted?: boolean): TimelineStage[] {
  const accountCreated: TimelineStage = { labelKey: "dashTimelineAccountCreated", state: "done" };
  const profileCompleted: TimelineStage = {
    labelKey: "dashTimelineProfileCompleted",
    state: onboardingCompleted || status !== "draft" ? "done" : "current",
  };

  if (status === "rejected") {
    return [
      accountCreated,
      profileCompleted,
      { labelKey: "dashTimelineSubmitted", state: "done" },
      { labelKey: "dashTimelineChangesRequired", state: "warning" },
      { labelKey: "dashTimelineResubmission", state: "upcoming" },
    ];
  }

  const submitted: TimelineStage = {
    labelKey: "dashTimelineSubmitted",
    state: status === "draft" ? "upcoming" : "done",
  };
  const underReview: TimelineStage = {
    labelKey: "dashTimelineUnderReview",
    state: status === "under_review" ? "current" : status === "verified" ? "done" : "upcoming",
  };
  const verified: TimelineStage = {
    labelKey: "dashTimelineVerifiedTutor",
    state: status === "verified" ? "done" : "upcoming",
  };

  return [accountCreated, profileCompleted, submitted, underReview, verified];
}

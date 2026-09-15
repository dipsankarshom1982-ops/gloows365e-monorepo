// apps/tutor-mobile/lib/dashboardStatus.ts
// Mirrors apps/tutor/src/lib/dashboardStatus.ts exactly — see that file's
// header for the full reasoning. Keep both in sync when editing either.

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
  subtitleKey: string;
  ctaKey: string;
}> = {
  draft: {
    icon: "🟡", labelKey: "dashStatusDraftLabel", descriptionKey: "dashStatusDraftDesc",
    subtitleKey: "dashSubtitleDraft", ctaKey: "dashCtaContinueSetup",
  },
  under_review: {
    icon: "🔵", labelKey: "dashStatusUnderReviewLabel", descriptionKey: "dashStatusUnderReviewDesc",
    subtitleKey: "dashSubtitleUnderReview", ctaKey: "dashCtaCompleteVerification",
  },
  verified: {
    icon: "🟢", labelKey: "dashStatusVerifiedLabel", descriptionKey: "dashStatusVerifiedDesc",
    subtitleKey: "dashSubtitleVerified", ctaKey: "dashCtaViewPublicProfile",
  },
  rejected: {
    icon: "🔴", labelKey: "dashStatusRejectedLabel", descriptionKey: "dashStatusRejectedDesc",
    subtitleKey: "dashSubtitleRejected", ctaKey: "dashCtaFixIssues",
  },
  suspended: {
    icon: "⚫", labelKey: "dashStatusSuspendedLabel", descriptionKey: "dashStatusSuspendedDesc",
    subtitleKey: "dashSubtitleSuspended", ctaKey: "dashCtaContactSupport",
  },
};

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

  const submitted: TimelineStage = { labelKey: "dashTimelineSubmitted", state: status === "draft" ? "upcoming" : "done" };
  const underReview: TimelineStage = {
    labelKey: "dashTimelineUnderReview",
    state: status === "under_review" ? "current" : status === "verified" ? "done" : "upcoming",
  };
  const verified: TimelineStage = { labelKey: "dashTimelineVerifiedTutor", state: status === "verified" ? "done" : "upcoming" };

  return [accountCreated, profileCompleted, submitted, underReview, verified];
}

"use client";
// apps/tutor/src/components/dashboard/PublicProfileReadiness.tsx
// "Ready to be discovered?" — readiness is computed client-side from the
// same requirements list the spec gives; actually going live is governed
// entirely by the EXISTING tutors/{uid}.verified flag (admin/server-only
// — see functions/src/tutorAccounts.ts's reviewTutorOnboarding), which is
// what already drives functions/src/tutorMarketplace.ts's marketplace
// sync trigger. There's deliberately no separate tutor-facing "Publish"
// action: since going live is an admin decision (per spec: "Do not allow
// tutors to manually enable this badge"), a READY tutor sees "awaiting
// final verification" rather than a button that would need to either do
// nothing or bypass that rule.
//
// "Preview Public Profile" is rendered disabled — no public tutor-profile
// page exists anywhere in this repo yet to link to (checked during
// planning); wiring one up is out of scope for this dashboard.

import { useTutorT } from "@gloows/tutor-i18n";
import type { TutorProfile, TutorProfileCompletionResult } from "@gloows/shared-logic";
import { Card } from "@/components/ui";

type Props = {
  user: { emailVerified: boolean };
  tutorProfile: TutorProfile;
  completion: TutorProfileCompletionResult;
};

export default function PublicProfileReadiness({ user, tutorProfile, completion }: Props) {
  const { t } = useTutorT();
  const completedSet = new Set(completion.completedSections);

  const requirementsMet =
    user.emailVerified &&
    !!tutorProfile.phoneVerified &&
    completedSet.has("basic_information") &&
    completedSet.has("profile_photo") &&
    completedSet.has("teaching_profile") &&
    completedSet.has("bio") &&
    completedSet.has("qualifications") &&
    tutorProfile.profileStatus !== "rejected" &&
    tutorProfile.profileStatus !== "suspended";

  const live = tutorProfile.verified === true;
  const statusKey = live ? "dashReadinessLive" : requirementsMet ? "dashReadinessReady" : "dashReadinessNotReady";
  const descKey = live ? "dashReadinessLiveDesc" : requirementsMet ? "dashReadinessReadyDesc" : "dashReadinessNotReadyDesc";

  return (
    <Card className="mb-4">
      <p className="text-sm font-black text-slate-100 mb-1">{t("dashReadinessTitle")}</p>
      <p className="text-xs font-bold uppercase tracking-wide mb-1.5 mt-2" style={{ color: live ? "#22c55e" : requirementsMet ? "#f59e0b" : "#64748b" }}>
        {t(statusKey)}
      </p>
      <p className="text-[13px] text-slate-400 mb-3">{t(descKey)}</p>
      <button type="button" disabled className="text-xs font-bold text-slate-600 cursor-not-allowed">
        {t("dashPreviewPublicProfileCta")} {t("dashComingSoon")}
      </button>
    </Card>
  );
}

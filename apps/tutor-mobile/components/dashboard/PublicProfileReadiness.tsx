// apps/tutor-mobile/components/dashboard/PublicProfileReadiness.tsx
// Mirrors apps/tutor/src/components/dashboard/PublicProfileReadiness.tsx
// — see its header for the "no separate publish action" reasoning.

import { useTranslation } from "react-i18next";
import { Text } from "react-native";
import { colors, semantic, spacing } from "@gloows/tutor-ui";
import type { TutorProfile, TutorProfileCompletionResult } from "@gloows/shared-logic";
import { Card } from "@/components/ui";

type Props = {
  user: { emailVerified: boolean };
  tutorProfile: TutorProfile;
  completion: TutorProfileCompletionResult;
};

export default function PublicProfileReadiness({ user, tutorProfile, completion }: Props) {
  const { t } = useTranslation();
  const completedSet = new Set(completion.completedSections);

  const requirementsMet =
    user.emailVerified && !!tutorProfile.phoneVerified &&
    completedSet.has("basic_information") && completedSet.has("profile_photo") &&
    completedSet.has("teaching_profile") && completedSet.has("bio") && completedSet.has("qualifications") &&
    tutorProfile.profileStatus !== "rejected" && tutorProfile.profileStatus !== "suspended";

  const live = tutorProfile.verified === true;
  const statusKey = live ? "dashReadinessLive" : requirementsMet ? "dashReadinessReady" : "dashReadinessNotReady";
  const descKey = live ? "dashReadinessLiveDesc" : requirementsMet ? "dashReadinessReadyDesc" : "dashReadinessNotReadyDesc";
  const statusColor = live ? colors.success : requirementsMet ? colors.warning : semantic.textMuted;

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={{ fontSize: 14, fontWeight: "900", color: semantic.textPrimary, marginBottom: 4 }}>{t("dashReadinessTitle")}</Text>
      <Text style={{ fontSize: 11, fontWeight: "800", color: statusColor, letterSpacing: 0.5, marginTop: 4, marginBottom: 4 }}>
        {t(statusKey).toUpperCase()}
      </Text>
      <Text style={{ fontSize: 13, color: semantic.textSecondary, marginBottom: 10 }}>{t(descKey)}</Text>
      <Text style={{ fontSize: 12, fontWeight: "800", color: colors.slate[600] }}>
        {t("dashPreviewPublicProfileCta")} {t("dashComingSoon")}
      </Text>
    </Card>
  );
}

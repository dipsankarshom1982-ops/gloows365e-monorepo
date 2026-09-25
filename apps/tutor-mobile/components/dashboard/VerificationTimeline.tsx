// apps/tutor-mobile/components/dashboard/VerificationTimeline.tsx
// Mirrors apps/tutor/src/components/dashboard/VerificationTimeline.tsx.

import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { colors, semantic, spacing } from "@gloows/tutor-ui";
import { timelineStages, type DashboardStatusKey, type TimelineStageState } from "@/lib/dashboardStatus";
import { Card } from "@/components/ui";

const STATE_GLYPH: Record<TimelineStageState, { icon: string; color: string }> = {
  done:     { icon: "✓", color: colors.success },
  current:  { icon: "●", color: semantic.accent },
  warning:  { icon: "⚠", color: colors.warning },
  upcoming: { icon: "○", color: colors.slate[600] },
};

type Props = { status: DashboardStatusKey; onboardingCompleted?: boolean };

export default function VerificationTimeline({ status, onboardingCompleted }: Props) {
  const { t } = useTranslation();
  const stages = timelineStages(status, onboardingCompleted);

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={{ fontSize: 14, fontWeight: "900", color: semantic.textPrimary, marginBottom: spacing.sm }}>{t("dashTimelineTitle")}</Text>
      <View style={{ gap: 8 }}>
        {stages.map((stage, i) => {
          const g = STATE_GLYPH[stage.state];
          return (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ width: 16, textAlign: "center", fontWeight: "900", color: g.color }}>{g.icon}</Text>
              <Text style={{
                fontSize: 13,
                color: stage.state === "upcoming" ? semantic.textMuted : semantic.textPrimary,
                fontWeight: stage.state === "current" ? "800" : "400",
              }}>
                {t(stage.labelKey)}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

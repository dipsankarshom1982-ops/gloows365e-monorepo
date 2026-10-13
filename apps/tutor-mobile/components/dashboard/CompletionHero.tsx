// apps/tutor-mobile/components/dashboard/CompletionHero.tsx
// Mirrors apps/tutor/src/components/dashboard/CompletionHero.tsx.

import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, TouchableOpacity, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import type { TutorProfileCompletionResult } from "@gloows/shared-logic";
import { tutorProfileSectionLabel } from "@gloows/shared-logic";
import { STATUS_META, greetingKeyForHour, type DashboardStatusKey } from "@/lib/dashboardStatus";
import { Card } from "@/components/ui";

type Props = {
  name: string;
  status: DashboardStatusKey;
  completion: TutorProfileCompletionResult;
  payoutSetUp: boolean;
  ctaHref: string;
};

export default function CompletionHero({ name, status, completion, payoutSetUp, ctaHref }: Props) {
  const { t } = useTranslation();
  const meta = STATUS_META[status];
  const hour = new Date().getHours();
  const firstName = name.trim().split(/\s+/)[0] ?? "";

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={{ fontSize: 18, fontWeight: "900", color: semantic.textPrimary }}>
        {t(greetingKeyForHour(hour), { name: firstName })} 👋
      </Text>
      <Text style={{ fontSize: 13, color: semantic.textSecondary, marginTop: 4, marginBottom: spacing.lg }}>
        {t(meta.subtitleKey)}
      </Text>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: semantic.textMuted, letterSpacing: 1 }}>
          {t("dashProfileCompletion").toUpperCase()}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: "900", color: semantic.accent }}>{completion.completionPercentage}%</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: semantic.surfaceElevated, overflow: "hidden", marginBottom: 6 }}>
        <View style={{ height: "100%", borderRadius: 4, width: `${completion.completionPercentage}%`, backgroundColor: semantic.accent }} />
      </View>
      <Text style={{ fontSize: 12, color: semantic.textMuted, marginBottom: spacing.md }}>{t("dashCompletionHint")}</Text>

      <View style={{ gap: 6, marginBottom: spacing.lg }}>
        {completion.completedSections.map((id) => (
          <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: semantic.success }}>✓</Text>
            <Text style={{ fontSize: 13, color: semantic.textSecondary }}>{tutorProfileSectionLabel(id)}</Text>
          </View>
        ))}
        {completion.incompleteSections.map((id) => (
          <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: id === "verification_documents" ? semantic.warning : semantic.textMuted }}>
              {id === "verification_documents" ? "⚠" : "○"}
            </Text>
            <Text style={{ fontSize: 13, color: semantic.textMuted }}>{tutorProfileSectionLabel(id)}</Text>
          </View>
        ))}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: payoutSetUp ? semantic.success : semantic.textMuted }}>{payoutSetUp ? "✓" : "○"}</Text>
          <Text style={{ fontSize: 13, color: semantic.textMuted }}>{t("dashPayoutSetupLabel")}</Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => router.push(ctaHref as any)}
        style={{ backgroundColor: semantic.primary, borderRadius: 10, paddingVertical: spacing.md, alignItems: "center" }}
      >
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>{t(meta.ctaKey)}</Text>
      </TouchableOpacity>
    </Card>
  );
}

// apps/tutor-mobile/components/dashboard/QuickActions.tsx
// Mirrors apps/tutor/src/components/dashboard/QuickActions.tsx.

import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, TouchableOpacity, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import type { DashboardStatusKey } from "@/lib/dashboardStatus";
import { Card } from "@/components/ui";

type Action = { labelKey: string; href: string; icon: string };

export default function QuickActions({ status }: { status: DashboardStatusKey }) {
  const { t } = useTranslation();

  const actions: Action[] = [
    ...(status === "draft" ? [{ labelKey: "dashQuickContinueSetup", href: "/onboarding?edit=1", icon: "🚀" }] : []),
    { labelKey: "dashQuickEditProfile", href: "/onboarding?edit=1", icon: "✏️" },
    { labelKey: "dashQuickManageDocuments", href: "/documents", icon: "📄" },
    { labelKey: "dashQuickSetAvailability", href: "/profile", icon: "🗓️" },
    { labelKey: "dashQuickVerificationStatus", href: "/dashboard", icon: "🛡️" },
    { labelKey: "dashQuickPayments", href: "/payouts", icon: "💳" },
  ];

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ fontSize: 14, fontWeight: "900", color: semantic.textPrimary, marginBottom: spacing.sm }}>{t("dashQuickActionsTitle")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {actions.map((a) => (
          <TouchableOpacity key={a.labelKey} onPress={() => router.push(a.href as any)} style={{ width: "47%" }}>
            <Card style={{ alignItems: "center", paddingVertical: spacing.lg }}>
              <Text style={{ fontSize: 20, marginBottom: 6 }}>{a.icon}</Text>
              <Text style={{ fontSize: 12, fontWeight: "800", color: semantic.textSecondary, textAlign: "center" }}>{t(a.labelKey)}</Text>
            </Card>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

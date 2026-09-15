// apps/tutor-mobile/components/dashboard/StatusCard.tsx
// Mirrors apps/tutor/src/components/dashboard/StatusCard.tsx.

import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { colors, semantic, spacing } from "@gloows/tutor-ui";
import { STATUS_META, type DashboardStatusKey } from "@/lib/dashboardStatus";
import { Card } from "@/components/ui";

type Props = { status: DashboardStatusKey; rejectionReason?: string };

export default function StatusCard({ status, rejectionReason }: Props) {
  const { t } = useTranslation();
  const meta = STATUS_META[status];

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: semantic.textMuted, letterSpacing: 1, marginBottom: 8 }}>
        {t("dashStatusCardTitle").toUpperCase()}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <Text style={{ fontSize: 20 }}>{meta.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "900", color: semantic.textPrimary }}>{t(meta.labelKey)}</Text>
          <Text style={{ fontSize: 13, color: semantic.textSecondary, marginTop: 2 }}>{t(meta.descriptionKey)}</Text>
        </View>
      </View>
      {status === "rejected" && rejectionReason && (
        <View style={{ marginTop: 12, borderLeftWidth: 3, borderLeftColor: colors.danger, backgroundColor: "rgba(239,68,68,0.10)", borderRadius: 8, padding: 10 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: colors.danger, letterSpacing: 0.5, marginBottom: 3 }}>
            {t("dashRejectionReasonLabel").toUpperCase()}
          </Text>
          <Text style={{ fontSize: 13, color: semantic.textPrimary }}>{rejectionReason}</Text>
        </View>
      )}
    </Card>
  );
}

// apps/tutor-mobile/components/dashboard/ProfileStrength.tsx
// Mirrors apps/tutor/src/components/dashboard/ProfileStrength.tsx.

import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { colors, semantic, spacing } from "@gloows/tutor-ui";
import type { TutorProfileStrength } from "@gloows/shared-logic";
import { Card } from "@/components/ui";

const STARS: Record<TutorProfileStrength, number> = { beginner: 1, developing: 2, good: 3, strong: 4, excellent: 5 };
const LABEL_KEY: Record<TutorProfileStrength, string> = {
  beginner: "dashStrengthBeginner", developing: "dashStrengthDeveloping", good: "dashStrengthGood",
  strong: "dashStrengthStrong", excellent: "dashStrengthExcellent",
};
const TIP_KEY: Record<TutorProfileStrength, string> = {
  beginner: "dashStrengthTipBeginner", developing: "dashStrengthTipDeveloping", good: "dashStrengthTipGood",
  strong: "dashStrengthTipStrong", excellent: "dashStrengthTipExcellent",
};

export default function ProfileStrength({ strength }: { strength: TutorProfileStrength }) {
  const { t } = useTranslation();
  const filled = STARS[strength];

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: semantic.textMuted, letterSpacing: 1, marginBottom: 8 }}>
        {t("dashProfileStrengthTitle").toUpperCase()}
      </Text>
      <View style={{ flexDirection: "row", gap: 4, marginBottom: 6 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Text key={i} style={{ fontSize: 18, color: i <= filled ? colors.gold : colors.slate[700] }}>★</Text>
        ))}
      </View>
      <Text style={{ fontSize: 14, fontWeight: "900", color: semantic.textPrimary, marginBottom: 4 }}>{t(LABEL_KEY[strength])}</Text>
      <Text style={{ fontSize: 12, color: semantic.textMuted }}>{t(TIP_KEY[strength])}</Text>
    </Card>
  );
}

// apps/tutor-mobile/components/dashboard/ProfileChecklist.tsx
// Mirrors apps/tutor/src/components/dashboard/ProfileChecklist.tsx.

import { router } from "expo-router";
import type { User } from "firebase/auth";
import { useTranslation } from "react-i18next";
import { Text, TouchableOpacity, View } from "react-native";
import { colors, semantic, spacing } from "@gloows/tutor-ui";
import type { TutorProfile, TutorProfileCompletionResult } from "@gloows/shared-logic";
import { Card } from "@/components/ui";

type Row = { done: boolean; labelKey: string; href: string };

type Props = { user: User; tutorProfile: TutorProfile; completion: TutorProfileCompletionResult; payoutSetUp: boolean };

export default function ProfileChecklist({ user, tutorProfile, completion, payoutSetUp }: Props) {
  const { t } = useTranslation();
  const completedSet = new Set(completion.completedSections);

  const rows: Row[] = [
    { done: true, labelKey: "dashChecklistAccountCreated", href: "/dashboard" },
    { done: user.emailVerified, labelKey: "dashChecklistEmailVerified", href: "/dashboard" },
    { done: !!tutorProfile.phoneVerified, labelKey: "dashChecklistMobileVerified", href: "/dashboard" },
    { done: completedSet.has("basic_information"), labelKey: "dashChecklistBasicInfo", href: "/onboarding?edit=1" },
    { done: completedSet.has("profile_photo"), labelKey: "dashChecklistProfilePhoto", href: "/onboarding?edit=1" },
    { done: completedSet.has("teaching_profile"), labelKey: "dashChecklistSubjectsAdded", href: "/onboarding?edit=1" },
    { done: completedSet.has("bio"), labelKey: "dashChecklistBio", href: "/profile" },
    { done: completedSet.has("verification_documents"), labelKey: "dashChecklistDocuments", href: "/documents" },
    { done: completedSet.has("availability"), labelKey: "dashChecklistAvailability", href: "/profile" },
    { done: payoutSetUp, labelKey: "dashChecklistPayout", href: "/payouts" },
  ];

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={{ fontSize: 14, fontWeight: "900", color: semantic.textPrimary, marginBottom: spacing.sm }}>{t("dashChecklistTitle")}</Text>
      <View>
        {rows.map((row, i) => (
          <TouchableOpacity
            key={row.labelKey} onPress={() => router.push(row.href as any)}
            style={{
              flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9,
              borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: colors.slate[800],
            }}
          >
            <Text style={{ width: 16, textAlign: "center", fontWeight: "900", color: row.done ? semantic.success : colors.slate[600] }}>
              {row.done ? "✓" : "○"}
            </Text>
            <Text style={{ flex: 1, fontSize: 13, color: row.done ? semantic.textSecondary : semantic.textMuted }}>{t(row.labelKey)}</Text>
            <Text style={{ color: colors.slate[600], fontSize: 13 }}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Card>
  );
}

// apps/tutor-mobile/components/dashboard/ActionRequired.tsx
// Mirrors apps/tutor/src/components/dashboard/ActionRequired.tsx.

import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, TouchableOpacity, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import type { TutorProfile, TutorProfileCompletionResult } from "@gloows/shared-logic";
import { Card } from "@/components/ui";

// QA fix — see web counterpart's header: an item now carries EITHER an
// `href` (navigate) OR an `action` (call a handler, used by the phone
// item to open the verify modal instead of a same-screen no-op link).
type ActionItem =
  | { key: string; titleKey: string; descKey: string; ctaKey: string; href: string; action?: undefined; priority: number }
  | { key: string; titleKey: string; descKey: string; ctaKey: string; href?: undefined; action: () => void; priority: number };

type Props = { tutorProfile: TutorProfile; completion: TutorProfileCompletionResult; onVerifyPhone: () => void };

export default function ActionRequired({ tutorProfile, completion, onVerifyPhone }: Props) {
  const { t } = useTranslation();
  const incomplete = new Set(completion.incompleteSections);
  const items: ActionItem[] = [];

  if (!tutorProfile.phoneVerified) {
    items.push({ key: "phone", titleKey: "dashActionVerifyPhoneTitle", descKey: "dashActionVerifyPhoneDesc", ctaKey: "dashVerifyNowCta", action: onVerifyPhone, priority: 1 });
  }
  if (incomplete.has("basic_information") || incomplete.has("teaching_profile") || incomplete.has("qualifications")) {
    items.push({ key: "profile_info", titleKey: "dashActionCompleteProfileTitle", descKey: "dashActionCompleteProfileDesc", ctaKey: "dashCompleteNowCta", href: "/onboarding?edit=1", priority: 2 });
  }
  if (incomplete.has("verification_documents")) {
    items.push({ key: "docs", titleKey: "dashActionUploadDocsTitle", descKey: "dashActionUploadDocsDesc", ctaKey: "dashUploadDocumentCta", href: "/documents", priority: 3 });
  }
  const allDocs = [...(tutorProfile.qualificationDocuments ?? []), ...(tutorProfile.experienceDocuments ?? []), ...(tutorProfile.additionalCertificates ?? [])];
  if (allDocs.some((d) => d.status === "rejected")) {
    items.push({ key: "rejected_docs", titleKey: "dashActionRejectedDocsTitle", descKey: "dashActionRejectedDocsDesc", ctaKey: "dashReuploadDocumentCta", href: "/documents", priority: 4 });
  }
  if (incomplete.has("bio")) {
    items.push({ key: "bio", titleKey: "dashActionBioTitle", descKey: "dashActionBioDesc", ctaKey: "dashCompleteNowCta", href: "/profile", priority: 5 });
  }
  if (incomplete.has("profile_photo")) {
    items.push({ key: "photo", titleKey: "dashActionPhotoTitle", descKey: "dashActionPhotoDesc", ctaKey: "dashCompleteNowCta", href: "/onboarding?edit=1", priority: 5 });
  }
  if (incomplete.has("availability")) {
    items.push({ key: "availability", titleKey: "dashActionAvailabilityTitle", descKey: "dashActionAvailabilityDesc", ctaKey: "dashSetAvailabilityCta", href: "/profile", priority: 6 });
  }

  if (items.length === 0) return null;
  items.sort((a, b) => a.priority - b.priority);

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ fontSize: 16, fontWeight: "900", color: semantic.textPrimary, marginBottom: spacing.sm }}>{t("dashActionRequiredTitle")}</Text>
      <View style={{ gap: spacing.sm }}>
        {items.map((item) => (
          <Card key={item.key}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <Text style={{ color: "#F59E0B", fontSize: 15, marginTop: 1 }}>⚠</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: semantic.textPrimary }}>{t(item.titleKey)}</Text>
                <Text style={{ fontSize: 12, color: semantic.textMuted, marginTop: 2 }}>{t(item.descKey)}</Text>
                <TouchableOpacity onPress={item.href ? () => router.push(item.href as any) : item.action} style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: semantic.accent }}>{t(item.ctaKey)}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}

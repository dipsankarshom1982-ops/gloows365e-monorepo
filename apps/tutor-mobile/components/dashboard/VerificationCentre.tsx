// apps/tutor-mobile/components/dashboard/VerificationCentre.tsx
// Mirrors apps/tutor/src/components/dashboard/VerificationCentre.tsx.

import { useState } from "react";
import { router } from "expo-router";
import type { User } from "firebase/auth";
import { sendEmailVerification } from "firebase/auth";
import { useTranslation } from "react-i18next";
import { Text, TouchableOpacity, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import type { TutorProfile, TutorOnboardingDocument } from "@gloows/shared-logic";
import { Badge, Card } from "@/components/ui";

// QA fix — see web counterpart's header: modal ownership moved to the
// dashboard screen so ActionRequired's phone item can open it too.
type Props = { user: User; tutorProfile: TutorProfile; onVerifyPhone: () => void };

function docStatusTone(docs: TutorOnboardingDocument[] | undefined): "default" | "success" | "warning" | "danger" {
  const status = docs?.[0]?.status;
  if (status === "verified") return "success";
  if (status === "rejected") return "danger";
  if (status === "under_review" || status === "submitted") return "warning";
  return "default";
}

function docStatusKey(docs: TutorOnboardingDocument[] | undefined): string {
  const status = docs?.[0]?.status;
  switch (status) {
    case "verified": return "dashDocStatusVerified";
    case "rejected": return "dashDocStatusRejected";
    case "under_review": return "dashDocStatusUnderReview";
    case "submitted": return "dashDocStatusSubmitted";
    default: return "dashDocStatusNotSubmitted";
  }
}

function maskPhone(phone: string): string {
  if (phone.length < 10) return phone;
  return `XXXXX ${phone.slice(-5)}`;
}

function Row({ title, subtitle, badge, action, actionLabel, helper, error }: {
  title: string; subtitle?: string; badge: React.ReactNode;
  action?: () => void; actionLabel?: string; helper?: string; error?: string;
}) {
  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: semantic.textPrimary }}>{title}</Text>
          {subtitle && <Text style={{ fontSize: 11, color: semantic.textMuted, marginTop: 2 }}>{subtitle}</Text>}
        </View>
        {badge}
      </View>
      {helper && <Text style={{ fontSize: 11, color: semantic.textMuted, marginTop: 6 }}>{helper}</Text>}
      {error && <Text style={{ fontSize: 12, color: "#F87171", marginTop: 6 }}>{error}</Text>}
      {action && actionLabel && (
        <TouchableOpacity onPress={action} style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: "800", color: semantic.accent }}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}

export default function VerificationCentre({ user, tutorProfile, onVerifyPhone }: Props) {
  const { t } = useTranslation();
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const profileInfoComplete = !!(tutorProfile.name && tutorProfile.profilePic && tutorProfile.city && tutorProfile.state);
  const teachingProfileComplete = !!(
    tutorProfile.tutorType && (tutorProfile.subjects?.length ?? 0) > 0 &&
    (tutorProfile.studentLevels?.length ?? 0) > 0 && tutorProfile.teachingMode && tutorProfile.experience
  );

  async function handleSendEmailVerification() {
    setEmailSending(true);
    try {
      await sendEmailVerification(user);
      setEmailSent(true);
    } catch { /* best-effort, see web counterpart */ } finally { setEmailSending(false); }
  }

  const qualDoc = tutorProfile.qualificationDocuments?.[0];

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ fontSize: 16, fontWeight: "900", color: semantic.textPrimary }}>{t("dashVerificationCentreTitle")}</Text>
      <Text style={{ fontSize: 13, color: semantic.textSecondary, marginBottom: spacing.sm }}>{t("dashVerificationCentreSubtitle")}</Text>

      <Row
        title={t("dashEmailVerificationTitle")} subtitle={user.email ?? ""}
        badge={<Badge tone={user.emailVerified ? "success" : "warning"} label={user.emailVerified ? t("dashVerified") : t("dashVerificationRequired")} />}
        action={!user.emailVerified ? handleSendEmailVerification : undefined}
        actionLabel={!user.emailVerified ? (emailSent ? t("dashVerificationEmailSent") : emailSending ? "…" : t("dashVerifyEmailCta")) : undefined}
      />

      <Row
        title={t("dashMobileVerificationTitle")} subtitle={`+91 ${maskPhone(tutorProfile.phoneNumber ?? "")}`}
        badge={<Badge tone={tutorProfile.phoneVerified ? "success" : "warning"} label={tutorProfile.phoneVerified ? t("dashVerified") : t("dashVerificationRequired")} />}
        action={!tutorProfile.phoneVerified ? onVerifyPhone : undefined}
        actionLabel={!tutorProfile.phoneVerified ? t("dashVerifyMobileCta") : undefined}
      />

      <Row
        title={t("dashProfileInfoTitle")}
        badge={<Badge tone={profileInfoComplete ? "success" : "warning"} label={profileInfoComplete ? t("dashComplete") : t("dashIncomplete")} />}
        action={() => router.push("/onboarding?edit=1" as any)} actionLabel={t("dashCompleteProfileCta")}
      />

      <Row
        title={t("dashTeachingProfileTitle")}
        badge={<Badge tone={teachingProfileComplete ? "success" : "warning"} label={teachingProfileComplete ? t("dashComplete") : t("dashIncomplete")} />}
        action={() => router.push("/onboarding?edit=1" as any)} actionLabel={t("dashUpdateTeachingProfileCta")}
      />

      <Row
        title={t("dashQualificationDocTitle")}
        badge={<Badge tone={docStatusTone(tutorProfile.qualificationDocuments)} label={t(docStatusKey(tutorProfile.qualificationDocuments))} />}
        error={qualDoc?.status === "rejected" ? qualDoc.rejectionReason : undefined}
        action={() => router.push("/documents" as any)}
        actionLabel={(tutorProfile.qualificationDocuments?.length ?? 0) > 0 ? t("dashViewSubmission") : t("dashUploadCertificateCta")}
      />

      <Row
        title={t("dashExperienceDocTitle")}
        badge={<Badge tone={docStatusTone(tutorProfile.experienceDocuments)} label={t(docStatusKey(tutorProfile.experienceDocuments))} />}
        helper={t("dashExperienceDocHelp")}
        action={() => router.push("/documents" as any)}
        actionLabel={(tutorProfile.experienceDocuments?.length ?? 0) > 0 ? t("dashViewSubmission") : t("dashAddExperienceCertCta")}
      />

      <Row
        title={t("dashCertificatesTitle")}
        badge={<Badge tone={docStatusTone(tutorProfile.additionalCertificates)} label={t(docStatusKey(tutorProfile.additionalCertificates))} />}
        action={() => router.push("/documents" as any)} actionLabel={t("dashAddCertificateCta")}
      />
    </View>
  );
}

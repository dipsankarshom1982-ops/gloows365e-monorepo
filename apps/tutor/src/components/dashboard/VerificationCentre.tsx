"use client";
// apps/tutor/src/components/dashboard/VerificationCentre.tsx
// The dashboard's 7-card verification centre: Email, Mobile, Profile
// Information, Teaching Profile, and the 3 onboarding document
// categories (qualification/experience/certificates). Reads straight off
// the live tutorProfile (already real-time via useTutorProfile's
// onSnapshot) and Firebase Auth's own `user.emailVerified` — no separate
// data fetch needed.

import { useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import { sendEmailVerification } from "firebase/auth";
import { useTutorT } from "@gloows/tutor-i18n";
import type { TutorProfile, TutorOnboardingDocument } from "@gloows/shared-logic";
import { Badge, Card } from "@/components/ui";

type Props = {
  user: User;
  tutorProfile: TutorProfile;
  // QA fix — the modal used to be owned entirely inside this component,
  // which meant the Action Required section's "Verify Now" phone item
  // (components/dashboard/ActionRequired.tsx) had nothing to actually
  // open and fell back to a same-page href="/dashboard" link that did
  // nothing when clicked. Opening is now owned by the dashboard page
  // (both platforms) and shared between this component and
  // ActionRequired.
  onVerifyPhone: () => void;
};

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

// "+91 XXXXX 12345" — mask the first 5 digits, show the last 5, per spec.
function maskPhone(phone: string): string {
  if (phone.length < 10) return phone;
  return `XXXXX ${phone.slice(-5)}`;
}

export default function VerificationCentre({ user, tutorProfile, onVerifyPhone }: Props) {
  const { t } = useTutorT();
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
    } catch {
      // Best-effort — Firebase rate-limits this; a failed send just means
      // the tutor can try again later, not worth surfacing as an error banner.
    } finally {
      setEmailSending(false);
    }
  }

  return (
    <div className="mb-4">
      <p className="text-lg font-black text-slate-100">{t("dashVerificationCentreTitle")}</p>
      <p className="text-sm text-slate-400 mb-3">{t("dashVerificationCentreSubtitle")}</p>

      <div className="flex flex-col gap-3">
        {/* Email */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-100">{t("dashEmailVerificationTitle")}</p>
              <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
            </div>
            {user.emailVerified ? (
              <Badge tone="success">{t("dashVerified")}</Badge>
            ) : (
              <Badge tone="warning">{t("dashVerificationRequired")}</Badge>
            )}
          </div>
          {!user.emailVerified && (
            <button
              type="button" onClick={handleSendEmailVerification} disabled={emailSending || emailSent}
              className="mt-3 text-xs font-bold text-brand-400 hover:text-brand-300 disabled:opacity-50"
            >
              {emailSent ? t("dashVerificationEmailSent") : emailSending ? "…" : t("dashVerifyEmailCta")}
            </button>
          )}
        </Card>

        {/* Mobile */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-100">{t("dashMobileVerificationTitle")}</p>
              <p className="text-xs text-slate-500 mt-0.5">+91 {maskPhone(tutorProfile.phoneNumber ?? "")}</p>
            </div>
            {tutorProfile.phoneVerified ? (
              <Badge tone="success">{t("dashVerified")}</Badge>
            ) : (
              <Badge tone="warning">{t("dashVerificationRequired")}</Badge>
            )}
          </div>
          {!tutorProfile.phoneVerified && (
            <button type="button" onClick={onVerifyPhone} className="mt-3 text-xs font-bold text-brand-400 hover:text-brand-300">
              {t("dashVerifyMobileCta")}
            </button>
          )}
        </Card>

        {/* Profile information */}
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-100">{t("dashProfileInfoTitle")}</p>
            <Badge tone={profileInfoComplete ? "success" : "warning"}>
              {profileInfoComplete ? t("dashComplete") : t("dashIncomplete")}
            </Badge>
          </div>
          <Link href="/onboarding?edit=1" className="mt-3 inline-block text-xs font-bold text-brand-400 hover:text-brand-300">
            {t("dashCompleteProfileCta")}
          </Link>
        </Card>

        {/* Teaching profile */}
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-100">{t("dashTeachingProfileTitle")}</p>
            <Badge tone={teachingProfileComplete ? "success" : "warning"}>
              {teachingProfileComplete ? t("dashComplete") : t("dashIncomplete")}
            </Badge>
          </div>
          <Link href="/onboarding?edit=1" className="mt-3 inline-block text-xs font-bold text-brand-400 hover:text-brand-300">
            {t("dashUpdateTeachingProfileCta")}
          </Link>
        </Card>

        {/* Qualification documents */}
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-100">{t("dashQualificationDocTitle")}</p>
            <Badge tone={docStatusTone(tutorProfile.qualificationDocuments)}>{t(docStatusKey(tutorProfile.qualificationDocuments))}</Badge>
          </div>
          {tutorProfile.qualificationDocuments?.[0]?.status === "rejected" && tutorProfile.qualificationDocuments[0].rejectionReason && (
            <p className="text-xs text-danger mt-2">{tutorProfile.qualificationDocuments[0].rejectionReason}</p>
          )}
          <Link href="/documents" className="mt-3 inline-block text-xs font-bold text-brand-400 hover:text-brand-300">
            {(tutorProfile.qualificationDocuments?.length ?? 0) > 0 ? t("dashViewSubmission") : t("dashUploadCertificateCta")}
          </Link>
        </Card>

        {/* Experience documents */}
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-100">{t("dashExperienceDocTitle")}</p>
            <Badge tone={docStatusTone(tutorProfile.experienceDocuments)}>{t(docStatusKey(tutorProfile.experienceDocuments))}</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-2">{t("dashExperienceDocHelp")}</p>
          <Link href="/documents" className="mt-2 inline-block text-xs font-bold text-brand-400 hover:text-brand-300">
            {(tutorProfile.experienceDocuments?.length ?? 0) > 0 ? t("dashViewSubmission") : t("dashAddExperienceCertCta")}
          </Link>
        </Card>

        {/* Additional certifications */}
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-100">{t("dashCertificatesTitle")}</p>
            <Badge tone={docStatusTone(tutorProfile.additionalCertificates)}>{t(docStatusKey(tutorProfile.additionalCertificates))}</Badge>
          </div>
          <Link href="/documents" className="mt-3 inline-block text-xs font-bold text-brand-400 hover:text-brand-300">
            {t("dashAddCertificateCta")}
          </Link>
        </Card>
      </div>
    </div>
  );
}

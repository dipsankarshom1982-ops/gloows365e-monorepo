"use client";
// apps/tutor/src/components/dashboard/ActionRequired.tsx
// Only renders when there's something to do. Priority order per spec:
// 1) security verification, 2) required profile info, 3) required
// verification documents, 4) rejected documents, 5) recommended
// improvements, 6) optional enhancements.

import Link from "next/link";
import { useTutorT } from "@gloows/tutor-i18n";
import type { TutorProfile, TutorProfileCompletionResult } from "@gloows/shared-logic";
import { Card } from "@/components/ui";

// QA fix — `href` was always a page link, but "Verify Now" for the phone
// item had nowhere real to link to (it's a same-page modal, not a
// route), so it pointed at "/dashboard" and did nothing when clicked.
// An item now carries EITHER a `href` (navigate) OR an `action` (call a
// handler) — never both.
type ActionItem =
  | { key: string; titleKey: string; descKey: string; ctaKey: string; href: string; action?: undefined; priority: number }
  | { key: string; titleKey: string; descKey: string; ctaKey: string; href?: undefined; action: () => void; priority: number };

type Props = {
  tutorProfile: TutorProfile;
  completion: TutorProfileCompletionResult;
  onVerifyPhone: () => void;
};

export default function ActionRequired({ tutorProfile, completion, onVerifyPhone }: Props) {
  const { t } = useTutorT();
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
    <div className="mb-4">
      <p className="text-lg font-black text-slate-100 mb-3">{t("dashActionRequiredTitle")}</p>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <Card key={item.key}>
            <div className="flex items-start gap-2.5">
              <span className="text-warning text-base leading-none mt-0.5">⚠</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-100">{t(item.titleKey)}</p>
                <p className="text-xs text-slate-500 mt-0.5">{t(item.descKey)}</p>
                {item.href ? (
                  <Link href={item.href} className="mt-2 inline-block text-xs font-bold text-brand-400 hover:text-brand-300">
                    {t(item.ctaKey)}
                  </Link>
                ) : (
                  <button type="button" onClick={item.action} className="mt-2 text-xs font-bold text-brand-400 hover:text-brand-300">
                    {t(item.ctaKey)}
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

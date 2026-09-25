"use client";
// apps/tutor/src/components/dashboard/ProfileChecklist.tsx
// "Your Profile Checklist" — clickable rows, each navigating to the
// screen that completes it.

import Link from "next/link";
import type { User } from "firebase/auth";
import { useTutorT } from "@gloows/tutor-i18n";
import type { TutorProfile, TutorProfileCompletionResult } from "@gloows/shared-logic";
import { Card } from "@/components/ui";

type Row = { done: boolean; labelKey: string; href: string };

type Props = {
  user: User;
  tutorProfile: TutorProfile;
  completion: TutorProfileCompletionResult;
  payoutSetUp: boolean;
};

export default function ProfileChecklist({ user, tutorProfile, completion, payoutSetUp }: Props) {
  const { t } = useTutorT();
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
    <Card className="mb-4">
      <p className="text-sm font-black text-slate-100 mb-3">{t("dashChecklistTitle")}</p>
      <div className="flex flex-col">
        {rows.map((row) => (
          <Link
            key={row.labelKey} href={row.href}
            className="flex items-center gap-2.5 py-2 border-b border-slate-800 last:border-b-0 hover:opacity-80 transition-opacity"
          >
            <span className={`w-4 text-center font-black text-sm ${row.done ? "text-success" : "text-slate-600"}`}>
              {row.done ? "✓" : "○"}
            </span>
            <span className={`text-[13px] flex-1 ${row.done ? "text-slate-300" : "text-slate-500"}`}>{t(row.labelKey)}</span>
            <span className="text-slate-600 text-xs">›</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

"use client";
// apps/tutor/src/app/(app)/dashboard/page.tsx
// Tutor Profile Completion & Verification Dashboard — see
// C:\Users\User\.claude\plans\typed-pondering-wave.md for the full design
// (kept for reference; not part of the repo). Replaces the previous
// 90-line placeholder (greeting + old-system verification banner + two
// stat cards) with the full experience: completion hero, status card,
// verification centre, timeline, action-required, checklist, strength,
// public-profile readiness, quick actions — the old stat cards stay,
// moved below the new sections.
//
// profileStatus/onboardingVerificationStatus come from
// submitTutorOnboarding/reviewTutorOnboarding (functions/src/
// tutorAccounts.ts) and are already live via useTutorProfile's
// onSnapshot — no separate listener needed here (the old dashboard's own
// onSnapshot on tutorVerifications/{uid} tracked a DIFFERENT, older
// status system this dashboard doesn't use; removed, not ported).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  useTutorClasses, useTutorProfile, useTutorStudents, useTutorPayoutDetails,
  calculateTutorProfileCompletion,
} from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import { Card, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";
import { resolveDashboardStatus } from "@/lib/dashboardStatus";
import CompletionHero from "@/components/dashboard/CompletionHero";
import StatusCard from "@/components/dashboard/StatusCard";
import VerificationCentre from "@/components/dashboard/VerificationCentre";
import VerificationTimeline from "@/components/dashboard/VerificationTimeline";
import ActionRequired from "@/components/dashboard/ActionRequired";
import ProfileChecklist from "@/components/dashboard/ProfileChecklist";
import ProfileStrength from "@/components/dashboard/ProfileStrength";
import PublicProfileReadiness from "@/components/dashboard/PublicProfileReadiness";
import QuickActions from "@/components/dashboard/QuickActions";
import PhoneVerifyModal from "@/components/dashboard/PhoneVerifyModal";

function isToday(ts: unknown): boolean {
  const d = (ts as { toDate?: () => Date } | undefined)?.toDate?.();
  if (!d) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function DashboardPage() {
  const { t } = useTutorT();
  const { user, tutorProfile, profileLoading } = useTutorProfile();
  const { students } = useTutorStudents(user?.uid);
  const { classes } = useTutorClasses(user?.uid);
  const { details: payoutDetails } = useTutorPayoutDetails(user?.uid);
  const todaysClasses = classes.filter((c) => c.status !== "Cancelled" && isToday(c.startTime));
  // Owned at the page level (not inside VerificationCentre) so
  // ActionRequired's "Verify Now" item can open the same modal — see
  // VerificationCentre.tsx's header for the QA fix this replaced.
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  async function handlePhoneVerified() {
    setShowPhoneModal(false);
    if (!user) return;
    await setDoc(doc(db, "tutors", user.uid), { phoneVerified: true, updatedAt: new Date() }, { merge: true });
  }

  const completion = tutorProfile ? calculateTutorProfileCompletion(tutorProfile) : null;

  // Keep profileCompletionPercentage/profileStrength on the document in
  // sync with what's actually displayed — cheap, client-computed fields
  // (see firestore.rules' tutors/{uid} allowlist), skipped when already
  // up to date so this doesn't fire a write loop on every snapshot.
  const lastSavedPercent = useRef<number | null>(null);
  useEffect(() => {
    if (!user || !completion) return;
    if (lastSavedPercent.current === completion.completionPercentage) return;
    if (tutorProfile?.profileCompletionPercentage === completion.completionPercentage) {
      lastSavedPercent.current = completion.completionPercentage;
      return;
    }
    lastSavedPercent.current = completion.completionPercentage;
    setDoc(doc(db, "tutors", user.uid), {
      profileCompletionPercentage: completion.completionPercentage,
      profileStrength: completion.profileStrength,
      updatedAt: new Date(),
    }, { merge: true }).catch(() => { /* best-effort, next snapshot will retry */ });
  }, [user, completion, tutorProfile?.profileCompletionPercentage]);

  if (profileLoading || !user || !tutorProfile || !completion) return <LoadingState />;

  const status = resolveDashboardStatus(tutorProfile.profileStatus);
  const ctaHref = status === "draft" ? "/onboarding" : status === "verified" ? "/dashboard" : status === "rejected" ? "/documents" : "/documents";
  const payoutSetUp = !!(payoutDetails?.accountHolderName);

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <div className="p-6 max-w-lg mx-auto">
        <CompletionHero
          name={tutorProfile.name ?? ""}
          status={status}
          completion={completion}
          payoutSetUp={payoutSetUp}
          ctaHref={ctaHref}
        />

        <StatusCard status={status} rejectionReason={tutorProfile.rejectionReason} />

        <ActionRequired tutorProfile={tutorProfile} completion={completion} onVerifyPhone={() => setShowPhoneModal(true)} />

        <VerificationCentre user={user} tutorProfile={tutorProfile} onVerifyPhone={() => setShowPhoneModal(true)} />

        <VerificationTimeline status={status} onboardingCompleted={tutorProfile.onboardingCompleted} />

        <ProfileChecklist user={user} tutorProfile={tutorProfile} completion={completion} payoutSetUp={payoutSetUp} />

        <ProfileStrength strength={completion.profileStrength} />

        <PublicProfileReadiness user={user} tutorProfile={tutorProfile} completion={completion} />

        <QuickActions status={status} />

        {/* Existing stats — kept below the new sections. */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Link href="/students">
            <Card className="hover:border-brand-500 transition-colors">
              <p className="text-xs font-semibold text-slate-500 mb-1">{t("activeStudentsLabel")}</p>
              <p className="text-2xl font-black text-slate-100">{students.length}</p>
            </Card>
          </Link>
          <Link href="/classes">
            <Card className="hover:border-brand-500 transition-colors">
              <p className="text-xs font-semibold text-slate-500 mb-1">{t("todaysClassesLabel")}</p>
              <p className="text-2xl font-black text-slate-100">{todaysClasses.length}</p>
            </Card>
          </Link>
        </div>
      </div>
      <BottomNav />
      {showPhoneModal && (
        <PhoneVerifyModal
          phoneNumber={tutorProfile.phoneNumber ?? ""}
          onVerified={handlePhoneVerified}
          onClose={() => setShowPhoneModal(false)}
        />
      )}
    </div>
  );
}

"use client";
// apps/tutor/src/app/(app)/dashboard/page.tsx
// Spec section 12's stats: Active Students (Phase 1b) and now Today's
// Classes (Phase 1d) are live. Pending Fees / Monthly Earnings / Average
// Rating still depend on collections that don't exist yet — deliberately
// still just the greeting + verification banner + these two stats until
// those land in a later phase.

import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTutorClasses, useTutorProfile, useTutorStudents } from "@gloows/shared-logic";
import type { TutorVerificationStatus } from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import { Button, Card, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

function isToday(ts: unknown): boolean {
  const d = (ts as { toDate?: () => Date } | undefined)?.toDate?.();
  if (!d) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

const BANNER: Record<TutorVerificationStatus, { key: string; tone: string } | null> = {
  Draft:          { key: "verificationDraftBanner",    tone: "text-slate-400" },
  Submitted:      { key: "verificationPendingBanner",  tone: "text-warning" },
  "Under Review": { key: "verificationPendingBanner",  tone: "text-warning" },
  Verified:       { key: "verificationVerifiedBanner", tone: "text-success" },
  Rejected:       { key: "verificationRejectedBanner", tone: "text-danger" },
  Suspended:      null,
};

export default function DashboardPage() {
  const { t } = useTutorT();
  const { user, tutorProfile, profileLoading } = useTutorProfile();
  const { students } = useTutorStudents(user?.uid);
  const { classes } = useTutorClasses(user?.uid);
  const [status, setStatus] = useState<TutorVerificationStatus>("Draft");
  const todaysClasses = classes.filter((c) => c.status !== "Cancelled" && isToday(c.startTime));

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "tutorVerifications", user.uid), (snap) => {
      setStatus(snap.exists() ? (snap.data().status ?? "Draft") : "Draft");
    });
  }, [user]);

  if (profileLoading) return <LoadingState />;

  const banner = BANNER[status];

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <div className="p-6 max-w-lg mx-auto">
        <h1 className="text-2xl font-black text-slate-100 mb-6">
          {t("goodMorning", { name: tutorProfile?.name ?? "" })}
        </h1>

        {banner && (
          <Card className="mb-4">
            <p className={`text-sm font-semibold ${banner.tone}`}>{t(banner.key)}</p>
            {(status === "Draft" || status === "Rejected") && (
              <Link href="/verification" className="inline-block mt-3">
                <Button variant="secondary">{t("completeVerification")}</Button>
              </Link>
            )}
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
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
    </div>
  );
}

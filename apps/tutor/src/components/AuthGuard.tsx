"use client";
// apps/tutor/src/components/AuthGuard.tsx
// Mirrors apps/web/src/components/layout/AuthGuard.tsx's pattern exactly
// (single source of truth from context, no separate auth listener here —
// same flash-redirect bug it fixed there would otherwise recur here) but
// reads useTutorProfile() instead of useStudentProfile().

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTutorProfile } from "@gloows/shared-logic";
import { LoadingState } from "./ui";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, authLoading, tutorProfile, profileLoading } = useTutorProfile();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
      return;
    }
    // SECURITY FIX (launch audit, tutor self-verification hole) — this
    // guard used to check sign-in only, so any authenticated account —
    // including a student's — could open every screen in the tutor app.
    // tutorProfile comes from TutorProfileContext's own tutors/{uid}
    // listener; once profileLoading settles, null means no tutor doc
    // exists for this account, i.e. they never went through
    // registerTutorAccount. Same "resolve role by doc existence"
    // convention functions/src/tutorMessaging.ts already uses server-side,
    // applied here client-side since custom claims can lag a token
    // refresh and shouldn't be what a route guard blocks on.
    if (!authLoading && user && !profileLoading && !tutorProfile) {
      router.replace("/login");
    }
  }, [authLoading, user, profileLoading, tutorProfile, router]);

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-bg">
        <div className="text-4xl font-black tracking-tight">
          <span className="text-brand-300">Gloows </span>
          <span className="text-slate-100">Tutor</span>
        </div>
        <LoadingState />
      </div>
    );
  }

  if (!user || !tutorProfile) return null;

  return <>{children}</>;
}

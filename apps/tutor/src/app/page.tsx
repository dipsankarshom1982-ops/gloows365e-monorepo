"use client";
// apps/tutor/src/app/page.tsx — root route, routes by auth state once
// resolved. Mirrors apps/web's login page's routeAfterAuthCore role: a
// thin dispatcher, not a screen of its own.
//
// Onboarding-incomplete tutors go to /onboarding instead of /dashboard —
// see app/onboarding/page.tsx's header for the full flow. This is the
// second (app-entry-level) resume point; /onboarding itself also
// resumes to the right step once loaded, this just makes sure a
// returning tutor lands there at all rather than on a dashboard built
// for a profile that doesn't exist yet.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTutorProfile } from "@gloows/shared-logic";
import { LoadingState } from "@/components/ui";

export default function RootPage() {
  const { user, authLoading, tutorProfile, profileLoading } = useTutorProfile();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || (user && profileLoading)) return;
    if (!user) { router.replace("/welcome"); return; }
    router.replace(tutorProfile?.onboardingCompleted ? "/dashboard" : "/onboarding");
  }, [authLoading, user, profileLoading, tutorProfile, router]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-bg">
      <LoadingState />
    </div>
  );
}

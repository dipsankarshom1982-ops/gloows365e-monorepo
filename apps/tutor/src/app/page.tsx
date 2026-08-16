"use client";
// apps/tutor/src/app/page.tsx — root route, routes by auth state once
// resolved. Mirrors apps/web's login page's routeAfterAuthCore role: a
// thin dispatcher, not a screen of its own.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTutorProfile } from "@gloows/shared-logic";
import { LoadingState } from "@/components/ui";

export default function RootPage() {
  const { user, authLoading } = useTutorProfile();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    router.replace(user ? "/dashboard" : "/welcome");
  }, [authLoading, user, router]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-bg">
      <LoadingState />
    </div>
  );
}

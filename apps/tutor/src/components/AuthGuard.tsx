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
  const { user, authLoading } = useTutorProfile();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  if (authLoading) {
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

  if (!user) return null;

  return <>{children}</>;
}

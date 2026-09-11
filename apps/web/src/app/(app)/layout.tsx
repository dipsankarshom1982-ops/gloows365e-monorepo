"use client";

// PATH: apps/web/src/app/(app)/layout.tsx
// Authenticated shell — wraps all student pages.
// Structure mirrors mobile (drawer)/(tabs) layout:
//   AuthGuard → Header (hamburger) → Drawer → Page content → BottomNav

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStudentProfile } from "@gloows/shared-logic";
import AuthGuard  from "@/components/layout/AuthGuard";
import AppHeader  from "@/components/layout/AppHeader";
import BottomNav  from "@/components/layout/BottomNav";
import Drawer     from "@/components/layout/Drawer";
import InstantHelpBar from "@/components/InstantHelpBar";

// Same detection used by app/page.tsx's boot-time routing — duplicated
// (not shared) to match that file's own convention. This is a defensive
// guard, not the primary routing mechanism: page.tsx already sends
// restart-education users straight to /restart-education/home and never
// into this (app) route group in the first place. This exists so that if
// a restart-education profile resolves while this layout is somehow
// already mounted (stale nav state, a bookmarked/typed URL, browser
// back/forward restoring a cached page, etc.), they still can't end up
// looking at the main student app — they get bounced back out immediately.
const RESTART_TYPES = ["restartEducation", "restart_education", "restart"];
const RESTART_INDICATOR_FIELDS = ["lastClassPassed", "educationGapReason", "currentOccupation"];

function RestartEducationGuard() {
  const router = useRouter();
  const { studentProfile } = useStudentProfile();

  useEffect(() => {
    if (!studentProfile) return;
    const profile = studentProfile as Record<string, any>;
    const isRestartUser =
      (profile.profileType && RESTART_TYPES.includes(profile.profileType)) ||
      RESTART_INDICATOR_FIELDS.some((f) => f in profile);
    if (isRestartUser) {
      router.replace("/restart-education/home");
    }
  }, [studentProfile, router]);

  return null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <AuthGuard>
      <RestartEducationGuard />
      <div id="__app">
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <AppHeader onMenuOpen={() => setDrawerOpen(true)} />
        <main className="page-scroll">{children}</main>
        <BottomNav />
      </div>
      {/* ShikshaHub Phase 4 — global, not per-page: see
         InstantHelpBar.tsx's header comment. */}
      <InstantHelpBar />
    </AuthGuard>
  );
}
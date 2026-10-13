"use client";

// PATH: apps/web/src/app/(app)/layout.tsx
// Authenticated shell — wraps all student pages.
// Structure mirrors mobile (drawer)/(tabs) layout:
//   AuthGuard → OnboardingGuard → Header (hamburger) → Drawer → Page content → BottomNav
//
// OnboardingGuard moved to components/layout/OnboardingGuard.tsx (fix:
// protect reels with onboarding guard) — /reels deliberately lives outside
// this (app) route group (see reels/page.tsx's header comment) and needs
// the exact same guard, so it's now a shared component instead of being
// defined only here.

import { useState } from "react";
import AuthGuard  from "@/components/layout/AuthGuard";
import OnboardingGuard from "@/components/layout/OnboardingGuard";
import AppHeader  from "@/components/layout/AppHeader";
import BottomNav  from "@/components/layout/BottomNav";
import Drawer     from "@/components/layout/Drawer";
import InstantHelpBar from "@/components/InstantHelpBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <AuthGuard>
      <OnboardingGuard>
        <div id="__app">
          <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
          <AppHeader onMenuOpen={() => setDrawerOpen(true)} />
          <main className="page-scroll">{children}</main>
          <BottomNav onMenuOpen={() => setDrawerOpen(true)} />
        </div>
        {/* ShikshaHub Phase 4 — global, not per-page: see
           InstantHelpBar.tsx's header comment. */}
        <InstantHelpBar />
      </OnboardingGuard>
    </AuthGuard>
  );
}

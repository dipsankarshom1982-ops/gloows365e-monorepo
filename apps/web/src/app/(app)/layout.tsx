"use client";

// PATH: apps/web/src/app/(app)/layout.tsx
// Authenticated shell — wraps all student pages.
// Structure mirrors mobile (drawer)/(tabs) layout:
//   AuthGuard → OnboardingGuard → Header (hamburger) → Drawer → Page content → BottomNav

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { doc, getFirestore, onSnapshot } from "firebase/firestore";
import { resolveOnboardingRoute, useStudentProfile } from "@gloows/shared-logic";
import { ONBOARDING_PATHS } from "@/lib/onboardingPaths";
import AuthGuard  from "@/components/layout/AuthGuard";
import AppHeader  from "@/components/layout/AppHeader";
import BottomNav  from "@/components/layout/BottomNav";
import Drawer     from "@/components/layout/Drawer";
import InstantHelpBar from "@/components/InstantHelpBar";

// Same detection used by app/page.tsx's boot-time routing — duplicated
// (not shared) to match that file's own convention.
const RESTART_TYPES = ["restartEducation", "restart_education", "restart"];
const RESTART_INDICATOR_FIELDS = ["lastClassPassed", "educationGapReason", "currentOccupation"];

// Minimal branded loading state, reusing AuthGuard's own splash markup —
// shown while this guard hasn't yet determined where the user belongs, or
// while a redirect it just triggered is in flight. Never skipped in favor
// of guessing: see the two effects in OnboardingGuard below.
function GuardLoading() {
  return (
    <div style={{
      minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0f172a",
    }}>
      <div style={{
        width: 32, height: 32,
        border: "3px solid rgba(99,102,241,0.3)",
        borderTop: "3px solid #6366F1",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// FIX (legacy-safe onboarding routing audit) — this used to be
// RestartEducationGuard, a side-effect-only component that checked
// `studentProfile` (students/{uid}) for restart-education indicators. But
// the restart-education flow (apps/web/src/app/restart-education/onboarding/
// page.tsx) writes those indicators to users/{uid}, never to students/{uid}
// — a genuine restart-education account typically has no students/{uid}
// doc at all. That made the old check a no-op for its actual purpose: it
// returned early on `!studentProfile` before ever reaching the restart
// check. This guard now reads users/{uid} directly (live, uid-keyed so a
// stale read for a previous user can never gate the current one) and,
// only once restart status is confirmed NOT required, hands off to the
// existing resolveOnboardingRoute()/students/{uid} predicate for normal
// student onboarding. Restart always takes precedence, exactly as before;
// only the data source was wrong.
//
// This also closes the deep-link gap the audit found: previously an
// authenticated but incomplete student (or a restart-education student)
// could open /reels, /discover, /wallet, etc. directly — this file's old
// guards only checked "signed in at all", never onboarding completeness.
function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, studentProfile, profileLoading } = useStudentProfile();
  const uid = user?.uid ?? null;

  const [restartState, setRestartState] = useState<{
    uid: string; checked: boolean; isRestart: boolean; onboardingComplete: boolean;
  } | null>(null);

  useEffect(() => {
    if (!uid) { setRestartState(null); return; }
    const db = getFirestore();
    const unsub = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const d = snap.exists() ? snap.data() : undefined;
        // A missing users/{uid} doc must never be read as "restart required".
        const isRestart = !!d && (
          (d.profileType && RESTART_TYPES.includes(d.profileType)) ||
          RESTART_INDICATOR_FIELDS.some((f) => f in d)
        );
        setRestartState({ uid, checked: true, isRestart, onboardingComplete: d?.onboardingComplete === true });
      },
      () => {
        // A read error is treated as "not restart" (not as "unknown" —
        // resolveOnboardingRoute below still runs and is itself safe for
        // every account state, including a missing students/{uid} doc).
        setRestartState({ uid, checked: true, isRestart: false, onboardingComplete: false });
      }
    );
    return () => unsub();
  }, [uid]);

  // Only trust restartState once it was written for the CURRENT uid — a
  // slow snapshot for a previous user (logout → login as someone else)
  // can never gate this user's routing.
  const restartReady   = !!uid && restartState?.uid === uid && restartState.checked;
  const isRestartUser  = restartReady && restartState!.isRestart;
  const onboardingRoute = !profileLoading ? resolveOnboardingRoute(studentProfile ?? undefined) : null;

  useEffect(() => {
    if (!uid || !restartReady) return; // wait for the restart check first

    if (isRestartUser) {
      const dest = restartState!.onboardingComplete ? "/restart-education/home" : "/restart-education/onboarding";
      if (pathname !== dest) router.replace(dest);
      return;
    }

    if (onboardingRoute === null) return; // student profile still loading
    if (onboardingRoute === "home") return; // allowed — protected app renders normally

    const dest = ONBOARDING_PATHS[onboardingRoute];
    if (pathname !== dest) router.replace(dest);
  }, [uid, restartReady, isRestartUser, restartState, onboardingRoute, pathname, router]);

  // Render gate — never show protected content while any of this is still
  // being resolved, or while a redirect triggered above hasn't landed yet.
  if (!uid) return null; // AuthGuard is already handling this
  if (!restartReady) return <GuardLoading />;
  if (isRestartUser) return <GuardLoading />;
  if (onboardingRoute === null || onboardingRoute !== "home") return <GuardLoading />;

  return <>{children}</>;
}

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

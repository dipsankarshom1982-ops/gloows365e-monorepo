"use client";

// PATH: apps/web/src/components/layout/OnboardingGuard.tsx
//
// Extracted from apps/web/src/app/(app)/layout.tsx (fix: harden onboarding
// route guards, d93bbc9) after runtime QA found /reels doesn't go through
// that layout at all — it deliberately lives outside the (app) route group
// for its full-bleed video UI (see reels/page.tsx's own header comment) and
// mounts its own AuthGuard directly, so (app)/layout.tsx's guards never ran
// for it. Rather than duplicate the restart-education/onboarding logic a
// second time inline in reels/page.tsx (which would create a second,
// independently-maintained copy of the same predicate), this is now the
// one shared definition both places use — no new onboarding state machine,
// no new field, just one guard usable wherever protected content needs it.
//
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
// student onboarding. Restart always takes precedence.

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { doc, getFirestore, onSnapshot } from "firebase/firestore";
import { resolveOnboardingRoute, useStudentProfile, type OnboardingStudentDoc, type StudentProfile } from "@gloows/shared-logic";
import { ONBOARDING_PATHS } from "@/lib/onboardingPaths";

// resolveOnboardingRoute() takes an OnboardingStudentDoc — an interface with
// only the 3 named fields it actually reads, all optional. StudentProfile
// (useStudentProfile()'s type) doesn't declare those 3 as named properties;
// it only has them via its own catch-all `[key: string]: any` index
// signature. Both types end up "weak" (every member optional) with no
// property names in common that TypeScript can see statically, which trips
// TS2559 ("has no properties in common") — a known TS limitation where an
// index signature doesn't satisfy the weak-type check, even though the
// values are structurally fine at runtime. Extracting exactly the fields
// resolveOnboardingRoute() cares about into a real, explicitly-typed object
// literal (rather than passing studentProfile through as-is, or reaching
// for `as any`) gives TypeScript actual named properties to match against.
function toOnboardingStudentDoc(profile: StudentProfile | null): OnboardingStudentDoc | undefined {
  if (!profile) return undefined;
  return {
    onboardingStep: profile.onboardingStep,
    parentPhoneVerified: profile.parentPhoneVerified,
    onboardingComplete: profile.onboardingComplete,
  };
}

const RESTART_TYPES = ["restartEducation", "restart_education", "restart"];
const RESTART_INDICATOR_FIELDS = ["lastClassPassed", "educationGapReason", "currentOccupation"];

// Minimal branded loading state, reusing AuthGuard's own splash markup —
// shown while this guard hasn't yet determined where the user belongs, or
// while a redirect it just triggered is in flight. Never skipped in favor
// of guessing: see the two effects below.
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

export default function OnboardingGuard({ children }: { children: React.ReactNode }) {
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
  const onboardingRoute = !profileLoading ? resolveOnboardingRoute(toOnboardingStudentDoc(studentProfile)) : null;

  useEffect(() => {
    if (!uid || !restartReady) return; // wait for the restart check first

    if (isRestartUser) {
      const dest = restartState!.onboardingComplete ? "/restart-education/home" : "/restart-education/onboarding";
      if (pathname !== dest) router.replace(dest);
      return;
    }

    if (onboardingRoute === null) return; // student profile still loading
    if (onboardingRoute === "home") return; // allowed — protected content renders normally

    const dest = ONBOARDING_PATHS[onboardingRoute];
    if (pathname !== dest) router.replace(dest);
  }, [uid, restartReady, isRestartUser, restartState, onboardingRoute, pathname, router]);

  // Render gate — never show protected content while any of this is still
  // being resolved, or while a redirect triggered above hasn't landed yet.
  if (!uid) return null; // the caller's own AuthGuard is already handling this
  if (!restartReady) return <GuardLoading />;
  if (isRestartUser) return <GuardLoading />;
  if (onboardingRoute === null || onboardingRoute !== "home") return <GuardLoading />;

  return <>{children}</>;
}

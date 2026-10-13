// PATH: apps/mobile/components/OnboardingGuard.tsx
//
// Mobile Route Coverage Audit (2026-09-29) found apps/mobile has no shared
// onboarding/restart guard at all — protection existed only in two places:
// app/index.tsx (a one-time boot redirect that never re-runs for in-app
// navigation) and app/(drawer)/_layout.tsx (a live guard, but scoped only
// to (drawer)/(tabs)/*). Every authenticated student-content route outside
// those two — root /reels, ai-guru/*, contest/*, seekho/*, shikshahub/*,
// vcoins/*, create-reel, mypost, daily-streak-quiz, battle screens,
// leaderboard/starboard/skillboard — had zero onboarding/restart
// protection, and root /reels specifically is reachable via a live,
// actively-used router.push("/reels") from SkillShortPreview/
// ShortLearnPreview, bypassing (drawer)'s guard entirely.
//
// This is the single shared guard those routes now use, mirroring
// apps/web/src/components/layout/OnboardingGuard.tsx's architecture
// (restart-education, read live from users/{uid}, always takes precedence;
// normal onboarding via resolveOnboardingRoute()/students/{uid} only once
// restart is ruled out) adapted for Expo Router. It additionally handles
// the unauthenticated case (Web has a separate AuthGuard; mobile has none),
// since this task's redirect rules require "unauthenticated → authentication
// flow" from every route this guard protects.
//
// (drawer)/_layout.tsx's own inline restart/onboarding check is
// deliberately left as-is, not migrated to this component — it already
// works and is independently verified; touching it was out of scope and
// unnecessary risk for this task.

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import {
  resolveOnboardingRoute,
  useStudentProfile,
  type OnboardingRoute,
  type OnboardingStudentDoc,
  type StudentProfile,
} from "@gloows/shared-logic";
import { db } from "@/lib/firebase";
import { useTheme } from "@/context/ThemeContext";
import { useNavigateWhenReady } from "@/hooks/useNavigateWhenReady";

// Both guards below wait for Firebase Auth to report (authLoading) before
// treating `user === null` as signed out, and route every redirect through
// useNavigateWhenReady: on a fresh MainActivity mount (deep link / relaunch)
// they used to call router.replace() before the root navigator existed —
// "Attempted to navigate before mounting the Root Layout component" — and
// could bounce a still-restoring signed-in student to /login.

// resolveOnboardingRoute() takes an OnboardingStudentDoc — an interface with
// only the 3 fields it reads, all named+optional. StudentProfile only has
// those 3 via its own catch-all `[key: string]: any` index signature, so
// TypeScript treats both as "weak" types with no named properties in
// common (TS2345/TS2559 — a known TS limitation; see
// apps/web/src/components/layout/OnboardingGuard.tsx's identical fix).
// Extracting exactly what resolveOnboardingRoute() reads into a real,
// explicitly-typed object literal avoids that — no `as any`.
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

// Mirrors (auth)/login.tsx and (drawer)/_layout.tsx's own duplicated copy —
// same per-platform/per-file convention already used for this mapping.
export function pathForOnboardingRoute(route: OnboardingRoute): string {
  switch (route) {
    case "parent-profile":       return "/(auth)/parent-profile";
    case "phone-verification":   return "/(auth)/phone-verification";
    case "parent-permissions":   return "/(auth)/parent-permissions";
    case "student-registration": return "/(auth)/register";
    case "home":                 return "/(drawer)/(tabs)/reels";
  }
}

function GuardLoading() {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

type RestartState = {
  uid: string; checked: boolean; isRestart: boolean; onboardingComplete: boolean;
};

// Shared by both guards below — live, uid-keyed read of users/{uid}, the
// restart-education source of truth (never students/{uid}). Factored out
// only to avoid duplicating the same onSnapshot logic twice in this file;
// not exported, not a second independent state machine.
function useRestartState(uid: string | null): RestartState | null {
  const [restartState, setRestartState] = useState<RestartState | null>(null);

  useEffect(() => {
    if (!uid) { setRestartState(null); return; }
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
        // A read error is treated as "not restart" (not "unknown") — the
        // normal onboarding check below is itself safe for every account
        // state, including a missing students/{uid} doc.
        setRestartState({ uid, checked: true, isRestart: false, onboardingComplete: false });
      }
    );
    return () => unsub();
  }, [uid]);

  return restartState;
}

export default function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const navigateWhenReady = useNavigateWhenReady();
  const { user, authLoading, studentProfile, profileLoading } = useStudentProfile();
  const uid = user?.uid ?? null;

  const restartState = useRestartState(uid);

  // Only trust restartState once it was written for the CURRENT uid — a
  // slow snapshot for a previous user (logout → login as someone else)
  // can never gate this user's routing.
  const restartReady   = !!uid && restartState?.uid === uid && restartState.checked;
  const isRestartUser  = restartReady && restartState!.isRestart;
  const onboardingRoute: OnboardingRoute | null =
    !profileLoading ? resolveOnboardingRoute(toOnboardingStudentDoc(studentProfile)) : null;

  useEffect(() => {
    if (authLoading) return; // session still restoring — not "signed out" yet
    if (!uid) {
      if (pathname === "/login") return;
      return navigateWhenReady(() => router.replace("/login" as any));
    }
    if (!restartReady) return; // wait for the restart check first

    if (isRestartUser) {
      const dest = restartState!.onboardingComplete ? "/restart-education/home" : "/restart-education/onboarding";
      if (pathname === dest) return;
      return navigateWhenReady(() => router.replace(dest as any));
    }

    if (onboardingRoute === null) return; // student profile still loading
    if (onboardingRoute === "home") return; // allowed — protected content renders normally

    const dest = pathForOnboardingRoute(onboardingRoute);
    if (pathname === dest) return;
    return navigateWhenReady(() => router.replace(dest as any));
  }, [authLoading, uid, restartReady, isRestartUser, restartState, onboardingRoute, pathname, router, navigateWhenReady]);

  // Render gate — never show protected content while any of this is still
  // being resolved, or while a redirect triggered above hasn't landed yet.
  if (authLoading || !uid) return <GuardLoading />;
  if (!restartReady) return <GuardLoading />;
  if (isRestartUser) return <GuardLoading />;
  if (onboardingRoute === null || onboardingRoute !== "home") return <GuardLoading />;

  return <>{children}</>;
}

// Guards restart-education/* specifically — the audit found this group had
// no verification that a visitor is actually a restart-education account,
// so a normal onboarding-incomplete user deep-linking here would see
// restart content instead of their real onboarding step. This is NOT the
// same check as the default export above (which requires normal onboarding
// to be COMPLETE): here, being a genuine restart account is itself the
// "allowed" condition — resolveOnboardingRoute()/students/{uid} would
// wrongly send a genuine restart account (typically no students/{uid} doc
// at all) to "parent-profile", so it's only consulted as the fallback once
// restart is ruled out, exactly mirroring (drawer)/_layout.tsx's existing
// precedence (restart always wins) applied in reverse.
export function RestartEducationGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const navigateWhenReady = useNavigateWhenReady();
  const { user, authLoading, studentProfile, profileLoading } = useStudentProfile();
  const uid = user?.uid ?? null;

  const restartState = useRestartState(uid);
  const restartReady  = !!uid && restartState?.uid === uid && restartState.checked;
  const isRestartUser = restartReady && restartState!.isRestart;
  const onboardingRoute: OnboardingRoute | null =
    !profileLoading ? resolveOnboardingRoute(toOnboardingStudentDoc(studentProfile)) : null;

  useEffect(() => {
    if (authLoading) return; // session still restoring — not "signed out" yet
    if (!uid) {
      if (pathname === "/login") return;
      return navigateWhenReady(() => router.replace("/login" as any));
    }
    if (!restartReady) return; // don't guess — wait for the restart check

    if (isRestartUser) return; // genuinely restart — allowed, preserve internal nav

    // Not a restart account — send to the real destination instead of
    // letting them see restart-education content.
    if (onboardingRoute === null) return; // student profile still loading
    const dest = onboardingRoute === "home" ? "/(drawer)/(tabs)/reels" : pathForOnboardingRoute(onboardingRoute);
    if (pathname === dest) return;
    return navigateWhenReady(() => router.replace(dest as any));
  }, [authLoading, uid, restartReady, isRestartUser, onboardingRoute, pathname, router, navigateWhenReady]);

  if (authLoading || !uid) return <GuardLoading />;
  if (!restartReady) return <GuardLoading />;
  if (!isRestartUser) return <GuardLoading />; // being redirected out, or still resolving onboardingRoute

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});

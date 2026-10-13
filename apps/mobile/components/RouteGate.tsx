// PATH: apps/mobile/components/RouteGate.tsx
//
// Wraps each screen of a navigator through its `screenLayout` prop (see
// app/ai-guru/_layout.tsx and routeGateLayout() below). The screen itself
// is NOT mounted — so none of its effects, Firestore reads or API/AI calls
// run — until useRouteGate() reports "allowed"; a spinner shows while
// access is being resolved or a redirect is in flight. Mirror of
// apps/web/src/components/layout/RouteGate.tsx.
//
// Redirect when blocked follows the page-level gates' convention (back if
// possible, else AI Guru menu for a feature / Home for a module or entry
// point), and only from the focused screen: a stack can hold several gated
// screens at once, and each must not pop the stack on its own.
//
// Authentication: evaluateRouteGate() treats a signed-out visitor as
// "allowed" because web mounts a separate AuthGuard. Mobile has no such guard,
// so every gated screen here also requires a signed-in user: while Firebase
// Auth is restoring the session nothing is mounted, and a signed-out visitor
// (deep link, stale tab after logout) is sent to /login. Redirects wait for
// the root navigator (useNavigateWhenReady) — calling router.* before it is
// mounted threw "Attempted to navigate before mounting the Root Layout".

import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useStudentProfile, type AiGuruScreenSpec, type RouteGateSpec } from "@gloows/shared-logic";
import { useRouteGate } from "@/hooks/useRouteGate";
import { useNavigateWhenReady } from "@/hooks/useNavigateWhenReady";
import { authGate } from "@/lib/navGuard";
import { useTheme } from "@/context/ThemeContext";

export default function RouteGate({ spec, aiGuruScreen, children }: {
  spec: RouteGateSpec;
  aiGuruScreen?: AiGuruScreenSpec;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const isFocused = useIsFocused();
  const pathname = usePathname();
  const { user, authLoading } = useStudentProfile();
  const auth = authGate(authLoading, !!user);
  const { state, blockedBy } = useRouteGate(spec, aiGuruScreen);
  const navigateWhenReady = useNavigateWhenReady();

  useEffect(() => {
    if (auth !== "signed-out" || !isFocused || pathname === "/login") return;
    return navigateWhenReady(() => router.replace("/login"));
  }, [auth, isFocused, pathname, navigateWhenReady]);

  useEffect(() => {
    if (auth !== "signed-in" || state !== "blocked" || !isFocused) return;
    return navigateWhenReady(() => {
      if (router.canGoBack()) router.back();
      else router.replace(blockedBy === "feature" ? "/ai-guru" : "/(drawer)/(tabs)/home");
    });
  }, [auth, state, blockedBy, isFocused, navigateWhenReady]);

  if (auth !== "signed-in" || state !== "allowed") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }
  return <>{children}</>;
}

/** `screenLayout` for a navigator whose screens all share one gate. */
export function routeGateLayout(spec: RouteGateSpec) {
  return ({ children }: { children: React.ReactElement }) => <RouteGate spec={spec}>{children}</RouteGate>;
}

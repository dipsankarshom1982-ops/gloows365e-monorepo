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

import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import type { AiGuruScreenSpec, RouteGateSpec } from "@gloows/shared-logic";
import { useRouteGate } from "@/hooks/useRouteGate";
import { useTheme } from "@/context/ThemeContext";

export default function RouteGate({ spec, aiGuruScreen, children }: {
  spec: RouteGateSpec;
  aiGuruScreen?: AiGuruScreenSpec;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const isFocused = useIsFocused();
  const { state, blockedBy } = useRouteGate(spec, aiGuruScreen);

  useEffect(() => {
    if (state !== "blocked" || !isFocused) return;
    if (router.canGoBack()) router.back();
    else router.replace(blockedBy === "feature" ? "/ai-guru" : "/(drawer)/(tabs)/home");
  }, [state, blockedBy, isFocused]);

  if (state !== "allowed") {
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

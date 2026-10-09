// apps/mobile/hooks/useModuleGate.ts
//
// Centralized Learn/Challenge destination guard — Part 3/4 of the App
// Structure & Feature Control fix. learn.tsx/challenge.tsx already hide a
// disabled module's card from the list; this is the other half — called
// again at the destination screen itself, so a bookmark, push-notification
// deep link, or browser/nav history entry can't reach a module Admin has
// turned off. Testers bypass via the same centralized useFeatureFlags()
// isTester the rest of the app already uses — no new tester mechanism.
//
// One hook call per screen (`const allowed = useModuleGate(...)`) is the
// unavoidable minimum in a file-based-routing app with no per-route
// middleware; the actual allow/deny logic itself lives once in
// @gloows/shared-logic's isModuleRouteAllowed, not copied per screen.

import { useEffect } from "react";
import { router } from "expo-router";
import { useFeatureFlags, isModuleRouteAllowed } from "@gloows/shared-logic";
import { useAppConfig } from "@/context/AppConfigContext";
import { useNavigateWhenReady } from "@/hooks/useNavigateWhenReady";

interface ModuleGateOptions {
  /** Set when a Home preview card (featureFlags/homeSection) also links to
   *  this same destination — e.g. "aiguru", "vidya_star", "seekho_preview",
   *  "knowledge_hub", "skillbattle". Disabling the Learn/Challenge module
   *  card must not block access via a still-enabled Home entry point. */
  homeSectionKey?: string;
  /** Same idea for a Drawer item (featureFlags/drawerItems) that also
   *  links here — currently only "wallet" (Wallet drawer item + Challenge's
   *  "leaderboard" module card both open /vcoins/wallet). */
  drawerItemKey?: string;
}

export function useModuleGate(moduleKey: string, options?: ModuleGateOptions): boolean {
  const { modules } = useAppConfig();
  const { isTester, roleResolved, homeSection, drawerItem } = useFeatureFlags();

  const extraAllowed =
    (!!options?.homeSectionKey && homeSection(options.homeSectionKey)) ||
    (!!options?.drawerItemKey && drawerItem(options.drawerItemKey));

  // Hold off deciding until we know whether this user is a tester — otherwise
  // a tester on a cold start is redirected before their role arrives.
  const allowed = !roleResolved || isModuleRouteAllowed({ isTester, modules, moduleKey, extraAllowed });
  const navigateWhenReady = useNavigateWhenReady();

  useEffect(() => {
    if (allowed) return;
    return navigateWhenReady(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/(drawer)/(tabs)/home");
    });
  }, [allowed, navigateWhenReady]);

  return allowed;
}

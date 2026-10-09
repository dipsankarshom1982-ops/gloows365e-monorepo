// apps/mobile/hooks/useAiGuruFeatureGate.ts
//
// Centralized AI Guru destination guard — same reasoning as
// useModuleGate.ts, scoped to featureFlags/aiGuru. ai-guru/index.tsx
// already filters its menu cards by useFeatureFlags().aiGuru(key); this is
// the check repeated at each individual AI Guru screen so a disabled
// feature isn't still reachable by direct URL/deep link/back-stack entry.
//
// featureKeys accepts more than one key because several screens are
// shared by more than one menu card (see ai-guru/index.tsx's
// MENU_CARD_DEFS) — e.g. ask-guru/my-lessons.tsx serves my_lessons,
// revision_reels AND practice_tests; ai-guru/player.tsx is reached from
// the generate, dashboard and my_lessons flows. Allowed if ANY of the
// screen's owning feature keys is enabled.

import { useEffect } from "react";
import { router } from "expo-router";
import { useFeatureFlags, isAiGuruRouteAllowed } from "@gloows/shared-logic";
import { useNavigateWhenReady } from "@/hooks/useNavigateWhenReady";

export interface AiGuruGateOptions {
  /** A featureFlags/homeSection key that is another entry point to this same
   *  route (e.g. "discover_preview" for /discover) — allowed while it is ON. */
  homeSectionKey?: string;
  /** Read the raw admin flags instead of the class-adjusted accessors. For
   *  routes with their own class rule (/discover hides itself for Class 3–5
   *  via isFeatureHiddenForClass), so that rule stays the layout's job and
   *  isn't misread here as an Admin OFF. Testers bypass either way. */
  ignoreClassRules?: boolean;
  /** false = don't gate (always allowed, no redirect). Default true. */
  enabled?: boolean;
}

export function useAiGuruFeatureGate(featureKeys: string | string[], options?: AiGuruGateOptions): boolean {
  const { isTester, roleResolved, aiGuru, aiFlags, homeSection, homeFlags } = useFeatureFlags();
  const flag = options?.ignoreClassRules ? (k: string) => aiFlags[k] ?? true : aiGuru;
  const homeKey = options?.homeSectionKey;
  const extraAllowed = !!homeKey && (options?.ignoreClassRules ? (homeFlags[homeKey] ?? true) : homeSection(homeKey));
  // Hold off deciding until we know whether this user is a tester — otherwise
  // a tester on a cold start is redirected before their role arrives.
  const allowed =
    options?.enabled === false ||
    !roleResolved ||
    isAiGuruRouteAllowed({ isTester, aiGuru: flag, featureKeys, extraAllowed });

  const navigateWhenReady = useNavigateWhenReady();

  useEffect(() => {
    if (allowed) return;
    return navigateWhenReady(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/ai-guru");
    });
  }, [allowed, navigateWhenReady]);

  return allowed;
}

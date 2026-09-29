"use client";

// PATH: apps/web/src/hooks/useAiGuruFeatureGate.ts
// Web mirror of apps/mobile/hooks/useAiGuruFeatureGate.ts — same
// isAiGuruRouteAllowed decision from @gloows/shared-logic. See the mobile
// file's header comment for the full rationale.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFeatureFlags, isAiGuruRouteAllowed } from "@gloows/shared-logic";

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
  const router = useRouter();
  const { isTester, roleResolved, aiGuru, aiFlags, homeSection, homeFlags } = useFeatureFlags();
  const flag = options?.ignoreClassRules ? (k: string) => aiFlags[k] ?? true : aiGuru;
  const homeKey = options?.homeSectionKey;
  const extraAllowed = !!homeKey && (options?.ignoreClassRules ? (homeFlags[homeKey] ?? true) : homeSection(homeKey));
  // Hold off deciding until we know whether this user is a tester — otherwise
  // a tester on a hard page load is redirected before their role arrives.
  const allowed =
    options?.enabled === false ||
    !roleResolved ||
    isAiGuruRouteAllowed({ isTester, aiGuru: flag, featureKeys, extraAllowed });

  useEffect(() => {
    if (!allowed) router.replace("/ai-guru");
  }, [allowed, router]);

  return allowed;
}

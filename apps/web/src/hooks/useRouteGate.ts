"use client";

// PATH: apps/web/src/hooks/useRouteGate.ts
// Web binding of @gloows/shared-logic's evaluateRouteGate() — feeds it the
// same FeatureFlagsContext / AppConfigContext state useModuleGate and
// useAiGuruFeatureGate read. Mirror: apps/mobile/hooks/useRouteGate.ts.
// Rendering/redirect lives in components/layout/RouteGate.tsx.

import {
  evaluateRouteGate, useFeatureFlags, useStudentProfile,
  type AiGuruScreenSpec, type RouteGateResult, type RouteGateSpec,
} from "@gloows/shared-logic";
import { useAppConfig } from "@/context/AppConfigContext";

export function useRouteGate(spec: RouteGateSpec, aiGuruScreen?: AiGuruScreenSpec): RouteGateResult {
  const { user } = useStudentProfile();
  const { modules, modulesResolved } = useAppConfig();
  const { isTester, roleResolved, flagsResolved, homeSection, aiGuru, drawerItem } = useFeatureFlags();

  return evaluateRouteGate(spec, {
    signedIn: !!user,
    roleResolved, isTester, flagsResolved, modulesResolved,
    modules, homeSection, aiGuru, drawerItem,
  }, aiGuruScreen);
}

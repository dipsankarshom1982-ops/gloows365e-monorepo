// PATH: apps/mobile/hooks/useRouteGate.ts
// Mobile binding of @gloows/shared-logic's evaluateRouteGate() — same
// FeatureFlagsContext / AppConfigContext state useModuleGate and
// useAiGuruFeatureGate read. Mirror: apps/web/src/hooks/useRouteGate.ts.
// Rendering/redirect lives in components/RouteGate.tsx.

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

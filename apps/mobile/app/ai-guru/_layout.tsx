// FIX (Mobile route coverage audit): ai-guru/* had no onboarding/restart
// protection — an authenticated but onboarding-incomplete or restart-
// education account could reach it directly. Wrapping the existing Stack
// in the shared guard protects every screen in this group at once.
//
// Access control: every screen also passes the AI Guru module gate
// (including vidyaguru, which has no feature flag of its own) and its own
// featureFlags/aiGuru key from AI_GURU_SCREENS, and is not mounted until
// that is decided — see components/RouteGate.tsx.
import { Stack } from "expo-router";
import { MODULE_GATES, getAiGuruScreenSpec } from "@gloows/shared-logic";
import OnboardingGuard from "@/components/OnboardingGuard";
import RouteGate from "@/components/RouteGate";

export default function AiGuruLayout() {
  return (
    <OnboardingGuard>
      <Stack
        screenOptions={{ headerShown: false }}
        screenLayout={({ children, route }) => (
          <RouteGate spec={MODULE_GATES.aiGuru} aiGuruScreen={getAiGuruScreenSpec(route.name)}>
            {children}
          </RouteGate>
        )}
      />
    </OnboardingGuard>
  );
}

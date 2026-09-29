// PATH: apps/mobile/app/daily-streak-quiz/_layout.tsx
//
// FIX (Mobile route coverage audit): daily-streak-quiz had no _layout.tsx
// and no onboarding/restart protection. New layout, same convention as the
// other group layouts, wrapped in the shared guard.

import { Stack } from "expo-router";
import { MODULE_GATES } from "@gloows/shared-logic";
import { routeGateLayout } from "@/components/RouteGate";
import OnboardingGuard from "@/components/OnboardingGuard";

export default function DailyStreakQuizLayout() {
  return (
    <OnboardingGuard>
      <Stack screenOptions={{ headerShown: false }} screenLayout={routeGateLayout(MODULE_GATES.dsq)} />
    </OnboardingGuard>
  );
}

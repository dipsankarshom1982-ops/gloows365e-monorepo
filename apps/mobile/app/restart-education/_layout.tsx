// PATH: app/restart-education/_layout.tsx
//
// FIX (Mobile route coverage audit): this group previously had no check
// that a visitor was actually a restart-education account — an
// onboarding-incomplete normal-track user could deep-link straight to
// /restart-education/home and see restart content instead of their real
// onboarding step. RestartEducationGuard (the restart-specific sibling of
// OnboardingGuard, both in components/OnboardingGuard.tsx) allows genuine
// restart accounts through unchanged and sends everyone else to their
// actual destination. Internal navigation between these screens is
// untouched — the guard only gates entry to the group as a whole.

import { Stack } from "expo-router";
import { RestartEducationGuard } from "@/components/OnboardingGuard";

export default function RestartEducationLayout() {
  return (
    <RestartEducationGuard>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="home" />
        <Stack.Screen name="ai-advisor" />
        <Stack.Screen name="pathways" />
        <Stack.Screen name="opportunities" />
        <Stack.Screen name="success-stories" />
        <Stack.Screen name="guidance" />
      </Stack>
    </RestartEducationGuard>
  );
}

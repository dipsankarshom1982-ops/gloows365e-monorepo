// FIX (Mobile route coverage audit): ai-guru/* had no onboarding/restart
// protection — an authenticated but onboarding-incomplete or restart-
// education account could reach it directly. Wrapping the existing Stack
// in the shared guard protects every screen in this group at once.
import { Stack } from "expo-router";
import OnboardingGuard from "@/components/OnboardingGuard";

export default function AiGuruLayout() {
  return (
    <OnboardingGuard>
      <Stack screenOptions={{ headerShown: false }} />
    </OnboardingGuard>
  );
}

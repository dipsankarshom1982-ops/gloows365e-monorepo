// FIX (Mobile route coverage audit): seekho/* had no onboarding/restart
// protection. Wrapping the existing Stack in the shared guard protects
// every screen in this group (including [subject]/[chapterId]/*) at once.
import { Stack } from "expo-router";
import OnboardingGuard from "@/components/OnboardingGuard";

export default function SeekhoLayout() {
  return (
    <OnboardingGuard>
      <Stack screenOptions={{ headerShown: false }} />
    </OnboardingGuard>
  );
}

// PATH: apps/mobile/app/vcoins/_layout.tsx
//
// FIX (Mobile route coverage audit): vcoins/* had no _layout.tsx and no
// onboarding/restart protection. New layout, same convention as the other
// group layouts, wrapped in the shared guard so wallet/claim-gift/
// transaction-detail are all protected at once.

import { Stack } from "expo-router";
import OnboardingGuard from "@/components/OnboardingGuard";

export default function VCoinsLayout() {
  return (
    <OnboardingGuard>
      <Stack screenOptions={{ headerShown: false }} />
    </OnboardingGuard>
  );
}

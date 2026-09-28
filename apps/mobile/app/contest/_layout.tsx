// PATH: apps/mobile/app/contest/_layout.tsx
//
// FIX (Mobile route coverage audit): contest/* had no _layout.tsx at all
// (each screen rendered directly under the root Stack) and no onboarding/
// restart protection. New layout, matching the header-hidden Stack
// convention every sibling group (ai-guru, seekho, shikshahub, glostore)
// already uses, wrapped in the shared guard so leaderboard/lesson/quiz/
// result/video are all protected at once.

import { Stack } from "expo-router";
import OnboardingGuard from "@/components/OnboardingGuard";

export default function ContestLayout() {
  return (
    <OnboardingGuard>
      <Stack screenOptions={{ headerShown: false }} />
    </OnboardingGuard>
  );
}

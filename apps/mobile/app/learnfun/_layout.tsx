// PATH: apps/mobile/app/learnfun/_layout.tsx
//
// FIX (Mobile route coverage audit — Phase 2): learnfun/* had no _layout.tsx
// and no onboarding/restart protection, despite being genuine protected
// student content (useLearnFun()/useVCoins(), students/{uid} XP/badges/
// missions, V-Coins reward Cloud Functions). Confirmed live bypass: pushed
// from (drawer)/(tabs)/learnFun.tsx, the protected LearnFun tab. New
// layout, same convention as contest/vcoins/daily-streak-quiz's own new
// layouts, wrapped in the shared guard so progress/rewards/streak/play/*
// are all protected at once — no changes to any LearnFun screen itself.

import { Stack } from "expo-router";
import OnboardingGuard from "@/components/OnboardingGuard";

export default function LearnFunLayout() {
  return (
    <OnboardingGuard>
      <Stack screenOptions={{ headerShown: false }} />
    </OnboardingGuard>
  );
}

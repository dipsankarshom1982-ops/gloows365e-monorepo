// PATH: apps/mobile/app/shikshahub/_layout.tsx
// Mirrors apps/mobile/app/glostore/_layout.tsx — plain Stack, header hidden
// since [uid].tsx draws its own back button.
//
// FIX (Mobile route coverage audit): shikshahub/* had no onboarding/restart
// protection. Wrapping the existing Stack in the shared guard protects
// [uid], bookings, credits, messages, and messages/thread at once.
import { Stack } from "expo-router";
import { MODULE_GATES } from "@gloows/shared-logic";
import { routeGateLayout } from "@/components/RouteGate";
import OnboardingGuard from "@/components/OnboardingGuard";

export default function ShikshaHubLayout() {
  return (
    <OnboardingGuard>
      <Stack screenOptions={{ headerShown: false }} screenLayout={routeGateLayout(MODULE_GATES.shikshahub)} />
    </OnboardingGuard>
  );
}

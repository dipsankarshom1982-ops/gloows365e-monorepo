"use client";
// PATH: apps/web/src/app/(app)/discover/subscription/page.tsx
// Discover Premium — reuses the same Firestore-driven plan/checkout UI as
// /ai-guru/subscription, scoped to module: "discover" (admin-managed plans).
// Mirrors the spirit of mobile app/discover/subscription.tsx, but standardized
// on the Firestore-driven pattern (see components/aiGuru/SubscriptionScreen)
// rather than the older hardcoded-PLANS version, since that's what the admin
// panel's SubscriptionPlans page actually manages for both modules.

import { SubscriptionScreen } from "@/components/aiGuru/SubscriptionScreen";

export default function DiscoverSubscriptionPage() {
  // FIX (launch audit, Task 3 — broken client-to-Cloud-Function connections):
  // createFn was "discoverCreateSubscription", a function that was never
  // written — every web Discover checkout attempt threw functions/not-found.
  // aiGuruCreateSubscription is module-agnostic (see aiGuruSubscription.ts's
  // resolvePlanPrice — it just resolves whatever planId it's given against
  // subscriptionPlans/{planId}, regardless of module), and is exactly what
  // apps/mobile/app/discover/subscription.tsx already calls correctly.
  return <SubscriptionScreen module="discover" title="Discover AI Premium" createFn="aiGuruCreateSubscription" />;
}

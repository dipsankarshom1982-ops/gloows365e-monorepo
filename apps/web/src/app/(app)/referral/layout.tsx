"use client";

// PATH: apps/web/src/app/(app)/referral/layout.tsx
// Access gate for every page under /referral — open while the Home referral card is ON (its only entry point).
// See components/layout/RouteGate.tsx.

import { ENTRY_POINT_GATES } from "@gloows/shared-logic";
import RouteGate from "@/components/layout/RouteGate";

export default function ReferralLayout({ children }: { children: React.ReactNode }) {
  return <RouteGate spec={ENTRY_POINT_GATES.referral}>{children}</RouteGate>;
}

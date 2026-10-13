"use client";

// PATH: apps/web/src/app/(app)/shikshahub/layout.tsx
// Access gate for every page under /shikshahub — the ShikshaHub module, including bookings, credits, messages and profile.
// See components/layout/RouteGate.tsx.

import { MODULE_GATES } from "@gloows/shared-logic";
import RouteGate from "@/components/layout/RouteGate";

export default function ShikshaHubLayout({ children }: { children: React.ReactNode }) {
  return <RouteGate spec={MODULE_GATES.shikshahub}>{children}</RouteGate>;
}

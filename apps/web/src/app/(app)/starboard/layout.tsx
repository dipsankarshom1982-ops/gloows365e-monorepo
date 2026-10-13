"use client";

// PATH: apps/web/src/app/(app)/starboard/layout.tsx
// Access gate for every page under /starboard — the Starboard module.
// See components/layout/RouteGate.tsx.

import { MODULE_GATES } from "@gloows/shared-logic";
import RouteGate from "@/components/layout/RouteGate";

export default function StarboardLayout({ children }: { children: React.ReactNode }) {
  return <RouteGate spec={MODULE_GATES.starboard}>{children}</RouteGate>;
}

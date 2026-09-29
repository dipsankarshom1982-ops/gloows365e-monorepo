"use client";

// PATH: apps/web/src/app/(app)/skillboost/layout.tsx
// Access gate for every page under /skillboost — the SkillBoost module.
// See components/layout/RouteGate.tsx.

import { MODULE_GATES } from "@gloows/shared-logic";
import RouteGate from "@/components/layout/RouteGate";

export default function SkillBoostLayout({ children }: { children: React.ReactNode }) {
  return <RouteGate spec={MODULE_GATES.skillboost}>{children}</RouteGate>;
}

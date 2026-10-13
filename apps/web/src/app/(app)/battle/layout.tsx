"use client";

// PATH: apps/web/src/app/(app)/battle/layout.tsx
// Access gate for every page under /battle — the SkillBattle module.
// See components/layout/RouteGate.tsx.

import { MODULE_GATES } from "@gloows/shared-logic";
import RouteGate from "@/components/layout/RouteGate";

export default function BattleLayout({ children }: { children: React.ReactNode }) {
  return <RouteGate spec={MODULE_GATES.skillbattle}>{children}</RouteGate>;
}

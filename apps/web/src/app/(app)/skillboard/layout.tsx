"use client";

// PATH: apps/web/src/app/(app)/skillboard/layout.tsx
// Access gate for every page under /skillboard — the SkillBoard module.
// See components/layout/RouteGate.tsx.

import { MODULE_GATES } from "@gloows/shared-logic";
import RouteGate from "@/components/layout/RouteGate";

export default function SkillBoardLayout({ children }: { children: React.ReactNode }) {
  return <RouteGate spec={MODULE_GATES.skillboard}>{children}</RouteGate>;
}

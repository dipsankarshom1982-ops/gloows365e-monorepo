"use client";

// PATH: apps/web/src/app/(app)/daily-streak-quiz/layout.tsx
// Access gate for every page under /daily-streak-quiz — the Daily Streak Quiz module.
// See components/layout/RouteGate.tsx.

import { MODULE_GATES } from "@gloows/shared-logic";
import RouteGate from "@/components/layout/RouteGate";

export default function DailyStreakQuizLayout({ children }: { children: React.ReactNode }) {
  return <RouteGate spec={MODULE_GATES.dsq}>{children}</RouteGate>;
}

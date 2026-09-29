"use client";

// PATH: apps/web/src/app/contest/layout.tsx
// Access gate for every page under /contest — contests belong to the VidyaStar module (lesson, quiz, result, leaderboard).
// See components/layout/RouteGate.tsx.

import { MODULE_GATES } from "@gloows/shared-logic";
import RouteGate from "@/components/layout/RouteGate";

export default function ContestLayout({ children }: { children: React.ReactNode }) {
  return <RouteGate spec={MODULE_GATES.vidyastar}>{children}</RouteGate>;
}

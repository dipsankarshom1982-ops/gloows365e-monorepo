"use client";

// PATH: apps/web/src/app/(app)/vidyastar/layout.tsx
// Access gate for every page under /vidyastar — the VidyaStar module.
// See components/layout/RouteGate.tsx.

import { MODULE_GATES } from "@gloows/shared-logic";
import RouteGate from "@/components/layout/RouteGate";

export default function VidyaStarLayout({ children }: { children: React.ReactNode }) {
  return <RouteGate spec={MODULE_GATES.vidyastar}>{children}</RouteGate>;
}

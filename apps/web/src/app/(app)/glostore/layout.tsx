"use client";

// PATH: apps/web/src/app/(app)/glostore/layout.tsx
// Access gate for every page under /glostore — open while the GloStore drawer item or the Home GloStore preview is ON (includes /glostore/product).
// See components/layout/RouteGate.tsx.

import { ENTRY_POINT_GATES } from "@gloows/shared-logic";
import RouteGate from "@/components/layout/RouteGate";

export default function GloStoreLayout({ children }: { children: React.ReactNode }) {
  return <RouteGate spec={ENTRY_POINT_GATES.glostore}>{children}</RouteGate>;
}

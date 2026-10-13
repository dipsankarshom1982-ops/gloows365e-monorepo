"use client";

// PATH: apps/web/src/app/(app)/seekho/layout.tsx
// Access gate for every page under /seekho — the Seekho module, including /seekho/[subject] and /seekho/revision.
// See components/layout/RouteGate.tsx.

import { MODULE_GATES } from "@gloows/shared-logic";
import RouteGate from "@/components/layout/RouteGate";

export default function SeekhoLayout({ children }: { children: React.ReactNode }) {
  return <RouteGate spec={MODULE_GATES.seekho}>{children}</RouteGate>;
}

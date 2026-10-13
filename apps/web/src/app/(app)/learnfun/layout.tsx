"use client";

// PATH: apps/web/src/app/(app)/learnfun/layout.tsx
// Access gate for every page under /learnfun — the Learn Fun module.
// See components/layout/RouteGate.tsx.

import { MODULE_GATES } from "@gloows/shared-logic";
import RouteGate from "@/components/layout/RouteGate";

export default function LearnFunLayout({ children }: { children: React.ReactNode }) {
  return <RouteGate spec={MODULE_GATES.learnfun}>{children}</RouteGate>;
}

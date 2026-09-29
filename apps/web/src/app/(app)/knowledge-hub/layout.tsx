"use client";

// PATH: apps/web/src/app/(app)/knowledge-hub/layout.tsx
// Access gate for every page under /knowledge-hub — the Knowledge Hub module.
// See components/layout/RouteGate.tsx.

import { MODULE_GATES } from "@gloows/shared-logic";
import RouteGate from "@/components/layout/RouteGate";

export default function KnowledgeHubLayout({ children }: { children: React.ReactNode }) {
  return <RouteGate spec={MODULE_GATES.knowledgehub}>{children}</RouteGate>;
}

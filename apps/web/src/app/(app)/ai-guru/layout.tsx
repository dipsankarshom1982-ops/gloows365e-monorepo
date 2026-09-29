"use client";

// PATH: apps/web/src/app/(app)/ai-guru/layout.tsx
// Access gate for every page under /ai-guru: the AI Guru module gate for all
// of them (including /ai-guru/vidyaguru, which has no feature flag), plus
// each screen's own featureFlags/aiGuru key from AI_GURU_SCREENS — the same
// keys the pages' useAiGuruFeatureGate() calls use. See
// components/layout/RouteGate.tsx.

import { usePathname } from "next/navigation";
import { MODULE_GATES, getAiGuruScreenSpec } from "@gloows/shared-logic";
import RouteGate from "@/components/layout/RouteGate";

export default function AiGuruLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const screen = pathname.replace(/^\/ai-guru\/?/, "").split("/")[0];

  return (
    <RouteGate spec={MODULE_GATES.aiGuru} aiGuruScreen={getAiGuruScreenSpec(screen)}>
      {children}
    </RouteGate>
  );
}

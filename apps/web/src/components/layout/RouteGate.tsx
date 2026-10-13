"use client";

// PATH: apps/web/src/components/layout/RouteGate.tsx
//
// Mounted by a route segment's layout.tsx around its pages. The page is NOT
// rendered — so none of its effects, Firestore reads or API/AI calls run —
// until useRouteGate() reports "allowed". While access is still being
// resolved (role, featureFlags, appModules for this uid) or a redirect is
// in flight, a spinner is shown instead. Blocked → same targets the
// page-level gates already use: AI Guru feature → /ai-guru, module or
// entry point → /home.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AiGuruScreenSpec, RouteGateSpec } from "@gloows/shared-logic";
import { useRouteGate } from "@/hooks/useRouteGate";

export function GateLoading() {
  return (
    <div role="status" aria-label="Loading" style={{
      minHeight: "60dvh", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: 32, height: 32,
        border: "3px solid rgba(99,102,241,0.3)",
        borderTop: "3px solid #6366F1",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function RouteGate({ spec, aiGuruScreen, children }: {
  spec: RouteGateSpec;
  aiGuruScreen?: AiGuruScreenSpec;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { state, blockedBy } = useRouteGate(spec, aiGuruScreen);

  useEffect(() => {
    if (state === "blocked") router.replace(blockedBy === "feature" ? "/ai-guru" : "/home");
  }, [state, blockedBy, router]);

  if (state !== "allowed") return <GateLoading />;
  return <>{children}</>;
}

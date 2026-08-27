"use client";

// PATH: apps/web/src/components/UpdateToast.tsx
//
// FEATURE (tester builds — "get updates without manually clearing cache"):
// sw.js now posts a message to every open tab when a new CACHE_VERSION has
// activated. Without this listener that message went nowhere — testers
// would stay on a stale cached build with no signal that a fix landed.
//
// Shows a small dismissible banner: "New version available — tap to
// refresh." Tapping sends SKIP_WAITING to the new worker (in case it's
// still waiting) and reloads, which is enough here since `activate` has
// already run and claimed clients by the time this message arrives.

import { useEffect, useState } from "react";

export default function UpdateToast() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "SW_UPDATED") setUpdateReady(true);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  if (!updateReady) return null;

  const handleRefresh = () => {
    navigator.serviceWorker?.controller?.postMessage({ type: "SKIP_WAITING" });
    window.location.reload();
  };

  return (
    <div
      style={{
        position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        background: "#1e293b", border: "1px solid rgba(56,189,248,0.4)",
        borderRadius: 14, padding: "10px 14px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
      }}
    >
      <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>
        🔄 New version available
      </span>
      <button
        onClick={handleRefresh}
        style={{
          background: "#38bdf8", border: "none", borderRadius: 10,
          padding: "6px 14px", color: "#0f172a", fontSize: 12, fontWeight: 700,
          cursor: "pointer", flexShrink: 0,
        }}
      >
        Refresh
      </button>
    </div>
  );
}

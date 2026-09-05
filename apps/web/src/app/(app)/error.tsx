"use client";

// PATH: apps/web/src/app/(app)/error.tsx
//
// FIX (production crash, 2026-09-05): apps/web had zero error.tsx /
// global-error.tsx boundaries anywhere. That meant an uncaught render
// exception on ANY single page under (app) — e.g. the ai-guru/page.tsx
// TypeError fixed alongside this file — fell all the way to Next.js's
// built-in default error UI, which replaces the *entire* document with
// the generic "Application error: a client-side exception has occurred"
// message. This boundary catches those crashes at the (app) segment
// instead: the outer root layout (and, more importantly, whatever
// caused the crash) gets a scoped, branded recovery screen with a retry
// button, rather than a blank/broken app for every visitor.
//
// This does not fix the underlying bug in whichever page throws — it
// only stops a single broken page from taking down the whole app for
// every user while that bug is being fixed.

import { useEffect } from "react";

export default function AppSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Still surfaces in the browser console / any error-reporting
    // integration — we're only stopping it from white-screening the app,
    // not hiding that it happened.
    console.error("Caught by apps/web (app) error boundary:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        textAlign: "center",
        background: "#0f172a",
      }}
    >
      <div style={{ fontSize: 40 }}>⚠️</div>
      <div style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 800 }}>
        Something went wrong
      </div>
      <div style={{ color: "#94a3b8", fontSize: 14, maxWidth: 320, lineHeight: 1.5 }}>
        This screen hit an unexpected error. You can try again, or head back
        to the home screen.
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button
          onClick={() => reset()}
          style={{
            padding: "10px 20px",
            borderRadius: 12,
            border: "none",
            background: "#6366f1",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <a
          href="/home"
          style={{
            padding: "10px 20px",
            borderRadius: 12,
            border: "1px solid #334155",
            background: "transparent",
            color: "#cbd5e1",
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Go to Home
        </a>
      </div>
    </div>
  );
}

"use client";

// PATH: apps/web/src/app/global-error.tsx
//
// FIX (production crash, 2026-09-05): last-resort boundary for a crash in
// the root layout itself (Providers/StudentProfileProvider/ThemeProvider,
// etc.) — code that (app)/error.tsx can't catch because it sits *above*
// that boundary in the tree. Per Next.js's contract, this file must
// render its own <html>/<body> since it replaces the root layout when it
// triggers. Without this, a root-layout-level throw falls through to the
// same generic "Application error: a client-side exception has occurred"
// page with no way to recover short of a manual reload.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Caught by apps/web global-error boundary:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
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
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: -1 }}>
            <span style={{ color: "#A5B4FC" }}>Gl</span>
            <span style={{ color: "#F1F5F9" }}>oows</span>
            <span style={{ color: "#818CF8", fontSize: 36 }}>365</span>
            <span style={{ color: "#FBBF24", fontSize: 38 }}>E</span>
          </div>
          <div style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 800 }}>
            Something went wrong
          </div>
          <div style={{ color: "#94a3b8", fontSize: 14, maxWidth: 320, lineHeight: 1.5 }}>
            The app hit an unexpected error while loading. Please try again.
          </div>
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
              marginTop: 4,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

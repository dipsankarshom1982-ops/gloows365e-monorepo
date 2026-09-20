"use client";

// PATH: apps/web/src/app/(app)/discover/layout.tsx
// Discover is a college/career/scholarship advisor and isn't offered to
// Class 3–5 (the server also refuses them — see functions/src/discover.ts).
// The navigation and home entries are already hidden for them; this covers a
// direct link or bookmark, so they see a friendly message here instead of the
// Discover screens or a raw 403. Every other class gets the page unchanged.

import { useRouter } from "next/navigation";
import { isPrimaryClassLevel, useStudentProfile } from "@gloows/shared-logic";

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { studentProfile } = useStudentProfile();

  if (!isPrimaryClassLevel(studentProfile?.class)) return <>{children}</>;

  return (
    <div className="page-pad" style={{ display: "flex", justifyContent: "center", padding: "48px 16px" }}>
      <div
        role="status"
        style={{
          maxWidth: 420, width: "100%", textAlign: "center", padding: 28, borderRadius: 20,
          border: "1px solid var(--border)", background: "var(--bg-card)",
        }}
      >
        <div style={{ fontSize: 44 }} aria-hidden="true">🧭</div>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: "var(--text)", margin: "12px 0 8px" }}>
          Discover isn&apos;t available for your class yet
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)", margin: 0 }}>
          Discover is made for older students exploring colleges and careers.
          Try AI Guru, the Daily Quiz and more instead!
        </p>
        <button
          onClick={() => router.push("/home")}
          style={{
            marginTop: 20, border: "none", borderRadius: 14, padding: "12px 24px",
            background: "#4f46e5", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer",
          }}
        >
          Go to Home
        </button>
      </div>
    </div>
  );
}

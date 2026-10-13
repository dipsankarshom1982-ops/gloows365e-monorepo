"use client";

// PATH: apps/web/src/app/(app)/discover/layout.tsx
// Discover is a college/career/scholarship advisor and isn't offered to
// Class 3–5 (the server also refuses them — see functions/src/discover.ts).
// The navigation and home entries are already hidden for them; this covers a
// direct link or bookmark, so they see a friendly message here instead of the
// Discover screens or a raw 403. Every other class gets the page unchanged.

import { useRouter, usePathname } from "next/navigation";
import { isPrimaryClassLevel, useFeatureFlags, useStudentProfile } from "@gloows/shared-logic";
import { useAiGuruFeatureGate } from "@/hooks/useAiGuruFeatureGate";
import { GateLoading } from "@/components/layout/RouteGate";

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { studentProfile, profileLoading } = useStudentProfile();

  // Admin control (Phase 2B): Discover follows featureFlags/aiGuru.discover,
  // OR homeSection.discover_preview while that Home entry point is ON. Raw
  // flags + disabled for Class 3–5 so the class rule below is unchanged, and
  // disabled on /discover/subscription — whether the purchase page should
  // stay reachable when Discover is OFF is an open product decision, so it
  // keeps today's behavior. Hook-only (no early return): same pattern as the
  // Phase 1 gates, and it runs before the class check below.
  const allowed = useAiGuruFeatureGate("discover", {
    homeSectionKey: "discover_preview",
    ignoreClassRules: true,
    enabled: !profileLoading && !isPrimaryClassLevel(studentProfile?.class) && !/\/subscription\/?$/.test(pathname ?? ""),
  });

  // Don't mount a Discover page (its search/trending calls run on mount)
  // until the class and the admin flags are actually known — the hook
  // above reports "allowed" while they're still loading, and a Class 3–5
  // profile still loading would otherwise fall through to the pages below.
  const { isTester, roleResolved, flagsResolved } = useFeatureFlags();
  if (profileLoading || !roleResolved || (!isTester && !flagsResolved) || !allowed) return <GateLoading />;

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

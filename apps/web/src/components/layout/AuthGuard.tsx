"use client";

// PATH: apps/web/src/components/layout/AuthGuard.tsx
//
// FIX: No longer creates its own onAuthStateChanged listener.
// Instead reads {user, authLoading} from StudentProfileContext which already
// has a listener running at the top of the tree.
//
// Old behaviour: two independent Firebase Auth listeners (AuthGuard +
// StudentProfileContext) could race — AuthGuard might redirect to /login
// before StudentProfileContext resolved, causing a flash redirect on
// every page refresh for a logged-in user.
//
// New behaviour: single source of truth, no flash.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStudentProfile } from "@gloows/shared-logic";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, authLoading } = useStudentProfile();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  // Still loading auth state — show branded splash
  if (authLoading) {
    return (
      <div style={{
        minHeight: "100dvh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "#0f172a",
      }}>
        <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: -1 }}>
          <span style={{ color: "#A5B4FC" }}>Gl</span>
          <span style={{ color: "#F1F5F9" }}>oows</span>
          <span style={{ color: "#818CF8", fontSize: 36 }}>365</span>
          <span style={{ color: "#FBBF24", fontSize: 38 }}>E</span>
        </div>
        <div style={{ color: "#94a3b8", marginTop: 12, fontSize: 14 }}>
          Learn • Compete • Earn 🚀
        </div>
        <div style={{
          marginTop: 32, width: 32, height: 32,
          border: "3px solid rgba(99,102,241,0.3)",
          borderTop: "3px solid #6366F1",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Auth resolved but no user — router.replace is in flight, render nothing
  if (!user) return null;

  return <>{children}</>;
}

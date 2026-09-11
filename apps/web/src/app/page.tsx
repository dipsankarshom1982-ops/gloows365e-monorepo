"use client";

// PATH: apps/web/src/app/page.tsx
//
// Root entry point — mirrors mobile app/index.tsx routing logic exactly.
//
// Flow:
//   1. First ever visit (no "alreadyLaunched" in localStorage) → /welcome
//   2. Not signed in → /login   (AuthGuard handles this for app pages too,
//      but we also redirect here directly so there's no flash)
//   3. Signed in, users/{uid} exists, profileType = "restartEducation":
//        onboardingComplete true  → /restart-education/home
//        onboardingComplete false → /restart-education/onboarding
//   4. Signed in, students/{uid} exists:
//        onboardingComplete true  → /home
//        onboardingComplete false → /register
//   5. Signed in, neither doc found → /register
//
// This replaces the old "always go to /home" shortcut which broke
// first-launch UX and sent restart-education users to the wrong place.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const RESTART_TYPES = ["restartEducation", "restart_education", "restart"];
const RESTART_INDICATOR_FIELDS = ["lastClassPassed", "educationGapReason", "currentOccupation"];

export default function RootPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Step 1: first-ever launch check (mirrors AsyncStorage "alreadyLaunched")
    const launched = localStorage.getItem("alreadyLaunched");
    if (!launched) {
      localStorage.setItem("alreadyLaunched", "true");
      router.replace("/welcome");
      return;
    }

    // Step 2: watch auth state then route
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        const db = getFirestore();

        // --- Check users/{uid} first (newer path) ---
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          const d = userSnap.data();
          const profileType = d?.profileType as string | undefined;
          const onboarding  = d?.onboardingComplete as boolean | undefined;

          // Explicit restart profileType
          if (profileType && RESTART_TYPES.includes(profileType)) {
            router.replace(onboarding === true
              ? "/restart-education/home"
              : "/restart-education/onboarding"
            );
            return;
          }

          // Implicit restart user (profileType write failed but indicator fields exist)
          const hasRestartFields = RESTART_INDICATOR_FIELDS.some((f) => f in d);
          if (hasRestartFields) {
            router.replace(onboarding === true
              ? "/restart-education/home"
              : "/restart-education/onboarding"
            );
            return;
          }
        }

        // --- Fall back to students/{uid} (legacy / normal student path) ---
        const studentSnap = await getDoc(doc(db, "students", user.uid));
        if (studentSnap.exists()) {
          const onboarding = studentSnap.data()?.onboardingComplete ?? false;
          router.replace(onboarding ? "/home" : "/register");
          return;
        }

        // --- Nothing found → send to registration ---
        router.replace("/register");

      } catch (e) {
        console.warn("Root routing error:", e);
        router.replace("/login");
      }
    });

    return () => unsub();
  }, [router]);

  // Minimal branded splash while we resolve
  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
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

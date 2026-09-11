"use client";

// PATH: apps/web/src/app/(auth)/login/page.tsx
//
// Mirrors mobile app/(auth)/login.tsx exactly.
//
// KEY FIX vs old version:
//   OLD: only checked students/{uid} → broke every user whose profile lives
//        in users/{uid} (restart-education users, anyone post-migration).
//
//   NEW: mirrors mobile index.tsx routing chain:
//     1. Check users/{uid}
//        - profileType = restartEducation → /restart-education/onboarding or /restart-education/home
//        - has restart indicator fields → same
//        - otherwise fall through
//     2. Check students/{uid}
//        - onboardingComplete true  → /home
//        - onboardingComplete false → /register
//     3. Neither found → /register
//
//   Also fixed: saves lastEmail to localStorage after successful login
//   (old code read it but never wrote it back).
//
// VISUAL: matches the mobile login screen's redesign — ambient glow,
// icon-led inputs with focus states, gradient CTA. Logic is unchanged.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// Mirrors mobile index.tsx constants
const RESTART_TYPES = ["restartEducation", "restart_education", "restart"];
const RESTART_INDICATOR_FIELDS = ["lastClassPassed", "educationGapReason", "currentOccupation"];

// Simple, permissive format check — mirrors the mobile login's equivalent.
// Not a substitute for Firebase's own validation (auth/invalid-email still
// fires if this somehow lets something bad through); it just gives instant
// inline feedback instead of a round trip for the common "missing @" typo.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Small inline icons (no new deps — currentColor so they inherit focus states) ──
function MailIcon() {
  return (
    <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m3 6 9 6 9-6" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
    </svg>
  );
}
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.24 4.24" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61C4.3 8.2 2 12 2 12a13.16 13.16 0 0 0 4.18 4.86" />
    </svg>
  );
}
function KeyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="15" r="4" />
      <path d="m10.5 12.5 8-8" />
      <path d="m17 6 2 2" />
      <path d="m14 9 2 2" />
    </svg>
  );
}
function ArrowRightIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <line x1="12" y1="16" x2="12" y2="16" />
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [secure,   setSecure]   = useState(true);
  const [loading,  setLoading]  = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error,    setError]    = useState("");
  const [message,  setMessage]  = useState("");
  // Inline field-level validation — separate from the submit-time `error`
  // banner, so a bad email format is pointed at directly under the field it
  // belongs to instead of a generic alert (WCAG: errors tied to their field).
  const [emailError, setEmailError] = useState("");
  const busy = loading || googleLoading;

  // Restore last email (mirrors mobile AsyncStorage.getItem("lastEmail"))
  useEffect(() => {
    const saved = localStorage.getItem("lastEmail");
    if (saved) setEmail(saved);
  }, []);

  // ── Shared post-auth routing chain ──────────────────────────────────────
  // Used by both email/password login and Google sign-in so both flows land
  // the user in the same place. Mirrors mobile index.tsx routing exactly.
  //
  // ⚠️ Hardened against a hung getDoc() (observed after a full site-data
  // wipe — auth itself succeeds, but a routing read can silently never
  // resolve, leaving the user stuck on the login screen with no error).
  // routeAfterAuthCore does the real work; routeAfterAuth races it against
  // a timeout and always redirects somewhere rather than leaving the user
  // stranded, and logs anything unexpected instead of swallowing it.
  const routeAfterAuthCore = async (uid: string) => {
    // ── Step 1: Check users/{uid} (newer path, handles restart users) ─
    const userSnap = await getDoc(doc(db, "users", uid));
    if (userSnap.exists()) {
      const d           = userSnap.data();
      const profileType = d?.profileType as string | undefined;
      const onboarding  = d?.onboardingComplete as boolean | undefined;

      // Explicit restart education profileType
      if (profileType && RESTART_TYPES.includes(profileType)) {
        setMessage("Welcome back! Redirecting...");
        setTimeout(() => {
          router.replace(
            onboarding === true
              ? "/restart-education/home"
              : "/restart-education/onboarding"
          );
        }, 500);
        return;
      }

      // Implicit restart user (indicator fields present, profileType write may have failed)
      const hasRestartFields = RESTART_INDICATOR_FIELDS.some((f) => f in d);
      if (hasRestartFields) {
        setMessage("Welcome back! Redirecting...");
        setTimeout(() => {
          router.replace(
            onboarding === true
              ? "/restart-education/home"
              : "/restart-education/onboarding"
          );
        }, 500);
        return;
      }

      // users/ doc exists but it's a normal student (created by signup.tsx)
      // Fall through to check students/ for onboardingComplete status
    }

    // ── Step 2: Check students/{uid} (normal student / legacy path) ───
    const studentSnap = await getDoc(doc(db, "students", uid));
    if (studentSnap.exists()) {
      const onboarding = studentSnap.data()?.onboardingComplete ?? false;
      if (!onboarding) {
        setMessage("Redirecting to complete your profile...");
        setTimeout(() => router.replace("/register"), 500);
        return;
      }
      setMessage("Login successful!");
      setTimeout(() => router.replace("/home"), 500);
      return;
    }

    // ── Step 3: Neither doc found → register ─────────────────────────
    setMessage("Redirecting to complete your profile...");
    setTimeout(() => router.replace("/register"), 500);
  };

  const routeAfterAuth = async (uid: string) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.error(
        "[login] routeAfterAuth timed out after 8s — falling back to /home. " +
        "Auth itself succeeded; this means a Firestore read in the routing " +
        "chain never resolved. Check the network tab for a stuck request."
      );
      setMessage("Login successful! Redirecting...");
      router.replace("/home");
    }, 8000);

    try {
      await routeAfterAuthCore(uid);
    } catch (err) {
      console.error("[login] routeAfterAuth failed:", err);
      if (!settled) {
        settled = true;
        // Auth already succeeded at this point — don't strand the user on
        // the login screen over a routing-check failure. Send them
        // somewhere real and let AuthGuard/onboarding checks downstream
        // sort out where they actually belong.
        router.replace("/home");
      }
    } finally {
      settled = true;
      clearTimeout(timeout);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password.trim()) {
      setError("Please enter email and password");
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setMessage("");
      setEmailError("");

      const userCred = await signInWithEmailAndPassword(
        auth,
        trimmedEmail,
        password.trim()
      );

      // ── Save lastEmail (mirrors mobile — was missing before) ─────────
      localStorage.setItem("lastEmail", trimmedEmail);

      await routeAfterAuth(userCred.user.uid);

    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      switch (code) {
        case "auth/user-not-found":         setError("Account not found. Please sign up first."); break;
        case "auth/wrong-password":
        case "auth/invalid-credential":     setError("The email or password you entered is incorrect."); break;
        case "auth/invalid-email":          setError("Invalid email format"); break;
        case "auth/user-disabled":          setError("Account has been disabled"); break;
        case "auth/network-request-failed": setError("Unable to connect. Please check your internet connection and try again."); break;
        default: setError((err instanceof Error ? err.message : null) || "Login failed. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Google sign-in ───────────────────────────────────────────────────────
  // Popup sign-in, then ensure a users/{uid} doc exists for brand-new Google
  // users (matching the fields signup/page.tsx writes for email/password
  // signups), then route through the same chain as a normal login.
  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      setError("");
      setMessage("");

      const provider = new GoogleAuthProvider();
      const userCred = await signInWithPopup(auth, provider);
      const user = userCred.user;

      if (user.email) localStorage.setItem("lastEmail", user.email);

      // First-time Google sign-in — create the same starter docs signup does,
      // so a brand-new Google user lands in /register just like a brand-new
      // email/password user would.
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          role: "student",
          roles: ["student"],
          // FIX (bug report — "200 v-coins not updated"): no coins:200
          // here — see the matching FIX comment in signup/page.tsx. The
          // welcome bonus is credited exactly once, into the field the
          // wallet UI actually reads, when registration completes.
          email: user.email ?? "",
          name: user.displayName ?? "",
          photoURL: user.photoURL ?? "",
          signupPlatform: "web",
          createdAt: serverTimestamp(),
        }, { merge: true });
      }

      await routeAfterAuth(user.uid);

    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      // User closing the popup isn't an error worth showing
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setGoogleLoading(false);
        return;
      }
      switch (code) {
        case "auth/account-exists-with-different-credential":
          setError("This email is already registered with a password. Please log in with email & password instead.");
          break;
        case "auth/popup-blocked":
          setError("Popup was blocked by your browser. Please allow popups for this site and try again.");
          break;
        case "auth/network-request-failed":
          setError("Unable to connect. Please check your internet connection and try again.");
          break;
        default:
          setError((err instanceof Error ? err.message : null) || "Google sign-in failed. Try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-glow" />

      {/* Brand logo — exact colours from mobile BrandLogo */}
      <div style={{ textAlign: "center", marginBottom: 24, position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1 }}>
          <span style={{ color: "#A5B4FC" }}>Gl</span>
          <span style={{ color: "var(--text)" }}>oows</span>
          <span style={{
            background: "linear-gradient(90deg,#6366F1,#8B5CF6,#EC4899)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontSize: 29,
          }}>365</span>
          <span style={{ color: "#FBBF24", fontSize: 31 }}>E</span>
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 5 }}>
          Learn • Compete • Earn 🚀
        </div>
      </div>

      <div className="auth-card">
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>
          Welcome back! 👋
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.5, color: "var(--text-muted)", marginBottom: 22 }}>
          Continue your learning journey and unlock new achievements.
        </p>

        {error && (
          <div className="error-box" style={{ marginBottom: 16 }} role="alert">
            <AlertIcon />
            <span>{error}</span>
          </div>
        )}
        {message && (
          <div className="success-box" style={{ marginBottom: 16 }} role="status">
            <CheckIcon />
            <span>{message}</span>
          </div>
        )}

        {/* Google sign-in — real popup auth */}
        <button
          type="button"
          className="btn-google"
          style={{ marginBottom: 4, minHeight: 54 }}
          onClick={handleGoogleSignIn}
          disabled={busy}
          aria-busy={googleLoading}
        >
          {googleLoading ? (
            <span className="btn-spinner" aria-hidden="true" style={{ borderColor: "rgba(66,133,244,0.3)", borderTopColor: "#4285F4" }} />
          ) : (
            <GoogleIcon />
          )}
          {googleLoading ? "Connecting to Google…" : "Continue with Google"}
        </button>

        <div className="divider" style={{ margin: "16px 0", fontSize: 11, letterSpacing: 0.6, fontWeight: 700, textTransform: "uppercase" }}>
          or continue with email
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }} noValidate>
          <div>
            <label className="auth-field-label" htmlFor="login-email">Email Address</label>
            <div className="auth-input-wrap">
              <MailIcon />
              <input
                id="login-email"
                className="auth-input"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
                onBlur={() => {
                  const trimmed = email.trim().toLowerCase();
                  if (trimmed !== email) setEmail(trimmed);
                  if (trimmed && !EMAIL_RE.test(trimmed)) setEmailError("Please enter a valid email address");
                }}
                required
                autoComplete="email"
                disabled={busy}
                aria-invalid={!!emailError}
                aria-describedby={emailError ? "login-email-error" : undefined}
                style={emailError ? { borderColor: "#ef4444" } : undefined}
              />
            </div>
            {emailError && (
              <p id="login-email-error" role="alert" style={{ color: "#f87171", fontSize: 12, fontWeight: 600, marginTop: 6, marginLeft: 2 }}>
                {emailError}
              </p>
            )}
          </div>

          <div>
            <label className="auth-field-label" htmlFor="login-password">Password</label>
            <div className="auth-input-wrap">
              <LockIcon />
              <input
                id="login-password"
                className="auth-input"
                type={secure ? "password" : "text"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={busy}
                style={{ paddingRight: 52 }}
              />
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setSecure(!secure)}
                aria-label={secure ? "Show password" : "Hide password"}
              >
                <EyeIcon open={secure} />
              </button>
            </div>
          </div>

          <div style={{ textAlign: "right", marginTop: -4 }}>
            <Link href="/password-reset" className="forgot-link">
              <KeyIcon />
              Forgot password?
            </Link>
          </div>

          <button className="btn-primary" type="submit" disabled={busy} aria-busy={loading} style={{ minHeight: 56 }}>
            {loading ? (
              <>
                <span className="btn-spinner" aria-hidden="true" />
                Signing you in…
              </>
            ) : (
              <>
                Login
                <ArrowRightIcon />
              </>
            )}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "var(--text-muted)" }}>
          Don&apos;t have an account?{" "}
          <Link href="/signup"
            style={{ color: "#FBBF24", fontWeight: 700, textDecoration: "none" }}>
            Sign up
          </Link>
        </p>

        <p style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          🔒 Secure access to your learning journey
        </p>
      </div>
    </div>
  );
}

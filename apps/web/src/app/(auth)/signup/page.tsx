"use client";

// PATH: apps/web/src/app/(auth)/signup/page.tsx
//
// Mirrors mobile app/(auth)/signup.tsx exactly:
//   - Email + password + confirm password
//   - Password strength meter (same 4-level algorithm)
//   - Creates students/{uid} + users/{uid} with onboardingComplete: false
//   - On success → /register  (to complete profile)
//   - Cleans up Auth user if Firestore write fails
//   - Same perks banner (🏆 🤖 🪙)
//   - Google sign-in button — real popup auth (mirrors login/page.tsx's
//     handleGoogleSignIn). A brand-new Google user always gets routed to
//     /register just like a brand-new email/password user; registration
//     is never skipped for Google sign-ups.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getAuth,
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithPopup,
} from "firebase/auth";
import { getFirestore, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

// Mirrors login/page.tsx RESTART_* constants — needed here too so an
// existing restart-education user who mistakenly hits "Continue with
// Google" on the Signup page still lands somewhere sensible instead of
// being shoved into the student registration form.
const RESTART_TYPES = ["restartEducation", "restart_education", "restart"];
const RESTART_INDICATOR_FIELDS = ["lastClassPassed", "educationGapReason", "currentOccupation"];

const PERKS = [
  { icon: "🏆", label: "Skill Battles" },
  { icon: "🤖", label: "AI Tutor" },
  { icon: "🪙", label: "200 Free Coins" },
];

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "#334155" };
  let score = 0;
  if (pw.length >= 6)              score++;
  if (pw.length >= 10)             score++;
  if (/[A-Z]/.test(pw))            score++;
  if (/[0-9]/.test(pw))            score++;
  if (/[^A-Za-z0-9]/.test(pw))    score++;
  if (score <= 1) return { score: 1, label: "Weak",   color: "#EF4444" };
  if (score === 2) return { score: 2, label: "Fair",   color: "#F97316" };
  if (score === 3) return { score: 3, label: "Good",   color: "#EAB308" };
  return            { score: 4, label: "Strong", color: "#22C55E" };
}

export default function SignupPage() {
  const router = useRouter();

  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [googleLoading,   setGoogleLoading]   = useState(false);
  const [error,           setError]           = useState("");

  const strength          = getPasswordStrength(password);
  const passwordsMatch    = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const validate = (normalizedEmail: string) => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim())
      return "All fields are required";
    if (!/\S+@\S+\.\S+/.test(normalizedEmail)) return "Invalid email format";
    if (password.length < 6)       return "Password must be at least 6 characters";
    if (password !== confirmPassword) return "Passwords do not match";
    return null;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const err = validate(normalizedEmail);
    if (err) { setError(err); return; }

    let createdUser: ReturnType<typeof getAuth>["currentUser"] = null;
    try {
      setLoading(true);
      setError("");

      const auth = getAuth();
      const db   = getFirestore();

      const userCred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const user     = userCred.user;
      createdUser    = user;

      // Best-effort — a parent's email being unreachable at this instant
      // (offline, transient SMTP hiccup) must never block account creation.
      // The soft-gate reminder banner and profile-settings' "Resend
      // verification email" action cover the retry.
      try { await sendEmailVerification(user); } catch { /* non-fatal */ }

      await setDoc(doc(db, "students", user.uid), {
        email: user.email,
        role: "student",
        onboardingComplete: false,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "users", user.uid), {
        role: "student",
        roles: ["student"],
        // FIX (bug report — "200 v-coins not updated"): removed a
        // `coins: 200` write here. useVCoins() (Wallet, header pill,
        // Drawer) only reads users/{uid}.vCoinsBalance, so this field was
        // never displayed anywhere. The welcome bonus is now credited
        // exactly once, through the proper vCoinsBalance/transaction
        // pipeline, when registration actually completes — see
        // register/page.tsx's creditVCoins() call.
        createdAt: serverTimestamp(),
      }, { merge: true });

      router.replace("/register");

    } catch (err: unknown) {
      // Clean up auth user if Firestore write failed (mirrors mobile)
      if (createdUser) {
        try { await deleteUser(createdUser as Parameters<typeof deleteUser>[0]); } catch { /* best-effort */ }
      }
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/email-already-in-use") setError("Email already registered");
      else if (code === "auth/invalid-email")   setError("Invalid email");
      else if (code === "auth/weak-password")   setError("Weak password");
      else setError("Signup failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Google sign-up ───────────────────────────────────────────────────────
  // Real popup auth (was previously just an "coming soon" alert — dead end
  // that let a Google user get all the way through Signup without ever
  // being forced into the profile-completion form). Mirrors login/page.tsx's
  // handleGoogleSignIn: create the same starter docs the email/password path
  // writes above, then route through the same profile-completeness check so
  // a brand-new Google user always lands on /register, never straight into
  // the app with an incomplete profile.
  const handleGoogleSignup = async () => {
    try {
      setGoogleLoading(true);
      setError("");

      const auth = getAuth();
      const db   = getFirestore();
      const provider = new GoogleAuthProvider();
      const userCred = await signInWithPopup(auth, provider);
      const user = userCred.user;

      if (user.email) localStorage.setItem("lastEmail", user.email);

      // ── Existing restart-education account → send back to login instead
      // of forcing them through the student registration form.
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists()) {
        const d = userSnap.data();
        const profileType = d?.profileType as string | undefined;
        const hasRestartFields = RESTART_INDICATOR_FIELDS.some((f) => f in d);
        if ((profileType && RESTART_TYPES.includes(profileType)) || hasRestartFields) {
          router.replace(d?.onboardingComplete ? "/restart-education/home" : "/restart-education/onboarding");
          return;
        }
      }

      // ── Existing fully-registered student → they already have an
      // account, Signup isn't the right page for them.
      const studentSnap = await getDoc(doc(db, "students", user.uid));
      if (studentSnap.exists() && studentSnap.data()?.onboardingComplete) {
        router.replace("/home");
        return;
      }

      // ── Brand-new Google user (or one who started but never finished
      // registration) → write the same starter docs the email/password
      // path writes above, then registration is mandatory.
      await setDoc(doc(db, "students", user.uid), {
        email: user.email ?? "",
        role: "student",
        onboardingComplete: false,
        createdAt: serverTimestamp(),
      }, { merge: true });
      await setDoc(doc(db, "users", user.uid), {
        role: "student",
        roles: ["student"],
        // See FIX comment on the email/password path above — no coins:200
        // here either; the welcome bonus is credited once, correctly, at
        // /register completion.
        email: user.email ?? "",
        name: user.displayName ?? "",
        photoURL: user.photoURL ?? "",
        signupPlatform: "web",
        createdAt: serverTimestamp(),
      }, { merge: true });

      router.replace("/register");

    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
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
          setError("Network error. Check your connection and try again.");
          break;
        default:
          setError((err instanceof Error ? err.message : null) || "Google sign-up failed. Try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      {/* Brand */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: -1 }}>
          <span style={{ color: "#A5B4FC" }}>Gl</span>
          {/* FIX (bug report — "script not visible in light theme"): this div
              uses className="auth-wrap", which switches to a light gradient
              background in light theme (see globals.css [data-theme="light"]
              .auth-wrap), but "oows" was hardcoded to #F1F5F9 (near-white) —
              invisible against that light background. login/page.tsx already
              uses var(--text) here; matching that. */}
          <span style={{ color: "var(--text)" }}>oows</span>
          <span style={{
            background: "linear-gradient(90deg,#6366F1,#8B5CF6,#EC4899)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontSize: 30,
          }}>365</span>
          <span style={{ color: "#FBBF24", fontSize: 32 }}>E</span>
        </div>
        <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 6 }}>
          Learn • Compete • Earn 🚀
        </div>
      </div>

      <div className="auth-card" style={{ maxWidth: 420 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Create Account</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>
          Join 10,000+ students levelling up
        </p>

        {/* Perks row */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {PERKS.map((p) => (
            <div key={p.label} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: 14, paddingBlock: 12, gap: 4,
            }}>
              <span style={{ fontSize: 22 }}>{p.icon}</span>
              <span style={{ fontSize: 10, color: "#c7d2fe", textAlign: "center", fontWeight: 600 }}>{p.label}</span>
            </div>
          ))}
        </div>

        {/* Google */}
        <button
          type="button"
          className="btn-google"
          style={{ marginBottom: 4 }}
          onClick={handleGoogleSignup}
          disabled={googleLoading || loading}
        >
          <span style={{ fontSize: 18, fontWeight: 900, color: "#4285F4" }}>G</span>
          {googleLoading ? "Signing in…" : "Continue with Google"}
        </button>

        <div className="divider" style={{ margin: "16px 0" }}>or sign up with email</div>

        {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Email — this becomes the account's login credential, and since
              most Class 6–12 students don't have their own email, it's
              almost always a parent/guardian's address in practice.
              Labelling it as such sets the right expectation, and the
              verification link now sent on signup (above) makes it a real,
              checkable claim rather than just wording. */}
          <div>
            <label style={{ color: "#c7d2fe", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>
              📧 Parent&apos;s Email
            </label>
            <input
              className="auth-input"
              type="email"
              placeholder="Enter parent's email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
              required
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div>
            <label style={{ color: "#c7d2fe", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>
              🔐 Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                className="auth-input"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }}
                required
                autoComplete="new-password"
                style={{ paddingRight: 48 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute", right: 14, top: "50%",
                  transform: "translateY(-50%)",
                  background: "none", border: "none",
                  color: "var(--text-muted)", cursor: "pointer", fontSize: 16,
                }}
              >{showPassword ? "👁️" : "🙈"}</button>
            </div>
            {/* Strength meter */}
            {password.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <div style={{ display: "flex", flex: 1, gap: 4 }}>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} style={{
                      flex: 1, height: 4, borderRadius: 2,
                      background: i <= strength.score ? strength.color : "#1e293b",
                      transition: "background 0.2s",
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: strength.color, width: 46, textAlign: "right" }}>
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label style={{ color: "#c7d2fe", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>
              🔑 Confirm Password
            </label>
            <div style={{
              position: "relative",
              borderRadius: 12,
              border: `1px solid ${passwordsMatch ? "rgba(34,197,94,0.55)" : passwordsMismatch ? "rgba(239,68,68,0.55)" : "transparent"}`,
            }}>
              <input
                className="auth-input"
                type={showConfirm ? "text" : "password"}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError(""); }}
                required
                autoComplete="new-password"
                style={{ paddingRight: 48 }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{
                  position: "absolute", right: 14, top: "50%",
                  transform: "translateY(-50%)",
                  background: "none", border: "none",
                  color: "var(--text-muted)", cursor: "pointer", fontSize: 16,
                }}
              >{showConfirm ? "👁️" : "🙈"}</button>
            </div>
            {passwordsMatch   && <p style={{ color: "#22C55E", fontSize: 12, marginTop: 6, fontWeight: 600 }}>✓ Passwords match</p>}
            {passwordsMismatch && <p style={{ color: "#EF4444", fontSize: 12, marginTop: 6, fontWeight: 600 }}>✗ Passwords don&apos;t match</p>}
          </div>

          <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? "Creating account…" : "Create Account →"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#c7d2fe" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#FFD700", fontWeight: 700, textDecoration: "none" }}>
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

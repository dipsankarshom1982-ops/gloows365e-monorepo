"use client";

// PATH: apps/web/src/app/(auth)/password-reset/page.tsx
//
// Mirrors mobile app/(auth)/password-reset.tsx exactly:
//   - Pre-fills email from URL search param (?email=...) — mirrors router.push params
//   - Sends Firebase password reset email
//   - Two states: form → success card
//   - Same error codes, same success copy
//   - "Back to Login" in both states

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";

function PasswordResetForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState("");

  // Pre-fill from ?email= param (mirrors mobile useLocalSearchParams)
  useEffect(() => {
    const e = searchParams.get("email");
    if (e) setEmail(e);
  }, [searchParams]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized) { setError("Please enter your email address"); return; }
    if (!/\S+@\S+\.\S+/.test(normalized)) { setError("Invalid email format"); return; }

    setLoading(true);
    setError("");
    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, normalized);
      setSent(true);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/user-not-found")  setError("No account found with this email address");
      else if (code === "auth/invalid-email") setError("Invalid email address");
      else setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100dvh",
      background: "linear-gradient(160deg, #020617, #0F172A, #1E1B4B)",
      display: "flex", flexDirection: "column",
      overflowY: "auto", padding: "0 24px 40px",
    }}>
      <div style={{ maxWidth: 440, margin: "0 auto", width: "100%", paddingTop: 16 }}>

        {/* Back button */}
        <Link href="/login" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          color: "#94A3B8", fontSize: 14, fontWeight: 500,
          textDecoration: "none", paddingBlock: 8, marginBottom: 32,
        }}>
          ← Back to Login
        </Link>

        {/* Lock icon */}
        <div style={{
          width: 72, height: 72, borderRadius: 36,
          background: "linear-gradient(135deg,#6366F1,#8B5CF6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 28px",
          boxShadow: "0 0 40px rgba(99,102,241,0.4)",
        }}>
          <span style={{ fontSize: 32 }}>🔒</span>
        </div>

        <h1 style={{
          fontSize: 26, fontWeight: 800, color: "#F8FAFC",
          textAlign: "center", marginBottom: 12,
        }}>
          Reset your password
        </h1>
        <p style={{
          fontSize: 14, color: "#94A3B8", textAlign: "center",
          lineHeight: "22px", marginBottom: 36,
        }}>
          Enter the email address linked to your account and we&apos;ll send you a secure reset link.
        </p>

        {sent ? (
          /* ── Success card ── */
          <div style={{
            background: "#0F172A",
            border: "1px solid #1E293B",
            borderRadius: 24, padding: 28,
            display: "flex", flexDirection: "column", alignItems: "center",
          }}>
            <span style={{ fontSize: 56, marginBottom: 16 }}>📬</span>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#F8FAFC", marginBottom: 12 }}>
              Email sent!
            </h2>
            <p style={{ color: "#94A3B8", textAlign: "center", fontSize: 14, marginBottom: 6 }}>
              We&apos;ve sent a password reset link to
            </p>
            <p style={{ color: "#818CF8", fontWeight: 700, fontSize: 15, marginBottom: 16, textAlign: "center" }}>
              {email.trim().toLowerCase()}
            </p>
            <p style={{ color: "#475569", fontSize: 12, textAlign: "center", lineHeight: "18px", marginBottom: 24 }}>
              Check your spam folder if you don&apos;t see it within a few minutes.
            </p>
            <button
              onClick={() => router.replace("/login")}
              style={{
                width: "100%",
                background: "linear-gradient(90deg,#6366F1,#8B5CF6)",
                border: "none", borderRadius: 14,
                paddingBlock: 15, fontSize: 15, fontWeight: 700,
                color: "#fff", cursor: "pointer",
              }}
            >
              Back to Login →
            </button>
          </div>
        ) : (
          /* ── Form ── */
          <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{
                fontSize: 13, fontWeight: 600, color: "#CBD5E1",
                display: "block", marginBottom: 8,
              }}>
                Email address
              </label>
              <div style={{
                display: "flex", alignItems: "center",
                background: "#1E293B",
                borderRadius: 14,
                border: `1.5px solid ${error ? "#F87171" : "#334155"}`,
                paddingInline: 14, paddingBlock: 14, gap: 10,
                transition: "border-color 0.2s",
              }}>
                <span style={{ color: "#64748B", fontSize: 18 }}>✉️</span>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
                  style={{
                    flex: 1, background: "transparent",
                    border: "none", outline: "none",
                    color: "#F1F5F9", fontSize: 15, fontWeight: 500,
                  }}
                  autoComplete="email"
                  required
                />
              </div>

              {error && (
                <p style={{ color: "#F87171", fontSize: 13, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  ⚠️ {error}
                </p>
              )}
              {!error && (
                <p style={{ color: "#64748B", fontSize: 12, marginTop: 8, lineHeight: "17px" }}>
                  We&apos;ll only send a link if this email is registered with GLOOWS365E.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!email.trim() || loading}
              style={{
                background: "linear-gradient(90deg,#6366F1,#8B5CF6)",
                border: "none", borderRadius: 14,
                paddingBlock: 16, fontSize: 16, fontWeight: 700,
                color: "#fff", cursor: (!email.trim() || loading) ? "not-allowed" : "pointer",
                opacity: (!email.trim() || loading) ? 0.45 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}
            >
              {loading ? "Sending…" : "Send Reset Link ✈️"}
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: "#1E293B" }} />
              <span style={{ color: "#475569", fontSize: 13 }}>or</span>
              <div style={{ flex: 1, height: 1, background: "#1E293B" }} />
            </div>

            <p style={{ textAlign: "center", color: "#94A3B8", fontSize: 14 }}>
              Remembered your password?{" "}
              <Link href="/login" style={{ color: "#818CF8", fontWeight: 700, textDecoration: "none" }}>
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default function PasswordResetPage() {
  return (
    <Suspense>
      <PasswordResetForm />
    </Suspense>
  );
}

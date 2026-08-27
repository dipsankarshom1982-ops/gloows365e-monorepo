"use client";

// PATH: apps/web/src/app/(auth)/register/page.tsx
//
// Mirrors mobile app/(auth)/register.tsx exactly:
//   - Full student profile form (name, phone, pincode→location, school, DOB, board, class, language, interests)
//   - Age gate: if age >= 18 → show RestartEducationBlock instead
//   - Referral code (optional, 8-char)
//   - Writes to students/{uid} + users/{uid} with onboardingComplete: true
//   - On success → /home
//   - RestartEducation path → writes profileType to users/{uid} → /restart-education/onboarding
//
// Phone OTP (signInWithPhoneNumber) — real verification, mirroring mobile
// app/(auth)/register.tsx. This used to be skipped entirely on web behind a
// comment claiming "reCAPTCHA doesn't work in the static export PWA" — that
// reasoning was mistaken. That constraint is real for *mobile* (React
// Native's WebView has no native reCAPTCHA support, which is exactly why
// components/auth/RecaptchaModal.tsx exists there as a workaround), but web
// is already a real browser: Firebase JS SDK's RecaptchaVerifier is the
// standard, well-supported mechanism here and needs no workaround. A
// secondary, in-memory-persistence Firebase app instance (getPhoneVerifyAuth
// below) mirrors mobile's pattern so verifying the parent's phone never
// disturbs the student's already-signed-in session.

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  inMemoryPersistence,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { getFirestore, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { functions, firebaseConfig } from "@/lib/firebase";

// Mirrors mobile app/privacy.tsx's PRIVACY_POLICY_VERSION — kept as a local
// constant here rather than a cross-package import since the two apps'
// privacy-policy content/versioning isn't shared infrastructure today.
const PRIVACY_POLICY_VERSION = "2026-07-17";

// ─── Secondary Firebase app for parent phone OTP (doesn't touch the
// student's main auth session) — mirrors mobile register.tsx exactly. ──────
function getPhoneVerifyAuth() {
  const existing = getApps().find((a) => a.name === "phone-verify");
  const app = existing ?? initializeApp(firebaseConfig, "phone-verify");
  try {
    return initializeAuth(app, { persistence: inMemoryPersistence });
  } catch {
    return getAuth(app);
  }
}
import { INDIAN_LANGUAGES, DEFAULT_LANGUAGE, getStoredLanguage, clearStoredLanguage } from "@/lib/languages";
import { TITLES } from "@/lib/avatars";

// Matches mobile services/referralService.ts — deterministic 8-char code from UID.
// Written to users/{uid} at registration so the referral page can display it
// and friends can enter it. Must produce a valid 8-char alphanumeric string
// because register/page.tsx only accepts codes of exactly length 8.
function generateReferralCode(uid: string): string {
  const clean = uid.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const part1 = clean.slice(0, 4).padEnd(4, "X");
  const part2 = clean.slice(-4).padEnd(4, "Y");
  return `${part1}${part2}`;
}

const BOARDS         = ["CBSE", "ICSE", "State Board", "Other"];
const CLASS_OPTIONS  = ["6", "7", "8", "9", "10", "11", "12"];
const INTERESTS      = ["Maths","Science","Coding","AI","Robotics","Cricket","Football","Art","Music","GK","Other"];

function calculateAge(dob: string): number {
  const [day, month, year] = dob.split("/").map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  if (
    today.getMonth() < month - 1 ||
    (today.getMonth() === month - 1 && today.getDate() < day)
  ) age--;
  return age;
}

// ─── Restart Education block ──────────────────────────────────────────────────
function RestartEducationBlock({ age, onRestart }: { age: number; onRestart: () => void }) {
  return (
    <div style={{
      minHeight: "100dvh",
      background: "linear-gradient(160deg, #0a0a1a, #1a1040, #0d2a1a)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "flex-start",
      padding: "40px 24px 48px",
      overflowY: "auto",
    }}>
      <div style={{
        width: 100, height: 100, borderRadius: "50%",
        background: "rgba(22,163,74,0.15)",
        border: "2px solid rgba(22,163,74,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 48, marginBottom: 20,
      }}>🎓</div>

      <h2 style={{ color: "#fff", fontSize: 28, fontWeight: 900, textAlign: "center", marginBottom: 6 }}>
        Welcome!
      </h2>
      <p style={{ color: "#86efac", fontSize: 15, textAlign: "center", marginBottom: 28 }}>
        A different learning path awaits you
      </p>

      <div style={{
        width: "100%", maxWidth: 480,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16, padding: 18, marginBottom: 16,
      }}>
        <p style={{ color: "#a3e635", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>About this platform</p>
        <p style={{ color: "#d1fae5", fontSize: 14, lineHeight: "22px" }}>
          GLOOWS365E is designed for current school students in Class 6–12 (under 18 years of age).{" "}
          Based on your age ({age} years), you are eligible for our{" "}
          <strong style={{ color: "#4ade80" }}>Restart My Education</strong> programme — a dedicated
          space for learners who want to continue their education journey after a break.
        </p>
      </div>

      <div style={{
        width: "100%", maxWidth: 480,
        background: "rgba(22,163,74,0.08)",
        border: "1px solid rgba(22,163,74,0.2)",
        borderRadius: 16, padding: 18, marginBottom: 28,
      }}>
        <p style={{ color: "#86efac", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
          What Restart My Education offers:
        </p>
        {[
          { e: "📖", t: "Open Schooling guidance (NIOS & State boards)" },
          { e: "🎓", t: "Distance Learning pathways" },
          { e: "🛠️", t: "Vocational & skill development options" },
          { e: "🤖", t: "Personalised AI Education Advisor" },
          { e: "🌟", t: "Real success stories from learners like you" },
          { e: "🎯", t: "Education Opportunities & scholarships" },
          { e: "🆓", t: "Free personal guidance from our team" },
        ].map((f) => (
          <div key={f.t} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 18, width: 24 }}>{f.e}</span>
            <span style={{ color: "#d1fae5", fontSize: 13, lineHeight: "20px" }}>{f.t}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onRestart}
        style={{
          width: "100%", maxWidth: 480,
          background: "linear-gradient(90deg,#16a34a,#15803d)",
          border: "none", borderRadius: 16,
          padding: "18px 24px", fontSize: 17, fontWeight: 800,
          color: "#fff", cursor: "pointer", marginBottom: 16,
        }}
      >
        Explore Restart My Education →
      </button>

      <p style={{ color: "rgba(134,239,172,0.6)", fontSize: 12, fontStyle: "italic", textAlign: "center" }}>
        &ldquo;No dream should stop because of circumstances.&rdquo;
      </p>
    </div>
  );
}

// ─── Main registration form ───────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();

  const [name,              setName]              = useState("");
  const [title,             setTitle]             = useState("");
  const [phone,             setPhone]             = useState("");
  const [pincode,           setPincode]           = useState("");
  const [stateVal,          setStateVal]          = useState("");
  const [district,          setDistrict]          = useState("");
  const [area,              setArea]              = useState("");
  const [school,            setSchool]            = useState("");
  const [board,             setBoard]             = useState("");
  const [studentClass,      setStudentClass]      = useState("");
  // FEATURE: pre-fill from the language chosen on the welcome screen
  // (see lib/languages.ts) instead of defaulting to blank — the student
  // already told us their language once, no need to ask again here.
  // Falls back to DEFAULT_LANGUAGE ("English") if nothing was stored
  // (e.g. registration reached directly, skipping welcome).
  const [preferredLanguage, setPreferredLanguage] = useState(
    () => getStoredLanguage() ?? DEFAULT_LANGUAGE
  );
  const [dob,               setDob]               = useState("");
  const [interests,         setInterests]         = useState<string[]>([]);
  const [customInterest,    setCustomInterest]    = useState("");
  const [referralCode,      setReferralCode]      = useState("");
  const [loading,           setLoading]           = useState(false);
  const [error,             setError]             = useState("");

  // Restart block state
  const [showRestartBlock, setShowRestartBlock] = useState(false);
  const [detectedAge,      setDetectedAge]      = useState(0);

  // Parent phone OTP
  const [confirmationResult,  setConfirmationResult]  = useState<ConfirmationResult | null>(null);
  const [otp,                 setOtp]                 = useState("");
  const [otpSent,              setOtpSent]            = useState(false);
  const [sendingOtp,           setSendingOtp]         = useState(false);
  const [verifyingOtp,         setVerifyingOtp]       = useState(false);
  const [parentPhoneVerified,  setParentPhoneVerified]= useState(false);
  const [otpError,             setOtpError]           = useState("");
  const [parentalConsent,      setParentalConsent]    = useState(false);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef  = useRef<RecaptchaVerifier | null>(null);

  const fetchLocation = async (pin: string) => {
    if (pin.length !== 6) return;
    try {
      const res  = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();
      if (data[0].Status === "Success") {
        const info = data[0].PostOffice[0];
        setStateVal(info.State);
        setDistrict(info.District);
        setArea(info.Name);
      }
    } catch { /* ignore */ }
  };

  const toggleInterest = (item: string) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  // DOB auto-format: DD/MM/YYYY
  const handleDobChange = (text: string) => {
    let digits    = text.replace(/\D/g, "");
    let formatted = digits;
    if (digits.length > 2) formatted = digits.slice(0, 2) + "/" + digits.slice(2);
    if (digits.length > 4) formatted = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4, 8);
    setDob(formatted);
  };

  // ── Parent phone OTP ────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setOtpError("Enter a valid 10-digit parent phone number first");
      return;
    }
    setSendingOtp(true);
    setOtpError("");
    try {
      const phoneAuth = getPhoneVerifyAuth();
      // Invisible reCAPTCHA bound to the hidden container div rendered
      // below — reused across sends/resends rather than recreated each
      // time, matching Firebase's own recommended usage.
      if (!recaptchaVerifierRef.current && recaptchaContainerRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(
          phoneAuth,
          recaptchaContainerRef.current,
          { size: "invisible" }
        );
      }
      const result = await signInWithPhoneNumber(phoneAuth, `+91${phone}`, recaptchaVerifierRef.current!);
      setConfirmationResult(result);
      setOtpSent(true);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      console.error("handleSendOtp failed:", e?.code, e?.message);
      const code = e?.code ?? "";
      if (code === "auth/invalid-phone-number") {
        setOtpError("Invalid phone number");
      } else if (code === "auth/too-many-requests") {
        setOtpError("Too many attempts. Try again later.");
      } else if (code === "auth/quota-exceeded") {
        setOtpError("SMS limit reached for today. Please try again tomorrow or contact support.");
      } else if (code === "auth/captcha-check-failed" || code === "auth/invalid-app-credential") {
        setOtpError("Verification check failed. Please refresh and try again.");
      } else {
        setOtpError(code ? `Failed to send OTP (${code}). Please try again.` : "Failed to send OTP. Please try again.");
      }
      // A failed attempt can leave the invisible widget in a state that
      // won't retry cleanly — drop it so the next tap builds a fresh one.
      try { recaptchaVerifierRef.current?.clear(); } catch { /* ignore */ }
      recaptchaVerifierRef.current = null;
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!confirmationResult || otp.length !== 6) { setOtpError("Enter the 6-digit OTP"); return; }
    setVerifyingOtp(true);
    setOtpError("");
    try {
      await confirmationResult.confirm(otp);
      setParentPhoneVerified(true);
      setOtpError("");
    } catch {
      setOtpError("Incorrect OTP. Please try again.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // DOB required first
    if (!dob || !/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) {
      setError("Please enter a valid date of birth (DD/MM/YYYY)");
      return;
    }

    // Age gate — mirrors mobile
    const age = calculateAge(dob);
    if (age >= 18) {
      setDetectedAge(age);
      setShowRestartBlock(true);
      return;
    }

    // Normal student validation
    if (!name || !title || !phone || !pincode || !school || !board || !studentClass || !preferredLanguage) {
      setError("Please fill all required fields");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError("Invalid parent phone number (10 digits, starting 6-9)");
      return;
    }
    if (!parentPhoneVerified) {
      setError("Please verify the parent phone number with the OTP sent to it");
      return;
    }
    if (!parentalConsent) {
      setError("Parent/guardian consent is required to continue");
      return;
    }
    if (!/^\d{6}$/.test(pincode)) {
      setError("Invalid pincode");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const auth = getAuth();
      const db   = getFirestore();
      const user = auth.currentUser;
      if (!user) { setError("Not logged in. Please log in first."); return; }

      const finalInterests = interests.includes("Other")
        ? [...interests.filter((i) => i !== "Other"), customInterest].filter(Boolean)
        : interests;

      // Avatar precedence: a real Google account photo, if this user signed
      // up/in with Google, is safe to persist — it's a normal raster image
      // URL both web and mobile can render. The Title-derived silhouette is
      // NOT persisted here: it's an SVG data URI, and React Native's Image
      // component can't render those — an account registered on web would
      // show a broken avatar in the mobile app. Instead, leaving profilePic
      // unset when there's no real photo lets each platform compute its own
      // fallback at display time from the `title` field (this file's
      // AppHeader/Drawer callers already do this via defaultAvatarForTitle();
      // the mobile app renders its own native equivalent) — never something
      // written once and shared cross-platform.
      const defaultProfilePic = user.photoURL || "";

      await setDoc(doc(db, "students", user.uid), {
        name, title, phone, school, board,
        class: studentClass, preferredLanguage,
        parentPhone: phone,
        parentPhoneVerified: true,
        parentalConsent: {
          granted: true,
          grantedAt: serverTimestamp(),
          parentPhone: phone,
          policyVersion: PRIVACY_POLICY_VERSION,
        },
        dob, age,
        location: { state: stateVal, district, area, pincode },
        interests: finalInterests,
        profilePic: defaultProfilePic,
        stats:           { xp: 0, level: 1, streak: 0 },
        learningProfile: { goal: "Improve learning", dailyTarget: 30 },
        onboardingComplete: true,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, "users", user.uid), {
        role: "student", roles: ["student"],
        profileType: "student",
        onboardingComplete: true,
        referralCode: generateReferralCode(user.uid),
        createdAt: serverTimestamp(),
      }, { merge: true });

      // FIX (bug report — "200 v-coins not updated"): this used to just
      // set users/{uid}.coins = 200 directly. But hooks/useVCoins.ts (and
      // therefore the Wallet page, header pill, and Drawer balance) only
      // ever reads users/{uid}.vCoinsBalance — a completely different
      // field — so that 200 was written somewhere nothing displays.
      //
      // Then routed through client-side creditVCoins() — since replaced by
      // the creditSignupBonus Cloud Function (functions/src/vcoins.ts):
      // firestore.rules now blocks direct client writes to vCoinsBalance
      // (see that migration's header comment), so the client-side call
      // this used to make would now silently fail. Idempotent server-side
      // (fixed referenceId "signup_bonus" per uid), so it can only ever
      // credit once even if handleRegister somehow runs twice for the same
      // uid — same guarantee the old client-side call relied on.
      try {
        await httpsCallable(functions, "creditSignupBonus")();
      } catch { /* non-fatal — a coin-credit hiccup must never block registration */ }

      // Apply referral code if provided — calls the applyReferral Cloud Function
      // directly via httpsCallable (the previous fetch("/api/apply-referral") was
      // calling a Next.js API route that doesn't exist and can't exist in a static
      // export). The CF validates the code, credits both parties, and writes the
      // referrals/{id} doc atomically — all server-side.
      //
      // NOTE re: "50 v-coins not updated" for referrals — that credit is
      // written entirely inside this Cloud Function, which lives outside
      // this repo (no functions/ source here to inspect). Given the
      // registration bonus above was landing in users/{uid}.coins instead
      // of vCoinsBalance, it's worth checking whether applyReferral has
      // the same field-name mismatch server-side — if it's incrementing
      // something other than vCoinsBalance / writing to a vCoinTransactions
      // doc, the wallet UI won't show it even though the function itself
      // reports success.
      if (referralCode.length === 8) {
        try {
          const applyReferral = httpsCallable<{ code: string }, { success: boolean; coinsEarned: number }>(
            functions, "applyReferral"
          );
          await applyReferral({ code: referralCode });
        } catch { /* non-fatal — referral failure must never block registration */ }
      }

      // Firestore now holds the durable preference — the pre-login
      // localStorage value from welcome has done its job.
      clearStoredLanguage();

      router.replace("/home");

    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : null) || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Restart Education redirect handler
  const handleRestartRedirect = async () => {
    try {
      const auth = getAuth();
      const db   = getFirestore();
      const user = auth.currentUser;
      if (user) {
        await setDoc(doc(db, "users", user.uid), {
          name,
          title,
          profilePic: user.photoURL || "",
          preferredLanguage,
          dob,
          age: detectedAge,
          profileType:        "restartEducation",
          onboardingComplete: false,
          createdAt:          serverTimestamp(),
        }, { merge: true });
      }
    } catch { /* non-fatal */ }
    // This flow has its own preferredLanguage write above (to users/{uid},
    // since restart-education profiles aren't students/{uid}) — the
    // pre-login welcome-screen value has done its job either way.
    clearStoredLanguage();
    router.replace("/restart-education/onboarding");
  };

  if (showRestartBlock) {
    return <RestartEducationBlock age={detectedAge} onRestart={handleRestartRedirect} />;
  }

  // ── chip style helper ──
  const chip = (selected: boolean): React.CSSProperties => ({
    paddingInline: 12, paddingBlock: 6,
    borderRadius: 20,
    border: `1.5px solid ${selected ? "#6366F1" : "#555"}`,
    background: selected ? "#6366F1" : "transparent",
    color: "#fff", fontSize: 12, cursor: "pointer",
  });

  return (
    <div style={{
      minHeight: "100dvh",
      background: "linear-gradient(160deg, #020617, #1E1B4B, #312E81)",
      overflowY: "auto",
    }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 20px" }}>

        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 34, fontWeight: 900, color: "#fff" }}>
            <span style={{ color: "#A5B4FC" }}>Gl</span>
            <span style={{ color: "#F1F5F9" }}>oows</span>
            <span style={{
              background: "linear-gradient(90deg,#6366F1,#8B5CF6,#EC4899)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: 28,
            }}>365</span>
            <span style={{ color: "#FBBF24" }}>E</span>
          </div>
          <p style={{ color: "#c7d2fe", fontSize: 15, marginTop: 4 }}>Create Your Profile 🚀</p>
        </div>

        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Name */}
          <input
            style={inputStyle}
            placeholder="Full Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          {/* Title — drives the default avatar shown around the app
              until a real photo is uploaded in Settings. */}
          <div>
            <label style={labelStyle}>Title *</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {TITLES.map((t) => (
                <button key={t} type="button" style={chip(title === t)} onClick={() => setTitle(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Parent Phone + OTP — by verifying this number, you as the
              parent/guardian confirm you're completing this registration
              for your child; the consent checkbox below is the separate,
              explicit affirmation DPDP Act 2023 requires alongside it. */}
          <div>
            <label style={labelStyle}>Parent Phone *</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{ ...inputStyle, flex: 1, ...(parentPhoneVerified ? { borderColor: "#34D399" } : {}) }}
                placeholder="10-digit parent phone number"
                type="tel"
                maxLength={10}
                value={phone}
                disabled={parentPhoneVerified}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, ""));
                  setParentPhoneVerified(false);
                  setOtpSent(false);
                  setConfirmationResult(null);
                  setOtp("");
                  setOtpError("");
                  setParentalConsent(false);
                }}
              />
              {parentPhoneVerified ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#34D399", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                  ✓ Verified
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={sendingOtp}
                  style={{
                    flexShrink: 0, borderRadius: 12, border: "none",
                    background: "#6366F1", color: "#fff", fontWeight: 700, fontSize: 13,
                    padding: "0 16px", cursor: sendingOtp ? "not-allowed" : "pointer",
                    opacity: sendingOtp ? 0.6 : 1,
                  }}
                >
                  {sendingOtp ? "Sending…" : otpSent ? "Resend" : "Send OTP"}
                </button>
              )}
            </div>

            {/* Invisible reCAPTCHA host — required by Firebase's phone auth,
                renders nothing visible in the "invisible" size. */}
            <div ref={recaptchaContainerRef} />

            {otpSent && !parentPhoneVerified && (
              <div style={{ marginTop: 10 }}>
                <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8 }}>
                  Enter the 6-digit OTP sent to +91 {phone} — the parent/guardian entering it is confirming they're completing this registration.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    style={{ ...inputStyle, flex: 1, letterSpacing: 3 }}
                    placeholder="6-digit OTP"
                    type="tel"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    autoComplete="one-time-code"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={verifyingOtp || otp.length !== 6}
                    style={{
                      flexShrink: 0, borderRadius: 12, border: "none",
                      background: "#22C55E", color: "#fff", fontWeight: 700, fontSize: 13,
                      padding: "0 16px", cursor: (verifyingOtp || otp.length !== 6) ? "not-allowed" : "pointer",
                      opacity: (verifyingOtp || otp.length !== 6) ? 0.6 : 1,
                    }}
                  >
                    {verifyingOtp ? "Verifying…" : "Verify"}
                  </button>
                </div>
              </div>
            )}
            {otpError && (
              <p style={{ color: "#f87171", fontSize: 12, marginTop: 6 }}>{otpError}</p>
            )}

            {/* Parental consent — a distinct, explicit affirmation separate
                from OTP verification (which only proves phone ownership,
                not consent), per DPDP Act 2023. Mirrors mobile register.tsx. */}
            {parentPhoneVerified && (
              <label style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                color: "#c7d2fe", fontSize: 13, marginTop: 10, cursor: "pointer", lineHeight: "18px",
              }}>
                <input
                  type="checkbox"
                  checked={parentalConsent}
                  onChange={(e) => setParentalConsent(e.target.checked)}
                  style={{ marginTop: 2, flexShrink: 0 }}
                />
                I am the parent/legal guardian of this student and I consent to the collection
                and processing of their personal data as described in the Privacy Policy.
              </label>
            )}
          </div>

          {/* Pincode */}
          <div>
            <input
              style={inputStyle}
              placeholder="Pincode *"
              type="tel"
              maxLength={6}
              value={pincode}
              onChange={(e) => { setPincode(e.target.value); fetchLocation(e.target.value); }}
            />
            {stateVal && (
              <p style={{ color: "#34D399", fontSize: 13, marginTop: 6 }}>
                📍 {area}, {district}, {stateVal}
              </p>
            )}
          </div>

          {/* School */}
          <input
            style={inputStyle}
            placeholder="School Name *"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
          />

          {/* DOB */}
          <input
            style={inputStyle}
            placeholder="Date of Birth * (DD/MM/YYYY)"
            value={dob}
            onChange={(e) => handleDobChange(e.target.value)}
            maxLength={10}
            inputMode="numeric"
          />

          {/* Board */}
          <div>
            <label style={labelStyle}>Board *</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {BOARDS.map((b) => (
                <button key={b} type="button" style={chip(board === b)} onClick={() => setBoard(b)}>
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Class */}
          <div>
            <label style={labelStyle}>Class *</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {CLASS_OPTIONS.map((c) => (
                <button key={c} type="button" style={chip(studentClass === c)} onClick={() => setStudentClass(c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label style={labelStyle}>Preferred Language *</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {INDIAN_LANGUAGES.map((lang) => (
                <button
                  key={lang.name} type="button"
                  style={{
                    ...chip(preferredLanguage === lang.name),
                    display: "flex", flexDirection: "column", alignItems: "center",
                    paddingInline: 14, paddingBlock: 8, gap: 2,
                  }}
                  onClick={() => setPreferredLanguage(lang.name)}
                >
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{lang.native}</span>
                  <span style={{ fontSize: 11 }}>{lang.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Interests */}
          <div>
            <label style={labelStyle}>Interests</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {INTERESTS.map((i) => (
                <button key={i} type="button" style={chip(interests.includes(i))} onClick={() => toggleInterest(i)}>
                  {i}
                </button>
              ))}
            </div>
            {interests.includes("Other") && (
              <input
                style={{ ...inputStyle, marginTop: 8 }}
                placeholder="Enter your interest"
                value={customInterest}
                onChange={(e) => setCustomInterest(e.target.value)}
              />
            )}
          </div>

          {/* Referral */}
          <div>
            <label style={labelStyle}>Referral Code (optional)</label>
            <input
              style={{ ...inputStyle, letterSpacing: 2, fontWeight: 700 }}
              placeholder="Enter friend's referral code"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
              maxLength={8}
            />
            {referralCode.length > 0 && referralCode.length < 8 && (
              <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>Code must be 8 characters</p>
            )}
            {referralCode.length === 8 && (
              <p style={{ color: "#34D399", fontSize: 11, marginTop: 4 }}>✓ Code looks good! You&apos;ll get a welcome bonus.</p>
            )}
          </div>

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 10, padding: "10px 14px", color: "#f87171", fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: "linear-gradient(90deg,#6366F1,#8B5CF6)",
              border: "none", borderRadius: 30,
              paddingBlock: 16, fontSize: 16, fontWeight: 700,
              color: "#fff", cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1, marginTop: 8,
            }}
          >
            {loading ? "Saving..." : "Continue →"}
          </button>

          {!parentPhoneVerified && (
            <p style={{ color: "#64748b", fontSize: 11, textAlign: "center" }}>
              * Verify parent phone with OTP to enable registration
            </p>
          )}
          {parentPhoneVerified && !parentalConsent && (
            <p style={{ color: "#64748b", fontSize: 11, textAlign: "center" }}>
              * Parent/guardian consent required to enable registration
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

// ─── shared local styles ──────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.06)",
  padding: "14px 16px", borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#fff", fontSize: 15, outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  color: "#c7d2fe", marginBottom: 8,
  fontSize: 13, fontWeight: 600,
  display: "block",
};

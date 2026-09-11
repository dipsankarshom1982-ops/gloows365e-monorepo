"use client";
// apps/tutor/src/app/(auth)/login/page.tsx
// Web counterpart to apps/tutor-mobile/app/(auth)/login.tsx — same
// premium 2026-edtech design (deep navy gradient, brand mark + "TUTOR"
// badge, floating-label-style fields with inline validation, gradient
// CTA, OR divider, Google button, security footer), same i18n keys, same
// Firebase error-code mapping. Two deliberate platform differences, both
// noted where they occur below:
//
//   1. Icons are inline SVG here instead of the hand-built RN <View>
//      glyphs mobile uses — mobile avoids @expo/vector-icons (see that
//      file's header) to skip a native dependency; web has no such cost,
//      so real vector icons are strictly better here.
//   2. Email/password fields are inside a real <form> (mobile has no
//      form-submission concept) so the browser's native password-manager
//      save-prompt fires on submit, and Enter submits from either field.
//
// "Continue with Google" is a UI-only stub on web too, same as mobile —
// NOT for mobile's reason (missing expo-auth-session). On web,
// signInWithPopup(auth, new GoogleAuthProvider()) is trivial (apps/web's
// own login already does it) and needs no new dependency. The blocker is
// upstream of this file: a first-time Google sign-in has no tutorRole
// yet, and registerTutorAccount (functions/src/tutorAccounts.ts) — the
// only path that provisions a tutors/{uid} doc — requires role selection
// and always creates its own Auth user via createUserWithEmailAndPassword,
// so it can't finish signing up a user Google already authenticated.
// Wiring this for real needs a callable that accepts an
// already-authenticated Google user, not just a new UI. Tapping it here
// says so plainly instead of leaving a half-working flow.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { useTutorT } from "@gloows/tutor-i18n";
import { useTutorProfile } from "@gloows/shared-logic";
import { auth } from "@/lib/firebase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`w-[18px] h-[18px] shrink-0 ${className ?? ""}`}>
      <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 5.5L10 11L17 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`w-[18px] h-[18px] shrink-0 ${className ?? ""}`}>
      <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`w-[19px] h-[19px] shrink-0 ${className ?? ""}`}>
      <path d="M1 10s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      {!open && <line x1="2" y1="2" x2="18" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
    </svg>
  );
}

type BannerTone = "error" | "success" | "info";

const BANNER_TONE_CLASSES: Record<BannerTone, { box: string; badge: string; glyph: string }> = {
  error:   { box: "bg-red-400/10 border-red-400 text-red-300",     badge: "bg-red-400",   glyph: "!" },
  success: { box: "bg-green-400/10 border-green-400 text-green-300", badge: "bg-green-400", glyph: "✓" },
  info:    { box: "bg-brand-400/10 border-brand-400 text-brand-200", badge: "bg-brand-400", glyph: "i" },
};

function Banner({ tone, children }: { tone: BannerTone; children: string }) {
  const c = BANNER_TONE_CLASSES[tone];
  return (
    <div role="alert" aria-live="polite" className={`flex items-start gap-2.5 rounded-xl border-l-[3px] px-3.5 py-3 mb-3 ${c.box}`}>
      <span className={`flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-black text-[#0B1226] shrink-0 mt-0.5 ${c.badge}`}>
        {c.glyph}
      </span>
      <span className="text-[13px] font-semibold leading-snug flex-1">{children}</span>
    </div>
  );
}

export default function LoginPage() {
  const { t } = useTutorT();
  const router = useRouter();
  const { user, authLoading, tutorProfile, profileLoading } = useTutorProfile();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{ tone: BannerTone; text: string } | null>(null);

  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Requirement: an already-authenticated tutor should never see this
  // screen — mirrors app/page.tsx's own root-level redirect, including
  // sending an onboarding-incomplete tutor to /onboarding rather than
  // /dashboard (a fresh sign-in shouldn't skip past unfinished steps).
  useEffect(() => {
    if (authLoading || (user && profileLoading)) return;
    if (user) router.replace(tutorProfile?.onboardingCompleted ? "/dashboard" : "/onboarding");
  }, [authLoading, user, profileLoading, tutorProfile, router]);

  if (authLoading || user) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-[#060A17] via-[#0B1226] to-[#111C3A]">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-brand-400 animate-spin" />
      </div>
    );
  }

  const emailValid = EMAIL_RE.test(email.trim());
  const emailError = emailTouched && email.length > 0 && !emailValid ? t("invalidEmailError") : null;
  const canSubmit = emailValid && password.length > 0 && !submitting;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return; // prevent double-submit
    setEmailTouched(true);
    if (!emailValid) {
      setFormMessage({ tone: "error", text: t("invalidEmailError") });
      return;
    }
    if (!password) {
      setFormMessage({ tone: "error", text: t("passwordRequiredError") });
      return;
    }

    setSubmitting(true);
    setFormMessage(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // No explicit redirect here — the useEffect above picks up `user`
      // becoming truthy and routes to /dashboard or /onboarding once
      // tutorProfile has actually loaded, avoiding a race where this
      // fires before onboardingCompleted is known.
    } catch (err: any) {
      switch (err?.code) {
        case "auth/user-not-found":
          setFormMessage({ tone: "error", text: t("accountNotFound") }); break;
        case "auth/wrong-password":
        case "auth/invalid-credential":
          setFormMessage({ tone: "error", text: t("incorrectCredentials") }); break;
        case "auth/invalid-email":
          setFormMessage({ tone: "error", text: t("invalidEmailError") }); break;
        case "auth/user-disabled":
          setFormMessage({ tone: "error", text: t("accountDisabled") }); break;
        case "auth/too-many-requests":
          setFormMessage({ tone: "error", text: t("tooManyAttempts") }); break;
        case "auth/network-request-failed":
          setFormMessage({ tone: "error", text: t("networkErrorRetry") }); break;
        default:
          setFormMessage({ tone: "error", text: err?.message ?? t("networkErrorRetry") });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    if (!emailValid) {
      setEmailTouched(true);
      setFormMessage({ tone: "error", text: t("forgotPasswordEnterEmail") });
      return;
    }
    try {
      setFormMessage(null);
      await sendPasswordResetEmail(auth, email.trim());
      setFormMessage({ tone: "success", text: t("forgotPasswordSent") });
    } catch (err: any) {
      setFormMessage({ tone: "error", text: err?.message ?? t("networkErrorRetry") });
    }
  }

  function handleGooglePress() {
    setFormMessage({ tone: "info", text: t("googleNotConfigured") });
  }

  return (
    <div className="min-h-dvh flex flex-col items-center bg-gradient-to-br from-[#060A17] via-[#0B1226] to-[#111C3A] px-5 py-10">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="flex items-center gap-1">
            <span className="text-2xl font-black tracking-tight">
              <span className="text-brand-300">Gl</span>
              <span className="text-slate-100">oows</span>
            </span>
            <span className="rounded-md px-1.5 py-0.5 bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-cyan-400">
              <span className="text-white text-xs font-black tracking-wide">365</span>
            </span>
            <span className="text-[10px] font-black text-gold">E</span>
          </div>
          <span className="rounded-full px-2 py-0.5 bg-brand-500/15 border border-brand-500/40 text-brand-300 text-[10px] font-extrabold tracking-widest">
            TUTOR
          </span>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-extrabold text-slate-50 mb-1.5 tracking-tight">{t("loginWelcomeTitle")}</h1>
        <p className="text-sm text-slate-400 mb-7 leading-relaxed">{t("loginWelcomeSubtitle")}</p>

        <form onSubmit={handleLogin} noValidate>
          {/* Email */}
          <div className="mb-4">
            <label htmlFor="tutor-email" className="block text-[13px] font-bold text-slate-300 mb-2 tracking-wide">
              {t("emailAddressLabel")}
            </label>
            <div className={`flex items-center gap-2.5 rounded-2xl border px-3.5 bg-white/5 transition-colors ${
              emailError ? "border-red-400" : emailFocused ? "border-brand-400 bg-brand-500/10" : "border-white/10"
            }`}>
              <MailIcon className={emailFocused ? "text-brand-300" : "text-slate-500"} />
              <input
                id="tutor-email"
                type="email"
                className="flex-1 bg-transparent py-3.5 text-[15px] text-slate-50 placeholder-slate-500 outline-none"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => { setEmailFocused(false); setEmailTouched(true); }}
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                aria-invalid={!!emailError}
                aria-describedby={emailError ? "tutor-email-error" : undefined}
                disabled={submitting}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); passwordInputRef.current?.focus(); }
                }}
              />
            </div>
            {emailError && (
              <p id="tutor-email-error" role="alert" className="mt-1.5 ml-0.5 text-xs font-semibold text-red-300">
                {emailError}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="mb-2">
            <label htmlFor="tutor-password" className="block text-[13px] font-bold text-slate-300 mb-2 tracking-wide">
              {t("passwordLabel")}
            </label>
            <div className={`flex items-center gap-2.5 rounded-2xl border px-3.5 bg-white/5 transition-colors ${
              pwFocused ? "border-brand-400 bg-brand-500/10" : "border-white/10"
            }`}>
              <LockIcon className={pwFocused ? "text-brand-300" : "text-slate-500"} />
              <input
                id="tutor-password"
                ref={passwordInputRef}
                type={showPassword ? "text" : "password"}
                className="flex-1 bg-transparent py-3.5 text-[15px] text-slate-50 placeholder-slate-500 outline-none"
                placeholder={t("passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPwFocused(true)}
                onBlur={() => setPwFocused(false)}
                autoComplete="current-password"
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {/* Forgot password — right-aligned */}
          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-[13.5px] font-bold text-brand-300 hover:text-brand-200 transition-colors py-1"
            >
              {t("forgotPassword")}
            </button>
          </div>

          {formMessage && <Banner tone={formMessage.tone}>{formMessage.text}</Banner>}

          {/* Primary CTA */}
          <button
            type="submit"
            disabled={!canSubmit}
            aria-busy={submitting}
            className={`w-full h-[54px] rounded-[18px] font-extrabold text-[15px] tracking-wide text-white transition-opacity flex items-center justify-center gap-2.5 ${
              canSubmit
                ? "bg-gradient-to-r from-[#4F46E5] via-brand-500 to-cyan-400 shadow-lg shadow-brand-600/30 hover:opacity-95"
                : "bg-slate-700 cursor-not-allowed opacity-70"
            }`}
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                {t("signingIn")}
              </>
            ) : (
              <>{t("signInButton")} →</>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[11px] font-bold tracking-widest text-slate-500">{t("orDivider")}</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={handleGooglePress}
          className="w-full h-[54px] rounded-2xl bg-slate-50 border border-black/10 flex items-center justify-center gap-2.5 font-bold text-sm text-slate-800 hover:bg-white transition-colors"
        >
          <span className="text-[#4285F4] font-black text-base">G</span>
          {t("continueWithGoogle")}
        </button>

        {/* Registration */}
        <div className="flex items-center justify-center gap-1.5 mt-6 text-[13.5px]">
          <span className="text-slate-400">{t("newToGloowsTutor")}</span>
          <Link href="/register" className="text-cyan-400 font-extrabold hover:text-cyan-300 transition-colors">
            {t("createAccount")}
          </Link>
        </div>

        {/* Security reassurance */}
        <p className="text-center text-[12px] text-slate-500 mt-7">{t("secureLoginNote")}</p>
      </div>
    </div>
  );
}

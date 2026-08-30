"use client";
// apps/tutor/src/app/(auth)/register/page.tsx
// Step 1 of the Gloows Tutor signup flow — account creation only
// (email/password/confirm). Everything else — role/tutor type, teaching
// profile, qualifications, document uploads — moved to the dedicated
// onboarding flow at /onboarding (Step 2-5), started once this succeeds.
// See apps/tutor/src/app/onboarding/page.tsx's header for why: the old
// version of this file used to also collect name + role + phone as
// Steps 2-3 of the SAME wizard, but the spec for the onboarding flow
// treats those as onboarding Step 2 ("Basic Information") instead, so
// this file no longer owns them — it only ever creates the Firebase Auth
// user and hands off.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useTutorT } from "@gloows/tutor-i18n";
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

function Banner({ children }: { children: string }) {
  return (
    <div role="alert" aria-live="polite" className="flex items-start gap-2.5 rounded-xl border-l-[3px] px-3.5 py-3 mb-4 bg-red-400/10 border-red-400">
      <span className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-black text-[#0B1226] shrink-0 mt-0.5 bg-red-400">!</span>
      <span className="text-[13px] font-semibold leading-snug flex-1 text-red-300">{children}</span>
    </div>
  );
}

export default function RegisterPage() {
  const { t } = useTutorT();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreateAccount() {
    if (submitting) return; // prevent double-submit
    if (!EMAIL_RE.test(email.trim())) { setErrorMessage(t("invalidEmailError")); return; }
    if (password.length < 6) { setErrorMessage(t("passwordTooShortError")); return; }
    if (password !== confirmPassword) { setErrorMessage(t("confirmPasswordMismatchError")); return; }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      // Onboarding Step 2 (Basic Information) picks up from here — see
      // apps/tutor/src/app/onboarding/page.tsx. No tutors/{uid} doc exists
      // yet; onboarding creates it once name/phone are collected.
      router.replace("/onboarding");
    } catch (err: any) {
      switch (err?.code) {
        case "auth/email-already-in-use":
          setErrorMessage("An account already exists with this email."); break;
        case "auth/weak-password":
          setErrorMessage(t("passwordTooShortError")); break;
        case "auth/network-request-failed":
          setErrorMessage(t("networkErrorRetry")); break;
        default:
          setErrorMessage(err?.message ?? t("networkErrorRetry"));
      }
    } finally {
      setSubmitting(false);
    }
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

        <h1 className="text-2xl font-extrabold text-slate-50 mb-1.5 tracking-tight">{t("createAccountTitle")}</h1>
        <p className="text-sm text-slate-400 mb-7 leading-relaxed">{t("createAccountSubtitle")}</p>

        <div className="mb-4">
          <label htmlFor="reg-email" className="block text-[13px] font-bold text-slate-300 mb-2 tracking-wide">{t("emailAddressLabel")}</label>
          <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 px-3.5 bg-white/5 focus-within:border-brand-400 focus-within:bg-brand-500/10 transition-colors">
            <MailIcon className="text-slate-500" />
            <input
              id="reg-email"
              type="email"
              className="flex-1 bg-transparent py-3.5 text-[15px] text-slate-50 placeholder-slate-500 outline-none"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              disabled={submitting}
            />
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="reg-password" className="block text-[13px] font-bold text-slate-300 mb-2 tracking-wide">{t("passwordLabel")}</label>
          <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 px-3.5 bg-white/5 focus-within:border-brand-400 focus-within:bg-brand-500/10 transition-colors">
            <LockIcon className="text-slate-500" />
            <input
              id="reg-password"
              type={showPassword ? "text" : "password"}
              className="flex-1 bg-transparent py-3.5 text-[15px] text-slate-50 placeholder-slate-500 outline-none"
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              disabled={submitting}
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-slate-400 hover:text-slate-200 transition-colors" aria-label={showPassword ? "Hide password" : "Show password"}>
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="reg-confirm" className="block text-[13px] font-bold text-slate-300 mb-2 tracking-wide">{t("confirmPasswordLabel")}</label>
          <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 px-3.5 bg-white/5 focus-within:border-brand-400 focus-within:bg-brand-500/10 transition-colors">
            <LockIcon className="text-slate-500" />
            <input
              id="reg-confirm"
              type={showConfirm ? "text" : "password"}
              className="flex-1 bg-transparent py-3.5 text-[15px] text-slate-50 placeholder-slate-500 outline-none"
              placeholder={t("confirmPasswordPlaceholder")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              disabled={submitting}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateAccount(); } }}
            />
            <button type="button" onClick={() => setShowConfirm((v) => !v)} className="text-slate-400 hover:text-slate-200 transition-colors" aria-label={showConfirm ? "Hide password" : "Show password"}>
              <EyeIcon open={showConfirm} />
            </button>
          </div>
        </div>

        {errorMessage && <Banner>{errorMessage}</Banner>}

        <button
          type="button"
          onClick={handleCreateAccount}
          disabled={submitting}
          aria-busy={submitting}
          className="w-full h-[54px] rounded-[18px] font-extrabold text-[15px] tracking-wide text-white bg-gradient-to-r from-[#4F46E5] via-brand-500 to-cyan-400 shadow-lg shadow-brand-600/30 hover:opacity-95 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2.5"
        >
          {submitting ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              {t("creatingAccount")}
            </>
          ) : (
            <>{t("continue")} →</>
          )}
        </button>

        <div className="flex items-center justify-center gap-1.5 mt-6 text-[13.5px]">
          <span className="text-slate-400">{t("alreadyHaveAccount")}</span>
          <Link href="/login" className="text-cyan-400 font-extrabold hover:text-cyan-300 transition-colors">
            {t("loginLink")}
          </Link>
        </div>
      </div>
    </div>
  );
}

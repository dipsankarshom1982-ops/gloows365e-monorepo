"use client";
// apps/tutor/src/components/dashboard/PhoneVerifyModal.tsx
// Dashboard-only re-verify affordance for the Verification Centre's
// Mobile card. Deliberately a SEPARATE small OTP stub rather than a
// refactor of onboarding/Step2BasicInfo.tsx's already-shipped, already-
// tested OTP flow into a shared component — this session's own
// OnboardingUI.tsx header already documents "small duplication across
// auth-adjacent screens is this codebase's established norm" (see e.g.
// apps/tutor-mobile's BrandLogo duplicated across welcome.tsx/login.tsx)
// and touching production onboarding code for this dashboard feature
// would be needless risk to a flow the user is actively testing.
//
// Same stub semantics as onboarding: any 6-digit code is accepted as
// "correct" after a simulated delay. Real integration point (both
// copies): Firebase Phone Auth signInWithPhoneNumber + reCAPTCHA.

import { useState } from "react";
import { useTutorT } from "@gloows/tutor-i18n";

type Props = {
  phoneNumber: string;
  onVerified: () => void;
  onClose: () => void;
};

export default function PhoneVerifyModal({ phoneNumber, onVerified, onClose }: Props) {
  const { t } = useTutorT();
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  function handleSend() {
    setSending(true);
    setTimeout(() => { setSending(false); setSent(true); }, 700);
  }

  function handleVerify() {
    if (!/^\d{6}$/.test(otpCode)) {
      setError(t("ob2InvalidOtpError"));
      return;
    }
    setError(null);
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      onVerified();
    }, 600);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-surface border border-slate-700 p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-black text-slate-100 mb-1">{t("dashVerifyMobileTitle")}</p>
        <p className="text-xs text-slate-500 mb-4">+91 {phoneNumber}</p>

        {!sent ? (
          <button
            type="button" onClick={handleSend} disabled={sending}
            className="w-full rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold py-2.5 disabled:opacity-50"
          >
            {sending ? "…" : t("ob2SendOtp")}
          </button>
        ) : (
          <>
            <input
              type="text" inputMode="numeric" maxLength={6}
              value={otpCode}
              onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); if (error) setError(null); }}
              placeholder={t("ob2OtpPlaceholder")}
              className="w-full mb-2 rounded-lg bg-bg border border-slate-700 px-3.5 py-2.5 text-sm text-center tracking-[0.3em] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
            {error && <p className="text-danger text-xs font-semibold mb-2">{error}</p>}
            <button
              type="button" onClick={handleVerify} disabled={verifying || otpCode.length !== 6}
              className="w-full rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold py-2.5 disabled:opacity-50"
            >
              {verifying ? "…" : t("ob2VerifyOtp")}
            </button>
          </>
        )}

        <button type="button" onClick={onClose} className="w-full mt-3 text-xs font-bold text-slate-500 hover:text-slate-300">
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

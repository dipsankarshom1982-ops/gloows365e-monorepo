"use client";

// PATH: apps/web/src/app/(auth)/phone-verification/page.tsx
// Mirrors mobile app/(auth)/phone-verification.tsx. OTP logic lives in the
// shared usePhoneOtpFlow hook (@gloows/shared-logic); this page only supplies
// the browser RecaptchaVerifier and the UI.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, RecaptchaVerifier } from "firebase/auth";
import { doc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import { getPhoneVerifyAuth, usePhoneOtpFlow } from "@gloows/shared-logic";
import { firebaseConfig } from "@/lib/firebase";

export default function PhoneVerificationPage() {
  const router = useRouter();
  const otpFlow = usePhoneOtpFlow();
  const { setPhone } = otpFlow;
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const startedRef = useRef(false);

  const handleSend = async () => {
    const phoneAuth = getPhoneVerifyAuth(firebaseConfig as any);
    if (!recaptchaVerifierRef.current && recaptchaContainerRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(phoneAuth, recaptchaContainerRef.current, { size: "invisible" });
    }
    await otpFlow.sendOtp(phoneAuth, recaptchaVerifierRef.current!);
  };

  // A failed send can leave the invisible widget unusable ("reCAPTCHA has
  // already been rendered in this element") — same recovery register/page.tsx
  // used to do inline.
  useEffect(() => {
    if (otpFlow.otpError && !otpFlow.otpSent) {
      try { recaptchaVerifierRef.current?.clear(); } catch { /* ignore */ }
      recaptchaVerifierRef.current = null;
      if (recaptchaContainerRef.current) recaptchaContainerRef.current.innerHTML = "";
    }
  }, [otpFlow.otpError, otpFlow.otpSent]);

  useEffect(() => () => {
    try { recaptchaVerifierRef.current?.clear(); } catch { /* ignore */ }
    recaptchaVerifierRef.current = null;
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("phone");
    if (p) setPhone(p);
    else router.replace("/parent-profile");
  }, [setPhone, router]);

  useEffect(() => {
    if (otpFlow.phone && !startedRef.current) {
      startedRef.current = true;
      handleSend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpFlow.phone]);

  useEffect(() => {
    if (!otpFlow.verified) return;
    const user = getAuth().currentUser;
    if (!user) return;
    setSaving(true);
    setDoc(doc(getFirestore(), "students", user.uid), {
      parentPhone: otpFlow.phone,
      parentPhoneVerified: true,
      onboardingStep: "phoneVerified",
      updatedAt: serverTimestamp(),
    }, { merge: true })
      .catch((e) => setSaveError(e?.message || "Failed to save verification. Please try Continue again."))
      .finally(() => setSaving(false));
  }, [otpFlow.verified, otpFlow.phone]);

  return (
    <div style={page}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>
        {otpFlow.verified ? (
          <>
            <div style={{ fontSize: 64 }}>✅</div>
            <h1 style={title}>Mobile Number Verified</h1>
            {saveError && <p style={err}>{saveError}</p>}
            <button style={{ ...btn, opacity: saving ? 0.6 : 1 }} disabled={saving}
              onClick={() => router.replace("/parent-permissions")}>Continue →</button>
          </>
        ) : (
          <>
            <h1 style={title}>Verify Your Mobile Number</h1>
            <p style={{ color: "#c7d2fe", fontSize: 14, marginBottom: 24 }}>We sent a 6-digit OTP to +91 {otpFlow.phone}.</p>
            <input style={{ ...input, textAlign: "center", fontSize: 24, letterSpacing: 10, fontWeight: 700 }}
              type="tel" maxLength={6} placeholder="______" autoComplete="one-time-code" value={otpFlow.otp}
              onChange={(e) => otpFlow.setOtp(e.target.value.replace(/\D/g, ""))} />
            {otpFlow.otpError && <p style={err}>{otpFlow.otpError}</p>}
            <button style={{ ...btn, opacity: otpFlow.verifyingOtp || otpFlow.otp.length !== 6 ? 0.6 : 1 }}
              disabled={otpFlow.verifyingOtp || otpFlow.otp.length !== 6} onClick={otpFlow.verifyOtp}>
              {otpFlow.verifyingOtp ? "Verifying…" : "Verify OTP"}
            </button>
            <button style={link} disabled={otpFlow.sendingOtp} onClick={handleSend}>
              {otpFlow.sendingOtp ? "Sending…" : "Resend OTP"}
            </button>
            <button style={{ ...link, color: "#94a3b8" }} onClick={() => { otpFlow.reset(); router.back(); }}>
              Change Mobile Number
            </button>
          </>
        )}
        <div ref={recaptchaContainerRef} />
      </div>
    </div>
  );
}

const page: React.CSSProperties = { minHeight: "100dvh", background: "linear-gradient(160deg, #020617, #1E1B4B, #312E81)" };
const title: React.CSSProperties = { color: "#fff", fontSize: 22, fontWeight: 800, marginBottom: 10 };
const input: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.06)", padding: 16, borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none", boxSizing: "border-box" };
const btn: React.CSSProperties = { width: "100%", marginTop: 16, background: "linear-gradient(90deg,#6366F1,#8B5CF6)", border: "none", borderRadius: 30, padding: "16px 0", fontSize: 16, fontWeight: 700, color: "#fff", cursor: "pointer" };
const link: React.CSSProperties = { display: "block", margin: "18px auto 0", background: "none", border: "none", color: "#A5B4FC", fontWeight: 700, fontSize: 14, cursor: "pointer" };
const err: React.CSSProperties = { color: "#f87171", fontSize: 13, marginTop: 10 };

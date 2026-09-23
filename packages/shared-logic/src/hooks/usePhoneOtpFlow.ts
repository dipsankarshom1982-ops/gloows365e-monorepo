"use client";

// packages/shared-logic/src/hooks/usePhoneOtpFlow.ts
//
// The ONE phone-OTP implementation for the whole app. Extracted verbatim
// (same regex, same Firebase error-code → message mapping, same behavior —
// no redesign) from what used to be three independent copies:
//   - apps/mobile/app/(auth)/register.tsx (handleSendOtp/handleVerifyOtp)
//   - apps/mobile/app/profile-settings.tsx (its own duplicate of the above)
//   - apps/web/src/app/(auth)/register/page.tsx (its own duplicate)
// Each platform still owns its own UI and its own ApplicationVerifier
// (mobile: components/auth/RecaptchaModal.tsx via a WebView; web: Firebase's
// native RecaptchaVerifier bound to a DOM node) — this hook only owns the
// send/verify/error/reset state machine, which was identical everywhere.
//
// There is deliberately no resend cooldown/timer here: none existed in any
// of the three previous implementations, so none is being introduced now.

import { useCallback, useState } from "react";
import { getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  inMemoryPersistence,
  initializeAuth,
  signInWithPhoneNumber,
  type ApplicationVerifier,
  type Auth,
  type ConfirmationResult,
} from "firebase/auth";
import type { FirebaseConfig } from "../lib/firebaseConfig";

// Secondary, in-memory-persistence Firebase app instance so verifying a
// phone number never disturbs the already-signed-in user's main auth
// session. Both apps' previous copies of this helper were byte-for-byte
// identical, since inMemoryPersistence needs no platform-specific storage
// adapter (unlike the main app's persistence, which mobile backs with
// AsyncStorage — see apps/mobile/lib/firebase.ts).
export function getPhoneVerifyAuth(firebaseConfig: FirebaseConfig): Auth {
  const existing = getApps().find((a) => a.name === "phone-verify");
  const app = existing ?? initializeApp(firebaseConfig, "phone-verify");
  try {
    return initializeAuth(app, { persistence: inMemoryPersistence });
  } catch {
    return getAuth(app);
  }
}

const PHONE_REGEX = /^[6-9]\d{9}$/;

export interface UsePhoneOtpFlowResult {
  phone: string;
  setPhone: (value: string) => void;
  otp: string;
  setOtp: (value: string) => void;
  otpSent: boolean;
  sendingOtp: boolean;
  verifyingOtp: boolean;
  verified: boolean;
  otpError: string;
  sendOtp: (auth: Auth, verifier: ApplicationVerifier) => Promise<void>;
  verifyOtp: () => Promise<void>;
  reset: () => void;
}

export function usePhoneOtpFlow(): UsePhoneOtpFlowResult {
  const [phone, setPhoneState] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [verified, setVerified] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // Editing the phone number after send/verify resets everything downstream
  // — mirrors the onChangeText handlers in all three previous copies.
  const setPhone = useCallback((value: string) => {
    setPhoneState(value);
    setVerified(false);
    setOtpSent(false);
    setConfirmationResult(null);
    setOtp("");
    setOtpError("");
  }, []);

  const sendOtp = useCallback(async (auth: Auth, verifier: ApplicationVerifier) => {
    // Defensive guard against a second tap landing before the disabled-button
    // re-render commits — mirrors the guard in every previous copy.
    if (sendingOtp) return;
    if (!PHONE_REGEX.test(phone)) {
      setOtpError("Enter a valid 10-digit phone number first");
      return;
    }
    setSendingOtp(true);
    setOtpError("");
    try {
      const result = await signInWithPhoneNumber(auth, `+91${phone}`, verifier);
      setConfirmationResult(result);
      setOtpSent(true);
    } catch (err: any) {
      console.error("usePhoneOtpFlow.sendOtp failed:", err?.code, err?.message);
      const code = err?.code ?? "";
      const msg = err?.message ?? "";
      if (code === "auth/invalid-phone-number" || msg.includes("TOO_SHORT") || msg.includes("INVALID_PHONE")) {
        setOtpError("Invalid phone number");
      } else if (code === "auth/too-many-requests" || msg.includes("TOO_MANY_REQUESTS")) {
        setOtpError("Too many attempts. Try again later.");
      } else if (code === "auth/quota-exceeded") {
        setOtpError("SMS limit reached for today. Please try again tomorrow or contact support.");
      } else if (code === "auth/captcha-check-failed" || code === "auth/invalid-app-credential") {
        setOtpError("Verification check failed. Please check your internet connection and try again.");
      } else if (msg.includes("cancelled")) {
        setOtpError("Verification cancelled.");
      } else {
        setOtpError(code ? `Failed to send OTP (${code}). Please try again.` : "Failed to send OTP. Please try again.");
      }
    } finally {
      setSendingOtp(false);
    }
  }, [phone, sendingOtp]);

  const verifyOtp = useCallback(async () => {
    if (!confirmationResult || otp.length !== 6) {
      setOtpError("Enter the 6-digit OTP");
      return;
    }
    setVerifyingOtp(true);
    setOtpError("");
    try {
      await confirmationResult.confirm(otp);
      setVerified(true);
      setOtpError("");
    } catch {
      setOtpError("Incorrect OTP. Please try again.");
    } finally {
      setVerifyingOtp(false);
    }
  }, [confirmationResult, otp]);

  const reset = useCallback(() => {
    setPhoneState("");
    setOtp("");
    setOtpSent(false);
    setVerified(false);
    setOtpError("");
    setConfirmationResult(null);
  }, []);

  return {
    phone, setPhone, otp, setOtp, otpSent, sendingOtp, verifyingOtp, verified, otpError,
    sendOtp, verifyOtp, reset,
  };
}

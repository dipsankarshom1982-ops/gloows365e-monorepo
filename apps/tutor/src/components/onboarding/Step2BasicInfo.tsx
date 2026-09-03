"use client";
// apps/tutor/src/components/onboarding/Step2BasicInfo.tsx
// Onboarding Step 2 — Basic Information: name, mobile+OTP, photo, PIN
// code (with city/state auto-fetch), gender. See file header of
// ../../app/onboarding/page.tsx for the overall flow.
//
// Every field on this step is mandatory. City/state are still
// auto-filled from the PIN code via India Post's free public lookup
// (api.postalpincode.in, no API key) and remain editable/overridable by
// hand, but the lookup failing (bad PIN, no network) no longer lets the
// tutor skip past them — they must be filled in manually in that case.
//
// OTP verification is a fully interactive UI STUB, not real Firebase
// Phone Auth — per this feature's own scoping decision (real SMS needs
// Console-side Phone Auth + reCAPTCHA config this session can't verify
// is enabled, same reasoning apps/tutor-mobile's login.tsx documents for
// stubbing Google Sign-In). Any 6-digit code is accepted as "correct"
// after a simulated delay. phoneVerified is client-asserted as a result
// — see firestore.rules' tutors/{uid} match block for why that's
// currently acceptable (and where to tighten it once real OTP lands).

import { useEffect, useRef, useState } from "react";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useTutorT } from "@gloows/tutor-i18n";
import {
  INDIAN_STATES, COMMON_INDIAN_CITIES, GENDER_OPTIONS,
} from "@/lib/onboardingOptions";
import type { OnboardingData } from "@/lib/onboardingTypes";
import { Chip, FieldError, PrimaryButton, SectionLabel, TextField, TextLink } from "./OnboardingUI";

const PHONE_RE = /^[6-9]\d{9}$/; // Indian mobile: 10 digits, starts 6-9
const PIN_RE = /^\d{6}$/;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

type Props = {
  uid: string;
  data: OnboardingData;
  update: (patch: Partial<OnboardingData>) => void;
  onContinue: () => void;
  onSaveLater: () => void;
  saving: boolean;
};

export default function Step2BasicInfo({ uid, data, update, onContinue, onSaveLater, saving }: Props) {
  const { t } = useTutorT();

  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [genderError, setGenderError] = useState<string | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);

  // PIN code -> city/state auto-fetch
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinFetching, setPinFetching] = useState(false);
  const pinFetchToken = useRef(0);

  // OTP flow — local/ephemeral, not persisted mid-flow.
  const [otpStage, setOtpStage] = useState<"idle" | "sent">("idle");
  const [otpCode, setOtpCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  // Photo upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  function handleSendOtp() {
    if (!PHONE_RE.test(data.phoneNumber.trim())) {
      setPhoneError(t("ob2InvalidPhoneError"));
      return;
    }
    setPhoneError(null);
    setOtpError(null);
    setSendingOtp(true);
    // Stub — see file header. Real integration point: Firebase Phone Auth
    // signInWithPhoneNumber(auth, `+91${data.phoneNumber}`, recaptchaVerifier).
    setTimeout(() => {
      setSendingOtp(false);
      setOtpStage("sent");
      setResendCooldown(30);
    }, 700);
  }

  function handleVerifyOtp() {
    if (!/^\d{6}$/.test(otpCode)) {
      setOtpError(t("ob2InvalidOtpError"));
      return;
    }
    setOtpError(null);
    setVerifyingOtp(true);
    setTimeout(() => {
      setVerifyingOtp(false);
      // Stub accepts any 6-digit code — see file header.
      update({ phoneVerified: true });
      setOtpCode("");
    }, 600);
  }

  function handleChangeNumber() {
    update({ phoneVerified: false });
    setOtpStage("idle");
    setOtpCode("");
    setOtpError(null);
  }

  async function handlePinCodeChange(raw: string) {
    const pin = raw.replace(/\D/g, "").slice(0, 6);
    update({ pinCode: pin });
    setPinError(null);

    if (!PIN_RE.test(pin)) return; // only fetch once all 6 digits are in

    // Guards against a stale slower response overwriting a newer one if
    // the tutor edits the PIN again before the first lookup returns.
    const token = ++pinFetchToken.current;
    setPinFetching(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const json = await res.json();
      if (token !== pinFetchToken.current) return; // superseded
      const postOffice = json?.[0]?.PostOffice?.[0];
      if (json?.[0]?.Status === "Success" && postOffice) {
        update({
          city: postOffice.District ?? postOffice.Name ?? "",
          state: postOffice.State ?? "",
        });
      } else {
        setPinError(t("ob2PinCodeNotFound"));
      }
    } catch {
      if (token === pinFetchToken.current) setPinError(t("ob2PinCodeNotFound"));
    } finally {
      if (token === pinFetchToken.current) setPinFetching(false);
    }
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError(t("ob2PhotoTooLargeError"));
      return;
    }
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      // Flat path, single segment after {uid} — matches storage.rules'
      // tutorDocuments/{userId}/{fileName} match exactly (no subfolders;
      // that rule doesn't recurse), so this needs no rules deployment.
      // Reuses the existing tutorDocuments prefix rather than a new
      // tutorProfilePhotos/ one for the same reason.
      const storagePath = `tutorDocuments/${uid}/profilePhoto_${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      update({ profilePic: url });
    } catch {
      setPhotoError(t("ob2PhotoUploadError"));
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleRemovePhoto() {
    const url = data.profilePic;
    update({ profilePic: "" });
    if (!url) return;
    try {
      await deleteObject(ref(storage, url));
    } catch {
      // Best-effort — a dangling Storage object with no Firestore
      // reference isn't user-visible and isn't worth surfacing an error
      // for here (matches this app's other delete-then-ignore patterns,
      // e.g. login.tsx's Auth-user rollback).
    }
  }

  function validateAndContinue() {
    let ok = true;
    const trimmedName = data.name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      setNameError(t("ob2NameTooShortError"));
      ok = false;
    } else {
      setNameError(null);
    }
    if (!data.phoneVerified) {
      setPhoneError(t("ob2VerifyPhoneRequiredError"));
      ok = false;
    }
    if (!data.profilePic) {
      setPhotoError(t("ob2PhotoRequiredError"));
      ok = false;
    } else {
      setPhotoError(null);
    }
    if (!PIN_RE.test(data.pinCode)) {
      setPinError(t("ob2PinCodeInvalidError"));
      ok = false;
    } else {
      setPinError(null);
    }
    if (!data.city.trim()) {
      setCityError(t("ob2CityRequiredError"));
      ok = false;
    } else {
      setCityError(null);
    }
    if (!data.state) {
      setStateError(t("ob2StateRequiredError"));
      ok = false;
    } else {
      setStateError(null);
    }
    if (!data.gender) {
      setGenderError(t("ob2GenderRequiredError"));
      ok = false;
    } else {
      setGenderError(null);
    }
    if (ok) onContinue();
  }

  const canContinue =
    data.name.trim().length >= 2 && data.phoneVerified && !!data.profilePic &&
    PIN_RE.test(data.pinCode) && !!data.city.trim() && !!data.state && !!data.gender;

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-slate-50 mb-1.5 tracking-tight">{t("ob2Title")}</h1>
      <p className="text-sm text-slate-400 mb-7 leading-relaxed">{t("ob2Subtitle")}</p>

      <TextField
        id="ob2-name"
        label={t("ob2FullNameLabel")}
        required
        value={data.name}
        onChange={(v) => { update({ name: v.slice(0, 100) }); if (nameError) setNameError(null); }}
        placeholder={t("ob2FullNamePlaceholder")}
        error={nameError}
      />

      {/* Mobile + OTP */}
      <div className="mb-5">
        <SectionLabel required>{t("ob2MobileLabel")}</SectionLabel>
        {data.phoneVerified ? (
          <div className="flex items-center justify-between rounded-2xl border border-green-400/40 bg-green-400/10 px-3.5 py-3.5">
            <span className="text-[15px] text-slate-50 font-semibold">+91 {data.phoneNumber}</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-green-300 text-[13px] font-bold">
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-green-400 text-[#0B1226] text-[10px] font-black">✓</span>
                {t("ob2Verified")}
              </span>
              <button type="button" onClick={handleChangeNumber} className="text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors">
                {t("ob2ChangeNumber")}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={`flex items-center rounded-2xl border px-3.5 bg-white/5 focus-within:border-brand-400 focus-within:bg-brand-500/10 transition-colors ${phoneError ? "border-red-400" : "border-white/10"}`}>
              <span className="text-slate-400 text-[15px] font-semibold pr-2 border-r border-white/10 mr-2.5">+91</span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                className="flex-1 bg-transparent py-3.5 text-[15px] text-slate-50 placeholder-slate-500 outline-none"
                placeholder={t("ob2MobilePlaceholder")}
                value={data.phoneNumber}
                onChange={(e) => { update({ phoneNumber: e.target.value.replace(/\D/g, "").slice(0, 10) }); if (phoneError) setPhoneError(null); }}
                disabled={otpStage === "sent"}
              />
              {otpStage === "idle" && (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={sendingOtp}
                  className="shrink-0 text-[13px] font-extrabold text-brand-300 hover:text-brand-200 transition-colors disabled:opacity-50 py-2"
                >
                  {sendingOtp ? "…" : t("ob2SendOtp")}
                </button>
              )}
            </div>
            {phoneError && <FieldError>{phoneError}</FieldError>}

            {otpStage === "sent" && (
              <div className="mt-3">
                <p className="text-xs text-slate-400 mb-2">{t("ob2OtpSentTo", { phone: data.phoneNumber })}</p>
                <div className="flex gap-2.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className={`flex-1 rounded-2xl border px-3.5 py-3.5 text-[15px] tracking-[0.3em] text-slate-50 placeholder-slate-500 bg-white/5 outline-none transition-colors focus:border-brand-400 focus:bg-brand-500/10 ${otpError ? "border-red-400" : "border-white/10"}`}
                    placeholder={t("ob2OtpPlaceholder")}
                    value={otpCode}
                    onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); if (otpError) setOtpError(null); }}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={verifyingOtp || otpCode.length !== 6}
                    className="shrink-0 px-5 rounded-2xl font-extrabold text-[14px] text-white bg-brand-600 hover:bg-brand-700 transition-colors disabled:opacity-50"
                  >
                    {verifyingOtp ? "…" : t("ob2VerifyOtp")}
                  </button>
                </div>
                {otpError && <FieldError>{otpError}</FieldError>}
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={resendCooldown > 0 || sendingOtp}
                  className="mt-2 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40"
                >
                  {resendCooldown > 0 ? `${t("ob2ResendOtp")} (${resendCooldown}s)` : t("ob2ResendOtp")}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Profile photo */}
      <div className="mb-5">
        <SectionLabel required>{t("ob2PhotoLabel")}</SectionLabel>
        <div className="flex items-center gap-3.5">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
            {data.profilePic ? (
              // eslint-disable-next-line @next/next/no-img-element -- Storage download URLs aren't in next/image's remote-pattern allowlist for this app yet
              <img src={data.profilePic} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl">🧑‍🏫</span>
            )}
          </div>
          <div className="flex-1">
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/jpg" className="hidden" onChange={handlePhotoSelect} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoUploading}
                className="text-[13px] font-extrabold text-brand-300 hover:text-brand-200 transition-colors disabled:opacity-50"
              >
                {photoUploading ? t("ob4Uploading") : data.profilePic ? t("ob2PhotoChange") : t("ob2PhotoUpload")}
              </button>
              {data.profilePic && !photoUploading && (
                <button type="button" onClick={handleRemovePhoto} className="text-[13px] font-bold text-slate-500 hover:text-red-300 transition-colors">
                  {t("ob2PhotoRemove")}
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">{t("ob2PhotoHint")}</p>
            {photoError && <FieldError>{photoError}</FieldError>}
          </div>
        </div>
      </div>

      <div className="mb-5">
        <SectionLabel required>{t("ob2PinCodeLabel")}</SectionLabel>
        <div className={`flex items-center rounded-2xl border px-3.5 bg-white/5 focus-within:border-brand-400 focus-within:bg-brand-500/10 transition-colors ${pinError ? "border-red-400" : "border-white/10"}`}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={data.pinCode}
            onChange={(e) => handlePinCodeChange(e.target.value)}
            placeholder={t("ob2PinCodePlaceholder")}
            className="flex-1 bg-transparent py-3.5 text-[15px] text-slate-50 placeholder-slate-500 outline-none"
          />
          {pinFetching && <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-brand-400 animate-spin shrink-0" />}
        </div>
        {pinFetching && <p className="mt-1.5 ml-0.5 text-xs text-slate-500">{t("ob2PinCodeFetching")}</p>}
        {pinError && <FieldError>{pinError}</FieldError>}
      </div>

      <TextField
        id="ob2-city"
        label={t("ob2CityLabel")}
        required
        value={data.city}
        onChange={(v) => { update({ city: v }); if (cityError) setCityError(null); }}
        placeholder={t("ob2CityPlaceholder")}
        list="ob2-city-options"
        error={cityError}
      />
      <datalist id="ob2-city-options">
        {COMMON_INDIAN_CITIES.map((c) => <option key={c} value={c} />)}
      </datalist>

      <div className="mb-5">
        <SectionLabel required>{t("ob2StateLabel")}</SectionLabel>
        <select
          value={data.state}
          onChange={(e) => { update({ state: e.target.value }); if (stateError) setStateError(null); }}
          className={`w-full rounded-2xl border px-3.5 py-3.5 text-[15px] bg-white/5 outline-none transition-colors focus:border-brand-400 focus:bg-brand-500/10 ${
            data.state ? "text-slate-50" : "text-slate-500"
          } ${stateError ? "border-red-400" : "border-white/10"}`}
        >
          <option value="" className="bg-[#0B1226]">{t("ob2StatePlaceholder")}</option>
          {INDIAN_STATES.map((s) => <option key={s} value={s} className="bg-[#0B1226] text-slate-50">{s}</option>)}
        </select>
        {stateError && <FieldError>{stateError}</FieldError>}
      </div>

      <div className="mb-6">
        <SectionLabel required>{t("ob2GenderLabel")}</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {GENDER_OPTIONS.map((g) => (
            <Chip key={g.value} active={data.gender === g.value} onClick={() => { update({ gender: g.value }); setGenderError(null); }}>
              {g.label}
            </Chip>
          ))}
        </div>
        {genderError && <FieldError>{genderError}</FieldError>}
      </div>

      <PrimaryButton onClick={validateAndContinue} disabled={saving || !canContinue} loading={saving}>
        {t("onboardingContinue")} →
      </PrimaryButton>
      <TextLink onClick={onSaveLater} disabled={saving}>{t("onboardingSaveLater")}</TextLink>
    </div>
  );
}

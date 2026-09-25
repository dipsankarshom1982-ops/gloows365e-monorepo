// apps/tutor-mobile/components/onboarding/Step2BasicInfo.tsx
// Mirrors apps/tutor/src/components/onboarding/Step2BasicInfo.tsx —
// name, mobile+OTP, photo, PIN code (city/state auto-fetch), gender.
// Every field on this step is mandatory. See ../../app/(auth)/
// onboarding.tsx's header for the overall flow.
//
// Photo upload uses expo-document-picker (already installed, already
// this app's established Storage-upload pattern — see
// app/(app)/verification.tsx) filtered to images, rather than adding
// expo-image-picker. That means gallery/file selection only, no camera
// capture — a disclosed scoping simplification, not an oversight; add
// expo-image-picker later if camera capture is actually needed.
//
// OTP verification is a fully interactive UI STUB, not real Firebase
// Phone Auth — same reasoning as ./login.tsx's Google Sign-In stub.
// Any 6-digit code is accepted as "correct" after a simulated delay.

import { useEffect, useRef, useState } from "react";
import { Image, Text, TextInput, TouchableOpacity, View, StyleSheet, ActivityIndicator } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "@/lib/firebase";
import {
  INDIAN_STATES, GENDER_OPTIONS,
} from "@/lib/onboardingOptions";
import type { OnboardingData } from "@/lib/onboardingTypes";
import {
  Chip, FieldError, PrimaryButton, SectionLabel, SelectField, TextField, TextLink,
} from "./OnboardingUI";

const PHONE_RE = /^[6-9]\d{9}$/;
const PIN_RE = /^\d{6}$/;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

type Props = {
  uid: string;
  data: OnboardingData;
  update: (patch: Partial<OnboardingData>) => void;
  onContinue: () => void;
  onSaveLater: () => void;
  saving: boolean;
  t: (k: string, o?: any) => string;
};

export default function Step2BasicInfo({ uid, data, update, onContinue, onSaveLater, saving, t }: Props) {
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [genderError, setGenderError] = useState<string | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);

  const [pinError, setPinError] = useState<string | null>(null);
  const [pinFetching, setPinFetching] = useState(false);
  const pinFetchToken = useRef(0);

  const [otpStage, setOtpStage] = useState<"idle" | "sent">("idle");
  const [otpCode, setOtpCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  function handleSendOtp() {
    if (!PHONE_RE.test(data.phoneNumber.trim())) {
      setPhoneError(t("ob2InvalidPhoneError"));
      return;
    }
    setPhoneError(null);
    setOtpError(null);
    setSendingOtp(true);
    // Stub — see file header. Real integration point: Firebase Phone Auth
    // signInWithPhoneNumber(auth, `+91${data.phoneNumber}`, ...).
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
      update({ phoneVerified: true }); // stub accepts any 6-digit code
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
    if (!PIN_RE.test(pin)) return;

    const token = ++pinFetchToken.current;
    setPinFetching(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const json = await res.json();
      if (token !== pinFetchToken.current) return;
      const postOffice = json?.[0]?.PostOffice?.[0];
      if (json?.[0]?.Status === "Success" && postOffice) {
        update({ city: postOffice.District ?? postOffice.Name ?? "", state: postOffice.State ?? "" });
      } else {
        setPinError(t("ob2PinCodeNotFound"));
      }
    } catch {
      if (token === pinFetchToken.current) setPinError(t("ob2PinCodeNotFound"));
    } finally {
      if (token === pinFetchToken.current) setPinFetching(false);
    }
  }

  async function handlePickPhoto() {
    const result = await DocumentPicker.getDocumentAsync({ type: ["image/*"], multiple: false });
    if (result.canceled || !result.assets?.[0]) return;
    const file = result.assets[0];
    if ((file.size ?? 0) > MAX_PHOTO_BYTES) {
      setPhotoError(t("ob2PhotoTooLargeError"));
      return;
    }
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const storagePath = `tutorDocuments/${uid}/profilePhoto_${Date.now()}_${file.name}`;
      const response = await fetch(file.uri);
      const blob = await response.blob();
      await uploadBytes(ref(storage, storagePath), blob);
      const url = await getDownloadURL(ref(storage, storagePath));
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
    try { await deleteObject(ref(storage, url)); } catch { /* best-effort */ }
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
    <View>
      <Text style={styles.title}>{t("ob2Title")}</Text>
      <Text style={styles.subtitle}>{t("ob2Subtitle")}</Text>

      <TextField
        label={t("ob2FullNameLabel")}
        required
        value={data.name}
        onChangeText={(v) => { update({ name: v.slice(0, 100) }); if (nameError) setNameError(null); }}
        placeholder={t("ob2FullNamePlaceholder")}
        error={nameError}
      />

      {/* Mobile + OTP */}
      <View style={styles.fieldWrap}>
        <SectionLabel required>{t("ob2MobileLabel")}</SectionLabel>
        {data.phoneVerified ? (
          <View style={styles.verifiedBox}>
            <Text style={styles.verifiedPhone}>+91 {data.phoneNumber}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={styles.verifiedBadgeRow}>
                <View style={styles.verifiedCheck}><Text style={styles.verifiedCheckText}>✓</Text></View>
                <Text style={styles.verifiedText}>{t("ob2Verified")}</Text>
              </View>
              <TouchableOpacity onPress={handleChangeNumber}>
                <Text style={styles.changeNumberText}>{t("ob2ChangeNumber")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <View style={[styles.phoneBox, phoneError && styles.inputError]}>
              <Text style={styles.phonePrefix}>+91</Text>
              <TextInput
                style={styles.phoneInput}
                keyboardType="number-pad"
                maxLength={10}
                placeholder={t("ob2MobilePlaceholder")}
                placeholderTextColor="#5B6478"
                value={data.phoneNumber}
                onChangeText={(v) => { update({ phoneNumber: v.replace(/\D/g, "").slice(0, 10) }); if (phoneError) setPhoneError(null); }}
                editable={otpStage !== "sent"}
              />
              {otpStage === "idle" && (
                <TouchableOpacity onPress={handleSendOtp} disabled={sendingOtp}>
                  <Text style={styles.sendOtpText}>{sendingOtp ? "…" : t("ob2SendOtp")}</Text>
                </TouchableOpacity>
              )}
            </View>
            {phoneError && <FieldError>{phoneError}</FieldError>}

            {otpStage === "sent" && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.otpSentText}>{t("ob2OtpSentTo", { phone: data.phoneNumber })}</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TextInput
                    style={[styles.otpInput, otpError && styles.inputError]}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder={t("ob2OtpPlaceholder")}
                    placeholderTextColor="#5B6478"
                    value={otpCode}
                    onChangeText={(v) => { setOtpCode(v.replace(/\D/g, "").slice(0, 6)); if (otpError) setOtpError(null); }}
                  />
                  <TouchableOpacity
                    style={[styles.verifyBtn, (verifyingOtp || otpCode.length !== 6) && { opacity: 0.5 }]}
                    onPress={handleVerifyOtp}
                    disabled={verifyingOtp || otpCode.length !== 6}
                  >
                    <Text style={styles.verifyBtnText}>{verifyingOtp ? "…" : t("ob2VerifyOtp")}</Text>
                  </TouchableOpacity>
                </View>
                {otpError && <FieldError>{otpError}</FieldError>}
                <TouchableOpacity onPress={handleSendOtp} disabled={resendCooldown > 0 || sendingOtp} style={{ marginTop: 8 }}>
                  <Text style={styles.resendText}>
                    {resendCooldown > 0 ? `${t("ob2ResendOtp")} (${resendCooldown}s)` : t("ob2ResendOtp")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      {/* Profile photo */}
      <View style={styles.fieldWrap}>
        <SectionLabel required>{t("ob2PhotoLabel")}</SectionLabel>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={styles.photoCircle}>
            {data.profilePic ? (
              <Image source={{ uri: data.profilePic }} style={styles.photoImage} />
            ) : (
              <Text style={{ fontSize: 24 }}>🧑‍🏫</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", gap: 14 }}>
              <TouchableOpacity onPress={handlePickPhoto} disabled={photoUploading}>
                <Text style={styles.photoActionText}>
                  {photoUploading ? t("ob4Uploading") : data.profilePic ? t("ob2PhotoChange") : t("ob2PhotoUpload")}
                </Text>
              </TouchableOpacity>
              {!!data.profilePic && !photoUploading && (
                <TouchableOpacity onPress={handleRemovePhoto}>
                  <Text style={styles.photoRemoveText}>{t("ob2PhotoRemove")}</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.photoHint}>{t("ob2PhotoHint")}</Text>
            {photoError && <FieldError>{photoError}</FieldError>}
          </View>
        </View>
      </View>

      {/* PIN code */}
      <View style={styles.fieldWrap}>
        <SectionLabel required>{t("ob2PinCodeLabel")}</SectionLabel>
        <View style={[styles.pinBox, pinError && styles.inputError]}>
          <TextInput
            style={styles.pinInput}
            keyboardType="number-pad"
            maxLength={6}
            placeholder={t("ob2PinCodePlaceholder")}
            placeholderTextColor="#5B6478"
            value={data.pinCode}
            onChangeText={handlePinCodeChange}
          />
          {pinFetching && <ActivityIndicator size="small" color="#818CF8" />}
        </View>
        {pinFetching && <Text style={styles.hint}>{t("ob2PinCodeFetching")}</Text>}
        {pinError && <FieldError>{pinError}</FieldError>}
      </View>

      <TextField
        label={t("ob2CityLabel")}
        required
        value={data.city}
        onChangeText={(v) => { update({ city: v }); if (cityError) setCityError(null); }}
        placeholder={t("ob2CityPlaceholder")}
        error={cityError}
      />

      <SelectField
        label={t("ob2StateLabel")}
        required
        value={data.state}
        options={INDIAN_STATES}
        onSelect={(v) => { update({ state: v }); setStateError(null); }}
        placeholder={t("ob2StatePlaceholder")}
      />
      {stateError && <FieldError>{stateError}</FieldError>}

      <View style={styles.fieldWrap}>
        <SectionLabel required>{t("ob2GenderLabel")}</SectionLabel>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {GENDER_OPTIONS.map((g) => (
            <Chip key={g.value} active={data.gender === g.value} onPress={() => { update({ gender: g.value }); setGenderError(null); }}>
              {g.label}
            </Chip>
          ))}
        </View>
        {genderError && <FieldError>{genderError}</FieldError>}
      </View>

      <PrimaryButton onPress={validateAndContinue} disabled={saving || !canContinue} loading={saving} loadingLabel={t("loading")} style={{ marginTop: 4 }}>
        {`${t("onboardingContinue")} →`}
      </PrimaryButton>
      <TextLink onPress={onSaveLater} disabled={saving}>{t("onboardingSaveLater")}</TextLink>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "800", color: "#F8FAFC", marginBottom: 6, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: "#94A3B8", marginBottom: 22, lineHeight: 20 },
  fieldWrap: { marginBottom: 16 },
  hint: { color: "#5B6478", fontSize: 12, marginTop: 6, marginLeft: 2 },
  inputError: { borderColor: "#F87171" },

  verifiedBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: "rgba(74,222,128,0.10)", borderWidth: 1, borderColor: "rgba(74,222,128,0.4)",
  },
  verifiedPhone: { color: "#F8FAFC", fontSize: 15, fontWeight: "600" },
  verifiedBadgeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  verifiedCheck: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#4ADE80", alignItems: "center", justifyContent: "center" },
  verifiedCheckText: { color: "#0B1226", fontSize: 10, fontWeight: "900" },
  verifiedText: { color: "#86EFAC", fontSize: 13, fontWeight: "700" },
  changeNumberText: { color: "#94A3B8", fontSize: 12, fontWeight: "700" },

  phoneBox: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 16, paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.10)",
  },
  phonePrefix: { color: "#94A3B8", fontSize: 15, fontWeight: "600", paddingRight: 8, marginRight: 10, borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.10)" },
  phoneInput: { flex: 1, color: "#F8FAFC", fontSize: 15, paddingVertical: 14 },
  sendOtpText: { color: "#A5B4FC", fontSize: 13, fontWeight: "800" },

  otpSentText: { color: "#94A3B8", fontSize: 12, marginBottom: 8 },
  otpInput: {
    flex: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, letterSpacing: 6,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.10)",
    color: "#F8FAFC", fontSize: 15,
  },
  verifyBtn: { paddingHorizontal: 20, borderRadius: 16, backgroundColor: "#4F46E5", alignItems: "center", justifyContent: "center" },
  verifyBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  resendText: { color: "#94A3B8", fontSize: 12, fontWeight: "700" },

  photoCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  photoImage: { width: "100%", height: "100%" },
  photoActionText: { color: "#A5B4FC", fontSize: 13, fontWeight: "800" },
  photoRemoveText: { color: "#64748B", fontSize: 13, fontWeight: "700" },
  photoHint: { color: "#5B6478", fontSize: 12, marginTop: 4 },

  pinBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 16, paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.10)",
  },
  pinInput: { flex: 1, color: "#F8FAFC", fontSize: 15, paddingVertical: 14 },
});

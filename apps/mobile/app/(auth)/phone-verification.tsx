// PATH: app/(auth)/phone-verification.tsx
//
// The existing phone/OTP verification flow, extracted out of what used to
// be inline inside (auth)/register.tsx and now shared with web via
// usePhoneOtpFlow() (packages/shared-logic/src/hooks/usePhoneOtpFlow.ts).
// Nothing about the underlying mechanism changed — same Firebase Phone
// Auth call, same secondary in-memory "phone-verify" app, same
// RecaptchaModal WebView verifier, same error messages. Only its entry
// point moved: it now launches from (auth)/parent-profile instead of being
// embedded in Student Registration.

import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getPhoneVerifyAuth, usePhoneOtpFlow } from "@gloows/shared-logic";

import { auth, db, firebaseConfig } from "@/lib/firebase";
import RecaptchaModal, { type RecaptchaVerifierHandle } from "@/components/auth/RecaptchaModal";

export default function PhoneVerification() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string }>();
  const recaptchaRef = useRef<RecaptchaVerifierHandle>(null);

  const otpFlow = usePhoneOtpFlow();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [sendError, setSendError] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (params.phone) { otpFlow.setPhone(String(params.phone)); return; }
    // Resumed directly (login / cold start) — use the number saved by Parent Profile.
    const user = auth.currentUser;
    if (!user) { router.replace("/login" as any); return; }
    getDoc(doc(db, "students", user.uid))
      .then((snap) => {
        const saved = snap.exists() ? snap.data()?.parentPhone : undefined;
        if (saved) otpFlow.setPhone(saved); else router.replace("/(auth)/parent-profile" as any);
      })
      .catch(() => router.replace("/(auth)/parent-profile" as any));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.phone]);

  const handleSend = async () => {
    setSendError("");
    let recaptchaToken: string;
    try {
      recaptchaToken = await recaptchaRef.current!.verify();
    } catch (e: any) {
      setSendError(e?.message === "Verification cancelled" ? "Verification cancelled." : "Verification check failed. Please check your internet connection and try again.");
      return;
    }
    const appVerifier = { type: "recaptcha", verify: async () => recaptchaToken };
    await otpFlow.sendOtp(getPhoneVerifyAuth(firebaseConfig as any), appVerifier as any);
  };

  // Auto-send once, on the render where the phone has actually landed in the
  // hook's state — sendOtp closes over `phone`, so firing it from the same
  // effect that calls setPhone would validate the previous (empty) value.
  useEffect(() => {
    if (otpFlow.phone && !startedRef.current) {
      startedRef.current = true;
      handleSend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpFlow.phone]);

  const saveVerified = async () => {
    const user = auth.currentUser;
    if (!user) return false;
    setSaving(true);
    setSaveError("");
    try {
      await setDoc(doc(db, "students", user.uid), {
        parentPhone: otpFlow.phone,
        parentPhoneVerified: true,
        onboardingStep: "phoneVerified",
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return true;
    } catch (e: any) {
      setSaveError(e?.message || "Failed to save verification. Please tap Continue to retry.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const savedRef = useRef(false);
  useEffect(() => {
    if (!otpFlow.verified) return;
    saveVerified().then((ok) => { savedRef.current = ok; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpFlow.verified]);

  const handleChangeNumber = () => {
    otpFlow.reset();
    router.back();
  };

  const handleContinue = async () => {
    if (!savedRef.current && !(await saveVerified())) return;
    router.replace("/(auth)/parent-permissions" as any);
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient colors={["#020617", "#1E1B4B", "#312E81"]} style={S.container}>
        <StatusBar barStyle="light-content" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={S.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {otpFlow.verified ? (
            <>
              <View style={S.successIcon}>
                <Ionicons name="checkmark-circle" size={72} color="#34D399" />
              </View>
              <Text style={S.title}>Mobile Number Verified</Text>
              {saveError ? <Text style={S.error}>{saveError}</Text> : null}
              <TouchableOpacity
                style={[S.button, saving && { opacity: 0.6 }]}
                onPress={handleContinue}
                disabled={saving}
              >
                <LinearGradient colors={["#6366F1", "#8B5CF6"]} style={S.buttonInner}>
                  {saving
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={S.buttonText}>Continue →</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={S.title}>Verify Your Mobile Number</Text>
              <Text style={S.subtitle}>
                We sent a 6-digit OTP to +91 {otpFlow.phone}.
              </Text>

              <TextInput
                style={S.otpInput}
                placeholder="______"
                placeholderTextColor="#555"
                keyboardType="number-pad"
                maxLength={6}
                value={otpFlow.otp}
                onChangeText={otpFlow.setOtp}
                textContentType="oneTimeCode"
                autoComplete={Platform.OS === "android" ? "sms-otp" : "one-time-code"}
              />

              {otpFlow.otpError || sendError ? <Text style={S.error}>{otpFlow.otpError || sendError}</Text> : null}

              <TouchableOpacity
                style={[S.button, otpFlow.verifyingOtp && { opacity: 0.6 }]}
                onPress={otpFlow.verifyOtp}
                disabled={otpFlow.verifyingOtp || otpFlow.otp.length !== 6}
              >
                <LinearGradient colors={["#6366F1", "#8B5CF6"]} style={S.buttonInner}>
                  {otpFlow.verifyingOtp
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={S.buttonText}>Verify OTP</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={S.linkBtn}
                onPress={handleSend}
                disabled={otpFlow.sendingOtp}
              >
                <Text style={S.linkText}>
                  {otpFlow.sendingOtp ? "Sending…" : "Resend OTP"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={S.linkBtn} onPress={handleChangeNumber}>
                <Text style={S.linkTextMuted}>Change Mobile Number</Text>
              </TouchableOpacity>
            </>
          )}

          <RecaptchaModal ref={recaptchaRef} firebaseConfig={firebaseConfig} />
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, maxWidth: 600, width: "100%", alignSelf: "center", paddingTop: 60, alignItems: "center" },
  successIcon: { marginBottom: 20 },
  title: { fontSize: 22, color: "#fff", fontWeight: "800", textAlign: "center", marginBottom: 10 },
  subtitle: { fontSize: 14, color: "#c7d2fe", textAlign: "center", marginBottom: 24 },
  otpInput: {
    backgroundColor: "rgba(255,255,255,0.06)", color: "#fff", width: "100%",
    padding: 16, borderRadius: 14, marginBottom: 12, textAlign: "center",
    fontSize: 24, letterSpacing: 12, fontWeight: "700",
  },
  error: { color: "#F87171", marginBottom: 12, textAlign: "center" },
  button: { marginTop: 8, borderRadius: 30, overflow: "hidden", width: "100%" },
  buttonInner: { paddingVertical: 16, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  linkBtn: { marginTop: 18, alignItems: "center" },
  linkText: { color: "#A5B4FC", fontWeight: "700", fontSize: 14 },
  linkTextMuted: { color: "#94a3b8", fontWeight: "600", fontSize: 13 },
});

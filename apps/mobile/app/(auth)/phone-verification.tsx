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
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
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

  useEffect(() => {
    if (params.phone) otpFlow.setPhone(String(params.phone));
    // Auto-send on arrival so the parent doesn't need an extra tap.
    if (params.phone) {
      handleSend(String(params.phone));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.phone]);

  const handleSend = async (phoneOverride?: string) => {
    const phoneAuth = getPhoneVerifyAuth(firebaseConfig as any);
    const recaptchaToken = await recaptchaRef.current!.verify();
    const appVerifier = { type: "recaptcha", verify: async () => recaptchaToken };
    await otpFlow.sendOtp(phoneAuth, appVerifier as any);
  };

  useEffect(() => {
    if (!otpFlow.verified) return;
    const user = auth.currentUser;
    if (!user) return;
    setSaving(true);
    setDoc(doc(db, "students", user.uid), {
      parentPhone: otpFlow.phone,
      parentPhoneVerified: true,
      onboardingStep: "phoneVerified",
      updatedAt: serverTimestamp(),
    }, { merge: true })
      .catch((e: any) => setSaveError(e?.message || "Failed to save verification. Please try Continue again."))
      .finally(() => setSaving(false));
  }, [otpFlow.verified]);

  const handleChangeNumber = () => {
    otpFlow.reset();
    router.back();
  };

  const handleContinue = () => {
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

              {otpFlow.otpError ? <Text style={S.error}>{otpFlow.otpError}</Text> : null}

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
                onPress={() => handleSend()}
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

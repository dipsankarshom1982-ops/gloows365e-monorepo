// apps/tutor-mobile/app/(auth)/register.tsx
// Step 1 of the Gloows Tutor signup flow — account creation only
// (email/password/confirm). Mirrors apps/tutor's simplified
// (auth)/register/page.tsx exactly: everything else — basic info,
// teaching profile, qualifications, document uploads — moved to the
// dedicated onboarding flow at ./onboarding.tsx (Step 2-5), started
// once this succeeds. See that file's header for the full flow.

import { useState } from "react";
import { router, Link } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { auth } from "@/lib/firebase";
import { Banner, BrandMark } from "@/components/onboarding/OnboardingUI";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LockGlyph({ color }: { color: string }) {
  return (
    <View style={styles.iconWrap} pointerEvents="none">
      <View style={[styles.lockShackle, { borderColor: color }]} />
      <View style={[styles.lockBody, { backgroundColor: color }]} />
    </View>
  );
}

function EyeGlyph({ passwordVisible, color }: { passwordVisible: boolean; color: string }) {
  return (
    <View style={styles.eyeGlyph} pointerEvents="none">
      <View style={[styles.eyeOuter, { borderColor: color }]}>
        <View style={[styles.eyePupil, { backgroundColor: color }]} />
      </View>
      {passwordVisible && <View style={[styles.eyeSlash, { backgroundColor: color }]} />}
    </View>
  );
}

export default function RegisterScreen() {
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

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
      // ./onboarding.tsx. No tutors/{uid} doc exists yet; onboarding
      // creates it once name/phone are collected.
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
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <LinearGradient colors={["#060A17", "#0B1226", "#111C3A"]} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <BrandMark />

            <Text style={styles.title}>{t("createAccountTitle")}</Text>
            <Text style={styles.subtitle}>{t("createAccountSubtitle")}</Text>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>{t("emailAddressLabel")}</Text>
              <View style={[styles.inputBox, focusedField === "email" && styles.inputBoxFocused]}>
                <Text style={[styles.atGlyph, focusedField === "email" && { color: "#A5B4FC" }]}>@</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t("emailPlaceholder")}
                  placeholderTextColor="#5B6478"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                  editable={!submitting}
                />
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>{t("passwordLabel")}</Text>
              <View style={[styles.inputBox, focusedField === "password" && styles.inputBoxFocused]}>
                <LockGlyph color={focusedField === "password" ? "#A5B4FC" : "#64748B"} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder={t("passwordPlaceholder")}
                  placeholderTextColor="#5B6478"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                  autoComplete="password-new"
                  editable={!submitting}
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={10} accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"}>
                  <EyeGlyph passwordVisible={showPassword} color="#8B93A7" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>{t("confirmPasswordLabel")}</Text>
              <View style={[styles.inputBox, focusedField === "confirm" && styles.inputBoxFocused]}>
                <LockGlyph color={focusedField === "confirm" ? "#A5B4FC" : "#64748B"} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder={t("confirmPasswordPlaceholder")}
                  placeholderTextColor="#5B6478"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={() => setFocusedField("confirm")}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showConfirm}
                  textContentType="newPassword"
                  autoComplete="password-new"
                  editable={!submitting}
                  returnKeyType="go"
                  onSubmitEditing={handleCreateAccount}
                />
                <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} hitSlop={10} accessibilityRole="button" accessibilityLabel={showConfirm ? "Hide password" : "Show password"}>
                  <EyeGlyph passwordVisible={showConfirm} color="#8B93A7" />
                </TouchableOpacity>
              </View>
            </View>

            {errorMessage && <Banner tone="error">{errorMessage}</Banner>}

            <TouchableOpacity style={[styles.primaryButton, submitting && { opacity: 0.7 }]} onPress={handleCreateAccount} disabled={submitting} activeOpacity={0.88}>
              <LinearGradient colors={["#4F46E5", "#6366F1", "#22D3EE"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryButtonInner}>
                {submitting ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.primaryButtonText}>{t("creatingAccount")}</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryButtonText}>{t("continue")} →</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>{t("alreadyHaveAccount")}</Text>
              <Link href="/login"><Text style={styles.footerLink}>{t("loginLink")}</Text></Link>
            </View>
          </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#060A17" },
  scrollContent: { flexGrow: 1, padding: 22, paddingTop: 8, paddingBottom: 32 },

  title:    { fontSize: 24, fontWeight: "800", color: "#F8FAFC", marginBottom: 6, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: "#94A3B8", marginBottom: 24, lineHeight: 20 },

  fieldWrap: { marginBottom: 16 },
  label: { color: "#A5ADC9", fontSize: 13, fontWeight: "700", marginBottom: 8, letterSpacing: 0.2 },
  inputBox: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 16, paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.10)",
  },
  inputBoxFocused: { borderColor: "#818CF8", backgroundColor: "rgba(99,102,241,0.08)" },
  input: { flex: 1, color: "#F8FAFC", fontSize: 15, fontWeight: "500", paddingVertical: 14, marginLeft: 2 },
  atGlyph: { fontSize: 17, fontWeight: "800", marginRight: 10, width: 18, textAlign: "center", color: "#64748B" },

  iconWrap: { width: 18, alignItems: "center", marginRight: 10 },
  lockShackle: { width: 9, height: 7, borderWidth: 1.6, borderBottomWidth: 0, borderTopLeftRadius: 5, borderTopRightRadius: 5, marginBottom: -1 },
  lockBody: { width: 15, height: 10, borderRadius: 3 },
  eyeGlyph: { width: 22, height: 16, alignItems: "center", justifyContent: "center" },
  eyeOuter: { width: 20, height: 13, borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  eyePupil: { width: 5, height: 5, borderRadius: 3 },
  eyeSlash: { position: "absolute", width: 22, height: 1.6, transform: [{ rotate: "45deg" }] },

  primaryButton: { borderRadius: 18, overflow: "hidden", height: 54, justifyContent: "center", shadowColor: "#6366F1", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 5 },
  primaryButtonInner: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  primaryButtonText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.3 },

  footerRow: { flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 22 },
  footerText: { color: "#94A3B8", fontSize: 13.5 },
  footerLink: { color: "#22D3EE", fontSize: 13.5, fontWeight: "800" },
});

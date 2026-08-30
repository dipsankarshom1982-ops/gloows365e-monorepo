// apps/tutor-mobile/app/(auth)/login.tsx
// Premium 2026-edtech-grade redesign of the Gloows Tutor login screen.
// Keeps this app's dark navy/blue brand identity (packages/tutor-ui's
// slate-900/brand-indigo palette) but raises the bar on hierarchy,
// validation, accessibility and polish — comparable to a modern fintech/
// edtech login rather than the earlier bare-minimum form.
//
// Deliberately introduces NO new native dependency: apps/tutor-mobile/
// app/_layout.tsx already documents that this app's screens use emoji/
// hand-built glyphs instead of @expo/vector-icons ("one less asset
// dependency for a foundation phase") — the lock/eye icons below follow
// that same convention with small View-built glyphs instead of emoji,
// for a cleaner monochrome look, rather than pulling in an icon library.
// Same reasoning for skipping react-native-reanimated (not installed
// here, unlike apps/mobile): the one entrance animation uses RN's
// built-in Animated API, as apps/tutor-mobile/(auth)/welcome.tsx already
// does. "Continue with Google" reuses apps/mobile's precedent of a
// styled "G" circle (no real Google logo asset) but isn't wired to real
// OAuth yet — that needs expo-auth-session + expo-web-browser (also not
// installed here) plus Google Cloud OAuth client IDs, same prerequisite
// apps/mobile's own login.tsx documents. Tapping it surfaces a clear
// "not set up yet" message instead of silently doing nothing.

import { useEffect, useRef, useState } from "react";
import { Link, router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { useTutorProfile } from "@gloows/shared-logic";
import { auth } from "@/lib/firebase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Hand-built glyphs (no icon-library dependency — see file header) ────────

function LockGlyph({ color }: { color: string }) {
  return (
    <View style={styles.lockGlyph} pointerEvents="none">
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

// ── Brand mark — matches apps/tutor-mobile's (auth)/welcome.tsx exactly,
// scaled down for a login screen (item 1: "do not leave excessive empty
// space at the top"), plus a small "TUTOR" badge as the brand label. ──────
function BrandMark() {
  return (
    <View style={styles.brandRow}>
      <View style={styles.logoWrap}>
        <Text style={styles.gloows}>
          <Text style={{ color: "#A5B4FC" }}>Gl</Text>
          <Text style={{ color: "#F1F5F9" }}>oows</Text>
        </Text>
        <LinearGradient
          colors={["#6366F1", "#8B5CF6", "#22D3EE"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.pill}
        >
          <Text style={styles.pillText}>365</Text>
        </LinearGradient>
        <Text style={styles.eTag}>E</Text>
      </View>
      <View style={styles.tutorBadge}>
        <Text style={styles.tutorBadgeText}>TUTOR</Text>
      </View>
    </View>
  );
}

type BannerTone = "error" | "success" | "info";

// NOTE: BANNER_STYLES is defined after `styles` at the bottom of this file
// (it reads styles.banner_error etc. at module-init time, unlike the
// components above which only read `styles` lazily at render time — so
// it has to come after StyleSheet.create actually runs).
function Banner({ tone, children }: { tone: BannerTone; children: string }) {
  const toneStyle = BANNER_STYLES[tone];
  return (
    <View style={[styles.banner, toneStyle.box]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View style={[styles.bannerBadge, toneStyle.badge]}>
        <Text style={styles.bannerBadgeText}>{toneStyle.glyph}</Text>
      </View>
      <Text style={[styles.bannerText, toneStyle.text]}>{children}</Text>
    </View>
  );
}

export default function LoginScreen() {
  const { t } = useTranslation();
  const { user, authLoading, tutorProfile, profileLoading } = useTutorProfile();

  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [pwFocused, setPwFocused]       = useState(false);
  const [formMessage, setFormMessage]   = useState<{ tone: BannerTone; text: string } | null>(null);

  const passwordInputRef = useRef<TextInput>(null);
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [fadeIn]);

  // Requirement: an already-authenticated tutor should never see this
  // screen (deep link, back-navigation, etc.) — mirrors app/index.tsx's
  // own root-level redirect as a second line of defense, including
  // sending an onboarding-incomplete tutor to /onboarding rather than
  // /dashboard.
  useEffect(() => {
    if (authLoading || (user && profileLoading)) return;
    if (user) router.replace(tutorProfile?.onboardingCompleted ? "/dashboard" : "/onboarding");
  }, [authLoading, user, profileLoading, tutorProfile]);

  if (authLoading || user) {
    return (
      <LinearGradient colors={["#060A17", "#0B1226", "#111C3A"]} style={styles.loadingScreen}>
        <ActivityIndicator color="#818CF8" size="large" />
      </LinearGradient>
    );
  }

  const emailValid = EMAIL_RE.test(email.trim());
  const emailError = emailTouched && email.length > 0 && !emailValid ? t("invalidEmailError") : null;
  const canSubmit = emailValid && password.length > 0 && !submitting;

  async function handleLogin() {
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

  // expo-auth-session / expo-web-browser aren't installed in this app yet
  // (see file header) — surface an honest status instead of a dead tap.
  function handleGooglePress() {
    setGoogleLoading(true);
    setFormMessage({ tone: "info", text: t("googleNotConfigured") });
    setTimeout(() => setGoogleLoading(false), 400);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <LinearGradient colors={["#060A17", "#0B1226", "#111C3A"]} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={{ opacity: fadeIn }}>
              <BrandMark />

              <Text style={styles.title}>{t("loginWelcomeTitle")}</Text>
              <Text style={styles.subtitle}>{t("loginWelcomeSubtitle")}</Text>

              {/* Email */}
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>{t("emailAddressLabel")}</Text>
                <View style={[
                  styles.inputBox,
                  emailFocused && styles.inputBoxFocused,
                  emailError && styles.inputBoxError,
                ]}>
                  <Text style={[styles.inputGlyph, { color: emailFocused ? "#A5B4FC" : "#64748B" }]}>@</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t("emailPlaceholder")}
                    placeholderTextColor="#5B6478"
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => { setEmailFocused(false); setEmailTouched(true); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    autoComplete="email"
                    importantForAutofill="yes"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                    accessibilityLabel={t("emailAddressLabel")}
                    accessibilityState={{ disabled: submitting }}
                  />
                </View>
                {emailError && (
                  <Text style={styles.fieldError} accessibilityRole="alert">{emailError}</Text>
                )}
              </View>

              {/* Password */}
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>{t("passwordLabel")}</Text>
                <View style={[styles.inputBox, pwFocused && styles.inputBoxFocused]}>
                  <LockGlyph color={pwFocused ? "#A5B4FC" : "#64748B"} />
                  <TextInput
                    ref={passwordInputRef}
                    style={[styles.input, { flex: 1 }]}
                    placeholder={t("passwordPlaceholder")}
                    placeholderTextColor="#5B6478"
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setPwFocused(true)}
                    onBlur={() => setPwFocused(false)}
                    secureTextEntry={!showPassword}
                    textContentType="password"
                    autoComplete="password"
                    importantForAutofill="yes"
                    returnKeyType="go"
                    onSubmitEditing={handleLogin}
                    accessibilityLabel={t("passwordLabel")}
                    accessibilityState={{ disabled: submitting }}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  >
                    <EyeGlyph passwordVisible={showPassword} color="#8B93A7" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Forgot password — right-aligned */}
              <TouchableOpacity
                onPress={handleForgotPassword}
                style={styles.forgotWrap}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={styles.forgotText}>{t("forgotPassword")}</Text>
              </TouchableOpacity>

              {formMessage && <Banner tone={formMessage.tone}>{formMessage.text}</Banner>}

              {/* Primary CTA */}
              <TouchableOpacity
                style={[styles.button, !canSubmit && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={!canSubmit}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmit, busy: submitting }}
              >
                <LinearGradient
                  colors={canSubmit ? ["#4F46E5", "#6366F1", "#22D3EE"] : ["#334155", "#334155"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.buttonInner}
                >
                  {submitting ? (
                    <View style={styles.buttonContent}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={styles.buttonText}>{t("signingIn")}</Text>
                    </View>
                  ) : (
                    <Text style={styles.buttonText}>{t("signInButton")} →</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t("orDivider")}</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google */}
              <TouchableOpacity
                style={styles.googleBtn}
                onPress={handleGooglePress}
                disabled={googleLoading}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t("continueWithGoogle")}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color="#1e293b" />
                ) : (
                  <>
                    <View style={styles.googleIconCircle}>
                      <Text style={styles.googleIcon}>G</Text>
                    </View>
                    <Text style={styles.googleBtnText}>{t("continueWithGoogle")}</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Registration */}
              <View style={styles.footerRow}>
                <Text style={styles.footerText}>{t("newToGloowsTutor")}</Text>
                <Link href="/register">
                  <Text style={styles.footerLink}>{t("createAccount")}</Text>
                </Link>
              </View>

              {/* Security reassurance */}
              <Text style={styles.securityNote}>{t("secureLoginNote")}</Text>
            </Animated.View>
          </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#060A17" },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { flexGrow: 1, padding: 22, paddingTop: 8, paddingBottom: 32 },

  // ── Brand ──
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6, marginBottom: 22 },
  logoWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  gloows:   { fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  pill:     { borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2, justifyContent: "center", alignItems: "center" },
  pillText: { color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 0.3 },
  eTag:     { fontSize: 10, fontWeight: "900", color: "#FBBF24" },
  tutorBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "rgba(99,102,241,0.16)", borderWidth: 1, borderColor: "rgba(99,102,241,0.4)" },
  tutorBadgeText: { color: "#A5B4FC", fontSize: 10, fontWeight: "800", letterSpacing: 1 },

  // ── Heading ──
  title:    { fontSize: 26, fontWeight: "800", color: "#F8FAFC", marginBottom: 6, letterSpacing: -0.3 },
  subtitle: { fontSize: 14.5, color: "#94A3B8", marginBottom: 26, lineHeight: 20 },

  // ── Fields ──
  fieldWrap: { marginBottom: 16 },
  label: { color: "#A5ADC9", fontSize: 13, fontWeight: "700", marginBottom: 8, letterSpacing: 0.2 },
  inputBox: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 16, paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.10)",
  },
  inputBoxFocused: { borderColor: "#818CF8", backgroundColor: "rgba(99,102,241,0.08)" },
  inputBoxError: { borderColor: "#F87171" },
  inputGlyph: { fontSize: 17, fontWeight: "800", marginRight: 10, width: 18, textAlign: "center" },
  input: { flex: 1, color: "#F8FAFC", fontSize: 15, fontWeight: "500", paddingVertical: 14, marginLeft: 2 },
  fieldError: { color: "#FCA5A5", fontSize: 12, fontWeight: "600", marginTop: 6, marginLeft: 2 },

  // ── Hand-built glyphs ──
  lockGlyph: { width: 18, alignItems: "center", marginRight: 10 },
  lockShackle: { width: 9, height: 7, borderWidth: 1.6, borderBottomWidth: 0, borderTopLeftRadius: 5, borderTopRightRadius: 5, marginBottom: -1 },
  lockBody: { width: 15, height: 10, borderRadius: 3 },
  eyeGlyph: { width: 22, height: 16, alignItems: "center", justifyContent: "center" },
  eyeOuter: { width: 20, height: 13, borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  eyePupil: { width: 5, height: 5, borderRadius: 3 },
  eyeSlash: { position: "absolute", width: 22, height: 1.6, transform: [{ rotate: "45deg" }] },

  // ── Forgot password ──
  forgotWrap: { alignSelf: "flex-end", marginBottom: 6, paddingVertical: 4 },
  forgotText: { color: "#A78BFA", fontSize: 13.5, fontWeight: "700" },

  // ── Banners ──
  banner: { flexDirection: "row", alignItems: "flex-start", gap: 9, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, marginTop: 6, marginBottom: 8 },
  banner_error:   { backgroundColor: "rgba(248,113,113,0.10)", borderLeftWidth: 3, borderLeftColor: "#F87171" },
  banner_success: { backgroundColor: "rgba(74,222,128,0.10)", borderLeftWidth: 3, borderLeftColor: "#4ADE80" },
  banner_info:    { backgroundColor: "rgba(129,140,248,0.10)", borderLeftWidth: 3, borderLeftColor: "#818CF8" },
  bannerBadge: { width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 1 },
  bannerBadge_error:   { backgroundColor: "#F87171" },
  bannerBadge_success: { backgroundColor: "#4ADE80" },
  bannerBadge_info:    { backgroundColor: "#818CF8" },
  bannerBadgeText: { color: "#0B1226", fontSize: 10, fontWeight: "900" },
  bannerText: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  bannerText_error:   { color: "#FCA5A5" },
  bannerText_success: { color: "#86EFAC" },
  bannerText_info:    { color: "#C7D2FE" },

  // ── Primary CTA ──
  button: {
    borderRadius: 18, overflow: "hidden", height: 54, justifyContent: "center",
    marginTop: 4, shadowColor: "#6366F1", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 5,
  },
  buttonDisabled: { shadowOpacity: 0 },
  buttonInner: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  buttonContent: { flexDirection: "row", alignItems: "center", gap: 10 },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.3 },

  // ── Divider ──
  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 22, marginBottom: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.10)" },
  dividerText: { color: "#64748B", fontSize: 11.5, fontWeight: "700", letterSpacing: 1 },

  // ── Google ──
  googleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    height: 54, borderRadius: 16, gap: 10,
    backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "rgba(15,23,42,0.08)",
  },
  googleIconCircle: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  googleIcon: { fontSize: 16, fontWeight: "900", color: "#4285F4" },
  googleBtnText: { fontSize: 15, fontWeight: "700", color: "#1E293B" },

  // ── Registration + footer ──
  footerRow: { flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 24 },
  footerText: { color: "#94A3B8", fontSize: 13.5 },
  footerLink: { color: "#22D3EE", fontSize: 13.5, fontWeight: "800" },

  securityNote: { textAlign: "center", color: "#5B6478", fontSize: 12, marginTop: 22 },
});

const BANNER_STYLES: Record<BannerTone, { box: object; badge: object; text: object; glyph: string }> = {
  error:   { box: styles.banner_error,   badge: styles.bannerBadge_error,   text: styles.bannerText_error,   glyph: "!" },
  success: { box: styles.banner_success, badge: styles.bannerBadge_success, text: styles.bannerText_success, glyph: "✓" },
  info:    { box: styles.banner_info,    badge: styles.bannerBadge_info,    text: styles.bannerText_info,    glyph: "i" },
};

import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { auth, db } from "@/lib/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

// Required once per app for the OAuth redirect to close the in-app browser
// correctly after Google hands control back. Expo's own docs put this at
// module scope (not inside the component) — safe to call multiple times.
WebBrowser.maybeCompleteAuthSession();

// Simple, permissive format check — mirrors the web login's equivalent.
// Not a substitute for Firebase's own validation (auth/invalid-email still
// fires if this somehow lets something bad through); it just gives instant
// inline feedback instead of a round trip for the common "missing @" typo.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Ambient glow — the signature element ─────────────────────────────────────
// A slow-breathing aurora behind the logo. Echoes the "🚀" launch energy of the
// tagline without competing with the content in front of it.
function AmbientGlow({ reduceMotion }: { reduceMotion: boolean }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return; // static glow — no looping animation
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3400 }),
        withTiming(0, { duration: 3400 })
      ),
      -1,
      true
    );
  }, [reduceMotion]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0.5 : 0.45 + pulse.value * 0.25,
    transform: [{ scale: reduceMotion ? 1 : 1 + pulse.value * 0.08 }],
  }));

  return (
    <View style={S.glowWrap} pointerEvents="none">
      <Animated.View style={[S.glowCircle, S.glowIndigo, glowStyle]} />
      <Animated.View style={[S.glowCircle, S.glowPink, glowStyle]} />
    </View>
  );
}

// ── Official Google "G" mark — matches web login's GoogleIcon exactly ───────
function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <Path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
      <Path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <Path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
    </Svg>
  );
}

// ── Brand logo — matches header.tsx ──────────────────────────────────────────
function BrandLogo() {
  return (
    <View style={S.logoWrap}>
      <Text style={S.gloows}>
        <Text style={{ color: "#A5B4FC" }}>Gl</Text>
        <Text style={{ color: "#F1F5F9" }}>oows</Text>
      </Text>
      <LinearGradient
        colors={["#6366F1", "#8B5CF6", "#EC4899"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={S.pill}
      >
        <Text style={S.pillText}>365</Text>
      </LinearGradient>
      <Text style={S.eTag}>E</Text>
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [secure,   setSecure]   = useState(true);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [message,  setMessage]  = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [pwFocused,    setPwFocused]    = useState(false);

  // Inline field-level validation — separate from the submit-time `error`
  // banner above, so a bad email format is pointed at directly under the
  // field it belongs to instead of a generic alert.
  const [emailError, setEmailError] = useState("");

  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    AsyncStorage.getItem("lastEmail").then((saved) => {
      if (saved) setEmail(saved);
    });
  }, []);

  const [googleLoading, setGoogleLoading] = useState(false);

  // ── Google Sign-In ─────────────────────────────────────────────────────
  // expo-auth-session's Google provider — works in Expo Go (via the proxy)
  // and standalone/EAS builds alike, unlike the native @react-native-
  // google-signin/google-signin package which requires a custom dev client.
  // Needs three OAuth client IDs from Google Cloud Console (see the iOS/
  // Android/Web client setup notes in this PR) — set as EXPO_PUBLIC_ env
  // vars, same convention as EXPO_PUBLIC_FIREBASE_* in lib/firebase.ts.
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    iosClientId:     process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId:     process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (googleResponse?.type === "success") {
      finishGoogleSignIn(googleResponse.authentication?.idToken);
    } else if (googleResponse?.type === "error") {
      setGoogleLoading(false);
      setError("Google sign-in failed. Please try again.");
    } else if (googleResponse?.type === "cancel" || googleResponse?.type === "dismiss") {
      // User backed out of the picker — not an error worth showing,
      // mirrors web's handling of auth/popup-closed-by-user.
      setGoogleLoading(false);
    }
  }, [googleResponse]);

  // Mirrors apps/web/src/app/(auth)/login/page.tsx's handleGoogleSignIn:
  // exchange the Google ID token for a Firebase credential, bootstrap a
  // users/{uid} doc for brand-new Google users (same fields web's signup/
  // login writes), then route the same way handleLogin already does below.
  const finishGoogleSignIn = async (idToken?: string) => {
    if (!idToken) {
      setGoogleLoading(false);
      setError("Google sign-in failed. Please try again.");
      return;
    }
    try {
      setError("");
      setMessage("");

      const credential = GoogleAuthProvider.credential(idToken);
      const userCred = await signInWithCredential(auth, credential);
      const user = userCred.user;

      if (user.email) await AsyncStorage.setItem("lastEmail", user.email);

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        // FIX (bug report — VCoins consistency): removed a `vCoins: 0`
        // write here. That field belongs exclusively to the Daily Streak
        // Quiz Cloud Function (claimVCoinReward) — nothing else should
        // write to it, even as an ostensibly-harmless default. The real
        // signup bonus is credited via creditVCoins() in register.tsx,
        // into vCoinsBalance, which is what every balance display reads.
        await setDoc(userRef, {
          role: "student",
          roles: ["student"],
          email: user.email ?? "",
          name: user.displayName ?? "",
          photoURL: user.photoURL ?? "",
          signupPlatform: "mobile",
          createdAt: serverTimestamp(),
        }, { merge: true });
      }

      const studentSnap = await getDoc(doc(db, "students", user.uid));
      if (!studentSnap.exists() || !studentSnap.data()?.onboardingComplete) {
        setMessage("Redirecting to complete your profile...");
        setTimeout(() => router.replace("/(auth)/register" as any), 500);
        return;
      }

      setMessage("Login successful!");
      setTimeout(() => router.replace("/(drawer)/(tabs)/home" as any), 500);
    } catch (err: any) {
      if (err.code === "auth/account-exists-with-different-credential") {
        setError("This email is already registered with a password. Please log in with email & password instead.");
      } else if (err.code === "auth/network-request-failed") {
        setError("Unable to connect. Please check your internet connection and try again.");
      } else {
        setError(err.message || "Google sign-in failed. Try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGooglePress = () => {
    // expo-auth-session builds a request even with a blank client ID (an
    // empty string is technically a valid prop value), so a missing
    // EXPO_PUBLIC_GOOGLE_*_CLIENT_ID env var doesn't fail until Google's
    // OAuth server rejects the request — surfacing as an opaque "Google
    // sign-in failed" with no clue why. Catching it here up front turns
    // that into an actionable message instead.
    const platformClientId = Platform.select({
      android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      ios:     process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      default: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });
    if (!platformClientId) {
      setError("Google Sign-In isn't configured for this build yet. Please use email & password, or contact support.");
      return;
    }
    setGoogleLoading(true);
    promptGoogleAsync().catch(() => {
      setGoogleLoading(false);
      setError("Couldn't open Google sign-in. Please try again.");
    });
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password.trim()) {
      setError("Please enter email and password");
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setMessage("");
      setEmailError("");

      const userCred = await signInWithEmailAndPassword(auth, trimmedEmail, password.trim());
      await AsyncStorage.setItem("lastEmail", trimmedEmail);
      const snap = await getDoc(doc(db, "students", userCred.user.uid));

      if (!snap.exists() || !snap.data()?.onboardingComplete) {
        setMessage("Redirecting to complete your profile...");
        setTimeout(() => router.replace("/(auth)/register" as any), 500);
        return;
      }

      setMessage("Login successful!");
      setTimeout(() => router.replace("/(drawer)/(tabs)/home" as any), 500);
    } catch (err: any) {
      switch (err.code) {
        case "auth/user-not-found":        setError("Account not found. Please sign up first."); break;
        case "auth/wrong-password":
        case "auth/invalid-credential":    setError("The email or password you entered is incorrect."); break;
        case "auth/invalid-email":         setError("Invalid email format"); break;
        case "auth/user-disabled":         setError("Account has been disabled"); break;
        case "auth/network-request-failed": setError("Unable to connect. Please check your internet connection and try again."); break;
        default: setError(err.message || "Login failed. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || googleLoading;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <LinearGradient colors={["#05030F", "#150C35", "#1E1B4B"]} style={{ flex: 1 }}>
          <StatusBar barStyle="light-content" />

          <AmbientGlow reduceMotion={reduceMotion} />

          <ScrollView
            contentContainerStyle={S.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Brand header — logo + tagline, kept compact ── */}
            <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(450).springify()}>
              <BrandLogo />
              <Text style={S.tagline}>Learn • Compete • Earn 🚀</Text>
            </Animated.View>

            {/* ── Login card — the elevated glass surface everything lives on ── */}
            <Animated.View
              style={S.card}
              entering={reduceMotion ? undefined : FadeInUp.duration(450).delay(80).springify()}
            >
              <Text style={S.cardHeading}>Welcome back! 👋</Text>
              <Text style={S.cardSubtitle}>Continue your learning journey and unlock new achievements.</Text>

              {/* Google Sign-In */}
              <TouchableOpacity
                style={[S.googleBtn, (!googleRequest || busy) && S.googleBtnDisabled]}
                onPress={handleGooglePress}
                disabled={!googleRequest || busy}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
                accessibilityState={{ disabled: !googleRequest || busy, busy: googleLoading }}
              >
                {googleLoading ? (
                  <>
                    <ActivityIndicator size="small" color="#1e293b" />
                    <Text style={S.googleBtnText}>Connecting to Google…</Text>
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    <Text style={S.googleBtnText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={S.divider}>
                <View style={S.dividerLine} />
                <Text style={S.dividerText}>OR CONTINUE WITH EMAIL</Text>
                <View style={S.dividerLine} />
              </View>

              {/* Email */}
              <View style={S.inputWrapper}>
                <Text style={S.label}>Email Address</Text>
                <View style={[S.inputBox, emailFocused && S.inputBoxFocused, emailError && S.inputBoxError]}>
                  <Ionicons name="mail-outline" size={18} color={emailFocused ? "#A5B4FC" : "#64748B"} style={S.inputIcon} />
                  <TextInput
                    placeholder="Enter your email"
                    placeholderTextColor="#5B6478"
                    style={S.input}
                    value={email}
                    onChangeText={(t) => { setEmail(t); if (emailError) setEmailError(""); }}
                    onBlur={() => {
                      setEmailFocused(false);
                      const trimmed = email.trim().toLowerCase();
                      if (trimmed !== email) setEmail(trimmed);
                      if (trimmed && !EMAIL_RE.test(trimmed)) setEmailError("Please enter a valid email address");
                    }}
                    onFocus={() => setEmailFocused(true)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    editable={!busy}
                    accessibilityLabel="Email address"
                  />
                </View>
                {emailError ? <Text style={S.fieldError}>{emailError}</Text> : null}
              </View>

              {/* Password */}
              <View style={S.inputWrapper}>
                <Text style={S.label}>Password</Text>
                <View style={[S.inputBox, pwFocused && S.inputBoxFocused]}>
                  <Ionicons name="lock-closed-outline" size={18} color={pwFocused ? "#A5B4FC" : "#64748B"} style={S.inputIcon} />
                  <TextInput
                    ref={passwordRef}
                    placeholder="Enter your password"
                    placeholderTextColor="#5B6478"
                    secureTextEntry={secure}
                    style={[S.input, { flex: 1 }]}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setPwFocused(true)}
                    onBlur={() => setPwFocused(false)}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    editable={!busy}
                    accessibilityLabel="Password"
                  />
                  <TouchableOpacity
                    onPress={() => setSecure(!secure)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={secure ? "Show password" : "Hide password"}
                  >
                    <Ionicons name={secure ? "eye-outline" : "eye-off-outline"} size={19} color="#8B93A7" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Forgot password — right-aligned, plain accent link */}
              <TouchableOpacity
                style={S.forgotButton}
                onPress={() =>
                  router.push({ pathname: "/password-reset", params: { email: email.trim() } } as any)
                }
                hitSlop={8}
                accessibilityRole="link"
                accessibilityLabel="Forgot password"
              >
                <Text style={S.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              {error   ? (
                <View style={S.alertBox} accessibilityRole="alert">
                  <Ionicons name="alert-circle" size={16} color="#FF6B6B" />
                  <Text style={S.error}>{error}</Text>
                </View>
              ) : null}
              {message ? (
                <View style={[S.alertBox, S.alertBoxSuccess]} accessibilityRole="alert">
                  <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
                  <Text style={S.success}>{message}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[S.button, (loading || googleLoading) && { opacity: 0.7 }]}
                onPress={handleLogin}
                disabled={busy}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Login"
                accessibilityState={{ disabled: busy, busy: loading }}
              >
                <LinearGradient colors={["#6366F1", "#8B5CF6", "#EC4899"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.buttonInner}>
                  {loading
                    ? (
                      <View style={S.buttonContent}>
                        <ActivityIndicator color="#fff" />
                        <Text style={S.buttonText}>Signing you in…</Text>
                      </View>
                    )
                    : (
                      <View style={S.buttonContent}>
                        <Text style={S.buttonText}>Login</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                      </View>
                    )
                  }
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/signup" as any)}
                accessibilityRole="link"
                accessibilityLabel="Sign up"
              >
                <Text style={S.footer}>
                  Don't have an account?{" "}
                  <Text style={S.link}>Sign up</Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Trust indicator */}
            <View style={S.trustRow}>
              <Ionicons name="lock-closed" size={12} color="#6B7280" />
              <Text style={S.trustText}>Secure access to your learning journey</Text>
            </View>
          </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 20, paddingVertical: 24 },

  // ── Ambient glow ──
  glowWrap:    { position: "absolute", top: 0, left: 0, right: 0, height: 420, alignItems: "center", justifyContent: "flex-start" },
  glowCircle:  { position: "absolute", width: 280, height: 280, borderRadius: 200, top: 40 },
  glowIndigo:  { backgroundColor: "#6366F1", left: "12%" },
  glowPink:    { backgroundColor: "#EC4899", right: "8%", top: 90 },

  logoWrap:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  gloows:       { fontSize: 34, fontWeight: "900", letterSpacing: -0.5 },
  pill:         { borderRadius: 9, paddingHorizontal: 9, paddingVertical: 3, justifyContent: "center", alignItems: "center" },
  pillText:     { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
  eTag:         { fontSize: 13, fontWeight: "900", color: "#FBBF24", marginBottom: 12 },
  tagline:      { textAlign: "center", color: "#94A3B8", fontSize: 13, marginTop: 2, marginBottom: 18, letterSpacing: 0.2 },

  // ── Login card — the elevated glass surface everything lives on ──
  card: {
    backgroundColor: "rgba(255,255,255,0.055)",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.30,
    shadowRadius: 26,
    elevation: 10,
  },
  cardHeading:  { fontSize: 24, fontWeight: "800", color: "#fff", marginBottom: 6 },
  cardSubtitle: { fontSize: 14, color: "#A5ADC9", lineHeight: 20, marginBottom: 22 },

  googleBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderRadius: 16, paddingVertical: 15, minHeight: 54, gap: 10, marginBottom: 18, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 3 },
  googleBtnDisabled: { opacity: 0.6 },
  googleBtnText:{ fontSize: 15, fontWeight: "700", color: "#1e293b" },

  divider:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 22 },
  dividerLine:  { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.1)" },
  dividerText:  { color: "#6B7280", fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6 },

  inputWrapper: { marginBottom: 16 },
  label:        { color: "#A5ADC9", fontSize: 13, fontWeight: "600", marginBottom: 8, letterSpacing: 0.2 },
  inputBox:     { flexDirection: "row", alignItems: "center", borderRadius: 16, paddingHorizontal: 14, minHeight: 54, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)" },
  inputBoxFocused: { borderColor: "#8B5CF6", backgroundColor: "rgba(139,92,246,0.08)" },
  inputBoxError:   { borderColor: "#FF6B6B" },
  inputIcon:    { marginRight: 10 },
  input:        { flex: 1, color: "#fff", fontSize: 15, fontWeight: "500", paddingVertical: 14 },
  fieldError:   { color: "#FF8585", fontSize: 12, fontWeight: "600", marginTop: 6, marginLeft: 2 },

  forgotButton: { alignSelf: "flex-end", paddingVertical: 8, paddingHorizontal: 2, marginBottom: 18, marginTop: 2 },
  forgotText:   { color: "#A78BFA", fontSize: 13.5, fontWeight: "700" },

  alertBox:        { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: "rgba(255,107,107,0.1)", borderRadius: 12, borderLeftWidth: 3, borderLeftColor: "#FF6B6B" },
  alertBoxSuccess: { backgroundColor: "rgba(74,222,128,0.1)", borderLeftColor: "#4ADE80" },
  error:   { color: "#FF8585", fontSize: 13, fontWeight: "600", flex: 1 },
  success: { color: "#4ADE80", fontSize: 13, fontWeight: "600", flex: 1 },

  button:      { borderRadius: 18, overflow: "hidden", marginTop: 4, shadowColor: "#8B5CF6", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 6 },
  buttonInner: { paddingVertical: 17, minHeight: 56, alignItems: "center", justifyContent: "center", borderRadius: 18 },
  buttonContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  buttonText:  { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.5 },

  footer: { color: "#A5ADC9", textAlign: "center", marginTop: 22, fontSize: 14 },
  link:   { color: "#FBBF24", fontWeight: "700", fontSize: 14 },

  trustRow:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 18 },
  trustText: { color: "#6B7280", fontSize: 12, fontWeight: "500" },
});

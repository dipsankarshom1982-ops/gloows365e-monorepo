import { auth, db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithCredential,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PRIVACY_POLICY_VERSION } from "@/app/privacy";
import { resolveOnboardingRoute } from "@gloows/shared-logic";

// Required once per app for the OAuth redirect to close the in-app browser
// correctly — see login.tsx, which already does this at module scope. Safe
// to call again here; Expo's own docs note it's idempotent.
WebBrowser.maybeCompleteAuthSession();

const PERKS = [
  { icon: "🏆", label: "Skill Battles" },
  { icon: "🤖", label: "AI Tutor" },
  { icon: "🪙", label: "200 Free Coins" },
];

// Mirrors login.tsx's routing constants — needed here too so an existing
// restart-education user who taps "Continue with Google" on Signup still
// lands somewhere sensible instead of being forced into student
// registration.
const RESTART_TYPES = ["restartEducation", "restart_education", "restart"];
const RESTART_INDICATOR_FIELDS = ["lastClassPassed", "educationGapReason", "currentOccupation"];

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: "", color: "#334155" };
  let score = 0;
  if (password.length >= 6)       score++;
  if (password.length >= 10)      score++;
  if (/[A-Z]/.test(password))     score++;
  if (/[0-9]/.test(password))     score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { score: 1, label: "Weak",   color: "#EF4444" };
  if (score === 2) return { score: 2, label: "Fair",   color: "#F97316" };
  if (score === 3) return { score: 3, label: "Good",   color: "#EAB308" };
  return            { score: 4, label: "Strong", color: "#22C55E" };
}

export default function Signup() {
  const router = useRouter();

  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [googleLoading,   setGoogleLoading]   = useState(false);
  const [error,           setError]           = useState("");
  const [agreedToPolicy,  setAgreedToPolicy]  = useState(false);

  const strength        = getPasswordStrength(password);
  const passwordsMatch  = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const validate = (normalizedEmail: string) => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim())
      return "All fields are required";
    if (!/\S+@\S+\.\S+/.test(normalizedEmail)) return "Invalid email format";
    if (password.length < 6)      return "Password must be at least 6 characters";
    if (password !== confirmPassword) return "Passwords do not match";
    if (!agreedToPolicy) return "Please agree to the Privacy Policy to continue";
    return null;
  };

  // ── Google Sign-In — real popup/auth-session flow (was a placeholder
  // Alert: "Google sign-in is available in the full app build...") ──
  // Mirrors login.tsx's implementation exactly — same three OAuth client
  // IDs, same credential exchange, same first-time-user bootstrap — so
  // Signup's Google button actually works instead of dead-ending.
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    iosClientId:     process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId:     process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (googleResponse?.type === "success") {
      finishGoogleSignup(googleResponse.authentication?.idToken);
    } else if (googleResponse?.type === "error") {
      setGoogleLoading(false);
      setError("Google sign-in failed. Please try again.");
    } else if (googleResponse?.type === "cancel" || googleResponse?.type === "dismiss") {
      setGoogleLoading(false);
    }
  }, [googleResponse]);

  const finishGoogleSignup = async (idToken?: string) => {
    if (!idToken) {
      setGoogleLoading(false);
      setError("Google sign-in failed. Please try again.");
      return;
    }
    try {
      setError("");

      const credential = GoogleAuthProvider.credential(idToken);
      const userCred = await signInWithCredential(auth, credential);
      const user = userCred.user;

      if (user.email) await AsyncStorage.setItem("lastEmail", user.email);

      // Existing restart-education account → send them to their own flow
      // instead of forcing student registration.
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const d = userSnap.data();
        const profileType = d?.profileType as string | undefined;
        const hasRestartFields = RESTART_INDICATOR_FIELDS.some((f) => f in d);
        if ((profileType && RESTART_TYPES.includes(profileType)) || hasRestartFields) {
          router.replace((d?.onboardingComplete ? "/restart-education/home" : "/restart-education/onboarding") as any);
          return;
        }
      }

      // Existing fully-registered student → Signup isn't the right screen
      // for them.
      const studentSnap = await getDoc(doc(db, "students", user.uid));
      if (studentSnap.exists() && studentSnap.data()?.onboardingComplete) {
        router.replace("/(drawer)/(tabs)/home" as any);
        return;
      }

      // Brand-new Google user (or one who started but never finished
      // registration) → write the same starter docs the email/password
      // path writes below, then registration is mandatory.
      await setDoc(doc(db, "students", user.uid), {
        email: user.email ?? "",
        role: "student",
        onboardingComplete: false,
        // Don't rewind a returning user who already got further.
        ...(studentSnap.data()?.onboardingStep ? {} : { onboardingStep: "accountCreated" }),
        createdAt: serverTimestamp(),
      }, { merge: true });
      await setDoc(userRef, {
        role: "student",
        roles: ["student"],
        email: user.email ?? "",
        name: user.displayName ?? "",
        photoURL: user.photoURL ?? "",
        signupPlatform: "mobile",
        createdAt: serverTimestamp(),
        consent: {
          policyAccepted: true,
          policyVersion: PRIVACY_POLICY_VERSION,
          acceptedAt: serverTimestamp(),
        },
      }, { merge: true });

      const nextRoute = resolveOnboardingRoute({
        ...(studentSnap.exists() ? studentSnap.data() : {}),
        onboardingStep: studentSnap.data()?.onboardingStep ?? "accountCreated",
      });
      router.replace((nextRoute === "student-registration" ? "/(auth)/register" : `/(auth)/${nextRoute}`) as any);
    } catch (err: any) {
      if (err.code === "auth/account-exists-with-different-credential") {
        setError("This email is already registered with a password. Please log in with email & password instead.");
      } else {
        setError(err.message || "Google sign-in failed. Try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGooglePress = () => {
    if (!agreedToPolicy) {
      setError("Please agree to the Privacy Policy to continue");
      return;
    }
    // See login.tsx's handleGooglePress for why this check exists — a blank
    // EXPO_PUBLIC_GOOGLE_*_CLIENT_ID env var otherwise fails silently deep
    // inside the OAuth flow instead of here, with no actionable message.
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

  const handleSignup = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const err = validate(normalizedEmail);
    if (err) { setError(err); return; }

    let createdUser: any = null;
    try {
      setLoading(true);
      setError("");

      const userCred  = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const user      = userCred.user;
      createdUser     = user;

      // Best-effort — a parent's email being unreachable at this instant
      // (offline, transient SMTP hiccup) must never block account creation.
      // The soft-gate reminder banner (drawer header) and the "Resend
      // verification email" action in profile-settings cover the retry.
      try { await sendEmailVerification(user); } catch { /* non-fatal */ }

      await setDoc(doc(db, "students", user.uid), {
        email: user.email, role: "student",
        onboardingComplete: false, onboardingStep: "accountCreated",
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "users", user.uid), {
        role: "student", roles: ["student"],
        // FIX (bug report — "200 v-coins not updated"): removed a
        // `coins: 200` write here — a field nothing in the app reads. The
        // welcome bonus is credited exactly once, into vCoinsBalance via
        // creditVCoins(), when registration actually completes — see
        // app/(auth)/register.tsx.
        createdAt: serverTimestamp(),
        consent: {
          policyAccepted: true,
          policyVersion: PRIVACY_POLICY_VERSION,
          acceptedAt: serverTimestamp(),
        },
      }, { merge: true });

      router.replace("/(auth)/parent-profile" as any);
    } catch (err: any) {
      if (createdUser) {
        try { await deleteUser(createdUser); } catch { /* best-effort cleanup */ }
      }
      if (err.code === "auth/email-already-in-use") setError("Email already registered");
      else if (err.code === "auth/invalid-email")   setError("Invalid email");
      else if (err.code === "auth/weak-password")   setError("Weak password");
      else setError("Signup failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#020617" }}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <LinearGradient colors={["#020617", "#1E1B4B", "#312E81"]} style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView
              contentContainerStyle={S.container}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={S.logo}>🎓</Text>
              <Text style={S.brand}>
                <Text style={S.brandGl}>Gl</Text>
                <Text style={S.brandOows}>oows</Text>
                <Text style={S.brand365}>365</Text>
              </Text>
              <Text style={S.heading}>Create Account</Text>
              <Text style={S.subtitle}>Join 10,000+ students levelling up</Text>

              {/* Perks */}
              <View style={S.perksRow}>
                {PERKS.map((p) => (
                  <View key={p.label} style={S.perkItem}>
                    <Text style={S.perkIcon}>{p.icon}</Text>
                    <Text style={S.perkLabel}>{p.label}</Text>
                  </View>
                ))}
              </View>

              {/* Google Sign-In */}
              <TouchableOpacity
                style={[S.googleBtn, !googleRequest && S.googleBtnDisabled]}
                onPress={handleGooglePress}
                disabled={!googleRequest || googleLoading}
                activeOpacity={0.85}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color="#1e293b" />
                ) : (
                  <>
                    <Text style={S.googleIcon}>G</Text>
                    <Text style={S.googleBtnText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={S.divider}>
                <View style={S.dividerLine} />
                <Text style={S.dividerText}>or sign up with email</Text>
                <View style={S.dividerLine} />
              </View>

              {/* Email — this becomes the account's login credential, and
                  since most Class 3–12 students don't have their own email,
                  it's almost always a parent/guardian's address in practice.
                  Labelling it as such sets the right expectation, and the
                  verification link now sent on signup (below) makes it a
                  real, checkable claim rather than just wording. */}
              <View style={S.fieldGroup}>
                <Text style={S.label}>📧 Parent's Email</Text>
                <View style={S.inputBox}>
                  <TextInput
                    placeholder="Enter parent's email"
                    placeholderTextColor="#999"
                    style={S.input}
                    value={email}
                    onChangeText={(t) => { setEmail(t); if (error) setError(""); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Password */}
              <View style={S.fieldGroup}>
                <Text style={S.label}>🔐 Password</Text>
                <View style={S.inputBox}>
                  <View style={S.passwordRow}>
                    <TextInput
                      placeholder="Min. 6 characters"
                      placeholderTextColor="#999"
                      secureTextEntry={!showPassword}
                      style={[S.input, { flex: 1 }]}
                      value={password}
                      onChangeText={(t) => { setPassword(t); if (error) setError(""); }}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#888" />
                    </TouchableOpacity>
                  </View>
                </View>
                {password.length > 0 && (
                  <View style={S.strengthRow}>
                    <View style={S.strengthBars}>
                      {[1, 2, 3, 4].map((i) => (
                        <View
                          key={i}
                          style={[S.strengthBar, { backgroundColor: i <= strength.score ? strength.color : "#1e293b" }]}
                        />
                      ))}
                    </View>
                    <Text style={[S.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                  </View>
                )}
              </View>

              {/* Confirm password */}
              <View style={S.fieldGroup}>
                <Text style={S.label}>🔑 Confirm Password</Text>
                <View style={[S.inputBox, passwordsMatch && S.inputBoxValid, passwordsMismatch && S.inputBoxInvalid]}>
                  <View style={S.passwordRow}>
                    <TextInput
                      placeholder="Re-enter your password"
                      placeholderTextColor="#999"
                      secureTextEntry={!showConfirm}
                      style={[S.input, { flex: 1 }]}
                      value={confirmPassword}
                      onChangeText={(t) => { setConfirmPassword(t); if (error) setError(""); }}
                    />
                    <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                      <Ionicons name={showConfirm ? "eye-off" : "eye"} size={20} color="#888" />
                    </TouchableOpacity>
                  </View>
                </View>
                {passwordsMatch   && <Text style={S.matchHint}>✓ Passwords match</Text>}
                {passwordsMismatch && <Text style={S.mismatchHint}>✗ Passwords don't match</Text>}
              </View>

              {/* DPDP consent — required before any account can be created */}
              <TouchableOpacity
                style={S.consentRow}
                onPress={() => { setAgreedToPolicy((v) => !v); if (error) setError(""); }}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={agreedToPolicy ? "checkbox" : "square-outline"}
                  size={20}
                  color={agreedToPolicy ? "#8B5CF6" : "#c7d2fe"}
                />
                <Text style={S.consentText}>
                  I have read and agree to the{" "}
                  <Text style={S.link} onPress={() => router.push("/privacy" as any)}>
                    Privacy Policy
                  </Text>
                </Text>
              </TouchableOpacity>

              {error ? (
                <View style={S.errorBox}>
                  <Text style={S.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[S.button, loading && { opacity: 0.7 }]}
                onPress={handleSignup}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient colors={["#6366F1", "#8B5CF6"]} style={S.buttonInner}>
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={S.buttonText}>Create Account →</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push("/login" as any)}>
                <Text style={S.footer}>
                  Already have an account?{" "}
                  <Text style={S.link}>Login</Text>
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableWithoutFeedback>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container:    { flexGrow: 1, padding: 22, paddingBottom: 40, justifyContent: "center" },
  logo:         { fontSize: 56, textAlign: "center", marginBottom: 6 },
  brand:        { fontSize: 36, fontWeight: "900", color: "#fff", textAlign: "center", letterSpacing: 1 },
  brandGl:      { color: "#A5B4FC" },
  brandOows:    { color: "#F1F5F9" },
  brand365:     { color: "#818CF8" },
  heading:      { fontSize: 24, fontWeight: "800", color: "#fff", textAlign: "center", marginTop: 14 },
  subtitle:     { fontSize: 14, color: "#c7d2fe", textAlign: "center", marginTop: 6, marginBottom: 20 },

  perksRow:     { flexDirection: "row", justifyContent: "space-between", marginBottom: 20, gap: 8 },
  perkItem:     { flex: 1, alignItems: "center", backgroundColor: "rgba(99,102,241,0.12)", borderRadius: 14, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(99,102,241,0.3)" },
  perkIcon:     { fontSize: 22, marginBottom: 4 },
  perkLabel:    { fontSize: 10, color: "#c7d2fe", textAlign: "center", fontWeight: "600" },

  googleBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderRadius: 14, paddingVertical: 14, gap: 10, marginBottom: 16 },
  googleBtnDisabled: { opacity: 0.6 },
  googleIcon:   { fontSize: 18, fontWeight: "900", color: "#4285F4" },
  googleBtnText:{ fontSize: 15, fontWeight: "700", color: "#1e293b" },

  divider:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  dividerLine:  { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.1)" },
  dividerText:  { color: "#64748b", fontSize: 12 },

  fieldGroup:   { marginBottom: 18 },
  label:        { color: "#c7d2fe", fontSize: 13, fontWeight: "600", marginBottom: 8 },
  inputBox:     { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 15, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", overflow: "hidden" },
  inputBoxValid:{ borderColor: "rgba(34,197,94,0.55)" },
  inputBoxInvalid:{ borderColor: "rgba(239,68,68,0.55)" },
  input:        { color: "#fff", fontSize: 15, fontWeight: "500" },
  passwordRow:  { flexDirection: "row", alignItems: "center" },

  strengthRow:  { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 10 },
  strengthBars: { flexDirection: "row", flex: 1, gap: 4 },
  strengthBar:  { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel:{ fontSize: 12, fontWeight: "700", width: 46, textAlign: "right" },
  matchHint:    { color: "#22C55E", fontSize: 12, marginTop: 6, fontWeight: "600" },
  mismatchHint: { color: "#EF4444", fontSize: 12, marginTop: 6, fontWeight: "600" },

  consentRow:   { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  consentText:  { color: "#c7d2fe", fontSize: 13, flex: 1, lineHeight: 18 },
  errorBox:     { backgroundColor: "rgba(255,107,107,0.1)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderLeftWidth: 3, borderLeftColor: "#FF6B6B", marginBottom: 16 },
  errorText:    { color: "#FF6B6B", textAlign: "center", fontSize: 13, fontWeight: "600" },

  button:       { borderRadius: 30, overflow: "hidden", marginTop: 6 },
  buttonInner:  { paddingVertical: 16, alignItems: "center", borderRadius: 28 },
  buttonText:   { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.5 },

  footer:       { color: "#c7d2fe", textAlign: "center", marginTop: 24, fontSize: 14 },
  link:         { color: "#FFD700", fontWeight: "700" },
});

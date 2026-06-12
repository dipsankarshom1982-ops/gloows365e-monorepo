import { auth, db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

const PERKS = [
  { icon: "🏆", label: "Skill Battles" },
  { icon: "🤖", label: "AI Tutor" },
  { icon: "🪙", label: "200 Free Coins" },
];

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
  const [error,           setError]           = useState("");

  const strength        = getPasswordStrength(password);
  const passwordsMatch  = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const validate = (normalizedEmail: string) => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim())
      return "All fields are required";
    if (!/\S+@\S+\.\S+/.test(normalizedEmail)) return "Invalid email format";
    if (password.length < 6)      return "Password must be at least 6 characters";
    if (password !== confirmPassword) return "Passwords do not match";
    return null;
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

      await setDoc(doc(db, "students", user.uid), {
        email: user.email, role: "student",
        onboardingComplete: false, createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "users", user.uid), {
        role: "student", roles: ["student"], coins: 200, createdAt: serverTimestamp(),
      }, { merge: true });

      router.replace("/(auth)/register" as any);
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
              <Text style={S.brand}>Vidya<Text style={S.gold}>AI</Text></Text>
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
                style={S.googleBtn}
                onPress={() =>
                  Alert.alert(
                    "Google Sign-In",
                    "Google sign-in is available in the full app build. Please use email & password for now.",
                    [{ text: "OK" }]
                  )
                }
                activeOpacity={0.85}
              >
                <Text style={S.googleIcon}>G</Text>
                <Text style={S.googleBtnText}>Continue with Google</Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={S.divider}>
                <View style={S.dividerLine} />
                <Text style={S.dividerText}>or sign up with email</Text>
                <View style={S.dividerLine} />
              </View>

              {/* Email */}
              <View style={S.fieldGroup}>
                <Text style={S.label}>📧 Email</Text>
                <View style={S.inputBox}>
                  <TextInput
                    placeholder="Enter your email"
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
  gold:         { color: "#FFD700" },
  heading:      { fontSize: 24, fontWeight: "800", color: "#fff", textAlign: "center", marginTop: 14 },
  subtitle:     { fontSize: 14, color: "#c7d2fe", textAlign: "center", marginTop: 6, marginBottom: 20 },

  perksRow:     { flexDirection: "row", justifyContent: "space-between", marginBottom: 20, gap: 8 },
  perkItem:     { flex: 1, alignItems: "center", backgroundColor: "rgba(99,102,241,0.12)", borderRadius: 14, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(99,102,241,0.3)" },
  perkIcon:     { fontSize: 22, marginBottom: 4 },
  perkLabel:    { fontSize: 10, color: "#c7d2fe", textAlign: "center", fontWeight: "600" },

  googleBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderRadius: 14, paddingVertical: 14, gap: 10, marginBottom: 16 },
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

  errorBox:     { backgroundColor: "rgba(255,107,107,0.1)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderLeftWidth: 3, borderLeftColor: "#FF6B6B", marginBottom: 16 },
  errorText:    { color: "#FF6B6B", textAlign: "center", fontSize: 13, fontWeight: "600" },

  button:       { borderRadius: 30, overflow: "hidden", marginTop: 6 },
  buttonInner:  { paddingVertical: 16, alignItems: "center", borderRadius: 28 },
  buttonText:   { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.5 },

  footer:       { color: "#c7d2fe", textAlign: "center", marginTop: 24, fontSize: 14 },
  link:         { color: "#FFD700", fontWeight: "700" },
});

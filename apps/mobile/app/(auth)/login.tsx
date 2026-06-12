import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { auth, db } from "@/lib/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect } from "react";

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

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [secure,   setSecure]   = useState(true);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [message,  setMessage]  = useState("");

  useEffect(() => {
    AsyncStorage.getItem("lastEmail").then((saved) => {
      if (saved) setEmail(saved);
    });
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter email and password");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const userCred = await signInWithEmailAndPassword(auth, email.trim(), password.trim());
      const snap     = await getDoc(doc(db, "students", userCred.user.uid));

      if (!snap.exists() || !snap.data()?.onboardingComplete) {
        setMessage("Redirecting to complete your profile...");
        setTimeout(() => router.replace("/(auth)/register" as any), 500);
        return;
      }

      setMessage("Login successful!");
      setTimeout(() => router.replace("/(drawer)/(tabs)/home" as any), 500);
    } catch (err: any) {
      switch (err.code) {
        case "auth/user-not-found":     setError("Account not found. Please sign up first."); break;
        case "auth/wrong-password":     setError("Incorrect password"); break;
        case "auth/invalid-email":      setError("Invalid email format"); break;
        case "auth/invalid-credential": setError("Invalid email or password"); break;
        case "auth/user-disabled":      setError("Account has been disabled"); break;
        default: setError(err.message || "Login failed. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <LinearGradient colors={["#020617", "#1E1B4B", "#312E81"]} style={S.container}>
          <StatusBar barStyle="light-content" />

          <BrandLogo />
          <Text style={S.title}>Welcome Back 👋</Text>
          <Text style={S.subtitle}>Continue your learning journey</Text>

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
            <Text style={S.dividerText}>or login with email</Text>
            <View style={S.dividerLine} />
          </View>

          {/* Email */}
          <View style={S.inputWrapper}>
            <Text style={S.label}>📧 Email</Text>
            <View style={S.inputBox}>
              <TextInput
                placeholder="Enter your email"
                placeholderTextColor="#999"
                style={S.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
          </View>

          {/* Password */}
          <View style={S.inputWrapper}>
            <Text style={S.label}>🔐 Password</Text>
            <View style={S.inputBox}>
              <View style={S.passwordRow}>
                <TextInput
                  placeholder="Enter your password"
                  placeholderTextColor="#999"
                  secureTextEntry={secure}
                  style={[S.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setSecure(!secure)}>
                  <Text style={S.eye}>{secure ? "👁️‍🗨️" : "🙈"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Forgot password */}
          <TouchableOpacity
            style={S.forgotButton}
            onPress={() =>
              router.push({ pathname: "/password-reset", params: { email: email.trim() } } as any)
            }
          >
            <Text style={S.forgotText}>🔑 Forgot Password?</Text>
          </TouchableOpacity>

          {error   ? <Text style={S.error}>{error}</Text>     : null}
          {message ? <Text style={S.success}>{message}</Text> : null}

          <TouchableOpacity
            style={[S.button, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <LinearGradient colors={["#6366F1", "#8B5CF6"]} style={S.buttonInner}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={S.buttonText}>Login →</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/signup" as any)}>
            <Text style={S.footer}>
              Don't have an account?{" "}
              <Text style={S.link}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container:    { flex: 1, padding: 20, justifyContent: "center" },
  logoWrap:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginBottom: 4, marginTop: 20 },
  gloows:       { fontSize: 36, fontWeight: "900", letterSpacing: -0.5 },
  pill:         { borderRadius: 9, paddingHorizontal: 9, paddingVertical: 3, justifyContent: "center", alignItems: "center" },
  pillText:     { color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: 0.5 },
  eTag:         { fontSize: 14, fontWeight: "900", color: "#FBBF24", marginBottom: 14 },
  title:        { fontSize: 24, color: "#fff", textAlign: "center", marginTop: 10, fontWeight: "800" },
  subtitle:     { textAlign: "center", color: "#c7d2fe", marginBottom: 24, fontSize: 14, marginTop: 8 },

  googleBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderRadius: 14, paddingVertical: 14, gap: 10, marginBottom: 16 },
  googleIcon:   { fontSize: 18, fontWeight: "900", color: "#4285F4" },
  googleBtnText:{ fontSize: 15, fontWeight: "700", color: "#1e293b" },

  divider:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  dividerLine:  { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.1)" },
  dividerText:  { color: "#64748b", fontSize: 12 },

  inputWrapper: { marginBottom: 18 },
  label:        { color: "#c7d2fe", fontSize: 13, fontWeight: "600", marginBottom: 8 },
  inputBox:     { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 15, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", overflow: "hidden" },
  passwordRow:  { flexDirection: "row", alignItems: "center" },
  eye:          { fontSize: 18, color: "#aaa", marginLeft: 10 },
  input:        { color: "#fff", fontSize: 15, fontWeight: "500" },

  forgotButton: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "rgba(167,139,250,0.1)", borderWidth: 1, borderColor: "#A78BFA", marginBottom: 20, marginTop: 5 },
  forgotText:   { color: "#A78BFA", textAlign: "center", fontSize: 14, fontWeight: "600" },

  error:   { color: "#FF6B6B", textAlign: "center", marginBottom: 12, fontSize: 13, fontWeight: "600", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "rgba(255,107,107,0.1)", borderRadius: 10, borderLeftWidth: 3, borderLeftColor: "#FF6B6B" },
  success: { color: "#4ADE80", textAlign: "center", marginBottom: 12, fontSize: 13, fontWeight: "600", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "rgba(74,222,128,0.1)", borderRadius: 10, borderLeftWidth: 3, borderLeftColor: "#4ADE80" },

  button:      { borderRadius: 30, overflow: "hidden", marginTop: 10 },
  buttonInner: { paddingVertical: 16, alignItems: "center", borderRadius: 28 },
  buttonText:  { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.5 },

  footer: { color: "#c7d2fe", textAlign: "center", marginTop: 25, fontSize: 14 },
  link:   { color: "#FFD700", fontWeight: "700", fontSize: 14 },
});
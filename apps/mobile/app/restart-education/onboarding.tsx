// PATH: app/restart-education/onboarding.tsx

import { auth, db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const LAST_CLASS_OPTIONS = [
  "Class 5 or below", "Class 6", "Class 7", "Class 8",
  "Class 9", "Class 10 (Failed)", "Class 10 (Passed)",
  "Class 11", "Class 12 (Failed)", "Class 12 (Passed)",
  "Graduate (incomplete)", "Never attended school",
];

const OCCUPATION_OPTIONS = [
  "Currently unemployed",
  "Daily wage worker",
  "Working in family business",
  "Private job / employed",
  "Farming / agriculture",
  "Homemaker",
  "Other",
];

const GAP_REASONS = [
  "Financial difficulties",
  "Family responsibilities",
  "Marriage",
  "Health issues",
  "Had to start working",
  "School not available nearby",
  "Lost interest / motivation",
  "Other",
];

export default function RestartOnboarding() {
  const router = useRouter();

  const [lastClass,       setLastClass]       = useState("");
  const [occupation,      setOccupation]      = useState("");
  const [gapReason,       setGapReason]       = useState("");
  const [otherOccupation, setOtherOccupation] = useState("");
  const [otherReason,     setOtherReason]     = useState("");

  const [step,    setStep]    = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const handleComplete = async () => {
    if (!lastClass || !occupation || !gapReason) {
      setError("Please complete all selections.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const user = auth.currentUser;
      if (!user) {
        setError("Session expired. Please login again.");
        setLoading(false);
        return;
      }

      // Use setDoc with merge:true instead of updateDoc
      // This works even if the doc was partially written or missing fields
      await setDoc(doc(db, "users", user.uid), {
        lastClassPassed:    lastClass,
        currentOccupation:  occupation === "Other" ? (otherOccupation || "Other") : occupation,
        educationGapReason: gapReason  === "Other" ? (otherReason     || "Other") : gapReason,
        onboardingComplete: true,
        profileType:        "restartEducation",
        updatedAt:          serverTimestamp(),
      }, { merge: true });

      console.log("✅ Onboarding written to Firestore");

      // Navigate directly to restart home — do NOT go through index.tsx
      // Use push so the back stack is clean
      router.replace("/restart-education/home" as any);

    } catch (e: any) {
      console.log("❌ Onboarding write error:", e?.code, e?.message);
      setError(e.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient colors={["#0a0a1a", "#1a1040", "#0d2a1a"]} style={S.container}>
        <StatusBar barStyle="light-content" />

        {/* Header */}
        <View style={S.header}>
          <Text style={S.headerTitle}>🎓 Restart My Education</Text>
          <View style={S.stepRow}>
            {([1, 2, 3] as const).map((s) => (
              <View key={s} style={[S.stepDot, step >= s && S.stepDotActive]} />
            ))}
          </View>
          <Text style={S.stepLabel}>Step {step} of 3</Text>
        </View>

        <ScrollView
          contentContainerStyle={S.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Step 1: Last Class ── */}
          {step === 1 && (
            <View style={S.stepCard}>
              <Text style={S.question}>What was the last class you attended?</Text>
              <Text style={S.subQuestion}>This helps us find the right pathway for you</Text>
              <View style={S.optionsGrid}>
                {LAST_CLASS_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[S.optionChip, lastClass === opt && S.optionChipActive]}
                    onPress={() => setLastClass(opt)}
                  >
                    <Text style={[S.optionText, lastClass === opt && S.optionTextActive]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ── Step 2: Occupation ── */}
          {step === 2 && (
            <View style={S.stepCard}>
              <Text style={S.question}>What are you currently doing?</Text>
              <Text style={S.subQuestion}>No judgment — we're here to help everyone</Text>
              <View style={S.optionsList}>
                {OCCUPATION_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[S.optionRow, occupation === opt && S.optionRowActive]}
                    onPress={() => setOccupation(opt)}
                  >
                    <View style={[S.radio, occupation === opt && S.radioActive]}>
                      {occupation === opt && <View style={S.radioDot} />}
                    </View>
                    <Text style={[S.optionRowText, occupation === opt && S.optionTextActive]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {occupation === "Other" && (
                <TextInput
                  style={S.input}
                  placeholder="Please describe..."
                  placeholderTextColor="#6b7280"
                  value={otherOccupation}
                  onChangeText={setOtherOccupation}
                />
              )}
            </View>
          )}

          {/* ── Step 3: Gap Reason ── */}
          {step === 3 && (
            <View style={S.stepCard}>
              <Text style={S.question}>Why did you stop your education?</Text>
              <Text style={S.subQuestion}>
                Your story matters — understanding your situation helps us guide you better
              </Text>
              <View style={S.optionsList}>
                {GAP_REASONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[S.optionRow, gapReason === opt && S.optionRowActive]}
                    onPress={() => setGapReason(opt)}
                  >
                    <View style={[S.radio, gapReason === opt && S.radioActive]}>
                      {gapReason === opt && <View style={S.radioDot} />}
                    </View>
                    <Text style={[S.optionRowText, gapReason === opt && S.optionTextActive]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {gapReason === "Other" && (
                <TextInput
                  style={S.input}
                  placeholder="Please describe..."
                  placeholderTextColor="#6b7280"
                  value={otherReason}
                  onChangeText={setOtherReason}
                />
              )}
            </View>
          )}

          {error ? <Text style={S.error}>{error}</Text> : null}

          {/* Navigation buttons */}
          <View style={S.btnRow}>
            {step > 1 && (
              <TouchableOpacity
                style={S.backBtn}
                onPress={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              >
                <Ionicons name="chevron-back" size={20} color="#86efac" />
                <Text style={S.backBtnText}>Back</Text>
              </TouchableOpacity>
            )}

            {step < 3 ? (
              <TouchableOpacity
                style={[
                  S.nextBtn,
                  !(step === 1 ? lastClass : occupation) && { opacity: 0.4 },
                ]}
                onPress={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                disabled={!(step === 1 ? lastClass : occupation)}
              >
                <LinearGradient colors={["#16a34a", "#15803d"]} style={S.nextBtnGradient}>
                  <Text style={S.nextBtnText}>Next →</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[S.nextBtn, (!gapReason || loading) && { opacity: 0.4 }]}
                onPress={handleComplete}
                disabled={!gapReason || loading}
              >
                <LinearGradient colors={["#16a34a", "#15803d"]} style={S.nextBtnGradient}>
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={S.nextBtnText}>Let's Begin! 🚀</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container:    { flex: 1 },
  header:       { alignItems: "center", paddingTop: 20, paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle:  { color: "#4ade80", fontSize: 18, fontWeight: "800", marginBottom: 12 },
  stepRow:      { flexDirection: "row", gap: 8, marginBottom: 4 },
  stepDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.2)" },
  stepDotActive:{ backgroundColor: "#4ade80", width: 24 },
  stepLabel:    { color: "rgba(255,255,255,0.5)", fontSize: 12 },
  scroll:       { paddingHorizontal: 20, paddingTop: 8 },
  stepCard:     { marginBottom: 24 },
  question:     { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 6, lineHeight: 28 },
  subQuestion:  { color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 20, lineHeight: 19 },
  optionsGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionChip: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  optionChipActive: { backgroundColor: "rgba(22,163,74,0.25)", borderColor: "#4ade80" },
  optionText:       { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  optionTextActive: { color: "#4ade80", fontWeight: "700" },
  optionsList:  { gap: 10 },
  optionRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  optionRowActive:  { borderColor: "#4ade80", backgroundColor: "rgba(22,163,74,0.1)" },
  optionRowText:    { color: "rgba(255,255,255,0.8)", fontSize: 14, flex: 1 },
  radio:        { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" },
  radioActive:  { borderColor: "#4ade80" },
  radioDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: "#4ade80" },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)", padding: 14,
    borderRadius: 12, color: "#fff", marginTop: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  error:        { color: "#F87171", textAlign: "center", marginBottom: 12, fontSize: 13 },
  btnRow:       { flexDirection: "row", gap: 12, alignItems: "center" },
  backBtn:      { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 16, paddingHorizontal: 8 },
  backBtnText:  { color: "#86efac", fontSize: 14, fontWeight: "600" },
  nextBtn:      { flex: 1, borderRadius: 14, overflow: "hidden" },
  nextBtnGradient: { paddingVertical: 16, alignItems: "center" },
  nextBtnText:  { color: "#fff", fontSize: 16, fontWeight: "800" },
});

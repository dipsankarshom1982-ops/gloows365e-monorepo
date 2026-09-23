// PATH: app/(auth)/parent-profile.tsx
//
// First onboarding step after account creation. Collects the parent's name,
// relationship to the student, and mobile number, then hands off to
// (auth)/phone-verification for the actual OTP flow (extracted from what
// used to live inline inside (auth)/register.tsx). This screen never runs
// signInWithPhoneNumber itself — it only stages the phone number and, once
// phone-verification reports success back into Firestore, reflects the
// verified state here.

import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

const RELATIONSHIPS = ["Father", "Mother", "Guardian", "Other"] as const;

export default function ParentProfile() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [fullName, setFullName] = useState("");
  const [relationship, setRelationship] = useState<string>("");
  const [phone, setPhone] = useState("");

  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) { router.replace("/login" as any); return; }
      try {
        const snap = await getDoc(doc(db, "students", user.uid));
        const d = snap.exists() ? snap.data() : null;
        if (d) {
          if (d.parentGuardianName) setFullName(d.parentGuardianName);
          if (d.parentRelationship) setRelationship(d.parentRelationship);
          if (d.parentPhone) setPhone(d.parentPhone);
          if (d.parentPhoneVerified && d.parentPhone) setVerifiedPhone(d.parentPhone);
        }
      } catch { /* fall back to a blank form */ }
      setLoading(false);
    };
    load();
  }, []);

  const isVerified = verifiedPhone !== null && verifiedPhone === phone;

  const onPhoneChange = (t: string) => {
    setPhone(t.replace(/\D/g, "").slice(0, 10));
  };

  const handleVerify = async () => {
    if (!fullName.trim()) { setError("Please enter your full name"); return; }
    if (!relationship) { setError("Please select your relationship with the student"); return; }
    if (!/^[6-9]\d{9}$/.test(phone)) { setError("Enter a valid 10-digit mobile number"); return; }

    const user = auth.currentUser;
    if (!user) { setError("User not logged in. Please login first."); return; }

    setSaving(true);
    setError("");
    try {
      await setDoc(doc(db, "students", user.uid), {
        parentGuardianName: fullName.trim(),
        parentRelationship: relationship,
        parentPhone: phone,
        onboardingStep: "parentProfileCompleted",
        updatedAt: serverTimestamp(),
      }, { merge: true });
      router.push({ pathname: "/(auth)/phone-verification", params: { phone } } as any);
    } catch (e: any) {
      setError(e?.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = () => {
    router.replace("/(auth)/parent-permissions" as any);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <LinearGradient colors={["#020617", "#1E1B4B", "#312E81"]} style={S.loadingContainer}>
          <ActivityIndicator color="#fff" size="large" />
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient colors={["#020617", "#1E1B4B", "#312E81"]} style={S.container}>
        <StatusBar barStyle="light-content" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={S.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={S.brand}>
            <Text style={S.brandGl}>Gl</Text>
            <Text style={S.brandOows}>oows</Text>
            <Text style={S.brand365}>365</Text>
          </Text>
          <Text style={S.title}>Set Up Your Parent Profile 👨‍👩‍👧</Text>

          <Text style={S.label}>Full Name *</Text>
          <TextInput
            style={S.input}
            placeholder="Your full name"
            placeholderTextColor="#aaa"
            value={fullName}
            onChangeText={setFullName}
            editable={!isVerified}
          />

          <Text style={S.label}>Relationship with Student *</Text>
          <View style={S.row}>
            {RELATIONSHIPS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[S.chip, relationship === r && S.active]}
                onPress={() => !isVerified && setRelationship(r)}
                disabled={isVerified}
              >
                <Text style={S.chipText}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={S.label}>Mobile Number *</Text>
          <View style={S.phoneRow}>
            <Text style={S.prefix}>+91</Text>
            <TextInput
              style={[S.input, S.phoneInput]}
              placeholder="XXXXXXXXXX"
              placeholderTextColor="#aaa"
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={onPhoneChange}
              editable={!isVerified}
            />
          </View>

          {isVerified ? (
            <View style={S.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#34D399" />
              <Text style={S.verifiedText}>Verified</Text>
            </View>
          ) : null}

          {error ? <Text style={S.error}>{error}</Text> : null}

          {isVerified ? (
            <TouchableOpacity style={S.button} onPress={handleContinue}>
              <LinearGradient colors={["#6366F1", "#8B5CF6"]} style={S.buttonInner}>
                <Text style={S.buttonText}>Continue →</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[S.button, saving && { opacity: 0.6 }]}
              onPress={handleVerify}
              disabled={saving}
            >
              <LinearGradient colors={["#6366F1", "#8B5CF6"]} style={S.buttonInner}>
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={S.buttonText}>Verify Mobile Number</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { padding: 20, maxWidth: 600, width: "100%", alignSelf: "center", paddingBottom: 40 },
  brand: { fontSize: 34, fontWeight: "900", color: "#fff", textAlign: "center" },
  brandGl: { color: "#A5B4FC" },
  brandOows: { color: "#F1F5F9" },
  brand365: { color: "#818CF8" },
  title: { fontSize: 20, color: "#c7d2fe", textAlign: "center", marginBottom: 24 },
  label: { color: "#c7d2fe", marginTop: 10, marginBottom: 6, fontWeight: "600" },
  input: { backgroundColor: "rgba(255,255,255,0.06)", padding: 14, borderRadius: 14, marginBottom: 12, color: "#fff" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#555" },
  active: { backgroundColor: "#6366F1", borderColor: "#6366F1" },
  chipText: { color: "#fff", fontSize: 13 },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  prefix: { color: "#c7d2fe", fontWeight: "700", fontSize: 16 },
  phoneInput: { flex: 1, marginBottom: 0 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10 },
  verifiedText: { color: "#34D399", fontWeight: "700", fontSize: 13 },
  error: { color: "#F87171", marginTop: 14, textAlign: "center" },
  button: { marginTop: 24, borderRadius: 30, overflow: "hidden" },
  buttonInner: { paddingVertical: 16, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

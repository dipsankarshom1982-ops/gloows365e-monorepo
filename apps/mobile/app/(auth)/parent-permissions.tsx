// PATH: app/(auth)/parent-permissions.tsx
//
// Final onboarding step before Student Registration. Replaces the single
// "I am the parent/guardian... I consent" checkbox that used to live inside
// (auth)/register.tsx with an explicit Yes/No answer per permission, plus
// separate Yes/No affirmations for Terms & Conditions and Privacy Policy
// (both clickable, linking to /terms and /privacy respectively). No
// checkboxes anywhere here, per spec.

import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import { PRIVACY_POLICY_VERSION } from "@/app/privacy";

type Answer = boolean | null;

function YesNo({ value, onChange }: { value: Answer; onChange: (v: boolean) => void }) {
  return (
    <View style={S.yesNoRow}>
      <TouchableOpacity
        style={[S.yesNoBtn, value === true && S.yesActive]}
        onPress={() => onChange(true)}
      >
        <Text style={[S.yesNoText, value === true && S.yesNoTextActive]}>YES</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[S.yesNoBtn, value === false && S.noActive]}
        onPress={() => onChange(false)}
      >
        <Text style={[S.yesNoText, value === false && S.yesNoTextActive]}>NO</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ParentPermissions() {
  const router = useRouter();

  const [studentInfo, setStudentInfo] = useState<Answer>(null);
  const [learningActivity, setLearningActivity] = useState<Answer>(null);
  const [importantComms, setImportantComms] = useState<Answer>(null);
  const [promotionalComms, setPromotionalComms] = useState<Answer>(null);
  const [termsAccepted, setTermsAccepted] = useState<Answer>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState<Answer>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canContinue =
    studentInfo === true &&
    learningActivity === true &&
    importantComms === true &&
    termsAccepted === true &&
    privacyAccepted === true;

  const handleContinue = async () => {
    if (!canContinue) {
      setError("Please answer Yes to all required items to continue");
      return;
    }
    const user = auth.currentUser;
    if (!user) { setError("User not logged in. Please login first."); return; }

    setSaving(true);
    setError("");
    try {
      const snap = await getDoc(doc(db, "students", user.uid));
      const parentPhone = snap.exists() ? snap.data()?.parentPhone : undefined;

      await setDoc(doc(db, "students", user.uid), {
        parentPermissions: {
          studentInfo: true,
          learningActivity: true,
          importantCommunications: true,
          promotionalCommunications: promotionalComms === true,
          termsAccepted: true,
          privacyAccepted: true,
          policyVersion: PRIVACY_POLICY_VERSION,
          respondedAt: serverTimestamp(),
        },
        // Kept for backward compatibility with anything still reading the
        // older single-shot consent shape register.tsx used to write.
        parentalConsent: {
          granted: true,
          grantedAt: serverTimestamp(),
          parentPhone: parentPhone ?? null,
          policyVersion: PRIVACY_POLICY_VERSION,
        },
        onboardingStep: "parentPermissionsCompleted",
        updatedAt: serverTimestamp(),
      }, { merge: true });

      router.replace("/(auth)/register" as any);
    } catch (e: any) {
      setError(e?.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient colors={["#020617", "#1E1B4B", "#312E81"]} style={S.container}>
        <StatusBar barStyle="light-content" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scrollContent}>
          <Text style={S.title}>Parent Permissions</Text>

          <View style={S.card}>
            <Text style={S.question}>
              Do you allow Gloows365 to collect and use your student&apos;s information for
              providing educational services?
            </Text>
            <Text style={S.cardLabel}>Student Information</Text>
            <YesNo value={studentInfo} onChange={setStudentInfo} />
          </View>

          <View style={S.card}>
            <Text style={S.question}>
              Do you allow Gloows365 to record your student&apos;s learning activity and progress?
            </Text>
            <Text style={S.cardLabel}>Learning Activity</Text>
            <YesNo value={learningActivity} onChange={setLearningActivity} />
          </View>

          <View style={S.card}>
            <Text style={S.question}>
              Do you agree to receive important account and educational communications from
              Gloows365?
            </Text>
            <Text style={S.cardLabel}>Important Communications</Text>
            <YesNo value={importantComms} onChange={setImportantComms} />
          </View>

          <View style={S.card}>
            <Text style={S.question}>
              Would you like to receive promotional updates from Gloows365?
            </Text>
            <Text style={S.cardLabel}>Promotional Communications (optional)</Text>
            <YesNo value={promotionalComms} onChange={setPromotionalComms} />
          </View>

          <View style={S.card}>
            <Text style={S.question}>
              Have you read and agree to the{" "}
              <Text style={S.link} onPress={() => router.push("/terms" as any)}>
                Terms & Conditions
              </Text>
              ?
            </Text>
            <Text style={S.cardLabel}>Terms & Conditions</Text>
            <YesNo value={termsAccepted} onChange={setTermsAccepted} />
          </View>

          <View style={S.card}>
            <Text style={S.question}>
              Have you read and agree to the{" "}
              <Text style={S.link} onPress={() => router.push("/privacy" as any)}>
                Privacy Policy
              </Text>
              ?
            </Text>
            <Text style={S.cardLabel}>Privacy Policy</Text>
            <YesNo value={privacyAccepted} onChange={setPrivacyAccepted} />
          </View>

          {error ? <Text style={S.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[S.button, (!canContinue || saving) && { opacity: 0.5 }]}
            onPress={handleContinue}
            disabled={!canContinue || saving}
          >
            <LinearGradient colors={["#6366F1", "#8B5CF6"]} style={S.buttonInner}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={S.buttonText}>Continue to Student Registration →</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, maxWidth: 600, width: "100%", alignSelf: "center", paddingBottom: 40 },
  title: { fontSize: 24, color: "#fff", fontWeight: "900", textAlign: "center", marginBottom: 20 },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  cardLabel: { color: "#A5B4FC", fontSize: 12, fontWeight: "800", marginBottom: 6, textTransform: "uppercase" },
  question: { color: "#e2e8f0", fontSize: 14, lineHeight: 20, marginBottom: 10 },
  link: { color: "#FFD700", fontWeight: "700" },
  yesNoRow: { flexDirection: "row", gap: 10 },
  yesNoBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: "#555",
    alignItems: "center",
  },
  yesActive: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  noActive: { backgroundColor: "#dc2626", borderColor: "#dc2626" },
  yesNoText: { color: "#c7d2fe", fontWeight: "800", fontSize: 13 },
  yesNoTextActive: { color: "#fff" },
  error: { color: "#F87171", marginBottom: 12, textAlign: "center" },
  button: { marginTop: 8, borderRadius: 30, overflow: "hidden" },
  buttonInner: { paddingVertical: 16, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

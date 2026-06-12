// PATH: components/restart/LeadCaptureModal.tsx
// Reusable lead capture form shown after 3 AI advisor messages.
// Writes to educationLeads/ Firestore collection.

import { auth, db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Delhi","Jammu & Kashmir","Ladakh","Puducherry","Chandigarh",
];

interface Props {
  visible:    boolean;
  onClose:    () => void;
  onSubmitted: () => void;
}

export default function LeadCaptureModal({ visible, onClose, onSubmitted }: Props) {
  const [name,           setName]           = useState("");
  const [mobile,         setMobile]         = useState("");
  const [state,          setState]          = useState("");
  const [district,       setDistrict]       = useState("");
  const [interestedInEd, setInterestedInEd] = useState<boolean | null>(null);
  const [consent,        setConsent]        = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [showStateList,  setShowStateList]  = useState(false);

  const handleSubmit = async () => {
    if (!name.trim())                          { Alert.alert("Required", "Please enter your name."); return; }
    if (!/^[6-9]\d{9}$/.test(mobile))         { Alert.alert("Invalid", "Please enter a valid 10-digit mobile number."); return; }
    if (!state)                                { Alert.alert("Required", "Please select your state."); return; }
    if (!district.trim())                      { Alert.alert("Required", "Please enter your district."); return; }
    if (interestedInEd === null)               { Alert.alert("Required", "Please indicate your interest in education."); return; }
    if (!consent)                              { Alert.alert("Required", "Please give consent to be contacted."); return; }

    setLoading(true);
    try {
      const user = auth.currentUser;

      // Get existing profile data
      let age            = 0;
      let language       = "English";
      let lastClass      = "";
      let occupation     = "";
      let preferredLang  = "";

      if (user) {
        const snap = await getDoc(doc(auth.app ? require("firebase/firestore").getFirestore() : require("@/lib/firebase").db, "users", user.uid));
        if (snap.exists()) {
          const d = snap.data();
          age           = d.age ?? 0;
          language      = d.preferredLanguage ?? "English";
          lastClass     = d.lastClassPassed ?? "";
          occupation    = d.currentOccupation ?? "";
          preferredLang = d.preferredLanguage ?? "English";
        }
      }

      await addDoc(collection(require("@/lib/firebase").db, "educationLeads"), {
        userId:            user?.uid ?? null,
        name:              name.trim(),
        mobile:            mobile.trim(),
        state,
        district:          district.trim(),
        language:          preferredLang || "English",
        age,
        lastClassPassed:   lastClass,
        currentOccupation: occupation,
        interestedInContinuingEducation: interestedInEd,
        consentGiven:      true,
        status:            "New",
        assignedPartner:   "",
        notes:             "",
        source:            "ai-advisor",
        createdAt:         serverTimestamp(),
      });

      onSubmitted();
      Alert.alert(
        "🎉 Request Submitted!",
        "Our team will contact you soon to provide free personal guidance on your education journey.",
        [{ text: "Thank You", style: "default" }]
      );
    } catch (e: any) {
      Alert.alert("Error", "Failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView style={S.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={S.sheet}>
          {/* Handle + close */}
          <View style={S.topRow}>
            <View style={S.handle} />
            <TouchableOpacity onPress={onClose} style={S.closeBtn}>
              <Ionicons name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scroll}>
            {/* Header */}
            <View style={S.headerSection}>
              <Text style={S.headerEmoji}>🤝</Text>
              <Text style={S.headerTitle}>Need Personal Guidance?</Text>
              <Text style={S.headerSub}>
                Our education assistance is completely free. Our team will personally
                help you explore the best pathways for your situation.
              </Text>
            </View>

            {/* Form */}
            <Text style={S.label}>Full Name *</Text>
            <TextInput
              style={S.input} placeholder="Your name"
              placeholderTextColor="#9ca3af" value={name} onChangeText={setName}
            />

            <Text style={S.label}>Mobile Number *</Text>
            <TextInput
              style={S.input} placeholder="10-digit mobile"
              placeholderTextColor="#9ca3af" keyboardType="phone-pad"
              maxLength={10} value={mobile} onChangeText={setMobile}
            />

            <Text style={S.label}>State *</Text>
            <TouchableOpacity style={S.input} onPress={() => setShowStateList(!showStateList)}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: state ? "#111" : "#9ca3af" }}>{state || "Select state"}</Text>
                <Ionicons name={showStateList ? "chevron-up" : "chevron-down"} size={16} color="#9ca3af" />
              </View>
            </TouchableOpacity>
            {showStateList && (
              <ScrollView style={S.stateList} nestedScrollEnabled>
                {INDIAN_STATES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[S.stateItem, state === s && S.stateItemActive]}
                    onPress={() => { setState(s); setShowStateList(false); }}
                  >
                    <Text style={[S.stateItemText, state === s && S.stateItemTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Text style={S.label}>District *</Text>
            <TextInput
              style={S.input} placeholder="Your district"
              placeholderTextColor="#9ca3af" value={district} onChangeText={setDistrict}
            />

            <Text style={S.label}>Interested in continuing education? *</Text>
            <View style={S.yesNoRow}>
              <TouchableOpacity
                style={[S.yesNoBtn, interestedInEd === true && S.yesNoBtnActive]}
                onPress={() => setInterestedInEd(true)}
              >
                <Text style={[S.yesNoBtnText, interestedInEd === true && S.yesNoBtnTextActive]}>
                  ✓ Yes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.yesNoBtn, interestedInEd === false && S.yesNoBtnActive]}
                onPress={() => setInterestedInEd(false)}
              >
                <Text style={[S.yesNoBtnText, interestedInEd === false && S.yesNoBtnTextActive]}>
                  Just exploring
                </Text>
              </TouchableOpacity>
            </View>

            {/* Consent */}
            <TouchableOpacity style={S.consentRow} onPress={() => setConsent(!consent)}>
              <View style={[S.checkbox, consent && S.checkboxActive]}>
                {consent && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={S.consentText}>
                I agree to be contacted by the Gloows Education team for free guidance regarding educational opportunities. ☑
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[S.submitBtn, (loading || !consent) && S.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading || !consent}
            >
              <LinearGradient colors={["#16a34a", "#15803d"]} style={S.submitGradient}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={S.submitText}>Request Guidance →</Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            <Text style={S.freeNote}>
              🆓 This service is completely free. No fees, ever.
            </Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const S = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "92%",
  },
  topRow:   { flexDirection: "row", justifyContent: "center", alignItems: "center", padding: 12 },
  handle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB" },
  closeBtn: { position: "absolute", right: 16, top: 12 },
  scroll:   { paddingHorizontal: 20, paddingBottom: 32 },

  headerSection: { alignItems: "center", marginBottom: 24 },
  headerEmoji:   { fontSize: 40, marginBottom: 8 },
  headerTitle:   { fontSize: 20, fontWeight: "800", color: "#111", marginBottom: 6, textAlign: "center" },
  headerSub:     { fontSize: 13, color: "#6B7280", textAlign: "center", lineHeight: 20 },

  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: "#111", backgroundColor: "#F9FAFB", marginBottom: 14,
  },

  stateList:     { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, maxHeight: 180, marginBottom: 14 },
  stateItem:     { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: "#F3F4F6" },
  stateItemActive:     { backgroundColor: "#F0FDF4" },
  stateItemText:       { fontSize: 13, color: "#374151" },
  stateItemTextActive: { color: "#16a34a", fontWeight: "700" },

  yesNoRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  yesNoBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center",
    borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB",
  },
  yesNoBtnActive:     { backgroundColor: "#F0FDF4", borderColor: "#16a34a" },
  yesNoBtnText:       { color: "#6B7280", fontSize: 14, fontWeight: "600" },
  yesNoBtnTextActive: { color: "#16a34a" },

  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 20 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 2,
    borderColor: "#D1D5DB", alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  checkboxActive: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  consentText:    { flex: 1, fontSize: 12, color: "#6B7280", lineHeight: 18 },

  submitBtn:         { borderRadius: 14, overflow: "hidden", marginBottom: 12 },
  submitBtnDisabled: { opacity: 0.5 },
  submitGradient:    { paddingVertical: 16, alignItems: "center" },
  submitText:        { color: "#fff", fontSize: 16, fontWeight: "800" },
  freeNote:          { textAlign: "center", fontSize: 12, color: "#9CA3AF" },
});

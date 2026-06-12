import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PracticalActivity } from "@/lib/aiGuru/types";

interface Props {
  activity: PracticalActivity;
  onSubmit: (response: string) => void;
  loading?: boolean;
}

export default function PracticalActivityCard({ activity, onSubmit, loading = false }: Props) {
  const [response, setResponse] = useState("");
  const [submitted, setSubmitted]   = useState(false);

  const handleSubmit = () => {
    if (!response.trim() || submitted) return;
    setSubmitted(true);
    onSubmit(response.trim());
  };

  return (
    <View style={S.wrap}>
      {/* Title */}
      <View style={S.titleRow}>
        <View style={S.iconWrap}>
          <Ionicons name="construct" size={20} color="#10b981" />
        </View>
        <Text style={S.title}>{activity.title}</Text>
      </View>

      {/* Instructions */}
      <View style={S.instructionsCard}>
        <Text style={S.sectionLabel}>📋 Instructions</Text>
        {activity.instructions.map((step, i) => (
          <View key={i} style={S.stepRow}>
            <View style={S.stepNum}>
              <Text style={S.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={S.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      {/* Expected output */}
      {activity.expectedOutput ? (
        <View style={S.expectedCard}>
          <Text style={S.sectionLabel}>🎯 Expected Output</Text>
          <Text style={S.expectedText}>{activity.expectedOutput}</Text>
        </View>
      ) : null}

      {/* Student response */}
      <View style={S.responseCard}>
        <Text style={S.sectionLabel}>✍️ Your Response</Text>
        <TextInput
          style={[S.input, submitted && S.inputDisabled]}
          placeholder="Write your solution or answer here..."
          placeholderTextColor="#475569"
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          value={response}
          onChangeText={setResponse}
          editable={!submitted}
        />
        <TouchableOpacity
          style={[S.submitBtn, (!response.trim() || submitted) && S.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!response.trim() || submitted || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <Text style={S.submitText}>Evaluating...</Text>
          ) : submitted ? (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={[S.submitText, { color: "#10b981" }]}>Submitted!</Text>
            </>
          ) : (
            <>
              <Ionicons name="send" size={16} color="#fff" />
              <Text style={S.submitText}>Submit for AI Evaluation</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  wrap:            { gap: 12 },
  titleRow:        { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap:        { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(16,185,129,0.15)", justifyContent: "center", alignItems: "center" },
  title:           { flex: 1, color: "#f1f5f9", fontSize: 17, fontWeight: "800" },
  instructionsCard:{ backgroundColor: "#1e293b", borderRadius: 16, padding: 16, gap: 12 },
  sectionLabel:    { color: "#94a3b8", fontSize: 11, fontWeight: "800", letterSpacing: 0.5, marginBottom: 4 },
  stepRow:         { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepNum:         { width: 24, height: 24, borderRadius: 12, backgroundColor: "#6366f1", justifyContent: "center", alignItems: "center", marginTop: 1 },
  stepNumText:     { color: "#fff", fontSize: 11, fontWeight: "900" },
  stepText:        { flex: 1, color: "#cbd5e1", fontSize: 14, lineHeight: 20 },
  expectedCard:    { backgroundColor: "#132027", borderRadius: 14, padding: 14, borderLeftWidth: 3, borderLeftColor: "#06b6d4" },
  expectedText:    { color: "#cbd5e1", fontSize: 14, lineHeight: 20, marginTop: 4 },
  responseCard:    { backgroundColor: "#1e293b", borderRadius: 16, padding: 16, gap: 10 },
  input:           { backgroundColor: "#0f172a", borderRadius: 12, padding: 14, color: "#f1f5f9", fontSize: 14, lineHeight: 20, minHeight: 110, borderWidth: 1, borderColor: "#334155" },
  inputDisabled:   { opacity: 0.6 },
  submitBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#6366f1", borderRadius: 12, paddingVertical: 14 },
  submitBtnDisabled:{ backgroundColor: "#1e293b", borderWidth: 1, borderColor: "#334155" },
  submitText:      { color: "#fff", fontSize: 15, fontWeight: "800" },
});

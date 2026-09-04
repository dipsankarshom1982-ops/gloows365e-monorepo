// PATH: components/vidyastar/ContestErrorState.tsx
//
// Shown when the contests Firestore listener reports an error. Never
// renders the raw error message (Firebase error strings/codes) — generic,
// user-safe copy only, with a Try Again that re-subscribes the listener
// via useContests' retry().

import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface Props {
  colors: { text: string; textSecondary: string };
  onRetry: () => void;
}

export default function ContestErrorState({ colors, onRetry }: Props) {
  return (
    <View style={s.wrap}>
      <Ionicons name="cloud-offline-outline" size={40} color="#f87171" />
      <Text style={[s.title, { color: colors.text }]}>Something went wrong</Text>
      <Text style={[s.subtitle, { color: colors.textSecondary }]}>Unable to load contests right now.</Text>
      <TouchableOpacity style={s.btn} onPress={onRetry} activeOpacity={0.85}>
        <Ionicons name="refresh" size={15} color="#fff" />
        <Text style={s.btnText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: 56, paddingHorizontal: 24, gap: 6 },
  title:    { fontSize: 16, fontWeight: "800", marginTop: 10, textAlign: "center" },
  subtitle: { fontSize: 13.5, textAlign: "center", lineHeight: 19 },
  btn: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, minHeight: 44,
    backgroundColor: "#ef4444",
  },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});

import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  feature?: string;
  onUpgrade: () => void;
  onDismiss?: () => void;
  compact?: boolean;
}

export default function PremiumLock({
  feature = "this feature",
  onUpgrade,
  onDismiss,
  compact = false,
}: Props) {
  if (compact) {
    return (
      <View style={S.compactWrap}>
        <LinearGradient colors={["#92400e", "#d97706"]} style={S.compactGrad}>
          <Ionicons name="lock-closed" size={14} color="#fff" />
          <Text style={S.compactText}>Premium</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={S.overlay}>
      <LinearGradient
        colors={["#0f0c29", "#302b63", "#24243e"]}
        style={S.card}
      >
        <View style={S.lockCircle}>
          <Ionicons name="lock-closed" size={32} color="#fbbf24" />
        </View>

        <Text style={S.title}>Unlock AI Guru Premium</Text>
        <Text style={S.subtitle}>
          Get unlimited access to {feature} and all premium features
        </Text>

        <View style={S.features}>
          {[
            "📸 PhotoSolve — 50 photo solves/day",
            "🎯 Exam Simulator — unlimited mock tests",
            "🎙️ Voice Tutor — 100 voice questions/day",
            "✨ Unlimited AI lessons per day",
            "💬 Unlimited follow-up doubts",
            "🤖 Unlimited VidyaGuru chats",
          ].map((f) => (
            <View key={f} style={S.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={S.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={S.upgradeBtn} onPress={onUpgrade} activeOpacity={0.9}>
          <LinearGradient
            colors={["#92400e", "#d97706", "#fbbf24"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={S.upgradeBtnGrad}
          >
            <Ionicons name="star" size={18} color="#fff" />
            <Text style={S.upgradeBtnText}>Upgrade to Premium</Text>
          </LinearGradient>
        </TouchableOpacity>

        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={S.dismissBtn}>
            <Text style={S.dismissText}>Try Tomorrow (Free: 2 lessons/day)</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );
}

const S = StyleSheet.create({
  overlay:       { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.85)", padding: 20 },
  card:          { width: "100%", borderRadius: 28, padding: 28, alignItems: "center", gap: 16 },
  lockCircle:    { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(251,191,36,0.15)", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fbbf24" },
  title:         { color: "#fbbf24", fontSize: 22, fontWeight: "900", textAlign: "center" },
  subtitle:      { color: "#94a3b8", fontSize: 14, textAlign: "center", lineHeight: 20 },
  features:      { width: "100%", gap: 10 },
  featureRow:    { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText:   { color: "#e2e8f0", fontSize: 14, flex: 1 },
  upgradeBtn:    { width: "100%", borderRadius: 16, overflow: "hidden" },
  upgradeBtnGrad:{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 8 },
  upgradeBtnText:{ color: "#fff", fontSize: 17, fontWeight: "900" },
  dismissBtn:    { paddingVertical: 8 },
  dismissText:   { color: "#64748b", fontSize: 12, textAlign: "center" },
  compactWrap:   { alignSelf: "flex-start" },
  compactGrad:   { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  compactText:   { color: "#fff", fontSize: 10, fontWeight: "800" },
});

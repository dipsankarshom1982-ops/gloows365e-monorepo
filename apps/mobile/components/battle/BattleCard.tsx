// PATH: components/battle/BattleCard.tsx
// Phase 2D-3 — presentation ONLY (brief §11/§29): renders a
// BattleCardViewModel it's handed; never computes rank/score/reward/
// eligibility itself, never reads Firestore, never calls a Cloud Function.

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import BattleStatusBadge from "./BattleStatusBadge";
import Countdown from "./Countdown";
import type { BattleCardViewModel } from "./types";

const ACCENT = "#ff9f43";

export default function BattleCard({ battle, onPress }: { battle: BattleCardViewModel; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${battle.title}${battle.skill ? `, ${battle.skill.name}` : ""} battle details`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    >
      <LinearGradient colors={["#2a1500", "#1a0e00"]} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.overlay} />
        <BattleStatusBadge status={battle.status} />
        {battle.status === "LIVE" && (
          <View style={styles.timerRow}>
            <Ionicons name="time-outline" size={11} color="#ffd166" />
            <Countdown deadline={battle.deadline} />
          </View>
        )}
        <Text style={styles.title} numberOfLines={2}>{battle.title}</Text>
        {battle.sponsor ? <Text style={styles.sponsor}>Powered by {battle.sponsor}</Text> : null}
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.chipRow}>
          {battle.skill ? (
            <View style={[styles.chip, { borderColor: `${ACCENT}55`, backgroundColor: `${ACCENT}18` }]}>
              <Text style={[styles.chipText, { color: ACCENT }]} numberOfLines={1}>🎯 {battle.skill.name}</Text>
            </View>
          ) : null}
          {battle.scope ? (
            <View style={styles.chip}>
              <Text style={styles.chipTextMuted} numberOfLines={1}>{battle.scope.label}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.footerRow}>
          {battle.reward ? (
            <Text style={styles.reward} numberOfLines={1}>🏆 {battle.reward.label}</Text>
          ) : <View />}
          {typeof battle.participantCount === "number" && (
            <View style={styles.participants}>
              <Ionicons name="people" size={12} color="rgba(255,255,255,0.5)" />
              <Text style={styles.participantsText}>{battle.participantCount}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, overflow: "hidden", borderWidth: 1.5, borderColor: "rgba(255,159,67,0.35)", backgroundColor: "#0e0a1a" },
  header: { minHeight: 96, padding: 12, justifyContent: "flex-end", position: "relative", gap: 4 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.15)" },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 4, position: "absolute", top: 12, right: 12 },
  title: { color: "#fff", fontSize: 15, fontWeight: "900", lineHeight: 20, marginTop: 6 },
  sponsor: { color: "rgba(255,159,67,0.85)", fontSize: 10, fontWeight: "700" },
  body: { padding: 12, gap: 10 },
  chipRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  chip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.04)", maxWidth: "100%" },
  chipText: { fontSize: 11, fontWeight: "800" },
  chipTextMuted: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.6)" },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reward: { color: "#06d6a0", fontSize: 13, fontWeight: "900", flexShrink: 1 },
  participants: { flexDirection: "row", alignItems: "center", gap: 4 },
  participantsText: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "700" },
});

// PATH: components/battle/BattleStatusBadge.tsx
// Phase 2D-3 — status is never communicated by color alone (Phase 2D-3
// brief §32): every state pairs a color with a distinct label/icon.

import { StyleSheet, Text, View } from "react-native";
import type { BattlePresentationStatus } from "./types";

const CONFIG: Record<BattlePresentationStatus, { label: string; bg: string; color: string }> = {
  UPCOMING:          { label: "⏰ Upcoming",  bg: "#f59e0b", color: "#fff" },
  LIVE:              { label: "🔴 Live",      bg: "#ef4444", color: "#fff" },
  SUBMISSION_CLOSED: { label: "⏳ Closed",    bg: "#6b7280", color: "#fff" },
  COMPLETED:         { label: "✅ Completed", bg: "#6b7280", color: "#fff" },
  CANCELLED:         { label: "🚫 Cancelled", bg: "#4b5563", color: "#fff" },
};

export default function BattleStatusBadge({ status }: { status: BattlePresentationStatus }) {
  const cfg = CONFIG[status];
  return (
    <View
      style={[styles.badge, { backgroundColor: cfg.bg }]}
      accessibilityLabel={`Battle status: ${cfg.label.replace(/^\S+\s/, "")}`}
    >
      <Text style={[styles.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start" },
  text: { fontSize: 10, fontWeight: "800" },
});

// PATH: components/battle/EmptyState.tsx
// Phase 2D-3 — shared empty-state pattern, matching the tone already
// established by the legacy skillbattle.tsx (emoji + title + subtext +
// optional action), just extracted for reuse rather than duplicated
// per-section.

import { Pressable, StyleSheet, Text, View } from "react-native";

export default function EmptyState({
  emoji, title, subtitle, actionLabel, onAction,
}: {
  emoji: string; title: string; subtitle?: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 20, gap: 6 },
  emoji: { fontSize: 36, marginBottom: 4 },
  title: { fontSize: 14, fontWeight: "800", color: "rgba(255,255,255,0.85)", textAlign: "center" },
  subtitle: { fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 18 },
  action: { marginTop: 8, backgroundColor: "#ff9f43", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  actionText: { color: "#fff", fontSize: 13, fontWeight: "800" },
});

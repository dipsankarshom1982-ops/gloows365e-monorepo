// PATH: components/battle/SkillChip.tsx
// Phase 2D-3 — minimal shared presentational chip (the "Phase 2D-2"
// catch-up this phase needed — see the Phase 2D-3 report's baseline
// section for why: Phase 2D-2 was never actually implemented as its own
// commit, only proposed in the Phase 2D-1 blueprint). Kept intentionally
// small — just what Discovery's "Browse by Skill" row and Battle
// Details' Skill section need, not a speculative full design system.

import { Pressable, StyleSheet, Text } from "react-native";

export default function SkillChip({
  label, icon, active, onPress, accent = "#ff9f43",
}: {
  label: string; icon?: string; active?: boolean; onPress?: () => void; accent?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={onPress ? `Browse ${label} battles` : label}
      accessibilityState={onPress ? { selected: !!active } : undefined}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: active ? accent : "rgba(255,255,255,0.12)", backgroundColor: active ? `${accent}22` : "rgba(255,255,255,0.04)" },
        pressed && { opacity: 0.8 },
      ]}
    >
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={[styles.label, { color: active ? accent : "rgba(255,255,255,0.75)" }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, minHeight: 36 },
  icon: { fontSize: 14 },
  label: { fontSize: 12, fontWeight: "700" },
});

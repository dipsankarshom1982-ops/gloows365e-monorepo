// PATH: components/vidyastar/ContestStatusBadge.tsx
//
// Reusable status pill for contest cards — Live / Completed / Upcoming.
// Status is communicated by icon + text + tone together, never color alone
// (accessibility requirement — a colorblind viewer still reads "Live Now"
// vs "Completed" vs "Upcoming" from the label and icon shape).

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

export type ContestStatusTone = "live" | "completed" | "upcoming";

interface Props {
  tone: ContestStatusTone;
  label: string;
}

const TONE_CONFIG: Record<ContestStatusTone, { bg: string; border: string; fg: string; icon?: keyof typeof Ionicons.glyphMap }> = {
  live:      { bg: "rgba(239,68,68,0.22)",  border: "rgba(252,165,165,0.45)", fg: "#fecaca" },
  completed: { bg: "rgba(16,185,129,0.20)", border: "rgba(110,231,183,0.4)",  fg: "#6ee7b7", icon: "checkmark-circle" },
  upcoming:  { bg: "rgba(99,102,241,0.22)", border: "rgba(199,210,254,0.4)",  fg: "#c7d2fe", icon: "calendar" },
};

// Small pulsing dot for the Live badge — the one place motion is used to
// draw the eye, kept subtle and skipped entirely under reduced-motion.
function LiveDot() {
  const reduceMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 650, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [reduceMotion, pulse]);

  return <Animated.View style={[s.dot, { opacity: reduceMotion ? 1 : pulse }]} />;
}

export default function ContestStatusBadge({ tone, label }: Props) {
  const cfg = TONE_CONFIG[tone];
  return (
    <View style={[s.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      {tone === "live" ? <LiveDot /> : cfg.icon ? <Ionicons name={cfg.icon} size={13} color={cfg.fg} /> : null}
      <Text style={[s.text, { color: cfg.fg }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ef4444" },
  text: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
});

// PATH: components/vidyastar/EmptyContestState.tsx
//
// Polished, per-filter empty state — replaces the single generic
// "No contests available" message with copy and an icon matched to which
// tab is empty, plus (for "live" only) a CTA that switches the caller to
// the Upcoming tab.

import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type EmptyContestVariant = "all" | "live" | "upcoming" | "completed";

interface Props {
  variant: EmptyContestVariant;
  colors: { text: string; textSecondary: string; accent: string };
  onViewUpcoming?: () => void;
}

const COPY: Record<EmptyContestVariant, { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }> = {
  all: {
    icon: "trophy-outline",
    title: "No contests available right now",
    subtitle: "Check back soon — new contests are added regularly.",
  },
  live: {
    icon: "flash-outline",
    title: "No live contests right now",
    subtitle: "Check upcoming contests and get ready to compete!",
  },
  upcoming: {
    icon: "calendar-outline",
    title: "No upcoming contests yet",
    subtitle: "New contests will show up here as soon as they're scheduled.",
  },
  completed: {
    icon: "checkmark-done-outline",
    title: "No completed contests yet",
    subtitle: "Your completed competitions will appear here.",
  },
};

export default function EmptyContestState({ variant, colors, onViewUpcoming }: Props) {
  const copy = COPY[variant];
  return (
    <View style={s.wrap}>
      <View style={s.iconCircle}>
        <Ionicons name={copy.icon} size={30} color="#8B5CF6" />
      </View>
      <Text style={[s.title, { color: colors.text }]}>{copy.title}</Text>
      <Text style={[s.subtitle, { color: colors.textSecondary }]}>{copy.subtitle}</Text>
      {variant === "live" && onViewUpcoming && (
        <TouchableOpacity style={s.cta} onPress={onViewUpcoming} activeOpacity={0.85}>
          <Ionicons name="calendar" size={15} color="#4f46e5" />
          <Text style={s.ctaText}>View Upcoming Contests</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: 56, paddingHorizontal: 24, gap: 6 },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(139,92,246,0.12)",
    alignItems: "center", justifyContent: "center", marginBottom: 6,
  },
  title:    { fontSize: 16, fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: 13.5, textAlign: "center", lineHeight: 19, maxWidth: 280 },
  cta: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14,
    paddingHorizontal: 16, paddingVertical: 11, borderRadius: 14, minHeight: 44,
    backgroundColor: "rgba(99,102,241,0.1)", borderWidth: 1, borderColor: "rgba(99,102,241,0.3)",
  },
  ctaText: { color: "#4f46e5", fontSize: 13.5, fontWeight: "700" },
});

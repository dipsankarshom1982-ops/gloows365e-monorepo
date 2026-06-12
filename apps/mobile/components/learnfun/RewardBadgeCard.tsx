// components/learnfun/RewardBadgeCard.tsx

import { useTheme } from "@/context/ThemeContext";
import { Badge } from "@/lib/learnfun/types";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface RewardBadgeCardProps {
  badge: Badge;
  earned: boolean;
}

export default function RewardBadgeCard({ badge, earned }: RewardBadgeCardProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { borderColor: earned ? "#38BDF840" : colors.border }]}>
      {/* Badge circle */}
      <View
        style={[
          styles.emojiCircle,
          earned
            ? { backgroundColor: "rgba(56,189,248,0.15)", borderColor: "#38BDF850" }
            : { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" },
        ]}
      >
        <Text style={[styles.emoji, { opacity: earned ? 1 : 0.3 }]}>{badge.emoji}</Text>
        {earned && (
          <View style={styles.earnedDot} />
        )}
      </View>

      {/* Name */}
      <Text
        style={[
          styles.name,
          { color: earned ? colors.text : colors.textSecondary, opacity: earned ? 1 : 0.5 },
        ]}
        numberOfLines={2}
      >
        {badge.name}
      </Text>

      {/* Status */}
      {earned ? (
        <View style={styles.earnedBadge}>
          <Text style={styles.earnedText}>✓ Earned</Text>
        </View>
      ) : (
        <Text style={[styles.lockedText, { color: "rgba(148,163,184,0.4)" }]}>Locked</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 110,
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  emojiCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  emoji: {
    fontSize: 28,
  },
  earnedDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#0F172A",
  },
  name: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 15,
  },
  earnedBadge: {
    backgroundColor: "rgba(16,185,129,0.18)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  earnedText: {
    color: "#10B981",
    fontSize: 10,
    fontWeight: "700",
  },
  lockedText: {
    fontSize: 10,
    fontWeight: "600",
  },
});

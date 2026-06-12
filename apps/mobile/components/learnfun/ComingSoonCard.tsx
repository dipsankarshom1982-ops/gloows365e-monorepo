// components/learnfun/ComingSoonCard.tsx

import { useTheme } from "@/context/ThemeContext";
import { LearnFunGame } from "@/lib/learnfun/types";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface ComingSoonCardProps {
  game: LearnFunGame;
}

export default function ComingSoonCard({ game }: ComingSoonCardProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Coming Soon badge */}
      <View style={styles.badge}>
        <Ionicons name="lock-closed" size={10} color="#94A3B8" />
        <Text style={styles.badgeText}>Coming Soon</Text>
      </View>

      {/* Emoji */}
      <View style={styles.emojiContainer}>
        <Text style={styles.emoji}>{game.emoji}</Text>
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: colors.textSecondary }]} numberOfLines={2}>
        {game.title}
      </Text>

      {/* Skill */}
      <Text style={[styles.skill, { color: "rgba(148,163,184,0.6)" }]} numberOfLines={1}>
        {game.skill}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 140,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    gap: 8,
    alignItems: "flex-start",
    opacity: 0.75,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(148,163,184,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    color: "#94A3B8",
    fontSize: 9,
    fontWeight: "700",
  },
  emojiContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(148,163,184,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 24,
    opacity: 0.6,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17,
  },
  skill: {
    fontSize: 11,
    fontWeight: "500",
  },
});

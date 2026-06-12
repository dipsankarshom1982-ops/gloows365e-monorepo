// components/learnfun/SkillWorldCard.tsx

import { useTheme } from "@/context/ThemeContext";
import { SkillWorld } from "@/lib/learnfun/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const { width } = Dimensions.get("window");
const CARD_SIZE = (width - 20 * 2 - 12) / 2;

interface SkillWorldCardProps {
  world: SkillWorld;
  onPress: () => void;
}

export default function SkillWorldCard({ world, onPress }: SkillWorldCardProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={world.locked ? undefined : onPress}
      activeOpacity={world.locked ? 1 : 0.85}
      style={[styles.wrapper, { width: CARD_SIZE, height: CARD_SIZE }]}
    >
      <LinearGradient
        colors={world.locked ? ["#374151", "#1F2937"] : world.gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <Text style={styles.emoji}>{world.emoji}</Text>
        <Text style={styles.name} numberOfLines={2}>
          {world.name}
        </Text>
        <Text style={[styles.skill, { color: "rgba(255,255,255,0.7)" }]} numberOfLines={1}>
          {world.skill}
        </Text>

        {/* Locked overlay */}
        {world.locked && (
          <View style={styles.lockedOverlay}>
            <Ionicons name="lock-closed" size={28} color="rgba(255,255,255,0.6)" />
            <Text style={styles.lockedText}>Locked</Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 20,
    overflow: "hidden",
  },
  card: {
    flex: 1,
    padding: 16,
    justifyContent: "flex-end",
    gap: 4,
  },
  emoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  name: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  skill: {
    fontSize: 11,
    fontWeight: "500",
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  lockedText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "700",
  },
});

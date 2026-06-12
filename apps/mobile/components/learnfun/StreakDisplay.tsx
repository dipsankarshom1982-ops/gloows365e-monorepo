// components/learnfun/StreakDisplay.tsx

import { useTheme } from "@/context/ThemeContext";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

interface StreakDisplayProps {
  streak: number;
}

function getStreakMessage(streak: number): string {
  if (streak === 0) return "Start your streak today! Play one mission now.";
  if (streak === 1) return "Great start! Come back tomorrow to build your streak!";
  if (streak < 3) return "You are on a roll! Keep it going!";
  if (streak < 7) return "Incredible! You are in the zone. Don't break it!";
  if (streak < 14) return "One week down! You are a true LearnFun champion!";
  if (streak < 30) return "Two weeks! You are unstoppable. Keep the fire burning!";
  return "30+ days! You are a Legend! Nothing can stop you!";
}

export default function StreakDisplay({ streak }: StreakDisplayProps) {
  const { colors } = useTheme();
  const flameAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (streak > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(flameAnim, {
            toValue: 1.15,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(flameAnim, {
            toValue: 0.92,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [streak, flameAnim]);

  const message = getStreakMessage(streak);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.leftSection}>
        <Animated.Text
          style={[styles.flameEmoji, { transform: [{ scale: flameAnim }] }]}
        >
          {streak > 0 ? "🔥" : "💤"}
        </Animated.Text>
        <View style={styles.textGroup}>
          <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>
            Daily Streak
          </Text>
          <Text style={[styles.streakCount, { color: streak > 0 ? "#EF4444" : colors.textSecondary }]}>
            {streak > 0 ? `${streak} Day${streak === 1 ? "" : "s"}!` : "0 Days"}
          </Text>
        </View>
      </View>

      <View style={styles.rightSection}>
        <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>
          {message}
        </Text>
      </View>

      {/* Milestone dots */}
      <View style={styles.milestones}>
        {[3, 7, 14, 30].map((milestone) => (
          <View
            key={milestone}
            style={[
              styles.milestoneDot,
              streak >= milestone
                ? { backgroundColor: "#EF4444" }
                : { backgroundColor: "rgba(255,255,255,0.1)" },
            ]}
          >
            <Text style={styles.milestoneText}>{milestone}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flameEmoji: {
    fontSize: 40,
  },
  textGroup: {
    gap: 2,
  },
  streakLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  streakCount: {
    fontSize: 22,
    fontWeight: "800",
  },
  rightSection: {
    flex: 1,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  milestones: {
    flexDirection: "row",
    gap: 8,
  },
  milestoneDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});

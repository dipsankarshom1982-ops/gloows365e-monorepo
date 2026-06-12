// components/learnfun/MissionCard.tsx

import { useTheme } from "@/context/ThemeContext";
import { DailyMission, Difficulty, GameType } from "@/lib/learnfun/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface MissionCardProps {
  mission: DailyMission;
  onPress: () => void;
  studentClass: number;
  completed?: boolean;
}

function getGameTypeGradient(gameType: GameType): [string, string] {
  switch (gameType) {
    case "budget_simulator":
      return ["#F59E0B", "#D97706"];
    case "time_planner":
      return ["#10B981", "#059669"];
    case "choice_story":
      return ["#8B5CF6", "#6366F1"];
    case "digital_safety":
      return ["#0EA5E9", "#0284C7"];
    case "career_goal":
      return ["#EC4899", "#BE185D"];
    case "boss_battle":
      return ["#EF4444", "#DC2626"];
    default:
      return ["#38BDF8", "#0EA5E9"];
  }
}

function getGameTypeEmoji(gameType: GameType): string {
  switch (gameType) {
    case "budget_simulator": return "💰";
    case "time_planner": return "⏰";
    case "choice_story": return "📖";
    case "digital_safety": return "🛡️";
    case "career_goal": return "🚀";
    case "boss_battle": return "⚔️";
    default: return "🎮";
  }
}

function getDifficultyColor(difficulty: Difficulty): string {
  switch (difficulty) {
    case "easy": return "#10B981";
    case "medium": return "#F59E0B";
    case "hard": return "#EF4444";
    case "boss": return "#8B5CF6";
    default: return "#94A3B8";
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function MissionCard({ mission, onPress, studentClass, completed = false }: MissionCardProps) {
  const { colors } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const gradientColors = getGameTypeGradient(mission.gameType);
  const gameEmoji = getGameTypeEmoji(mission.gameType);
  const difficultyColor = getDifficultyColor(mission.difficulty);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.04,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, [pulseAnim, glowAnim]);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });

  return (
    <TouchableOpacity
      onPress={completed ? undefined : onPress}
      activeOpacity={completed ? 1 : 0.92}
      style={[styles.wrapper, completed && { opacity: 0.85 }]}
    >
      <LinearGradient
        colors={[`${gradientColors[0]}22`, `${gradientColors[1]}11`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { borderColor: `${gradientColors[0]}40` }]}
      >
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={styles.emojiContainer}>
            <Text style={styles.skillEmoji}>{gameEmoji}</Text>
          </View>

          <View style={styles.headerTextGroup}>
            <View style={styles.badgeRow}>
              <View style={[styles.skillBadge, { backgroundColor: `${gradientColors[0]}30` }]}>
                <Text style={[styles.skillBadgeText, { color: gradientColors[0] }]}>
                  {mission.skill}
                </Text>
              </View>
              <View style={[styles.difficultyBadge, { backgroundColor: `${difficultyColor}25` }]}>
                <Text style={[styles.difficultyText, { color: difficultyColor }]}>
                  {mission.difficulty.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={[styles.missionTitle, { color: colors.text }]} numberOfLines={2}>
              {mission.missionTitle}
            </Text>
          </View>
        </View>

        {/* Story intro */}
        <Text
          style={[styles.storyIntro, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {mission.storyIntro}
        </Text>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaEmoji}>⏱️</Text>
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {formatTime(mission.timerSeconds)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaEmoji}>🪙</Text>
            <Text style={[styles.metaText, { color: "#F59E0B" }]}>
              {mission.reward.coins} coins
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaEmoji}>⚡</Text>
            <Text style={[styles.metaText, { color: "#38BDF8" }]}>
              {mission.reward.xp} XP
            </Text>
          </View>
          <View style={[styles.classBadge, { backgroundColor: `${gradientColors[0]}25` }]}>
            <Text style={[styles.classText, { color: gradientColors[0] }]}>
              Class {studentClass}
            </Text>
          </View>
        </View>

        {/* Play / Completed button */}
        {completed ? (
          <View style={styles.completedBanner}>
            <Text style={styles.completedIcon}>✅</Text>
            <View>
              <Text style={styles.completedTitle}>Completed Today!</Text>
              <Text style={styles.completedSub}>New mission arrives tomorrow</Text>
            </View>
          </View>
        ) : (
          <Animated.View
            style={[
              styles.playBtnWrapper,
              { transform: [{ scale: pulseAnim }], opacity: glowOpacity },
            ]}
          >
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.playBtn}
            >
              <Text style={styles.playBtnText}>PLAY NOW</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </Animated.View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 20,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  emojiContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  skillEmoji: {
    fontSize: 28,
  },
  headerTextGroup: {
    flex: 1,
    gap: 6,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  skillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  skillBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: "800",
  },
  missionTitle: {
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 22,
  },
  storyIntro: {
    fontSize: 13,
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaEmoji: {
    fontSize: 14,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "600",
  },
  classBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: "auto",
  },
  classText: {
    fontSize: 11,
    fontWeight: "700",
  },
  playBtnWrapper: {
    borderRadius: 16,
    overflow: "hidden",
  },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
    borderRadius: 16,
  },
  playBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
  },
  completedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(16,185,129,0.18)",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.4)",
  },
  completedIcon: {
    fontSize: 28,
  },
  completedTitle: {
    color: "#10B981",
    fontSize: 15,
    fontWeight: "800",
  },
  completedSub: {
    color: "#6EE7B7",
    fontSize: 12,
    marginTop: 2,
  },
});

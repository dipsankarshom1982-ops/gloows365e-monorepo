// app/learnfun/streak.tsx
// StreakScreen — calendar view + milestones + motivation

import { useTheme } from "@/context/ThemeContext";
import { useLearnFun } from "@/hooks/useLearnFun";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const MILESTONES = [
  { days: 3, label: "Starter", emoji: "🌱", color: "#10B981" },
  { days: 7, label: "1 Week Hero", emoji: "⭐", color: "#F59E0B" },
  { days: 14, label: "2 Week Champion", emoji: "🏆", color: "#F97316" },
  { days: 30, label: "30-Day Legend", emoji: "👑", color: "#EF4444" },
];

function getMotivation(streak: number): { message: string; emoji: string; color: string } {
  if (streak === 0) return {
    message: "Start your LearnFun journey today! Play one mission to light up your first flame! 🔥",
    emoji: "💤",
    color: "#94A3B8",
  };
  if (streak < 3) return {
    message: `${streak} day${streak > 1 ? "s" : ""} strong! Keep going — you are building a great habit!`,
    emoji: "🌱",
    color: "#10B981",
  };
  if (streak < 7) return {
    message: `${streak} days! You are in the habit zone! Most students stop at day 2 — you did not. Keep it up!`,
    emoji: "🔥",
    color: "#F97316",
  };
  if (streak < 14) return {
    message: `One week and counting! 🎉 Students with 7+ day streaks score 30% better in life skills assessments!`,
    emoji: "⭐",
    color: "#F59E0B",
  };
  if (streak < 30) return {
    message: `${streak} days! You are almost at the legendary 30-day mark! You are in the top 5% of all students!`,
    emoji: "🏆",
    color: "#8B5CF6",
  };
  return {
    message: `${streak} days! You are a TRUE LEGEND! 30+ days of continuous learning — you are unstoppable!`,
    emoji: "👑",
    color: "#EF4444",
  };
}

// Generate last 30 days of activity dots (simulated)
function generateActivityDots(streak: number): boolean[] {
  const dots: boolean[] = new Array(30).fill(false);
  // Mark last `streak` days as active
  for (let i = 0; i < Math.min(streak, 30); i++) {
    dots[29 - i] = true;
  }
  return dots;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export default function StreakScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { profile, loading } = useLearnFun();

  const activityDots = useMemo(
    () => generateActivityDots(profile?.streak ?? 0),
    [profile?.streak]
  );

  const motivation = useMemo(
    () => getMotivation(profile?.streak ?? 0),
    [profile?.streak]
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Profile not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.accent }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const streak = profile.streak;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>My Streak</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Main streak display */}
        <LinearGradient
          colors={streak > 0 ? ["#7F1D1D", "#991B1B"] : ["#1E293B", "#0F172A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.streakHero}
        >
          <Text style={styles.streakHeroEmoji}>{motivation.emoji}</Text>
          <Text style={styles.streakHeroValue}>
            {streak}
          </Text>
          <Text style={styles.streakHeroLabel}>
            {streak === 1 ? "Day Streak" : "Day Streak"}
          </Text>
          <Text style={styles.streakHeroMessage}>{motivation.message}</Text>
        </LinearGradient>

        {/* 30-day Calendar */}
        <View style={[styles.calendarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.calendarTitle, { color: colors.text }]}>Last 30 Days</Text>
          <Text style={[styles.calendarSubtitle, { color: colors.textSecondary }]}>
            Each dot = one active day
          </Text>

          {/* Day labels */}
          <View style={styles.dayLabels}>
            {DAY_LABELS.map((day, i) => (
              <Text key={i} style={[styles.dayLabel, { color: colors.textSecondary }]}>{day}</Text>
            ))}
          </View>

          {/* Activity grid — 5 rows × 6 cols roughly = 30 days */}
          <View style={styles.activityGrid}>
            {activityDots.map((active, i) => (
              <View
                key={i}
                style={[
                  styles.activityDot,
                  active
                    ? { backgroundColor: "#EF4444" }
                    : { backgroundColor: "rgba(255,255,255,0.08)" },
                ]}
              >
                {active && <Text style={styles.activityDotCheck}>🔥</Text>}
              </View>
            ))}
          </View>

          <View style={styles.calendarLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Active day</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "rgba(255,255,255,0.08)" }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Missed day</Text>
            </View>
          </View>
        </View>

        {/* Milestones */}
        <View style={styles.milestonesSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Streak Milestones</Text>
          {MILESTONES.map((milestone) => {
            const achieved = streak >= milestone.days;
            return (
              <View
                key={milestone.days}
                style={[
                  styles.milestoneRow,
                  {
                    backgroundColor: achieved ? `${milestone.color}15` : colors.card,
                    borderColor: achieved ? `${milestone.color}40` : colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.milestoneIconBg,
                    { backgroundColor: achieved ? `${milestone.color}25` : "rgba(255,255,255,0.05)" },
                  ]}
                >
                  <Text style={styles.milestoneEmoji}>{milestone.emoji}</Text>
                </View>
                <View style={styles.milestoneTextGroup}>
                  <Text style={[styles.milestoneLabel, { color: colors.text }]}>
                    {milestone.label}
                  </Text>
                  <Text style={[styles.milestoneDays, { color: colors.textSecondary }]}>
                    {milestone.days} day streak
                  </Text>
                </View>
                <View style={[
                  styles.milestoneStatus,
                  { backgroundColor: achieved ? `${milestone.color}20` : "rgba(255,255,255,0.05)" },
                ]}>
                  {achieved ? (
                    <Ionicons name="checkmark-circle" size={22} color={milestone.color} />
                  ) : (
                    <Text style={[styles.milestoneRemaining, { color: colors.textSecondary }]}>
                      {milestone.days - streak}d left
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Tips to keep streak */}
        <View style={[styles.tipsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.tipsTitle, { color: colors.text }]}>💡 Tips to Keep Your Streak</Text>
          {[
            "Play one mission daily — even if it's just 5 minutes!",
            "Set a reminder at the same time every day.",
            "Start with the easiest mission type on busy days.",
            "Tell a friend about your streak — accountability helps!",
            "Missing one day is okay — just don't miss two in a row!",
          ].map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Text style={[styles.tipBullet, { color: colors.accent }]}>•</Text>
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  streakHero: {
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  streakHeroEmoji: { fontSize: 56 },
  streakHeroValue: { color: "#fff", fontSize: 72, fontWeight: "900", lineHeight: 80 },
  streakHeroLabel: { color: "rgba(255,255,255,0.7)", fontSize: 18, fontWeight: "600" },
  streakHeroMessage: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    marginTop: 8,
  },
  calendarCard: { borderRadius: 20, padding: 16, borderWidth: 1, gap: 12 },
  calendarTitle: { fontSize: 16, fontWeight: "700" },
  calendarSubtitle: { fontSize: 12, marginTop: -8 },
  dayLabels: { flexDirection: "row", justifyContent: "space-around" },
  dayLabel: { fontSize: 11, fontWeight: "600", width: 32, textAlign: "center" },
  activityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4, justifyContent: "flex-start" },
  activityDot: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  activityDotCheck: { fontSize: 16 },
  calendarLegend: { flexDirection: "row", gap: 16, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: 11 },
  milestonesSection: { gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  milestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  milestoneIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneEmoji: { fontSize: 22 },
  milestoneTextGroup: { flex: 1, gap: 3 },
  milestoneLabel: { fontSize: 14, fontWeight: "700" },
  milestoneDays: { fontSize: 12 },
  milestoneStatus: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneRemaining: { fontSize: 10, fontWeight: "700", textAlign: "center" },
  tipsCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 10 },
  tipsTitle: { fontSize: 14, fontWeight: "700" },
  tipRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  tipBullet: { fontSize: 16, fontWeight: "800", lineHeight: 20 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19 },
});

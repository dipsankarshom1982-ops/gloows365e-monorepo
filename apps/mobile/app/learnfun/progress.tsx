// app/learnfun/progress.tsx
// LearnFunProgressScreen

import { useTheme } from "@/context/ThemeContext";
import { useLearnFun } from "@/hooks/useLearnFun";
import { XP_PER_LEVEL } from "@/lib/learnfun/constants";
import { Skill } from "@/lib/learnfun/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SKILL_COLORS: Record<string, string> = {
  "Money Management": "#F59E0B",
  "Time Management": "#10B981",
  "Digital Safety": "#0EA5E9",
  "Goal Setting": "#8B5CF6",
  "Career Awareness": "#EC4899",
  "Communication": "#F97316",
  "Health & Habits": "#10B981",
  "Leadership": "#818CF8",
  "Decision Making": "#A78BFA",
  "Emotional Control": "#F43F5E",
};

const SKILL_LIST: Skill[] = [
  "Money Management",
  "Time Management",
  "Digital Safety",
  "Goal Setting",
  "Career Awareness",
  "Communication",
];

function getMilestoneLabel(streak: number): string {
  if (streak >= 30) return "30-Day Legend 🔥";
  if (streak >= 14) return "2-Week Hero ⚡";
  if (streak >= 7) return "1-Week Star ⭐";
  if (streak >= 3) return "3-Day Starter 🌱";
  return "Just Started 👋";
}

export default function LearnFunProgressScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { profile, allBadges, loading } = useLearnFun();

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
        <Text style={{ color: colors.textSecondary, fontSize: 15 }}>Profile not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.accent }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const xpInCurrentLevel = profile.xp % XP_PER_LEVEL;
  const xpProgress = xpInCurrentLevel / XP_PER_LEVEL;
  const earnedBadges = allBadges.filter((b) => profile.badges.includes(b.id));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>My Progress</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Level progress */}
        <LinearGradient
          colors={["#1E1B4B", "#312E81"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.levelCard}
        >
          <View style={styles.levelRow}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelNum}>{profile.level}</Text>
            </View>
            <View style={styles.levelTextGroup}>
              <Text style={styles.levelTitle}>Level {profile.level}</Text>
              <Text style={styles.levelXP}>
                {xpInCurrentLevel} / {XP_PER_LEVEL} XP to next level
              </Text>
            </View>
          </View>
          <View style={styles.levelBarBg}>
            <View style={[styles.levelBarFill, { width: `${xpProgress * 100}%` }]} />
          </View>
          <Text style={styles.totalXP}>Total XP: {profile.xp.toLocaleString()}</Text>
        </LinearGradient>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {[
            { label: "Missions Done", value: profile.completedMissionIds.length, emoji: "✅", color: "#10B981" },
            { label: "Badges Earned", value: earnedBadges.length, emoji: "🏅", color: "#F59E0B" },
            { label: "Best Streak", value: `${profile.streak}d`, emoji: "🔥", color: "#EF4444" },
            { label: "Total Coins", value: profile.coins.toLocaleString(), emoji: "🪙", color: "#F59E0B" },
          ].map((stat) => (
            <View key={stat.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={styles.statEmoji}>{stat.emoji}</Text>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Streak milestone */}
        <View style={[styles.milestoneCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.milestoneEmoji}>🔥</Text>
          <View style={styles.milestoneText}>
            <Text style={[styles.milestoneTitle, { color: colors.text }]}>
              {getMilestoneLabel(profile.streak)}
            </Text>
            <Text style={[styles.milestoneSub, { color: colors.textSecondary }]}>
              Current streak: {profile.streak} day{profile.streak !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        {/* Skill breakdown */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Skill Breakdown</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Skills you have practised this month
          </Text>
          {SKILL_LIST.map((skill) => {
            const skillColor = SKILL_COLORS[skill] ?? colors.accent;
            const progress = Math.random() * 0.8 + 0.1; // placeholder — real data would come from Firestore
            return (
              <View key={skill} style={styles.skillRow}>
                <Text style={[styles.skillName, { color: colors.text }]}>{skill}</Text>
                <View style={[styles.skillBarBg, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
                  <View style={[styles.skillBarFill, { width: `${progress * 100}%`, backgroundColor: skillColor }]} />
                </View>
              </View>
            );
          })}
        </View>

        {/* Recent missions */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Mission History</Text>
          {profile.completedMissionIds.length > 0 ? (
            profile.completedMissionIds.slice(0, 5).map((id, i) => (
              <View key={i} style={[styles.missionHistoryItem, { borderBottomColor: colors.border }]}>
                <Text style={styles.missionHistoryEmoji}>✅</Text>
                <Text style={[styles.missionHistoryId, { color: colors.textSecondary }]} numberOfLines={1}>
                  Mission {id.slice(0, 20)}...
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎮</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No missions completed yet. Play your first mission!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
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
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  levelCard: { borderRadius: 20, padding: 20, gap: 12 },
  levelRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  levelBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(56,189,248,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  levelNum: { color: "#38BDF8", fontSize: 22, fontWeight: "900" },
  levelTextGroup: { gap: 3 },
  levelTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  levelXP: { color: "rgba(255,255,255,0.6)", fontSize: 13 },
  levelBarBg: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 4,
    overflow: "hidden",
  },
  levelBarFill: { height: "100%", backgroundColor: "#38BDF8", borderRadius: 4 },
  totalXP: { color: "rgba(255,255,255,0.5)", fontSize: 12, textAlign: "right" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    width: "48%",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 4,
  },
  statEmoji: { fontSize: 24 },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 11, fontWeight: "500", textAlign: "center" },
  milestoneCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  milestoneEmoji: { fontSize: 32 },
  milestoneText: { gap: 3 },
  milestoneTitle: { fontSize: 16, fontWeight: "800" },
  milestoneSub: { fontSize: 12 },
  sectionCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "800" },
  sectionSubtitle: { fontSize: 12, marginTop: -6 },
  skillRow: { gap: 6 },
  skillName: { fontSize: 13, fontWeight: "600" },
  skillBarBg: { height: 6, borderRadius: 3, overflow: "hidden" },
  skillBarFill: { height: "100%", borderRadius: 3 },
  missionHistoryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  missionHistoryEmoji: { fontSize: 16 },
  missionHistoryId: { fontSize: 12, flex: 1 },
  emptyState: { alignItems: "center", gap: 8, paddingVertical: 16 },
  emptyEmoji: { fontSize: 36 },
  emptyText: { fontSize: 13, textAlign: "center" },
});

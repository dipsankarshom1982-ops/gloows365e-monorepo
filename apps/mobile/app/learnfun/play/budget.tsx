// app/learnfun/play/budget.tsx
// BudgetSimulatorGameScreen

import ParentInsightCard from "@/components/learnfun/ParentInsightCard";
import { useTheme } from "@/context/ThemeContext";
import { useLearnFun } from "@/hooks/useLearnFun";
import { FALLBACK_MISSIONS, getMissionForClass } from "@/lib/learnfun/missionData";
import { DailyMission, MissionItem } from "@/lib/learnfun/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type GameState = "intro" | "playing" | "result";

function calcScore(mission: DailyMission, selected: string[]): number {
  let score = 100;
  const items = mission.choicesOrItems ?? [];

  const needs = items.filter((i) => i.type === "need");
  const emergencies = items.filter((i) => i.type === "emergency");
  const savings = items.filter((i) => i.type === "saving");
  const wants = items.filter((i) => i.type === "want");

  const totalBudget = items.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const selectedCost = items
    .filter((i) => selected.includes(i.name))
    .reduce((sum, i) => sum + (i.price ?? 0), 0);

  // Deduct for unmet needs
  needs.forEach((n) => {
    if (!selected.includes(n.name)) score -= 20;
  });

  // Deduct for unhandled emergencies
  emergencies.forEach((e) => {
    if (!selected.includes(e.name)) score -= 15;
  });

  // Deduct for overspent wants
  if (selectedCost > totalBudget) {
    wants.forEach((w) => {
      if (selected.includes(w.name)) score -= 10;
    });
  }

  // Bonus for saving
  const hasSaving = savings.some((s) => selected.includes(s.name));
  if (hasSaving) score += 10;

  return Math.max(0, Math.min(100, score));
}

function getTypeBadgeColor(type: MissionItem["type"]): string {
  switch (type) {
    case "need": return "#10B981";
    case "emergency": return "#EF4444";
    case "want": return "#F59E0B";
    case "saving": return "#38BDF8";
    default: return "#94A3B8";
  }
}

function getTypeBadgeLabel(type: MissionItem["type"]): string {
  switch (type) {
    case "need": return "NEED";
    case "emergency": return "EMERGENCY";
    case "want": return "WANT";
    case "saving": return "SAVE";
    default: return type.toUpperCase();
  }
}

export default function BudgetSimulatorGameScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    missionId?: string;
    missionTitle?: string;
    studentClass?: string;
  }>();

  const studentClass = parseInt(params.studentClass ?? "8", 10);
  const { todaysMission, completeMission } = useLearnFun();

  const mission: DailyMission = useMemo(() => {
    if (
      todaysMission &&
      todaysMission.gameType === "budget_simulator" &&
      Array.isArray(todaysMission.choicesOrItems)
    ) return todaysMission;
    const local = getMissionForClass(studentClass);
    if (local.gameType === "budget_simulator") return local;
    return FALLBACK_MISSIONS[0];
  }, [todaysMission, studentClass]);

  const [gameState, setGameState] = useState<GameState>("intro");
  const [selected, setSelected] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(mission.timerSeconds);
  const [score, setScore] = useState(0);
  const [hintIndex, setHintIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hintRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const budget = useMemo(
    () => (mission.choicesOrItems ?? []).reduce((sum, i) => sum + (i.price ?? 0), 0),
    [mission]
  );

  const selectedCost = useMemo(
    () =>
      (mission.choicesOrItems ?? [])
        .filter((i) => selected.includes(i.name))
        .reduce((sum, i) => sum + (i.price ?? 0), 0),
    [selected, mission]
  );

  // Timer
  useEffect(() => {
    if (gameState !== "playing") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [gameState]);

  // Hint rotation
  useEffect(() => {
    if (gameState !== "playing") return;
    hintRef.current = setInterval(() => {
      setHintIndex((i) => (i + 1) % (mission.hints?.length || 1));
    }, 30000);
    return () => clearInterval(hintRef.current!);
  }, [gameState, mission.hints?.length]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    clearInterval(timerRef.current!);
    const finalScore = calcScore(mission, selected);
    setScore(finalScore);
    setGameState("result");

    try {
      const badge = finalScore >= 80 ? mission.reward.badge : undefined;
      await completeMission(mission.id, finalScore, badge);
    } catch (e) {
      console.error("[budget] completeMission error:", e);
    } finally {
      setSubmitting(false);
    }
  }, [mission, selected, completeMission, submitting]);

  const toggleItem = useCallback((itemName: string) => {
    setSelected((prev) =>
      prev.includes(itemName) ? prev.filter((n) => n !== itemName) : [...prev, itemName]
    );
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const timerColor = timeLeft <= 30 ? "#EF4444" : timeLeft <= 60 ? "#F59E0B" : "#10B981";

  // ── INTRO ──────────────────────────────────────────────────────────────────
  if (gameState === "intro") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Budget Simulator</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.introContent}>
          <Text style={styles.introEmoji}>💰</Text>
          <Text style={[styles.introTitle, { color: colors.text }]}>{mission.missionTitle}</Text>

          {/* LifeBuddy */}
          <View style={[styles.lifeBuddy, { backgroundColor: "rgba(129,140,248,0.12)" }]}>
            <Text style={{ fontSize: 28 }}>🤖</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.lifeBuddyName}>LifeBuddy</Text>
              <Text style={[styles.lifeBuddyText, { color: colors.text }]}>
                {mission.characterDialogue}
              </Text>
            </View>
          </View>

          {/* Story */}
          <View style={[styles.storyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.storyTitle, { color: colors.textSecondary }]}>The Story</Text>
            <Text style={[styles.storyText, { color: colors.text }]}>{mission.storyIntro}</Text>
          </View>

          {/* Goal */}
          <View style={[styles.goalCard, { backgroundColor: "rgba(56,189,248,0.1)", borderColor: "rgba(56,189,248,0.25)" }]}>
            <Text style={[styles.goalTitle, { color: colors.accent }]}>🎯 Your Goal</Text>
            <Text style={[styles.goalText, { color: colors.text }]}>{mission.goal}</Text>
          </View>

          {/* Reward preview */}
          <View style={[styles.rewardPreview, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.rewardPreviewTitle, { color: colors.textSecondary }]}>Rewards</Text>
            <View style={styles.rewardRow}>
              <Text style={styles.rewardItem}>🪙 {mission.reward.coins} coins</Text>
              <Text style={styles.rewardItem}>⚡ {mission.reward.xp} XP</Text>
              {mission.reward.badge && <Text style={styles.rewardItem}>🏅 Badge</Text>}
            </View>
          </View>

          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => setGameState("playing")}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#F59E0B", "#D97706"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.startBtnGradient}
            >
              <Text style={styles.startBtnText}>Start Mission 🚀</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── PLAYING ────────────────────────────────────────────────────────────────
  if (gameState === "playing") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top bar */}
        <View style={[styles.playTopBar, { borderBottomColor: colors.border }]}>
          <View style={styles.budgetDisplay}>
            <Text style={[styles.budgetLabel, { color: colors.textSecondary }]}>Budget</Text>
            <Text style={[styles.budgetAmount, { color: "#F59E0B" }]}>₹{budget}</Text>
          </View>
          <View style={[styles.timerPill, { backgroundColor: `${timerColor}20` }]}>
            <Ionicons name="time-outline" size={14} color={timerColor} />
            <Text style={[styles.timerText, { color: timerColor }]}>{formatTime(timeLeft)}</Text>
          </View>
          <View style={styles.spentDisplay}>
            <Text style={[styles.budgetLabel, { color: colors.textSecondary }]}>Spent</Text>
            <Text style={[styles.budgetAmount, { color: selectedCost > budget ? "#EF4444" : colors.text }]}>
              ₹{selectedCost}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.playContent}>
          {/* LifeBuddy hint */}
          <Animated.View style={[styles.lifeBuddy, { backgroundColor: "rgba(129,140,248,0.12)", opacity: fadeAnim }]}>
            <Text style={{ fontSize: 28 }}>🤖</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.lifeBuddyName}>LifeBuddy</Text>
              <Text style={[styles.lifeBuddyText, { color: colors.text }]}>
                {mission.hints[hintIndex]}
              </Text>
            </View>
          </Animated.View>

          {/* Items grid */}
          <Text style={[styles.itemsHeading, { color: colors.textSecondary }]}>
            Tap items to select or deselect:
          </Text>

          <View style={styles.itemsGrid}>
            {(mission.choicesOrItems ?? []).map((item) => {
              const isSelected = selected.includes(item.name);
              const typeColor = getTypeBadgeColor(item.type);
              return (
                <TouchableOpacity
                  key={item.name}
                  onPress={() => toggleItem(item.name)}
                  activeOpacity={0.8}
                  style={[
                    styles.itemCard,
                    {
                      backgroundColor: isSelected ? `${typeColor}20` : colors.card,
                      borderColor: isSelected ? typeColor : colors.border,
                    },
                  ]}
                >
                  <Text style={styles.itemEmoji}>{item.emoji ?? "📦"}</Text>
                  <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  {item.price !== undefined && (
                    <Text style={[styles.itemPrice, { color: "#F59E0B" }]}>₹{item.price}</Text>
                  )}
                  <View style={[styles.typeBadge, { backgroundColor: `${typeColor}25` }]}>
                    <Text style={[styles.typeBadgeText, { color: typeColor }]}>
                      {getTypeBadgeLabel(item.type)}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={[styles.checkmark, { backgroundColor: typeColor }]}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Bottom bar */}
        <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={styles.runningTotal}>
            <Text style={[styles.runningTotalText, { color: colors.textSecondary }]}>
              Selected: <Text style={{ color: "#F59E0B", fontWeight: "800" }}>₹{selectedCost}</Text>
              {"  "}Budget: <Text style={{ color: colors.text, fontWeight: "800" }}>₹{budget}</Text>
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={styles.submitBtn}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#F59E0B", "#D97706"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitBtnGradient}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Choices ✓</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── RESULT ─────────────────────────────────────────────────────────────────
  const isSuccess = score >= 60;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Mission Complete!</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.resultContent}>
        <Text style={styles.resultEmoji}>{isSuccess ? "🎉" : "😅"}</Text>
        <Text style={[styles.resultTitle, { color: colors.text }]}>
          {isSuccess ? "Mission Accomplished!" : "Try Again!"}
        </Text>

        {/* Score */}
        <View style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>Your Score</Text>
          <Text style={[styles.scoreValue, { color: isSuccess ? "#10B981" : "#EF4444" }]}>
            {score}%
          </Text>
          <View style={styles.scoreBarBg}>
            <View style={[styles.scoreBarFill, { width: `${score}%`, backgroundColor: isSuccess ? "#10B981" : "#EF4444" }]} />
          </View>
        </View>

        {/* Feedback */}
        <View style={[styles.feedbackCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.feedbackText, { color: colors.text }]}>
            {isSuccess ? mission.successFeedback : mission.tryAgainFeedback}
          </Text>
        </View>

        {/* Reward */}
        {isSuccess && (
          <View style={[styles.rewardCard, { backgroundColor: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.3)" }]}>
            <Text style={[styles.rewardTitle, { color: "#F59E0B" }]}>🎁 Rewards Earned</Text>
            <View style={styles.rewardRow}>
              <Text style={styles.rewardItem}>🪙 {Math.round((mission.reward.coins * score) / 100)} coins</Text>
              <Text style={styles.rewardItem}>⚡ {Math.round((mission.reward.xp * score) / 100)} XP</Text>
            </View>
          </View>
        )}

        {/* Parent Insight */}
        <ParentInsightCard
          insight={mission.parentInsight}
          skill={mission.skill}
          score={score}
        />

        {/* Buttons */}
        <View style={styles.resultButtons}>
          <TouchableOpacity
            onPress={() => {
              setGameState("intro");
              setSelected([]);
              setTimeLeft(mission.timerSeconds);
              setScore(0);
              setHintIndex(0);
              setSubmitting(false);
            }}
            style={[styles.retryBtn, { borderColor: colors.border }]}
          >
            <Text style={[styles.retryBtnText, { color: colors.textSecondary }]}>
              🔄 Play Again
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.claimBtn}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#F59E0B", "#D97706"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.claimBtnGradient}
            >
              <Text style={styles.claimBtnText}>🚀 Back to Home</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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

  // Intro
  introContent: { padding: 20, gap: 16, paddingBottom: 40 },
  introEmoji: { fontSize: 56, textAlign: "center" },
  introTitle: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  lifeBuddy: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 16,
  },
  lifeBuddyName: { color: "#818CF8", fontWeight: "800", fontSize: 11 },
  lifeBuddyText: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  storyCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 6 },
  storyTitle: { fontSize: 12, fontWeight: "600" },
  storyText: { fontSize: 14, lineHeight: 21 },
  goalCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 6 },
  goalTitle: { fontSize: 13, fontWeight: "700" },
  goalText: { fontSize: 14, lineHeight: 21 },
  rewardPreview: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  rewardPreviewTitle: { fontSize: 12, fontWeight: "600" },
  rewardRow: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  rewardItem: { fontSize: 14, fontWeight: "700", color: "#F59E0B" },
  startBtn: { borderRadius: 16, overflow: "hidden" },
  startBtnGradient: {
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 16,
  },
  startBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },

  // Playing
  playTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  budgetDisplay: { alignItems: "center", gap: 2 },
  budgetLabel: { fontSize: 10, fontWeight: "500" },
  budgetAmount: { fontSize: 18, fontWeight: "800" },
  spentDisplay: { alignItems: "center", gap: 2 },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  timerText: { fontSize: 16, fontWeight: "800" },
  playContent: { padding: 16, gap: 14, paddingBottom: 120 },
  itemsHeading: { fontSize: 12, fontWeight: "600" },
  itemsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  itemCard: {
    width: "47%",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    gap: 6,
    alignItems: "flex-start",
  },
  itemEmoji: { fontSize: 28 },
  itemName: { fontSize: 13, fontWeight: "600", lineHeight: 17 },
  itemPrice: { fontSize: 16, fontWeight: "800" },
  typeBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  typeBadgeText: { fontSize: 9, fontWeight: "800" },
  checkmark: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
  },
  runningTotal: { alignItems: "center" },
  runningTotalText: { fontSize: 13 },
  submitBtn: { borderRadius: 14, overflow: "hidden" },
  submitBtnGradient: { paddingVertical: 14, alignItems: "center", borderRadius: 14 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  // Result
  resultContent: { padding: 20, gap: 16, paddingBottom: 40 },
  resultEmoji: { fontSize: 60, textAlign: "center" },
  resultTitle: { fontSize: 24, fontWeight: "800", textAlign: "center" },
  scoreCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  scoreLabel: { fontSize: 13, fontWeight: "600" },
  scoreValue: { fontSize: 48, fontWeight: "900" },
  scoreBarBg: {
    width: "100%",
    height: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 4,
    overflow: "hidden",
  },
  scoreBarFill: { height: "100%", borderRadius: 4 },
  feedbackCard: { borderRadius: 16, padding: 16, borderWidth: 1 },
  feedbackText: { fontSize: 14, lineHeight: 21 },
  rewardCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  rewardTitle: { fontSize: 15, fontWeight: "700" },
  resultButtons: { flexDirection: "row", gap: 12 },
  retryBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  retryBtnText: { fontSize: 14, fontWeight: "700" },
  claimBtn: { flex: 2, borderRadius: 14, overflow: "hidden" },
  claimBtnGradient: { paddingVertical: 14, alignItems: "center", borderRadius: 14 },
  claimBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});

// app/learnfun/play/time-planner.tsx
// TimePlannerGameScreen

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
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type GameState = "intro" | "playing" | "result";

// Time slots: 6am to 10pm in 2-hour blocks
const TIME_SLOTS = [
  "6:00 AM", "8:00 AM", "10:00 AM", "12:00 PM",
  "2:00 PM", "4:00 PM", "6:00 PM", "8:00 PM", "10:00 PM",
];

function scorePlan(assignments: Record<string, string>, tasks: MissionItem[]): number {
  let score = 60; // base

  const assignedTasks = Object.values(assignments);
  const studyTasks = tasks.filter(
    (t) => t.name.toLowerCase().includes("study") || t.name.toLowerCase().includes("homework") ||
      t.name.toLowerCase().includes("maths") || t.name.toLowerCase().includes("science") ||
      t.name.toLowerCase().includes("english") || t.name.toLowerCase().includes("board") ||
      t.name.toLowerCase().includes("practice") || t.name.toLowerCase().includes("revision")
  );
  const sleepTask = tasks.find((t) => t.name.toLowerCase().includes("sleep"));
  const playTask = tasks.find(
    (t) => t.name.toLowerCase().includes("play") || t.name.toLowerCase().includes("sport") ||
      t.name.toLowerCase().includes("cricket") || t.name.toLowerCase().includes("exercise")
  );

  // Study coverage
  const studyAssigned = studyTasks.filter((t) => assignedTasks.includes(t.name)).length;
  const studyCoverage = studyTasks.length > 0 ? studyAssigned / studyTasks.length : 1;
  score += Math.round(studyCoverage * 20);

  // Sleep assigned
  if (sleepTask && assignedTasks.includes(sleepTask.name)) score += 10;

  // Play assigned
  if (playTask && assignedTasks.includes(playTask.name)) score += 10;

  // All tasks assigned bonus
  const totalAssigned = Object.keys(assignments).length;
  if (totalAssigned >= tasks.length - 1) score += 10; // -1 to allow 1 optional skip

  return Math.max(0, Math.min(100, score));
}

export default function TimePlannerGameScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ missionId?: string; studentClass?: string }>();
  const studentClass = parseInt(params.studentClass ?? "8", 10);

  const { todaysMission, completeMission } = useLearnFun();

  const mission: DailyMission = useMemo(() => {
    if (
      todaysMission &&
      todaysMission.gameType === "time_planner" &&
      Array.isArray(todaysMission.choicesOrItems) &&
      Array.isArray(todaysMission.hints)
    ) return todaysMission;
    const local = getMissionForClass(studentClass);
    if (local.gameType === "time_planner") return local;
    return FALLBACK_MISSIONS[1];
  }, [todaysMission, studentClass]);

  const [gameState, setGameState] = useState<GameState>("intro");
  const [timeLeft, setTimeLeft] = useState(mission.timerSeconds);
  const [score, setScore] = useState(0);
  const [hintIndex, setHintIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  // assignments: taskName -> slotLabel
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hintRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tasks = mission.choicesOrItems ?? [];

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
    const finalScore = scorePlan(assignments, tasks);
    setScore(finalScore);
    setGameState("result");
    try {
      await completeMission(mission.id, finalScore, finalScore >= 80 ? mission.reward.badge : undefined);
    } catch (e) {
      console.error("[time-planner] completeMission:", e);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, assignments, tasks, mission, completeMission]);

  const handleTaskSelect = useCallback((taskName: string) => {
    setSelectedTask((prev) => (prev === taskName ? null : taskName));
  }, []);

  const handleSlotAssign = useCallback((slot: string) => {
    if (!selectedTask) return;
    setAssignments((prev) => ({ ...prev, [selectedTask]: slot }));
    setSelectedTask(null);
  }, [selectedTask]);

  const getSlotTask = useCallback(
    (slot: string) => Object.entries(assignments).find(([, s]) => s === slot)?.[0] ?? null,
    [assignments]
  );

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const timerColor = timeLeft <= 30 ? "#EF4444" : timeLeft <= 60 ? "#F59E0B" : "#10B981";
  const isSuccess = score >= 60;

  // ── INTRO ──────────────────────────────────────────────────────────────────
  if (gameState === "intro") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Time Planner</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.introContent}>
          <Text style={styles.introEmoji}>⏰</Text>
          <Text style={[styles.introTitle, { color: colors.text }]}>{mission.missionTitle}</Text>

          <View style={[styles.lifeBuddy, { backgroundColor: "rgba(129,140,248,0.12)" }]}>
            <Text style={{ fontSize: 28 }}>🤖</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.lifeBuddyName}>LifeBuddy</Text>
              <Text style={[styles.lifeBuddyText, { color: colors.text }]}>
                {mission.characterDialogue}
              </Text>
            </View>
          </View>

          <View style={[styles.storyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.storyTitle, { color: colors.textSecondary }]}>The Story</Text>
            <Text style={[styles.storyText, { color: colors.text }]}>{mission.storyIntro}</Text>
          </View>

          <View style={[styles.goalCard, { backgroundColor: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.25)" }]}>
            <Text style={[styles.goalTitle, { color: "#10B981" }]}>🎯 Your Goal</Text>
            <Text style={[styles.goalText, { color: colors.text }]}>{mission.goal}</Text>
          </View>

          <View style={[styles.howToCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.howToTitle, { color: colors.text }]}>📋 How to Play</Text>
            <Text style={[styles.howToText, { color: colors.textSecondary }]}>
              1. Tap a task from the list below{"\n"}
              2. Tap a time slot on the timeline to assign it{"\n"}
              3. Cover all important tasks{"\n"}
              4. Hit "Check Plan" when done!
            </Text>
          </View>

          <View style={[styles.rewardPreview, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.rewardPreviewTitle, { color: colors.textSecondary }]}>Rewards</Text>
            <View style={styles.rewardRow}>
              <Text style={styles.rewardItem}>🪙 {mission.reward.coins} coins</Text>
              <Text style={styles.rewardItem}>⚡ {mission.reward.xp} XP</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => setGameState("playing")}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#10B981", "#059669"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.startBtnGradient}
            >
              <Text style={styles.startBtnText}>Start Planning 🚀</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── PLAYING ────────────────────────────────────────────────────────────────
  if (gameState === "playing") {
    const assignedTaskNames = Object.keys(assignments);
    const unassignedTasks = tasks.filter((t) => !assignedTaskNames.includes(t.name));

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top bar */}
        <View style={[styles.playTopBar, { borderBottomColor: colors.border }]}>
          <Text style={[styles.playTitle, { color: colors.text }]}>Plan Your Day</Text>
          <View style={[styles.timerPill, { backgroundColor: `${timerColor}20` }]}>
            <Ionicons name="time-outline" size={14} color={timerColor} />
            <Text style={[styles.timerText, { color: timerColor }]}>{formatTime(timeLeft)}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.playContent}>
          {/* LifeBuddy hint */}
          <View style={[styles.lifeBuddy, { backgroundColor: "rgba(129,140,248,0.12)" }]}>
            <Text style={{ fontSize: 28 }}>🤖</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.lifeBuddyName}>LifeBuddy</Text>
              <Text style={[styles.lifeBuddyText, { color: colors.text }]}>
                {mission.hints[hintIndex]}
              </Text>
            </View>
          </View>

          {/* Instructions */}
          {selectedTask && (
            <View style={[styles.instructionBanner, { backgroundColor: "rgba(16,185,129,0.15)" }]}>
              <Text style={[styles.instructionText, { color: "#10B981" }]}>
                ✅ "{selectedTask}" selected — tap a time slot to assign!
              </Text>
            </View>
          )}

          {/* Timeline */}
          <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
            📅 Day Timeline (tap a slot to assign)
          </Text>

          <View style={[styles.timeline, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {TIME_SLOTS.map((slot) => {
              const assignedTo = getSlotTask(slot);
              return (
                <TouchableOpacity
                  key={slot}
                  onPress={() => handleSlotAssign(slot)}
                  style={[
                    styles.timeSlot,
                    { borderBottomColor: colors.border },
                    assignedTo ? { backgroundColor: "rgba(16,185,129,0.12)" } : {},
                    selectedTask && !assignedTo ? { backgroundColor: "rgba(56,189,248,0.08)" } : {},
                  ]}
                >
                  <Text style={[styles.slotTime, { color: colors.textSecondary }]}>{slot}</Text>
                  {assignedTo ? (
                    <View style={styles.slotTaskRow}>
                      <Text style={[styles.slotTaskName, { color: "#10B981" }]} numberOfLines={1}>
                        {assignedTo}
                      </Text>
                      <TouchableOpacity
                        onPress={() =>
                          setAssignments((prev) => {
                            const next = { ...prev };
                            delete next[assignedTo];
                            return next;
                          })
                        }
                      >
                        <Ionicons name="close-circle" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={[styles.slotEmpty, { color: colors.border }]}>
                      {selectedTask ? "← Tap to assign" : "Empty"}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Unassigned tasks */}
          <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
            📋 Tasks to assign ({unassignedTasks.length} remaining)
          </Text>

          <View style={styles.tasksPool}>
            {unassignedTasks.map((task) => (
              <TouchableOpacity
                key={task.name}
                onPress={() => handleTaskSelect(task.name)}
                style={[
                  styles.taskChip,
                  {
                    backgroundColor: selectedTask === task.name ? "rgba(16,185,129,0.25)" : colors.card,
                    borderColor: selectedTask === task.name ? "#10B981" : colors.border,
                  },
                ]}
              >
                <Text style={styles.taskChipEmoji}>{task.emoji ?? "📌"}</Text>
                <Text style={[styles.taskChipName, { color: colors.text }]} numberOfLines={1}>
                  {task.name}
                </Text>
              </TouchableOpacity>
            ))}
            {unassignedTasks.length === 0 && (
              <Text style={[styles.allAssigned, { color: "#10B981" }]}>
                ✅ All tasks assigned! Hit "Check Plan"!
              </Text>
            )}
          </View>
        </ScrollView>

        {/* Bottom bar */}
        <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {assignedTaskNames.length}/{tasks.length} tasks scheduled
          </Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={styles.submitBtn}
          >
            <LinearGradient
              colors={["#10B981", "#059669"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitBtnGradient}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Check Plan ✓</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── RESULT ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Plan Result</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.resultContent}>
        <Text style={styles.resultEmoji}>{isSuccess ? "🎉" : "😅"}</Text>
        <Text style={[styles.resultTitle, { color: colors.text }]}>
          {isSuccess ? "Great Plan!" : "Needs Work!"}
        </Text>

        <View style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>Plan Score</Text>
          <Text style={[styles.scoreValue, { color: isSuccess ? "#10B981" : "#EF4444" }]}>{score}%</Text>
          <View style={styles.scoreBarBg}>
            <View style={[styles.scoreBarFill, { width: `${score}%`, backgroundColor: isSuccess ? "#10B981" : "#EF4444" }]} />
          </View>
        </View>

        <View style={[styles.feedbackCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.feedbackText, { color: colors.text }]}>
            {isSuccess ? mission.successFeedback : mission.tryAgainFeedback}
          </Text>
        </View>

        <ParentInsightCard insight={mission.parentInsight} skill={mission.skill} score={score} />

        <View style={styles.resultButtons}>
          <TouchableOpacity
            onPress={() => {
              setGameState("intro");
              setAssignments({});
              setSelectedTask(null);
              setTimeLeft(mission.timerSeconds);
              setScore(0);
              setSubmitting(false);
            }}
            style={[styles.retryBtn, { borderColor: colors.border }]}
          >
            <Text style={[styles.retryBtnText, { color: colors.textSecondary }]}>🔄 Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.claimBtn}>
            <LinearGradient
              colors={["#10B981", "#059669"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.claimBtnGradient}
            >
              <Text style={styles.claimBtnText}>🏠 Back to Home</Text>
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
  howToCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 6 },
  howToTitle: { fontSize: 13, fontWeight: "700" },
  howToText: { fontSize: 13, lineHeight: 20 },
  rewardPreview: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  rewardPreviewTitle: { fontSize: 12, fontWeight: "600" },
  rewardRow: { flexDirection: "row", gap: 16 },
  rewardItem: { fontSize: 14, fontWeight: "700", color: "#F59E0B" },
  startBtn: { borderRadius: 16, overflow: "hidden" },
  startBtnGradient: { paddingVertical: 16, alignItems: "center", borderRadius: 16 },
  startBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  playTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  playTitle: { fontSize: 16, fontWeight: "700" },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  timerText: { fontSize: 16, fontWeight: "800" },
  playContent: { padding: 16, gap: 14, paddingBottom: 100 },
  instructionBanner: { borderRadius: 12, padding: 12 },
  instructionText: { fontSize: 13, fontWeight: "600" },
  sectionHeading: { fontSize: 12, fontWeight: "600" },
  timeline: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  timeSlot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    minHeight: 48,
  },
  slotTime: { fontSize: 13, fontWeight: "600", width: 80 },
  slotTaskRow: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  slotTaskName: { flex: 1, fontSize: 13, fontWeight: "600" },
  slotEmpty: { fontSize: 12, fontStyle: "italic" },
  tasksPool: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  taskChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    maxWidth: "48%",
  },
  taskChipEmoji: { fontSize: 16 },
  taskChipName: { fontSize: 12, fontWeight: "600", flex: 1 },
  allAssigned: { fontSize: 14, fontWeight: "700" },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
  },
  progressText: { fontSize: 12, textAlign: "center" },
  submitBtn: { borderRadius: 14, overflow: "hidden" },
  submitBtnGradient: { paddingVertical: 14, alignItems: "center", borderRadius: 14 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  resultContent: { padding: 20, gap: 16, paddingBottom: 40 },
  resultEmoji: { fontSize: 60, textAlign: "center" },
  resultTitle: { fontSize: 24, fontWeight: "800", textAlign: "center" },
  scoreCard: { borderRadius: 16, padding: 20, borderWidth: 1, alignItems: "center", gap: 8 },
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
  resultButtons: { flexDirection: "row", gap: 12 },
  retryBtn: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 14, alignItems: "center" },
  retryBtnText: { fontSize: 14, fontWeight: "700" },
  claimBtn: { flex: 2, borderRadius: 14, overflow: "hidden" },
  claimBtnGradient: { paddingVertical: 14, alignItems: "center", borderRadius: 14 },
  claimBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});

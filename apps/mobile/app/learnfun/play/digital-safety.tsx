// app/learnfun/play/digital-safety.tsx
// DigitalSafetyDefenderGameScreen

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

// Determine if an item is "safe" or "unsafe" based on its type
function isItemSafe(item: MissionItem): boolean {
  return item.type === "need" || item.type === "task";
}

interface ItemVerdict {
  itemName: string;
  playerSaidSafe: boolean;
  correctAnswer: boolean;
  isCorrect: boolean;
}

export default function DigitalSafetyDefenderGameScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ missionId?: string; studentClass?: string }>();
  const studentClass = parseInt(params.studentClass ?? "8", 10);

  const { todaysMission, completeMission } = useLearnFun();

  const mission: DailyMission = useMemo(() => {
    if (
      todaysMission &&
      todaysMission.gameType === "digital_safety" &&
      Array.isArray(todaysMission.choicesOrItems) &&
      Array.isArray(todaysMission.hints)
    ) return todaysMission;
    const local = getMissionForClass(studentClass);
    if (local.gameType === "digital_safety") return local;
    return FALLBACK_MISSIONS[2];
  }, [todaysMission, studentClass]);

  const [gameState, setGameState] = useState<GameState>("intro");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [verdicts, setVerdicts] = useState<ItemVerdict[]>([]);
  const [timeLeft, setTimeLeft] = useState(mission.timerSeconds);
  const [hintIndex, setHintIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [lastCorrect, setLastCorrect] = useState(true);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hintRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const items = mission.choicesOrItems ?? [];
  const currentItem = items[currentIndex];
  const isLastItem = currentIndex >= items.length - 1;

  useEffect(() => {
    if (gameState !== "playing") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          finishGame([...verdicts]);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [gameState]);

  useEffect(() => {
    if (gameState !== "playing") return;
    hintRef.current = setInterval(() => {
      setHintIndex((i) => (i + 1) % (mission.hints?.length || 1));
    }, 20000);
    return () => clearInterval(hintRef.current!);
  }, [gameState, mission.hints?.length]);

  const finishGame = useCallback(
    async (finalVerdicts: ItemVerdict[]) => {
      if (submitting) return;
      setSubmitting(true);
      clearInterval(timerRef.current!);

      const correct = finalVerdicts.filter((v) => v.isCorrect).length;
      const total = finalVerdicts.length;
      const percentScore = total > 0 ? Math.round((correct / total) * 100) : 0;

      setGameState("result");

      try {
        await completeMission(
          mission.id,
          percentScore,
          percentScore >= 80 ? mission.reward.badge : undefined
        );
      } catch (e) {
        console.error("[digital-safety] completeMission:", e);
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, mission, completeMission]
  );

  const handleVerdict = useCallback(
    (playerSaidSafe: boolean) => {
      if (!currentItem) return;

      const correct = isItemSafe(currentItem);
      const isCorrect = playerSaidSafe === correct;

      const newVerdict: ItemVerdict = {
        itemName: currentItem.name,
        playerSaidSafe,
        correctAnswer: correct,
        isCorrect,
      };

      setLastCorrect(isCorrect);
      setFeedbackVisible(true);

      if (!isCorrect) {
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 6, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
        ]).start();
      }

      const newVerdicts = [...verdicts, newVerdict];
      setVerdicts(newVerdicts);

      setTimeout(() => {
        setFeedbackVisible(false);
        if (isLastItem) {
          finishGame(newVerdicts);
        } else {
          setCurrentIndex((i) => i + 1);
        }
      }, 1200);
    },
    [currentItem, isLastItem, verdicts, finishGame, shakeAnim]
  );

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const timerColor = timeLeft <= 30 ? "#EF4444" : timeLeft <= 60 ? "#F59E0B" : "#0EA5E9";

  const correctCount = verdicts.filter((v) => v.isCorrect).length;
  const percentScore = verdicts.length > 0 ? Math.round((correctCount / verdicts.length) * 100) : 0;
  const isSuccess = percentScore >= 60;

  // ── INTRO ──────────────────────────────────────────────────────────────────
  if (gameState === "intro") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Cyber Defender</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.introContent}>
          <Text style={styles.introEmoji}>🛡️</Text>
          <Text style={[styles.introTitle, { color: colors.text }]}>{mission.missionTitle}</Text>

          <View style={[styles.lifeBuddy, { backgroundColor: "rgba(129,140,248,0.12)" }]}>
            <Text style={{ fontSize: 28 }}>🤖</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.lifeBuddyName}>LifeBuddy</Text>
              <Text style={[styles.lifeBuddyText, { color: colors.text }]}>
                You are a Cyber Detective! Messages, links and requests will appear. Tap SAFE or UNSAFE for each one. Be fast — the clock is ticking!
              </Text>
            </View>
          </View>

          <View style={[styles.storyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.storyTitle, { color: colors.textSecondary }]}>The Mission</Text>
            <Text style={[styles.storyText, { color: colors.text }]}>{mission.storyIntro}</Text>
          </View>

          <View style={[styles.tipCard, { backgroundColor: "rgba(14,165,233,0.1)", borderColor: "rgba(14,165,233,0.25)" }]}>
            <Text style={[styles.tipTitle, { color: "#0EA5E9" }]}>🔍 Cyber Detective Tips</Text>
            {(mission.hints ?? []).slice(0, 3).map((hint, i) => (
              <Text key={i} style={[styles.tipText, { color: colors.text }]}>• {hint}</Text>
            ))}
          </View>

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
              colors={["#0EA5E9", "#0284C7"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.startBtnGradient}
            >
              <Text style={styles.startBtnText}>Start Defending 🛡️</Text>
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
          <View style={styles.scoreDisplay}>
            <Text style={[styles.scoreDisplayLabel, { color: colors.textSecondary }]}>Score</Text>
            <Text style={[styles.scoreDisplayValue, { color: "#0EA5E9" }]}>{correctCount}/{currentIndex}</Text>
          </View>
          <View style={[styles.timerPill, { backgroundColor: `${timerColor}20` }]}>
            <Ionicons name="time-outline" size={14} color={timerColor} />
            <Text style={[styles.timerText, { color: timerColor }]}>{formatTime(timeLeft)}</Text>
          </View>
          <View style={styles.progressDisplay}>
            <Text style={[styles.scoreDisplayLabel, { color: colors.textSecondary }]}>Item</Text>
            <Text style={[styles.scoreDisplayValue, { color: colors.text }]}>
              {currentIndex + 1}/{items.length}
            </Text>
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

          {/* Current item card */}
          {currentItem && (
            <Animated.View
              style={[
                styles.itemCard,
                {
                  backgroundColor: colors.card,
                  borderColor: feedbackVisible
                    ? lastCorrect ? "#10B981" : "#EF4444"
                    : colors.border,
                  transform: [{ translateX: shakeAnim }],
                },
              ]}
            >
              <Text style={styles.itemEmoji}>{currentItem.emoji ?? "📩"}</Text>
              <Text style={[styles.itemLabel, { color: colors.textSecondary }]}>
                INCOMING MESSAGE / REQUEST
              </Text>
              <Text style={[styles.itemText, { color: colors.text }]}>{currentItem.name}</Text>

              {feedbackVisible && (
                <View style={[
                  styles.feedbackOverlay,
                  { backgroundColor: lastCorrect ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)" },
                ]}>
                  <Text style={{ fontSize: 36 }}>{lastCorrect ? "✅" : "❌"}</Text>
                  <Text style={[{ color: lastCorrect ? "#10B981" : "#EF4444", fontWeight: "800", fontSize: 16 }]}>
                    {lastCorrect ? "Correct!" : "Wrong!"}
                  </Text>
                  <Text style={[{ color: colors.textSecondary, fontSize: 12, textAlign: "center" }]}>
                    This was {isItemSafe(currentItem) ? "SAFE ✅" : "UNSAFE ⚠️"}
                  </Text>
                </View>
              )}
            </Animated.View>
          )}

          {/* SAFE / UNSAFE buttons */}
          <View style={styles.verdictButtons}>
            <TouchableOpacity
              onPress={() => handleVerdict(true)}
              disabled={feedbackVisible}
              style={styles.safeBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.safeBtnEmoji}>✅</Text>
              <Text style={styles.safeBtnText}>SAFE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleVerdict(false)}
              disabled={feedbackVisible}
              style={styles.unsafeBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.unsafeBtnEmoji}>⚠️</Text>
              <Text style={styles.unsafeBtnText}>UNSAFE</Text>
            </TouchableOpacity>
          </View>

          {/* Progress mini-bar */}
          <View style={[styles.miniProgressBg, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
            <View
              style={[
                styles.miniProgressFill,
                {
                  width: `${(currentIndex / items.length) * 100}%`,
                  backgroundColor: "#0EA5E9",
                },
              ]}
            />
          </View>
        </ScrollView>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Mission Complete!</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.resultContent}>
        <Text style={styles.resultEmoji}>{isSuccess ? "🎉" : "🕵️"}</Text>
        <Text style={[styles.resultTitle, { color: colors.text }]}>
          {isSuccess ? "Cyber Guardian!" : "Keep Practising!"}
        </Text>

        <View style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>Detection Score</Text>
          <Text style={[styles.scoreValue, { color: isSuccess ? "#0EA5E9" : "#EF4444" }]}>{percentScore}%</Text>
          <Text style={[{ color: colors.textSecondary, fontSize: 12 }]}>
            {correctCount} correct out of {verdicts.length}
          </Text>
          <View style={styles.scoreBarBg}>
            <View style={[styles.scoreBarFill, { width: `${percentScore}%`, backgroundColor: isSuccess ? "#0EA5E9" : "#EF4444" }]} />
          </View>
        </View>

        {/* Verdict recap */}
        <View style={[styles.verdictRecap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.recapTitle, { color: colors.text }]}>Your Verdicts</Text>
          {verdicts.map((v, i) => (
            <View key={i} style={styles.verdictItem}>
              <Text style={{ fontSize: 16 }}>{v.isCorrect ? "✅" : "❌"}</Text>
              <Text style={[styles.verdictItemText, { color: colors.textSecondary }]} numberOfLines={2}>
                {v.itemName}
              </Text>
              <Text style={{ color: v.correctAnswer ? "#10B981" : "#EF4444", fontSize: 11, fontWeight: "700" }}>
                {v.correctAnswer ? "SAFE" : "UNSAFE"}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.feedbackCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.feedbackText, { color: colors.text }]}>
            {isSuccess ? mission.successFeedback : mission.tryAgainFeedback}
          </Text>
        </View>

        <ParentInsightCard insight={mission.parentInsight} skill={mission.skill} score={percentScore} />

        <View style={styles.resultButtons}>
          <TouchableOpacity
            onPress={() => {
              setGameState("intro");
              setCurrentIndex(0);
              setVerdicts([]);
              setTimeLeft(mission.timerSeconds);
              setFeedbackVisible(false);
            }}
            style={[styles.retryBtn, { borderColor: colors.border }]}
          >
            <Text style={[styles.retryBtnText, { color: colors.textSecondary }]}>🔄 Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.claimBtn}>
            <LinearGradient
              colors={["#0EA5E9", "#0284C7"]}
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
  tipCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  tipTitle: { fontSize: 13, fontWeight: "700" },
  tipText: { fontSize: 13, lineHeight: 19 },
  rewardPreview: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  rewardPreviewTitle: { fontSize: 12, fontWeight: "600" },
  rewardRow: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
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
  scoreDisplay: { alignItems: "center", gap: 2 },
  scoreDisplayLabel: { fontSize: 10, fontWeight: "500" },
  scoreDisplayValue: { fontSize: 16, fontWeight: "800" },
  progressDisplay: { alignItems: "center", gap: 2 },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  timerText: { fontSize: 16, fontWeight: "800" },
  playContent: { padding: 20, gap: 16, paddingBottom: 40 },
  itemCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 2,
    alignItems: "center",
    gap: 12,
    minHeight: 200,
    justifyContent: "center",
  },
  itemEmoji: { fontSize: 48 },
  itemLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  itemText: { fontSize: 16, fontWeight: "700", textAlign: "center", lineHeight: 22 },
  feedbackOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  verdictButtons: { flexDirection: "row", gap: 16 },
  safeBtn: {
    flex: 1,
    backgroundColor: "rgba(16,185,129,0.2)",
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: "center",
    gap: 6,
    borderWidth: 2,
    borderColor: "#10B981",
  },
  safeBtnEmoji: { fontSize: 32 },
  safeBtnText: { color: "#10B981", fontSize: 18, fontWeight: "900" },
  unsafeBtn: {
    flex: 1,
    backgroundColor: "rgba(239,68,68,0.15)",
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: "center",
    gap: 6,
    borderWidth: 2,
    borderColor: "#EF4444",
  },
  unsafeBtnEmoji: { fontSize: 32 },
  unsafeBtnText: { color: "#EF4444", fontSize: 18, fontWeight: "900" },
  miniProgressBg: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 8,
  },
  miniProgressFill: { height: "100%", borderRadius: 3 },
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
  verdictRecap: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  recapTitle: { fontSize: 14, fontWeight: "700" },
  verdictItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  verdictItemText: { flex: 1, fontSize: 12, lineHeight: 17 },
  feedbackCard: { borderRadius: 16, padding: 16, borderWidth: 1 },
  feedbackText: { fontSize: 14, lineHeight: 21 },
  resultButtons: { flexDirection: "row", gap: 12 },
  retryBtn: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 14, alignItems: "center" },
  retryBtnText: { fontSize: 14, fontWeight: "700" },
  claimBtn: { flex: 2, borderRadius: 14, overflow: "hidden" },
  claimBtnGradient: { paddingVertical: 14, alignItems: "center", borderRadius: 14 },
  claimBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});

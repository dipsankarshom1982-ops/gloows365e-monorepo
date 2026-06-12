// app/learnfun/play/choice-story.tsx
// ChoiceStoryGameScreen

import ParentInsightCard from "@/components/learnfun/ParentInsightCard";
import { useTheme } from "@/context/ThemeContext";
import { useLearnFun } from "@/hooks/useLearnFun";
import { FALLBACK_MISSIONS, getMissionForClass } from "@/lib/learnfun/missionData";
import { DailyMission } from "@/lib/learnfun/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
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

// Story steps are generated from mission data
// Each step has: scene text, character dialogue, 2-3 choices with points
interface StoryStep {
  sceneText: string;
  characterSays: string;
  choices: { label: string; points: number; feedback: string }[];
}

function buildStorySteps(mission: DailyMission): StoryStep[] {
  // Build story steps from mission hints and goal
  // Using storyIntro as scene 1, then cycling hints as subsequent scenes
  const steps: StoryStep[] = [
    {
      sceneText: mission.storyIntro,
      characterSays: mission.characterDialogue,
      choices: [
        { label: "Think carefully before deciding", points: 20, feedback: "Great thinking! Taking time to decide is always wise." },
        { label: "Ask a trusted adult for help", points: 15, feedback: "Good choice! Seeking guidance shows maturity." },
        { label: "Go with the first idea", points: 5, feedback: "Sometimes quick decisions work, but thinking helps more!" },
      ],
    },
    {
      sceneText: `The situation develops: ${mission.goal}`,
      characterSays: mission.hints[0] ?? "Think carefully!",
      choices: [
        { label: "Choose the responsible option", points: 25, feedback: mission.successFeedback.slice(0, 80) + "..." },
        { label: "Choose the easier option", points: 10, feedback: "That works, but there was a better way!" },
        { label: "Ignore the situation", points: 0, feedback: "Ignoring problems rarely helps. Try again!" },
      ],
    },
    {
      sceneText: `Things get interesting: ${mission.hints[1] ?? "What will you do next?"}`,
      characterSays: mission.hints[2] ?? "You're doing great!",
      choices: [
        { label: "Show empathy and help others", points: 25, feedback: "Excellent! Empathy makes great leaders." },
        { label: "Focus only on yourself", points: 8, feedback: "Self-focus is okay sometimes, but teamwork is better!" },
        { label: "Walk away", points: 2, feedback: "Walking away avoids conflict but misses opportunities." },
      ],
    },
    {
      sceneText: "Almost there! One final challenge stands in the way of success.",
      characterSays: mission.hints[3] ?? "You've come so far — finish strong!",
      choices: [
        { label: "Make the smart long-term choice", points: 30, feedback: "Outstanding! Long-term thinking is a superpower!" },
        { label: "Go for the quick reward", points: 12, feedback: "Quick rewards feel good, but patience pays more!" },
        { label: "Give up now", points: 0, feedback: "Never give up at the last step! Try again!" },
      ],
    },
  ];
  return steps;
}

export default function ChoiceStoryGameScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ missionId?: string; studentClass?: string }>();
  const studentClass = parseInt(params.studentClass ?? "8", 10);

  const { todaysMission, completeMission } = useLearnFun();

  const mission: DailyMission = useMemo(() => {
    if (todaysMission && todaysMission.gameType === "choice_story") return todaysMission;
    const local = getMissionForClass(studentClass);
    if (local.gameType === "choice_story") return local;
    return FALLBACK_MISSIONS[0];
  }, [todaysMission, studentClass]);

  const storySteps = useMemo(() => buildStorySteps(mission), [mission]);

  const [gameState, setGameState] = useState<GameState>("intro");
  const [step, setStep] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [lastFeedback, setLastFeedback] = useState("");
  const [choiceHistory, setChoiceHistory] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const maxPossibleScore = storySteps.reduce(
    (sum, s) => sum + Math.max(...s.choices.map((c) => c.points)),
    0
  );

  const handleChoice = useCallback(
    async (choice: StoryStep["choices"][0]) => {
      const newScore = totalScore + choice.points;
      setTotalScore(newScore);
      setLastFeedback(choice.feedback);
      setChoiceHistory((prev) => [...prev, choice.label]);

      if (step < storySteps.length - 1) {
        setStep((s) => s + 1);
      } else {
        // Final step — calculate result
        setSubmitting(true);
        const percentScore = Math.round((newScore / maxPossibleScore) * 100);
        setGameState("result");
        try {
          await completeMission(
            mission.id,
            percentScore,
            percentScore >= 80 ? mission.reward.badge : undefined
          );
        } catch (e) {
          console.error("[choice-story] completeMission:", e);
        } finally {
          setSubmitting(false);
        }
      }
    },
    [totalScore, step, storySteps.length, maxPossibleScore, mission, completeMission]
  );

  const percentScore = Math.round((totalScore / maxPossibleScore) * 100);
  const isSuccess = percentScore >= 60;
  const currentStep = storySteps[step];

  const getStepEmoji = (idx: number) => {
    const emojis = ["📖", "🔄", "⚡", "🏆"];
    return emojis[idx] ?? "📖";
  };

  // ── INTRO ──────────────────────────────────────────────────────────────────
  if (gameState === "intro") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Choice Story</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.introContent}>
          <Text style={styles.introEmoji}>📖</Text>
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

          <View style={[styles.infoCard, { backgroundColor: "rgba(139,92,246,0.1)", borderColor: "rgba(139,92,246,0.25)" }]}>
            <Text style={{ color: "#8B5CF6", fontSize: 13, fontWeight: "700" }}>📋 How to Play</Text>
            <Text style={{ color: colors.text, fontSize: 13, lineHeight: 20, marginTop: 6 }}>
              You will face {storySteps.length} situations.{"\n"}
              Choose wisely — your choices shape the story and your score!{"\n"}
              Each good choice earns you points. Make the best decisions!
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
              colors={["#8B5CF6", "#6366F1"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.startBtnGradient}
            >
              <Text style={styles.startBtnText}>Start Story 📖</Text>
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
        {/* Progress bar header */}
        <View style={[styles.playHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.progressSection}>
            <View style={styles.progressDots}>
              {storySteps.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    i < step ? { backgroundColor: "#8B5CF6" } :
                      i === step ? { backgroundColor: "#A78BFA", width: 20 } :
                        { backgroundColor: "rgba(255,255,255,0.15)" },
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
              Chapter {step + 1} of {storySteps.length}
            </Text>
          </View>
          <View style={[styles.scorePill, { backgroundColor: "rgba(139,92,246,0.2)" }]}>
            <Text style={{ color: "#8B5CF6", fontWeight: "800", fontSize: 12 }}>
              ⭐ {totalScore}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.playContent}>
          {/* Character display */}
          <View style={styles.characterDisplay}>
            <Text style={styles.characterEmoji}>{getStepEmoji(step)}</Text>
            <Text style={[styles.chapterLabel, { color: colors.textSecondary }]}>
              Chapter {step + 1}
            </Text>
          </View>

          {/* Scene text */}
          <View style={[styles.sceneCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sceneText, { color: colors.text }]}>{currentStep.sceneText}</Text>
          </View>

          {/* LifeBuddy hint */}
          <View style={[styles.lifeBuddy, { backgroundColor: "rgba(129,140,248,0.12)" }]}>
            <Text style={{ fontSize: 28 }}>🤖</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.lifeBuddyName}>LifeBuddy</Text>
              <Text style={[styles.lifeBuddyText, { color: colors.text }]}>
                {currentStep.characterSays}
              </Text>
            </View>
          </View>

          {/* Last feedback */}
          {lastFeedback !== "" && (
            <View style={[styles.feedbackBanner, { backgroundColor: "rgba(16,185,129,0.12)" }]}>
              <Text style={{ color: "#10B981", fontSize: 13, fontWeight: "600" }}>
                ✅ {lastFeedback}
              </Text>
            </View>
          )}

          {/* Choices */}
          <Text style={[styles.choicePrompt, { color: colors.textSecondary }]}>
            What will you do?
          </Text>

          {currentStep.choices.map((choice, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => handleChoice(choice)}
              disabled={submitting}
              activeOpacity={0.8}
              style={[styles.choiceBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.choiceIndex, { backgroundColor: "rgba(139,92,246,0.2)" }]}>
                <Text style={{ color: "#8B5CF6", fontWeight: "800", fontSize: 13 }}>
                  {String.fromCharCode(65 + idx)}
                </Text>
              </View>
              <Text style={[styles.choiceText, { color: colors.text }]}>{choice.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Story Complete!</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.resultContent}>
        <Text style={styles.resultEmoji}>{isSuccess ? "🎉" : "📚"}</Text>
        <Text style={[styles.resultTitle, { color: colors.text }]}>
          {isSuccess ? "Excellent Choices!" : "Keep Practising!"}
        </Text>

        <View style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>Story Score</Text>
          <Text style={[styles.scoreValue, { color: isSuccess ? "#8B5CF6" : "#EF4444" }]}>
            {percentScore}%
          </Text>
          <Text style={[{ color: colors.textSecondary, fontSize: 12 }]}>
            {totalScore} / {maxPossibleScore} points
          </Text>
          <View style={styles.scoreBarBg}>
            <View style={[styles.scoreBarFill, { width: `${percentScore}%`, backgroundColor: isSuccess ? "#8B5CF6" : "#EF4444" }]} />
          </View>
        </View>

        {/* Choice recap */}
        <View style={[styles.choiceRecap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.recapTitle, { color: colors.text }]}>Your Choices</Text>
          {choiceHistory.map((choice, i) => (
            <View key={i} style={styles.recapItem}>
              <Text style={[styles.recapChapter, { color: colors.textSecondary }]}>Ch.{i + 1}</Text>
              <Text style={[styles.recapChoice, { color: colors.text }]} numberOfLines={2}>{choice}</Text>
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
            onPress={() => { setGameState("intro"); setStep(0); setTotalScore(0); setLastFeedback(""); setChoiceHistory([]); }}
            style={[styles.retryBtn, { borderColor: colors.border }]}
          >
            <Text style={[styles.retryBtnText, { color: colors.textSecondary }]}>🔄 Replay</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.claimBtn}>
            <LinearGradient
              colors={["#8B5CF6", "#6366F1"]}
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
  infoCard: { borderRadius: 16, padding: 16, borderWidth: 1 },
  rewardPreview: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  rewardPreviewTitle: { fontSize: 12, fontWeight: "600" },
  rewardRow: { flexDirection: "row", gap: 16 },
  rewardItem: { fontSize: 14, fontWeight: "700", color: "#F59E0B" },
  startBtn: { borderRadius: 16, overflow: "hidden" },
  startBtnGradient: { paddingVertical: 16, alignItems: "center", borderRadius: 16 },
  startBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  playHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  progressSection: { flex: 1, gap: 4 },
  progressDots: { flexDirection: "row", gap: 6, alignItems: "center" },
  progressDot: { width: 8, height: 8, borderRadius: 4 },
  progressLabel: { fontSize: 11 },
  scorePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  playContent: { padding: 20, gap: 16, paddingBottom: 40 },
  characterDisplay: { alignItems: "center", gap: 4 },
  characterEmoji: { fontSize: 64 },
  chapterLabel: { fontSize: 13, fontWeight: "600" },
  sceneCard: { borderRadius: 16, padding: 16, borderWidth: 1 },
  sceneText: { fontSize: 15, lineHeight: 23 },
  feedbackBanner: { borderRadius: 12, padding: 12 },
  choicePrompt: { fontSize: 13, fontWeight: "600" },
  choiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  choiceIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceText: { flex: 1, fontSize: 14, lineHeight: 20 },
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
  choiceRecap: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 10 },
  recapTitle: { fontSize: 14, fontWeight: "700" },
  recapItem: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  recapChapter: { fontSize: 12, fontWeight: "600", minWidth: 35 },
  recapChoice: { flex: 1, fontSize: 13, lineHeight: 18 },
  feedbackCard: { borderRadius: 16, padding: 16, borderWidth: 1 },
  feedbackText: { fontSize: 14, lineHeight: 21 },
  resultButtons: { flexDirection: "row", gap: 12 },
  retryBtn: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 14, alignItems: "center" },
  retryBtnText: { fontSize: 14, fontWeight: "700" },
  claimBtn: { flex: 2, borderRadius: 14, overflow: "hidden" },
  claimBtnGradient: { paddingVertical: 14, alignItems: "center", borderRadius: 14 },
  claimBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});

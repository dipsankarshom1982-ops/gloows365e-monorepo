// app/learnfun/play/career-goal.tsx
// CareerGoalBuilderGameScreen

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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type GameState = "intro" | "step1" | "step2" | "step3" | "step4" | "result";

const CAREER_OPTIONS = [
  { id: "doctor", label: "Doctor / Medical", emoji: "👨‍⚕️", skills: ["Science", "Empathy", "Patience"] },
  { id: "engineer", label: "Engineer / Tech", emoji: "👩‍💻", skills: ["Maths", "Logic", "Problem Solving"] },
  { id: "designer", label: "Designer / Artist", emoji: "🎨", skills: ["Creativity", "Drawing", "Aesthetics"] },
  { id: "teacher", label: "Teacher / Educator", emoji: "👩‍🏫", skills: ["Communication", "Patience", "Knowledge"] },
  { id: "ca", label: "CA / Finance", emoji: "📊", skills: ["Maths", "Attention to Detail", "Business"] },
  { id: "journalist", label: "Journalist / Writer", emoji: "✍️", skills: ["Writing", "Research", "Curiosity"] },
  { id: "entrepreneur", label: "Entrepreneur", emoji: "🚀", skills: ["Leadership", "Risk Taking", "Innovation"] },
  { id: "athlete", label: "Athlete / Sports", emoji: "🏅", skills: ["Dedication", "Fitness", "Teamwork"] },
  { id: "lawyer", label: "Lawyer / Judge", emoji: "⚖️", skills: ["Argumentation", "Reading", "Ethics"] },
  { id: "architect", label: "Architect / Planner", emoji: "🏛️", skills: ["Design", "Maths", "Spatial Thinking"] },
];

const GOAL_EXAMPLES = [
  "Score 90+ in Science this year",
  "Read 2 books about my career this term",
  "Shadow a professional for 1 day",
  "Join the school club related to my career",
  "Learn one relevant skill online this month",
  "Talk to 3 people working in this field",
];

const MONTHLY_ACTIONS = [
  { label: "Study related subjects more", emoji: "📚" },
  { label: "Watch YouTube videos about this career", emoji: "📺" },
  { label: "Practice the key skills daily", emoji: "💪" },
  { label: "Join a club or group", emoji: "🤝" },
  { label: "Read a book about this career", emoji: "📖" },
  { label: "Talk to a professional in this field", emoji: "💬" },
  { label: "Work on a related project", emoji: "🛠️" },
  { label: "Take an online course or workshop", emoji: "🖥️" },
];

function scoreCareerPlan(
  career: string,
  goals: string[],
  actions: string[]
): number {
  let score = 40;
  if (career) score += 15;
  const filledGoals = goals.filter((g) => g.trim().length > 10).length;
  score += filledGoals * 12; // up to 36
  const selectedActions = actions.length;
  score += Math.min(selectedActions * 5, 25); // up to 25
  return Math.min(100, score);
}

export default function CareerGoalBuilderGameScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ missionId?: string; studentClass?: string }>();
  const studentClass = parseInt(params.studentClass ?? "9", 10);

  const { todaysMission, completeMission } = useLearnFun();

  const mission: DailyMission = useMemo(() => {
    if (todaysMission && todaysMission.gameType === "career_goal") return todaysMission;
    const local = getMissionForClass(studentClass);
    if (local.gameType === "career_goal") return local;
    return FALLBACK_MISSIONS[3];
  }, [todaysMission, studentClass]);

  const [gameState, setGameState] = useState<GameState>("intro");
  const [selectedCareer, setSelectedCareer] = useState<string>("");
  const [goals, setGoals] = useState<string[]>(["", "", ""]);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleGoalChange = useCallback((text: string, index: number) => {
    setGoals((prev) => {
      const updated = [...prev];
      updated[index] = text;
      return updated;
    });
  }, []);

  const toggleAction = useCallback((action: string) => {
    setSelectedActions((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    );
  }, []);

  const handleFinish = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    const finalScore = scoreCareerPlan(selectedCareer, goals, selectedActions);
    setScore(finalScore);
    setGameState("result");
    try {
      await completeMission(
        mission.id,
        finalScore,
        finalScore >= 80 ? mission.reward.badge : undefined
      );
    } catch (e) {
      console.error("[career-goal] completeMission:", e);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, selectedCareer, goals, selectedActions, mission, completeMission]);

  const careerData = CAREER_OPTIONS.find((c) => c.id === selectedCareer);
  const isSuccess = score >= 60;

  const renderStepHeader = (title: string, stepNum: number, total: number) => (
    <View style={[styles.stepHeader, { borderBottomColor: colors.border }]}>
      <TouchableOpacity
        onPress={() => {
          if (stepNum === 1) setGameState("intro");
          else if (stepNum === 2) setGameState("step1");
          else if (stepNum === 3) setGameState("step2");
          else if (stepNum === 4) setGameState("step3");
        }}
        style={styles.backBtn}
      >
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.stepTitleGroup}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>{title}</Text>
        <View style={styles.stepDots}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                i < stepNum ? { backgroundColor: "#EC4899" } : { backgroundColor: "rgba(255,255,255,0.15)" },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );

  // ── INTRO ──────────────────────────────────────────────────────────────────
  if (gameState === "intro") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Career Goal Builder</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.introContent}>
          <Text style={styles.introEmoji}>🚀</Text>
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
            <Text style={[styles.storyTitle, { color: colors.textSecondary }]}>The Mission</Text>
            <Text style={[styles.storyText, { color: colors.text }]}>{mission.storyIntro}</Text>
          </View>

          <View style={[styles.stepsPreview, { backgroundColor: "rgba(236,72,153,0.1)", borderColor: "rgba(236,72,153,0.25)" }]}>
            <Text style={[styles.stepsTitle, { color: "#EC4899" }]}>📋 4 Steps</Text>
            {[
              "Step 1: Pick a career interest",
              "Step 2: Set 3 SMART goals",
              "Step 3: Plan monthly actions",
              "Step 4: See your career roadmap!",
            ].map((step, i) => (
              <Text key={i} style={[styles.stepItem, { color: colors.text }]}>• {step}</Text>
            ))}
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
            onPress={() => setGameState("step1")}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#EC4899", "#BE185D"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.startBtnGradient}
            >
              <Text style={styles.startBtnText}>Explore Careers 🚀</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── STEP 1: Pick Career ────────────────────────────────────────────────────
  if (gameState === "step1") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {renderStepHeader("Pick a Career", 1, 4)}
        <ScrollView contentContainerStyle={styles.stepContent}>
          <Text style={[styles.stepQuestion, { color: colors.text }]}>
            What career interests you most?
          </Text>
          <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
            Don't overthink — pick what excites you today!
          </Text>

          <View style={styles.careerGrid}>
            {CAREER_OPTIONS.map((career) => (
              <TouchableOpacity
                key={career.id}
                onPress={() => setSelectedCareer(career.id)}
                style={[
                  styles.careerCard,
                  {
                    backgroundColor: selectedCareer === career.id ? "rgba(236,72,153,0.2)" : colors.card,
                    borderColor: selectedCareer === career.id ? "#EC4899" : colors.border,
                  },
                ]}
              >
                <Text style={styles.careerEmoji}>{career.emoji}</Text>
                <Text style={[styles.careerLabel, { color: colors.text }]}>{career.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {selectedCareer && careerData && (
            <View style={[styles.careerDetail, { backgroundColor: "rgba(236,72,153,0.12)", borderColor: "rgba(236,72,153,0.25)" }]}>
              <Text style={[styles.careerDetailTitle, { color: "#EC4899" }]}>
                {careerData.emoji} {careerData.label}
              </Text>
              <Text style={[styles.careerDetailLabel, { color: colors.textSecondary }]}>Key skills needed:</Text>
              <View style={styles.skillTags}>
                {careerData.skills.map((skill) => (
                  <View key={skill} style={[styles.skillTag, { backgroundColor: "rgba(236,72,153,0.2)" }]}>
                    <Text style={[styles.skillTagText, { color: "#EC4899" }]}>{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={() => selectedCareer && setGameState("step2")}
            disabled={!selectedCareer}
            style={[
              styles.nextBtn,
              { opacity: selectedCareer ? 1 : 0.5 },
            ]}
          >
            <LinearGradient
              colors={["#EC4899", "#BE185D"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextBtnGradient}
            >
              <Text style={styles.nextBtnText}>Next: Set Goals →</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── STEP 2: Set Goals ─────────────────────────────────────────────────────
  if (gameState === "step2") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {renderStepHeader("Set 3 Goals", 2, 4)}
        <ScrollView contentContainerStyle={styles.stepContent}>
          <Text style={[styles.stepQuestion, { color: colors.text }]}>
            Set 3 SMART goals for your {careerData?.label ?? "chosen"} career:
          </Text>
          <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
            Be specific! "Score 85 in Science" beats "do better in Science".
          </Text>

          <View style={[styles.lifeBuddy, { backgroundColor: "rgba(129,140,248,0.12)" }]}>
            <Text style={{ fontSize: 28 }}>🤖</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.lifeBuddyName}>LifeBuddy</Text>
              <Text style={[styles.lifeBuddyText, { color: colors.text }]}>
                SMART = Specific, Measurable, Achievable, Relevant, Time-bound. Write goals you can track!
              </Text>
            </View>
          </View>

          {goals.map((goal, i) => (
            <View key={i} style={styles.goalInputGroup}>
              <Text style={[styles.goalLabel, { color: colors.textSecondary }]}>
                Goal {i + 1} {i === 0 ? "(Academic)" : i === 1 ? "(Skill)" : "(Action)"}
              </Text>
              <TextInput
                value={goal}
                onChangeText={(text) => handleGoalChange(text, i)}
                placeholder={GOAL_EXAMPLES[i]}
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.goalInput,
                  {
                    backgroundColor: "#1E293B",
                    color: colors.text,
                    borderColor: goal.length > 10 ? "#EC4899" : colors.border,
                  },
                ]}
                multiline
              />
            </View>
          ))}

          <TouchableOpacity
            onPress={() => goals.filter((g) => g.trim().length > 5).length >= 1 && setGameState("step3")}
            style={styles.nextBtn}
          >
            <LinearGradient
              colors={["#EC4899", "#BE185D"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextBtnGradient}
            >
              <Text style={styles.nextBtnText}>Next: Plan Actions →</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── STEP 3: Monthly Actions ───────────────────────────────────────────────
  if (gameState === "step3") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {renderStepHeader("Plan Actions", 3, 4)}
        <ScrollView contentContainerStyle={styles.stepContent}>
          <Text style={[styles.stepQuestion, { color: colors.text }]}>
            Pick 3+ monthly actions to move towards your career:
          </Text>
          <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
            Small consistent actions beat big one-time efforts!
          </Text>

          <View style={styles.actionsGrid}>
            {MONTHLY_ACTIONS.map((action) => {
              const isSelected = selectedActions.includes(action.label);
              return (
                <TouchableOpacity
                  key={action.label}
                  onPress={() => toggleAction(action.label)}
                  style={[
                    styles.actionCard,
                    {
                      backgroundColor: isSelected ? "rgba(236,72,153,0.2)" : colors.card,
                      borderColor: isSelected ? "#EC4899" : colors.border,
                    },
                  ]}
                >
                  <Text style={styles.actionEmoji}>{action.emoji}</Text>
                  <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
                  {isSelected && (
                    <View style={styles.actionCheck}>
                      <Ionicons name="checkmark-circle" size={18} color="#EC4899" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.selectedCount, { color: colors.textSecondary }]}>
            {selectedActions.length} action{selectedActions.length !== 1 ? "s" : ""} selected
            {selectedActions.length >= 3 ? " ✅" : ` (need ${3 - selectedActions.length} more)`}
          </Text>

          <TouchableOpacity
            onPress={handleFinish}
            disabled={submitting || selectedActions.length < 1}
            style={[styles.nextBtn, { opacity: selectedActions.length >= 1 ? 1 : 0.5 }]}
          >
            <LinearGradient
              colors={["#EC4899", "#BE185D"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextBtnGradient}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.nextBtnText}>See My Roadmap 🗺️</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Career Roadmap Ready!</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.resultContent}>
        <Text style={styles.resultEmoji}>{isSuccess ? "🎉" : "📋"}</Text>
        <Text style={[styles.resultTitle, { color: colors.text }]}>
          {isSuccess ? "Great Roadmap!" : "Good Start!"}
        </Text>

        {/* Career summary */}
        {careerData && (
          <View style={[styles.careerSummary, { backgroundColor: "rgba(236,72,153,0.12)", borderColor: "rgba(236,72,153,0.25)" }]}>
            <Text style={[styles.careerSummaryTitle, { color: "#EC4899" }]}>
              {careerData.emoji} Career: {careerData.label}
            </Text>
            <Text style={[styles.careerSummaryLabel, { color: colors.textSecondary }]}>Your Goals:</Text>
            {goals.filter((g) => g.trim().length > 0).map((goal, i) => (
              <Text key={i} style={[styles.goalSummaryItem, { color: colors.text }]}>🎯 {goal}</Text>
            ))}
            <Text style={[styles.careerSummaryLabel, { color: colors.textSecondary }]}>Monthly Actions:</Text>
            {selectedActions.map((action, i) => (
              <Text key={i} style={[styles.goalSummaryItem, { color: colors.text }]}>✅ {action}</Text>
            ))}
          </View>
        )}

        <View style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>Roadmap Score</Text>
          <Text style={[styles.scoreValue, { color: isSuccess ? "#EC4899" : "#EF4444" }]}>{score}%</Text>
          <View style={styles.scoreBarBg}>
            <View style={[styles.scoreBarFill, { width: `${score}%`, backgroundColor: isSuccess ? "#EC4899" : "#EF4444" }]} />
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
              setSelectedCareer("");
              setGoals(["", "", ""]);
              setSelectedActions([]);
              setScore(0);
            }}
            style={[styles.retryBtn, { borderColor: colors.border }]}
          >
            <Text style={[styles.retryBtnText, { color: colors.textSecondary }]}>🔄 Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.claimBtn}>
            <LinearGradient
              colors={["#EC4899", "#BE185D"]}
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
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  stepTitleGroup: { flex: 1, gap: 6 },
  stepTitle: { fontSize: 16, fontWeight: "700" },
  stepDots: { flexDirection: "row", gap: 6 },
  stepDot: { width: 8, height: 8, borderRadius: 4 },
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
  stepsPreview: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  stepsTitle: { fontSize: 13, fontWeight: "700" },
  stepItem: { fontSize: 13, lineHeight: 20 },
  rewardPreview: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  rewardPreviewTitle: { fontSize: 12, fontWeight: "600" },
  rewardRow: { flexDirection: "row", gap: 16 },
  rewardItem: { fontSize: 14, fontWeight: "700", color: "#F59E0B" },
  startBtn: { borderRadius: 16, overflow: "hidden" },
  startBtnGradient: { paddingVertical: 16, alignItems: "center", borderRadius: 16 },
  startBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  stepContent: { padding: 20, gap: 16, paddingBottom: 40 },
  stepQuestion: { fontSize: 18, fontWeight: "800", lineHeight: 25 },
  stepSubtitle: { fontSize: 13, lineHeight: 18 },
  careerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  careerCard: {
    width: "48%",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    alignItems: "center",
    gap: 6,
  },
  careerEmoji: { fontSize: 28 },
  careerLabel: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  careerDetail: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  careerDetailTitle: { fontSize: 15, fontWeight: "800" },
  careerDetailLabel: { fontSize: 12, fontWeight: "600" },
  skillTags: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  skillTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  skillTagText: { fontSize: 12, fontWeight: "600" },
  nextBtn: { borderRadius: 16, overflow: "hidden" },
  nextBtnGradient: { paddingVertical: 16, alignItems: "center", borderRadius: 16 },
  nextBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  goalInputGroup: { gap: 6 },
  goalLabel: { fontSize: 12, fontWeight: "600" },
  goalInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: "top",
  },
  actionsGrid: { gap: 10 },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
  },
  actionEmoji: { fontSize: 20 },
  actionLabel: { flex: 1, fontSize: 13, fontWeight: "600" },
  actionCheck: { marginLeft: "auto" },
  selectedCount: { fontSize: 13, textAlign: "center" },
  resultContent: { padding: 20, gap: 16, paddingBottom: 40 },
  resultEmoji: { fontSize: 60, textAlign: "center" },
  resultTitle: { fontSize: 24, fontWeight: "800", textAlign: "center" },
  careerSummary: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  careerSummaryTitle: { fontSize: 16, fontWeight: "800" },
  careerSummaryLabel: { fontSize: 12, fontWeight: "600", marginTop: 4 },
  goalSummaryItem: { fontSize: 13, lineHeight: 20 },
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

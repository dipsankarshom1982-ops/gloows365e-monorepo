// app/learnfun/play/boss-battle.tsx
// BossBattleGameScreen — Mixed rapid-fire questions across week's skills

import { useTheme } from "@/context/ThemeContext";
import { useLearnFun } from "@/hooks/useLearnFun";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type GameState = "intro" | "battle" | "result";

interface BossQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  skill: string;
  explanation: string;
}

function getBossForClass(studentClass: number): { name: string; emoji: string; hp: number } {
  if (studentClass <= 6) return { name: "Budget Goblin", emoji: "👺", hp: 100 };
  if (studentClass <= 8) return { name: "Time Wraith", emoji: "👻", hp: 120 };
  if (studentClass <= 10) return { name: "Cyber Dragon", emoji: "🐉", hp: 150 };
  return { name: "Decision Titan", emoji: "🤖", hp: 180 };
}

function getQuestionsForClass(studentClass: number): BossQuestion[] {
  const base: BossQuestion[] = [
    {
      question: "You have ₹100. Milk costs ₹40, chips cost ₹50, savings goal is ₹30. What is the SMART choice?",
      options: ["Buy milk + chips", "Buy milk + save ₹60", "Save all ₹100", "Buy only chips"],
      correctIndex: 1,
      skill: "💰 Money Management",
      explanation: "Buy the need (milk) and save the rest. Chips are a want — skip them when budget is tight!",
    },
    {
      question: "Exams are in 3 days. You have 6 subjects. What should you do FIRST?",
      options: [
        "Study your favourite subject",
        "Start with the exam that is soonest + weakest subject",
        "Watch TV first then study",
        "Pull an all-nighter",
      ],
      correctIndex: 1,
      skill: "⏰ Time Management",
      explanation: "Prioritise by urgency (soonest exam) and difficulty (weakest subject) first!",
    },
    {
      question: "You receive: 'YOU WON ₹50,000! Click here to claim!' via WhatsApp. What do you do?",
      options: [
        "Click the link immediately",
        "Share with friends",
        "Delete it — it is a scam",
        "Reply with your details",
      ],
      correctIndex: 2,
      skill: "🛡️ Digital Safety",
      explanation: "If it sounds too good to be true, it IS too good to be true. This is a classic scam!",
    },
    {
      question: "Your friend pressures you to skip class to play cricket. What is the BEST response?",
      options: [
        "Skip class — friends come first",
        "Say no firmly but kindly, explain why school matters",
        "Agree just to avoid conflict",
        "Ignore your friend",
      ],
      correctIndex: 1,
      skill: "✅ Decision Making",
      explanation: "Standing firm with kindness is true courage. Good friends respect your decisions!",
    },
    {
      question: "A SMART goal is best described as:",
      options: [
        "Vague and flexible",
        "Specific, Measurable, Achievable, Relevant, Time-bound",
        "Easy and fun",
        "Set by someone else for you",
      ],
      correctIndex: 1,
      skill: "🎯 Goal Setting",
      explanation: "SMART goals have all 5 elements. 'Score 80 in Maths by December' is SMART!",
    },
  ];

  if (studentClass >= 9) {
    base.push(
      {
        question: "Which is the BEST first step for career planning in Class 9?",
        options: [
          "Wait until Class 12 to decide",
          "Explore interests, talk to professionals, set one career goal",
          "Only study the subjects parents suggest",
          "Copy your friend's career plan",
        ],
        correctIndex: 1,
        skill: "🚀 Career Awareness",
        explanation: "Early exploration gives you 3+ years to prepare. Start now, not in Class 12!",
      },
      {
        question: "To manage stress during exams, you should:",
        options: [
          "Study 18 hours without breaks",
          "Sleep less to study more",
          "Take short breaks, sleep 8 hours, exercise daily",
          "Avoid talking to family",
        ],
        correctIndex: 2,
        skill: "💪 Health & Habits",
        explanation: "Sleep, breaks and exercise improve memory and reduce stress. Smart students do this!",
      }
    );
  }

  return base;
}

export default function BossBattleGameScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ studentClass?: string }>();
  const studentClass = parseInt(params.studentClass ?? "8", 10);

  const { completeMission, todaysMission } = useLearnFun();
  const boss = getBossForClass(studentClass);
  const questions = getQuestionsForClass(studentClass);

  const [gameState, setGameState] = useState<GameState>("intro");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [bossHP, setBossHP] = useState(boss.hp);
  const [studentHP, setStudentHP] = useState(100);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [gameScore, setGameScore] = useState(0);

  const bossShakeAnim = useRef(new Animated.Value(0)).current;
  const studentShakeAnim = useRef(new Animated.Value(0)).current;
  const attackAnim = useRef(new Animated.Value(0)).current;

  const bossHPPercent = (bossHP / boss.hp) * 100;
  const studentHPPercent = studentHP;

  const currentQuestion = questions[questionIndex];
  const totalQuestions = questions.length;

  const animateAttack = useCallback((isCorrect: boolean) => {
    if (isCorrect) {
      Animated.sequence([
        Animated.timing(attackAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(bossShakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
        Animated.timing(bossShakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
        Animated.timing(bossShakeAnim, { toValue: 5, duration: 80, useNativeDriver: true }),
        Animated.timing(bossShakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
        Animated.timing(attackAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.sequence([
        Animated.timing(studentShakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
        Animated.timing(studentShakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
        Animated.timing(studentShakeAnim, { toValue: 5, duration: 80, useNativeDriver: true }),
        Animated.timing(studentShakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
      ]).start();
    }
  }, [bossShakeAnim, studentShakeAnim, attackAnim]);

  const handleAnswer = useCallback(
    async (optionIndex: number) => {
      if (selectedAnswer !== null || showResult) return;

      setSelectedAnswer(optionIndex);
      const isCorrect = optionIndex === currentQuestion.correctIndex;

      animateAttack(isCorrect);

      if (isCorrect) {
        setScore((s) => s + 1);
        const damage = Math.round(boss.hp / totalQuestions);
        setBossHP((hp) => Math.max(0, hp - damage));
      } else {
        setStudentHP((hp) => Math.max(0, hp - 20));
      }

      setShowResult(true);

      setTimeout(async () => {
        setShowResult(false);
        setSelectedAnswer(null);

        if (questionIndex < totalQuestions - 1) {
          setQuestionIndex((i) => i + 1);
        } else {
          // End of battle
          const finalScore = Math.round((score + (isCorrect ? 1 : 0)) / totalQuestions * 100);
          setGameScore(finalScore);
          setGameState("result");

          try {
            const missionId = todaysMission?.id ?? "boss_battle_weekly";
            await completeMission(
              missionId,
              finalScore,
              finalScore >= 80 ? "badge_boss_slayer" : undefined
            );
          } catch (e) {
            console.error("[boss-battle] completeMission:", e);
          }
        }
      }, 1800);
    },
    [
      selectedAnswer,
      showResult,
      currentQuestion,
      animateAttack,
      boss.hp,
      totalQuestions,
      questionIndex,
      score,
      todaysMission,
      completeMission,
    ]
  );

  const isSuccess = gameScore >= 60;
  const bossDefeated = bossHP <= 0;

  // ── INTRO ──────────────────────────────────────────────────────────────────
  if (gameState === "intro") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Weekly Boss Battle</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.introContent}>
          <Text style={styles.bossIntroEmoji}>{boss.emoji}</Text>
          <Text style={[styles.bossName, { color: "#EF4444" }]}>{boss.name}</Text>
          <Text style={[styles.bossSubtitle, { color: colors.textSecondary }]}>
            Class {studentClass} Boss Battle
          </Text>

          <View style={[styles.lifeBuddy, { backgroundColor: "rgba(129,140,248,0.12)" }]}>
            <Text style={{ fontSize: 28 }}>🤖</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.lifeBuddyName}>LifeBuddy</Text>
              <Text style={[styles.lifeBuddyText, { color: colors.text }]}>
                The {boss.name} has appeared! Answer {totalQuestions} questions correctly to defeat it. Each correct answer deals damage — wrong answers hurt YOU! Use the knowledge from your week's missions!
              </Text>
            </View>
          </View>

          <View style={[styles.battleInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.battleInfoRow}>
              <View style={styles.battleStat}>
                <Text style={styles.battleStatEmoji}>⚔️</Text>
                <Text style={[styles.battleStatLabel, { color: colors.textSecondary }]}>Questions</Text>
                <Text style={[styles.battleStatValue, { color: colors.text }]}>{totalQuestions}</Text>
              </View>
              <View style={styles.battleStat}>
                <Text style={styles.battleStatEmoji}>❤️</Text>
                <Text style={[styles.battleStatLabel, { color: colors.textSecondary }]}>Your HP</Text>
                <Text style={[styles.battleStatValue, { color: "#10B981" }]}>100</Text>
              </View>
              <View style={styles.battleStat}>
                <Text style={styles.battleStatEmoji}>👹</Text>
                <Text style={[styles.battleStatLabel, { color: colors.textSecondary }]}>Boss HP</Text>
                <Text style={[styles.battleStatValue, { color: "#EF4444" }]}>{boss.hp}</Text>
              </View>
            </View>
          </View>

          <View style={[styles.rewardPreview, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.rewardPreviewTitle, { color: colors.textSecondary }]}>Victory Rewards</Text>
            <View style={styles.rewardRow}>
              <Text style={styles.rewardItem}>🪙 150 coins</Text>
              <Text style={styles.rewardItem}>⚡ 200 XP</Text>
              <Text style={styles.rewardItem}>🏅 Boss Slayer Badge</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => setGameState("battle")}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#EF4444", "#DC2626"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.startBtnGradient}
            >
              <Text style={styles.startBtnText}>⚔️ Start Battle!</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── BATTLE ─────────────────────────────────────────────────────────────────
  if (gameState === "battle") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: "#0F172A" }]}>
        {/* Battle header */}
        <LinearGradient
          colors={["#7F1D1D", "#1E1B4B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.battleHeader}
        >
          <View style={styles.hpSection}>
            <Text style={styles.hpLabel}>YOU</Text>
            <View style={[styles.hpBarBg, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
              <View style={[styles.hpBarFill, { width: `${studentHPPercent}%`, backgroundColor: "#10B981" }]} />
            </View>
            <Text style={styles.hpValue}>{studentHP} HP</Text>
          </View>

          <Text style={styles.vsText}>⚔️</Text>

          <View style={styles.hpSection}>
            <Text style={styles.hpLabelBoss}>{boss.name}</Text>
            <View style={[styles.hpBarBg, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
              <View style={[styles.hpBarFill, { width: `${bossHPPercent}%`, backgroundColor: "#EF4444" }]} />
            </View>
            <Text style={styles.hpValueBoss}>{bossHP} HP</Text>
          </View>
        </LinearGradient>

        {/* Boss display */}
        <View style={styles.bossArena}>
          <Animated.Text
            style={[
              styles.bossArenaEmoji,
              { transform: [{ translateX: bossShakeAnim }] },
            ]}
          >
            {boss.emoji}
          </Animated.Text>
          <View style={styles.questionCounter}>
            <Text style={styles.questionCounterText}>
              Q {questionIndex + 1}/{totalQuestions}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.battleContent}>
          {/* Skill label */}
          <View style={[styles.skillLabel, { backgroundColor: "rgba(139,92,246,0.2)" }]}>
            <Text style={styles.skillLabelText}>{currentQuestion.skill}</Text>
          </View>

          {/* Question */}
          <View style={[styles.questionCard, { backgroundColor: "#1E293B", borderColor: "rgba(255,255,255,0.1)" }]}>
            <Text style={[styles.questionText, { color: "#E2E8F0" }]}>{currentQuestion.question}</Text>
          </View>

          {/* Options */}
          {currentQuestion.options.map((option, idx) => {
            let optionStyle = {};
            let textColor = "#E2E8F0";

            if (showResult && selectedAnswer !== null) {
              if (idx === currentQuestion.correctIndex) {
                optionStyle = { backgroundColor: "rgba(16,185,129,0.25)", borderColor: "#10B981" };
                textColor = "#10B981";
              } else if (idx === selectedAnswer && idx !== currentQuestion.correctIndex) {
                optionStyle = { backgroundColor: "rgba(239,68,68,0.2)", borderColor: "#EF4444" };
                textColor = "#EF4444";
              }
            }

            return (
              <TouchableOpacity
                key={idx}
                onPress={() => handleAnswer(idx)}
                disabled={selectedAnswer !== null}
                style={[styles.optionBtn, { backgroundColor: "#1E293B", borderColor: "rgba(255,255,255,0.1)" }, optionStyle]}
                activeOpacity={0.8}
              >
                <View style={[styles.optionIndex, { backgroundColor: "rgba(139,92,246,0.25)" }]}>
                  <Text style={{ color: "#818CF8", fontWeight: "800", fontSize: 13 }}>
                    {String.fromCharCode(65 + idx)}
                  </Text>
                </View>
                <Text style={[styles.optionText, { color: textColor }]}>{option}</Text>
              </TouchableOpacity>
            );
          })}

          {/* Explanation after answer */}
          {showResult && (
            <View style={[
              styles.explanationCard,
              {
                backgroundColor: selectedAnswer === currentQuestion.correctIndex
                  ? "rgba(16,185,129,0.12)"
                  : "rgba(239,68,68,0.12)",
              },
            ]}>
              <Text style={[styles.explanationText, { color: "#E2E8F0" }]}>
                {selectedAnswer === currentQuestion.correctIndex ? "✅ " : "❌ "}
                {currentQuestion.explanation}
              </Text>
            </View>
          )}
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Battle Over!</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.resultContent}>
        <Text style={styles.resultEmoji}>
          {bossDefeated ? "🏆" : isSuccess ? "🎉" : "💀"}
        </Text>
        <Text style={[styles.resultTitle, { color: colors.text }]}>
          {bossDefeated ? `${boss.name} Defeated!` : isSuccess ? "Well Fought!" : "Defeated!"}
        </Text>
        <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]}>
          {bossDefeated ? `You are a Boss Slayer! The ${boss.name} has been vanquished!` :
            isSuccess ? "You did great but the boss survived. Come back stronger!" :
              "The boss was too strong this time. Study your skills and try again next Friday!"}
        </Text>

        <View style={[styles.battleSummary, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Correct Answers</Text>
            <Text style={[styles.summaryValue, { color: "#10B981" }]}>{score}/{totalQuestions}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Boss HP Remaining</Text>
            <Text style={[styles.summaryValue, { color: "#EF4444" }]}>{bossHP}/{boss.hp}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Your HP Remaining</Text>
            <Text style={[styles.summaryValue, { color: "#10B981" }]}>{studentHP}/100</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Battle Score</Text>
            <Text style={[styles.summaryValue, { color: isSuccess ? "#8B5CF6" : "#EF4444" }]}>{gameScore}%</Text>
          </View>
        </View>

        {isSuccess && (
          <View style={[styles.rewardCard, { backgroundColor: "rgba(139,92,246,0.15)", borderColor: "rgba(139,92,246,0.3)" }]}>
            <Text style={[styles.rewardTitle, { color: "#8B5CF6" }]}>🎁 Rewards Earned</Text>
            <View style={styles.rewardRow}>
              <Text style={styles.rewardItem}>🪙 {Math.round(150 * gameScore / 100)} coins</Text>
              <Text style={styles.rewardItem}>⚡ {Math.round(200 * gameScore / 100)} XP</Text>
              {gameScore >= 80 && <Text style={styles.rewardItem}>🏅 Boss Slayer!</Text>}
            </View>
          </View>
        )}

        <View style={styles.resultButtons}>
          <TouchableOpacity
            onPress={() => {
              setGameState("intro");
              setQuestionIndex(0);
              setScore(0);
              setBossHP(boss.hp);
              setStudentHP(100);
              setSelectedAnswer(null);
              setShowResult(false);
            }}
            style={[styles.retryBtn, { borderColor: colors.border }]}
          >
            <Text style={[styles.retryBtnText, { color: colors.textSecondary }]}>⚔️ Battle Again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.claimBtn}>
            <LinearGradient
              colors={["#EF4444", "#DC2626"]}
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
  bossIntroEmoji: { fontSize: 72, textAlign: "center" },
  bossName: { fontSize: 28, fontWeight: "900", textAlign: "center" },
  bossSubtitle: { fontSize: 14, textAlign: "center" },
  lifeBuddy: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 16,
  },
  lifeBuddyName: { color: "#818CF8", fontWeight: "800", fontSize: 11 },
  lifeBuddyText: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  battleInfo: { borderRadius: 16, padding: 16, borderWidth: 1 },
  battleInfoRow: { flexDirection: "row", justifyContent: "space-around" },
  battleStat: { alignItems: "center", gap: 4 },
  battleStatEmoji: { fontSize: 24 },
  battleStatLabel: { fontSize: 11, fontWeight: "500" },
  battleStatValue: { fontSize: 18, fontWeight: "800" },
  rewardPreview: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  rewardPreviewTitle: { fontSize: 12, fontWeight: "600" },
  rewardRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  rewardItem: { fontSize: 13, fontWeight: "700", color: "#F59E0B" },
  startBtn: { borderRadius: 16, overflow: "hidden" },
  startBtnGradient: { paddingVertical: 16, alignItems: "center", borderRadius: 16 },
  startBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  battleHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  hpSection: { flex: 1, gap: 4 },
  hpLabel: { color: "#10B981", fontSize: 10, fontWeight: "800" },
  hpLabelBoss: { color: "#EF4444", fontSize: 10, fontWeight: "800", textAlign: "right" },
  hpBarBg: { height: 6, borderRadius: 3, overflow: "hidden" },
  hpBarFill: { height: "100%", borderRadius: 3 },
  hpValue: { color: "#10B981", fontSize: 11, fontWeight: "700" },
  hpValueBoss: { color: "#EF4444", fontSize: 11, fontWeight: "700", textAlign: "right" },
  vsText: { fontSize: 24 },
  bossArena: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
    backgroundColor: "rgba(127,29,29,0.15)",
  },
  bossArenaEmoji: { fontSize: 72 },
  questionCounter: {
    backgroundColor: "rgba(139,92,246,0.25)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
  },
  questionCounterText: { color: "#818CF8", fontWeight: "800", fontSize: 13 },
  battleContent: { padding: 16, gap: 12, paddingBottom: 40 },
  skillLabel: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  skillLabelText: { color: "#A78BFA", fontSize: 12, fontWeight: "700" },
  questionCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
  },
  questionText: { fontSize: 16, lineHeight: 24, fontWeight: "600" },
  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  optionIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: { flex: 1, fontSize: 14, lineHeight: 19 },
  explanationCard: { borderRadius: 14, padding: 14 },
  explanationText: { fontSize: 13, lineHeight: 20 },
  resultContent: { padding: 20, gap: 16, paddingBottom: 40 },
  resultEmoji: { fontSize: 60, textAlign: "center" },
  resultTitle: { fontSize: 26, fontWeight: "800", textAlign: "center" },
  resultSubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  battleSummary: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 15, fontWeight: "800" },
  rewardCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  rewardTitle: { fontSize: 15, fontWeight: "700" },
  resultButtons: { flexDirection: "row", gap: 12 },
  retryBtn: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 14, alignItems: "center" },
  retryBtnText: { fontSize: 14, fontWeight: "700" },
  claimBtn: { flex: 2, borderRadius: 14, overflow: "hidden" },
  claimBtnGradient: { paddingVertical: 14, alignItems: "center", borderRadius: 14 },
  claimBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});

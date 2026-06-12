import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { QuizQuestion } from "@/lib/aiGuru/types";
import { XP_PER_CORRECT } from "@/lib/aiGuru/constants";

const LABELS = ["A", "B", "C", "D"];

interface Props {
  question: QuizQuestion;
  questionIndex: number;
  totalQuestions: number;
  timeLeft: number;
  maxTime?: number;
  selectedIndex: number | null;
  locked: boolean;
  onSelect: (index: number) => void;
}

export default function QuizCard({
  question, questionIndex, totalQuestions,
  timeLeft, maxTime = 30,
  selectedIndex, locked, onSelect,
}: Props) {
  const timerAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide in on mount
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [questionIndex]);

  useEffect(() => {
    Animated.timing(timerAnim, {
      toValue: timeLeft / maxTime,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [timeLeft]);

  const timerColor = timerAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: ["#ef4444", "#f59e0b", "#10b981"],
  });

  const xp = XP_PER_CORRECT[question.difficulty] ?? 10;
  const isAnswered = locked && selectedIndex !== null;
  const correctIdx = question.correctAnswerIndex;

  return (
    <Animated.View style={[S.wrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Header */}
      <View style={S.header}>
        <Text style={S.counter}>Q{questionIndex + 1} / {totalQuestions}</Text>
        <View style={S.xpBadge}>
          <Text style={S.xpText}>+{xp} XP</Text>
        </View>
        <View style={[S.diffBadge, diffStyle(question.difficulty)]}>
          <Text style={S.diffText}>{question.difficulty.toUpperCase()}</Text>
        </View>
      </View>

      {/* Timer bar */}
      <View style={S.timerBg}>
        <Animated.View style={[S.timerFill, { width: timerAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }), backgroundColor: timerColor }]} />
      </View>
      <Text style={[S.timerNum, timeLeft <= 10 && { color: "#ef4444" }]}>{timeLeft}s</Text>

      {/* Question */}
      <View style={S.qCard}>
        <Text style={S.qText}>{question.question}</Text>
      </View>

      {/* Options */}
      <View style={S.options}>
        {question.options.map((opt, i) => {
          const isSelected = selectedIndex === i;
          const isRight    = locked && i === correctIdx;
          const isWrong    = locked && isSelected && !isRight;
          return (
            <TouchableOpacity
              key={i}
              style={[S.optBtn, isRight && S.optRight, isWrong && S.optWrong, !locked && isSelected && S.optSelected]}
              onPress={() => !locked && onSelect(i)}
              activeOpacity={locked ? 1 : 0.8}
            >
              <View style={[S.optLabel, isRight && S.optLabelRight, isWrong && S.optLabelWrong]}>
                <Text style={S.optLabelText}>{LABELS[i]}</Text>
              </View>
              <Text style={S.optText}>{opt}</Text>
              {isRight && <Ionicons name="checkmark-circle" size={20} color="#10b981" />}
              {isWrong && <Ionicons name="close-circle"     size={20} color="#ef4444" />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Explanation after answer */}
      {isAnswered && (
        <View style={[S.expCard, { borderColor: selectedIndex === correctIdx ? "#10b981" : "#ef4444" }]}>
          <Text style={[S.expTitle, { color: selectedIndex === correctIdx ? "#10b981" : "#ef4444" }]}>
            {selectedIndex === correctIdx ? "✅ Correct! +" + xp + " XP" : "❌ Incorrect"}
          </Text>
          <Text style={S.expText}>{question.explanation}</Text>
          {question.concept ? <Text style={S.conceptTag}>📌 {question.concept}</Text> : null}
        </View>
      )}
    </Animated.View>
  );
}

function diffStyle(d: string) {
  if (d === "easy")   return { backgroundColor: "#064e3b" };
  if (d === "hard")   return { backgroundColor: "#450a0a" };
  return { backgroundColor: "#1e3a5f" };
}

const S = StyleSheet.create({
  wrap:          { flex: 1, padding: 16, gap: 12 },
  header:        { flexDirection: "row", alignItems: "center", gap: 8 },
  counter:       { flex: 1, color: "#94a3b8", fontSize: 13, fontWeight: "700" },
  xpBadge:       { backgroundColor: "rgba(99,102,241,0.2)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  xpText:        { color: "#818cf8", fontSize: 11, fontWeight: "800" },
  diffBadge:     { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  diffText:      { color: "#a5b4fc", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  timerBg:       { height: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" },
  timerFill:     { height: "100%", borderRadius: 4 },
  timerNum:      { color: "#94a3b8", fontSize: 11, fontWeight: "700", textAlign: "right" },
  qCard:         { backgroundColor: "#1e293b", borderRadius: 18, padding: 18 },
  qText:         { color: "#f1f5f9", fontSize: 17, fontWeight: "700", lineHeight: 26 },
  options:       { gap: 10 },
  optBtn:        { flexDirection: "row", alignItems: "center", backgroundColor: "#1e293b", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#334155", gap: 12 },
  optSelected:   { borderColor: "#6366f1" },
  optRight:      { borderColor: "#10b981", backgroundColor: "#052e16" },
  optWrong:      { borderColor: "#ef4444", backgroundColor: "#450a0a" },
  optLabel:      { width: 32, height: 32, borderRadius: 8, backgroundColor: "#334155", justifyContent: "center", alignItems: "center" },
  optLabelRight: { backgroundColor: "#064e3b" },
  optLabelWrong: { backgroundColor: "#7f1d1d" },
  optLabelText:  { color: "#a5b4fc", fontWeight: "800", fontSize: 13 },
  optText:       { flex: 1, color: "#cbd5e1", fontSize: 14, lineHeight: 20 },
  expCard:       { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  expTitle:      { fontSize: 14, fontWeight: "800" },
  expText:       { color: "#94a3b8", fontSize: 13, lineHeight: 20 },
  conceptTag:    { color: "#6366f1", fontSize: 11, fontWeight: "700", marginTop: 4 },
});

import { auth, db } from "@/lib/firebase";
import { submitContestQuiz, QuizAnswer } from "@/services/submitContestQuiz";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SECONDS_PER_Q = 30;
const OPTION_LABELS = ["A", "B", "C", "D"];

interface Question {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  difficulty?: string;
  concept?: string;
}

export default function ContestQuizScreen() {
  const { contestId } = useLocalSearchParams<{ contestId: string }>();
  const router = useRouter();
  const userId = auth.currentUser?.uid;

  const [questions, setQuestions]   = useState<Question[]>([]);
  const [loading, setLoading]       = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers]       = useState<QuizAnswer[]>([]);
  const [selected, setSelected]     = useState<number | null>(null);
  const [locked, setLocked]         = useState(false);
  const [timeLeft, setTimeLeft]     = useState(SECONDS_PER_Q);
  const [submitting, setSubmitting] = useState(false);

  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStart = useRef<number>(Date.now());
  const progressAnim  = useRef(new Animated.Value(1)).current;

  // Load lessonJson.quiz; redirect if already completed
  useEffect(() => {
    if (!contestId || !userId) return;
    (async () => {
      const [contestSnap, participantSnap] = await Promise.all([
        getDoc(doc(db, "contests", contestId as string)),
        getDoc(doc(db, "contests", contestId as string, "participant", userId)),
      ]);

      // Block re-taking: if already completed, go straight to result
      if (participantSnap.exists() && participantSnap.data()?.completed) {
        router.replace({ pathname: "/contest/result", params: { contestId } });
        return;
      }

      if (contestSnap.exists()) {
        const quiz: Question[] = contestSnap.data()?.lessonJson?.quiz ?? [];
        setQuestions(quiz);
      }
      setLoading(false);
    })();
  }, [contestId, userId]);

  // Timer per question
  useEffect(() => {
    if (loading || locked || questions.length === 0) return;

    questionStart.current = Date.now();
    setTimeLeft(SECONDS_PER_Q);
    Animated.timing(progressAnim, { toValue: 1, duration: 0, useNativeDriver: false }).start();
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: SECONDS_PER_Q * 1000,
      useNativeDriver: false,
    }).start();

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleAdvance(null);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentIdx, loading]);

  const handleSelect = (idx: number) => {
    if (locked) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelected(idx);
    setLocked(true);
    setTimeout(() => handleAdvance(idx), 1200);
  };

  const handleAdvance = (selectedIdx: number | null) => {
    const q = questions[currentIdx];
    const correct = selectedIdx !== null && selectedIdx === q.correctAnswerIndex;
    const timeTakenSeconds = Math.min(
      SECONDS_PER_Q,
      Math.round((Date.now() - questionStart.current) / 1000)
    );

    const newAnswers: QuizAnswer[] = [
      ...answers,
      { questionIndex: currentIdx, selectedIndex: selectedIdx, correct, timeTakenSeconds },
    ];
    setAnswers(newAnswers);

    if (currentIdx + 1 < questions.length) {
      setCurrentIdx((i) => i + 1);
      setSelected(null);
      setLocked(false);
    } else {
      finishQuiz(newAnswers);
    }
  };

  const finishQuiz = async (finalAnswers: QuizAnswer[]) => {
    if (!userId || !contestId) return;
    setSubmitting(true);
    try {
      const { score, rank } = await submitContestQuiz(
        contestId as string,
        userId,
        finalAnswers
      );
      router.replace({
        pathname: "/contest/result",
        params: { contestId, score: String(score), total: String(questions.length), rank: String(rank) },
      });
    } catch (e) {
      console.error("Quiz submit error:", e);
      router.replace({
        pathname: "/contest/result",
        params: { contestId, score: "0", total: String(questions.length) },
      });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={S.center}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={S.loadingText}>Loading quiz...</Text>
      </SafeAreaView>
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView style={S.center}>
        <Ionicons name="help-circle-outline" size={64} color="#374151" />
        <Text style={S.emptyTitle}>No Quiz Available</Text>
        <Text style={S.emptySub}>The quiz for this contest hasn't been generated yet.</Text>
        <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
          <Text style={S.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (submitting) {
    return (
      <SafeAreaView style={S.center}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={S.loadingText}>Submitting your answers...</Text>
      </SafeAreaView>
    );
  }

  const q = questions[currentIdx];
  const timerDanger = timeLeft <= 10;

  return (
    <SafeAreaView style={S.container}>
      {/* Progress + Timer header */}
      <LinearGradient colors={["#0f0c29", "#302b63"]} style={S.header}>
        <View style={S.headerRow}>
          <Text style={S.qCounter}>Question {currentIdx + 1} / {questions.length}</Text>
          <View style={[S.timerBadge, timerDanger && S.timerDanger]}>
            <Ionicons name="time-outline" size={14} color={timerDanger ? "#fca5a5" : "#a5b4fc"} />
            <Text style={[S.timerText, timerDanger && S.timerTextDanger]}>{timeLeft}s</Text>
          </View>
        </View>

        <View style={S.progressBg}>
          <Animated.View
            style={[
              S.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
        <View style={S.stepDots}>
          {questions.map((_, i) => (
            <View
              key={i}
              style={[S.dot, i < currentIdx && S.dotDone, i === currentIdx && S.dotActive]}
            />
          ))}
        </View>
      </LinearGradient>

      {/* Question */}
      <View style={S.questionCard}>
        {!!q.difficulty && (
          <View style={[S.diffBadge, diffColor(q.difficulty)]}>
            <Text style={S.diffText}>{q.difficulty.toUpperCase()}</Text>
          </View>
        )}
        <Text style={S.questionText}>{q.question}</Text>
        {!!q.concept && <Text style={S.conceptHint}>Topic: {q.concept}</Text>}
      </View>

      {/* Options */}
      <View style={S.options}>
        {q.options.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect  = locked && i === q.correctAnswerIndex;
          const isWrong    = locked && isSelected && !isCorrect;
          return (
            <TouchableOpacity
              key={i}
              activeOpacity={locked ? 1 : 0.8}
              style={[S.optBtn, isCorrect && S.optCorrect, isWrong && S.optWrong, isSelected && !locked && S.optSelected]}
              onPress={() => handleSelect(i)}
            >
              <View style={[S.optLabel, isCorrect && S.optLabelCorrect, isWrong && S.optLabelWrong]}>
                <Text style={S.optLabelText}>{OPTION_LABELS[i]}</Text>
              </View>
              <Text style={[S.optText, (isCorrect || isWrong) && S.optTextBold]}>{opt}</Text>
              {isCorrect && <Ionicons name="checkmark-circle" size={20} color="#10b981" />}
              {isWrong   && <Ionicons name="close-circle"     size={20} color="#ef4444" />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Score tracker */}
      <View style={S.scoreTracker}>
        <Text style={S.scoreTrackerText}>
          ✅ {answers.filter((a) => a.correct).length} correct  ·  ❌ {answers.filter((a) => !a.correct && a.selectedIndex !== null).length} wrong  ·  ⏩ {answers.filter((a) => a.selectedIndex === null).length} skipped
        </Text>
      </View>
    </SafeAreaView>
  );
}

function diffColor(d: string) {
  if (d === "easy") return { backgroundColor: "#064e3b" };
  if (d === "hard") return { backgroundColor: "#450a0a" };
  return { backgroundColor: "#1e3a5f" };
}

const S = StyleSheet.create({
  container:     { flex: 1, backgroundColor: "#0f172a" },
  center:        { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a", gap: 14, padding: 24 },
  loadingText:   { color: "#94a3b8", fontSize: 15, fontWeight: "600" },
  emptyTitle:    { color: "#f1f5f9", fontSize: 20, fontWeight: "800" },
  emptySub:      { color: "#6b7280", fontSize: 14, textAlign: "center" },
  backBtn:       { marginTop: 8, backgroundColor: "#1e293b", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24 },
  backBtnText:   { color: "#6366f1", fontWeight: "800" },

  header:        { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, gap: 10 },
  headerRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  qCounter:      { color: "#e2e8f0", fontSize: 15, fontWeight: "800" },
  timerBadge:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  timerDanger:   { backgroundColor: "rgba(239,68,68,0.2)" },
  timerText:     { color: "#a5b4fc", fontSize: 13, fontWeight: "800" },
  timerTextDanger: { color: "#fca5a5" },
  progressBg:    { height: 6, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" },
  progressFill:  { height: "100%", backgroundColor: "#6366f1", borderRadius: 4 },
  stepDots:      { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  dot:           { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.2)" },
  dotDone:       { backgroundColor: "#10b981" },
  dotActive:     { backgroundColor: "#6366f1", width: 20 },

  questionCard:  { margin: 16, backgroundColor: "#1e293b", borderRadius: 20, padding: 20, gap: 8 },
  diffBadge:     { alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  diffText:      { color: "#a5b4fc", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  questionText:  { color: "#f1f5f9", fontSize: 18, fontWeight: "700", lineHeight: 28 },
  conceptHint:   { color: "#475569", fontSize: 12, fontStyle: "italic" },

  options:       { paddingHorizontal: 16, gap: 10 },
  optBtn:        { flexDirection: "row", alignItems: "center", backgroundColor: "#1e293b", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#334155", gap: 12 },
  optSelected:   { borderColor: "#6366f1" },
  optCorrect:    { borderColor: "#10b981", backgroundColor: "#052e16" },
  optWrong:      { borderColor: "#ef4444", backgroundColor: "#450a0a" },
  optLabel:      { width: 32, height: 32, borderRadius: 8, backgroundColor: "#334155", justifyContent: "center", alignItems: "center" },
  optLabelCorrect: { backgroundColor: "#064e3b" },
  optLabelWrong:   { backgroundColor: "#7f1d1d" },
  optLabelText:  { color: "#a5b4fc", fontWeight: "800", fontSize: 13 },
  optText:       { flex: 1, color: "#cbd5e1", fontSize: 15, lineHeight: 22 },
  optTextBold:   { fontWeight: "700" },

  scoreTracker:     { position: "absolute", bottom: 16, left: 16, right: 16, backgroundColor: "#1e293b", borderRadius: 12, padding: 12, alignItems: "center" },
  scoreTrackerText: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
});

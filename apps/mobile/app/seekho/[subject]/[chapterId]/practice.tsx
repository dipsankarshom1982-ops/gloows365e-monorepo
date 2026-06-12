import { useTheme } from "@/context/ThemeContext";
import { useStudentProfile } from "@/context/StudentProfileContext";
import { CHAPTER_XP_REWARD, PRACTICE_PASS_THRESHOLD } from "@/lib/seekho/constants";
import type { SeekhoPracticeQuestion, SeekhoSubject, PracticeResultItem } from "@/lib/seekho/types";
import { useSeekhoStore } from "@/store/seekhoStore";
import { getPracticeByChapter } from "@/services/seekhoFirestore";
import XPToast, { type XPToastRef } from "@/components/seekho/XPToast";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Shuffle helper
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PracticeScreen() {
  const { colors } = useTheme();
  const { user } = useStudentProfile();
  const { subject, chapterId } = useLocalSearchParams<{
    subject: string;
    chapterId: string;
  }>();

  const subjectName = subject as SeekhoSubject;
  const { submitPracticeAnswer, markChapterComplete } = useSeekhoStore();

  const [questions, setQuestions] = useState<SeekhoPracticeQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [allResults, setAllResults] = useState<PracticeResultItem[]>([]);

  const xpToastRef = useRef<XPToastRef>(null);

  useEffect(() => {
    if (!chapterId || !user) return;
    (async () => {
      const qs = await getPracticeByChapter(chapterId);
      setQuestions(shuffle(qs));
      setLoading(false);
    })();
  }, [chapterId, user]);

  const currentQuestion = questions[currentIdx];
  const totalQuestions = questions.length;
  const correctCount = Object.values(answers).filter(Boolean).length;

  const handleOptionSelect = (idx: number) => {
    if (submitted) return;
    setSelectedIdx(idx);
  };

  const handleSubmit = () => {
    if (selectedIdx === null || !currentQuestion) return;
    const correct = selectedIdx === currentQuestion.correctIndex;
    setSubmitted(true);

    const result: PracticeResultItem = {
      courseId: chapterId!,
      questionId: currentQuestion.questionId,
      conceptTag: currentQuestion.conceptTag,
      correct,
      responseTimeMs: Date.now() - questionStartTime,
    };

    setAllResults((prev) => [...prev, result]);
    setAnswers((prev) => ({ ...prev, [currentQuestion.questionId]: correct }));
    submitPracticeAnswer(chapterId!, currentQuestion.questionId, correct);
  };

  const handleNext = () => {
    if (currentIdx < totalQuestions - 1) {
      setCurrentIdx((i) => i + 1);
      setSelectedIdx(null);
      setSubmitted(false);
      setQuestionStartTime(Date.now());
    } else {
      finishPractice();
    }
  };

  const finishPractice = async () => {
    setDone(true);
    const score = correctCount / Math.max(totalQuestions, 1);

    if (score >= PRACTICE_PASS_THRESHOLD && user && chapterId) {
      try {
        const onChapterComplete = httpsCallable<{ courseId: string }, { success: boolean }>(
          functions,
          "seekhoOnChapterComplete"
        );
        await onChapterComplete({ courseId: chapterId });
        markChapterComplete(chapterId);
        xpToastRef.current?.show(CHAPTER_XP_REWARD);

        // Award V-Coins for chapter completion (fire-and-forget)
        httpsCallable(functions, "claimVCoinReward")(
          { activityId: "chapter_complete", referenceId: chapterId }
        ).catch(() => {});

        // Update revision queue for wrong answers
        const wrongResults = allResults.filter((r) => !r.correct);
        if (wrongResults.length > 0) {
          const updateRevision = httpsCallable<{ results: PracticeResultItem[] }, { updated: number }>(
            fns,
            "seekhoUpdateRevisionQueue"
          );
          await updateRevision({ results: allResults }).catch(() => null);
        }
      } catch (e) {
        console.warn("Chapter complete call failed:", e);
      }
    }
  };

  const handleAddToRevision = async () => {
    if (!user || !chapterId) return;
    const wrongResults = allResults.filter((r) => !r.correct);
    if (!wrongResults.length) return;
    try {
      const updateRevision = httpsCallable<{ results: PracticeResultItem[] }, { updated: number }>(
        functions,
        "seekhoUpdateRevisionQueue"
      );
      await updateRevision({ results: wrongResults });
      Alert.alert("Added!", "Wrong answers added to your revision queue.");
    } catch (e) {
      Alert.alert("Error", "Could not update revision queue.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[S.container, { backgroundColor: colors.background }]}>
        <View style={S.center}>
          <Text style={[S.loadingText, { color: colors.textSecondary }]}>Loading practice…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (totalQuestions === 0) {
    return (
      <SafeAreaView style={[S.container, { backgroundColor: colors.background }]}>
        <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={S.center}>
          <Text style={S.emptyIcon}>📝</Text>
          <Text style={[S.emptyTitle, { color: colors.text }]}>No questions yet</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Summary screen ──────────────────────────────────────────────────────────
  if (done) {
    const score = correctCount / Math.max(totalQuestions, 1);
    const passed = score >= PRACTICE_PASS_THRESHOLD;
    const weakConcepts = [
      ...new Set(allResults.filter((r) => !r.correct).map((r) => r.conceptTag)),
    ];

    return (
      <SafeAreaView style={[S.container, { backgroundColor: colors.background }]}>
        <XPToast ref={xpToastRef} />
        <ScrollView contentContainerStyle={S.summaryScroll}>
          <LinearGradient
            colors={passed ? ["#052e16", "#059669"] : ["#450a0a", "#dc2626"]}
            style={S.summaryHero}
          >
            <Text style={S.summaryEmoji}>{passed ? "🏆" : "💪"}</Text>
            <Text style={S.summaryScore}>
              {correctCount}/{totalQuestions}
            </Text>
            <Text style={S.summaryLabel}>
              {passed ? "Chapter Complete!" : "Keep Practicing!"}
            </Text>
            <Text style={S.summaryPct}>{Math.round(score * 100)}% correct</Text>
          </LinearGradient>

          {passed && (
            <View style={[S.xpCard, { backgroundColor: colors.card }]}>
              <Text style={S.xpCardEmoji}>⭐</Text>
              <Text style={[S.xpCardTitle, { color: colors.text }]}>+{CHAPTER_XP_REWARD} XP Earned!</Text>
              <Text style={[S.xpCardSub, { color: colors.textSecondary }]}>
                Chapter added to your completed list
              </Text>
            </View>
          )}

          {weakConcepts.length > 0 && (
            <View style={{ paddingHorizontal: 16 }}>
              <Text style={[S.sectionTitle, { color: colors.text }]}>Weak Concepts</Text>
              {weakConcepts.map((c) => (
                <View key={c} style={[S.weakTag, { backgroundColor: colors.card }]}>
                  <Ionicons name="alert-circle-outline" size={14} color="#f59e0b" />
                  <Text style={[S.weakTagText, { color: colors.text }]}>{c}</Text>
                </View>
              ))}
              <TouchableOpacity style={S.revisionBtn} onPress={handleAddToRevision}>
                <Ionicons name="refresh-circle-outline" size={18} color="#fff" />
                <Text style={S.revisionBtnText}>Add to Revision Queue</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={S.summaryActions}>
            <TouchableOpacity
              style={[S.summaryBtn, { backgroundColor: "#4f46e5" }]}
              onPress={() =>
                router.replace({
                  pathname: "/seekho/[subject]/[chapterId]",
                  params: { subject: subjectName, chapterId: chapterId! },
                })
              }
            >
              <Text style={S.summaryBtnText}>Back to Chapter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[S.summaryBtn, { borderColor: colors.border, borderWidth: 1.5 }]}
              onPress={() => router.push("/(drawer)/(tabs)/seekho")}
            >
              <Text style={[S.summaryBtnText, { color: colors.text }]}>Home</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Question card ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[S.container, { backgroundColor: colors.background }]}>
      <XPToast ref={xpToastRef} />

      {/* Header */}
      <View style={[S.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="close" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[S.progressText, { color: colors.textSecondary }]}>
          Q{currentIdx + 1} of {totalQuestions}
        </Text>
        <View style={[S.headerBarBg, { backgroundColor: colors.border }]}>
          <View
            style={[
              S.headerBarFill,
              { width: `${((currentIdx + 1) / totalQuestions) * 100}%` },
            ]}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={S.questionScroll} showsVerticalScrollIndicator={false}>
        {/* Difficulty badge */}
        <View style={S.diffRow}>
          <View
            style={[
              S.diffBadge,
              {
                backgroundColor:
                  currentQuestion.difficulty === "easy"
                    ? "#052e16"
                    : currentQuestion.difficulty === "medium"
                    ? "#431407"
                    : "#450a0a",
              },
            ]}
          >
            <Text
              style={[
                S.diffText,
                {
                  color:
                    currentQuestion.difficulty === "easy"
                      ? "#10b981"
                      : currentQuestion.difficulty === "medium"
                      ? "#f97316"
                      : "#ef4444",
                },
              ]}
            >
              {currentQuestion.difficulty.toUpperCase()}
            </Text>
          </View>
          <Text style={[S.conceptTag, { color: "#a5b4fc" }]}>
            {currentQuestion.conceptTag}
          </Text>
        </View>

        {/* Question */}
        <Text style={[S.questionText, { color: colors.text }]}>
          {currentQuestion.question}
        </Text>

        {/* Options */}
        {currentQuestion.options.map((option, idx) => {
          const isSelected = selectedIdx === idx;
          const isCorrect = idx === currentQuestion.correctIndex;
          let bgColor = colors.card;
          let borderColor = colors.border;
          if (submitted) {
            if (isCorrect) { bgColor = "#052e16"; borderColor = "#10b981"; }
            else if (isSelected && !isCorrect) { bgColor = "#450a0a"; borderColor = "#ef4444"; }
          } else if (isSelected) {
            bgColor = "#1e1b4b"; borderColor = "#6366f1";
          }

          return (
            <TouchableOpacity
              key={idx}
              style={[S.optionBtn, { backgroundColor: bgColor, borderColor }]}
              onPress={() => handleOptionSelect(idx)}
              disabled={submitted}
              activeOpacity={0.8}
            >
              <View style={[S.optionLetter, { backgroundColor: isSelected && !submitted ? "#4f46e5" : colors.border }]}>
                <Text style={[S.optionLetterText, { color: isSelected && !submitted ? "#fff" : colors.textSecondary }]}>
                  {String.fromCharCode(65 + idx)}
                </Text>
              </View>
              <Text style={[S.optionText, { color: submitted && isCorrect ? "#10b981" : colors.text }]}>
                {option}
              </Text>
              {submitted && isCorrect && (
                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              )}
              {submitted && isSelected && !isCorrect && (
                <Ionicons name="close-circle" size={18} color="#ef4444" />
              )}
            </TouchableOpacity>
          );
        })}

        {/* Explanation */}
        {submitted && (
          <View style={[S.explanationWrap, { backgroundColor: colors.card }]}>
            <Text style={[S.explanationLabel, { color: "#a5b4fc" }]}>Explanation</Text>
            <Text style={[S.explanationText, { color: colors.text }]}>
              {currentQuestion.explanation}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Action button */}
      <View style={[S.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        {!submitted ? (
          <TouchableOpacity
            style={[S.actionBtn, { backgroundColor: selectedIdx !== null ? "#4f46e5" : colors.card, opacity: selectedIdx !== null ? 1 : 0.5 }]}
            onPress={handleSubmit}
            disabled={selectedIdx === null}
          >
            <Text style={[S.actionBtnText, { color: selectedIdx !== null ? "#fff" : colors.textSecondary }]}>
              Submit Answer
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[S.actionBtn, { backgroundColor: "#4f46e5" }]} onPress={handleNext}>
            <Text style={[S.actionBtnText, { color: "#fff" }]}>
              {currentIdx < totalQuestions - 1 ? "Next Question →" : "View Results"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { fontSize: 14, fontWeight: "500" },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "800" },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  progressText: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  headerBarBg: { height: 4, borderRadius: 2, overflow: "hidden" },
  headerBarFill: { height: 4, borderRadius: 2, backgroundColor: "#6366f1" },

  questionScroll: { padding: 16, paddingBottom: 8 },
  diffRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  diffText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  conceptTag: { fontSize: 11, fontWeight: "600" },
  questionText: { fontSize: 17, fontWeight: "700", lineHeight: 26, marginBottom: 20 },

  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  optionLetterText: { fontSize: 13, fontWeight: "700" },
  optionText: { flex: 1, fontSize: 14, fontWeight: "600", lineHeight: 20 },

  explanationWrap: { borderRadius: 14, padding: 14, marginTop: 4 },
  explanationLabel: { fontSize: 11, fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  explanationText: { fontSize: 13, fontWeight: "500", lineHeight: 20 },

  footer: { padding: 16, paddingBottom: 20, borderTopWidth: 1 },
  actionBtn: { paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  actionBtnText: { fontSize: 15, fontWeight: "800" },

  // Summary
  summaryScroll: { paddingBottom: 40 },
  summaryHero: {
    padding: 32,
    alignItems: "center",
    gap: 6,
  },
  summaryEmoji: { fontSize: 56, marginBottom: 8 },
  summaryScore: { color: "#fff", fontSize: 48, fontWeight: "900" },
  summaryLabel: { color: "#fff", fontSize: 18, fontWeight: "800" },
  summaryPct: { color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "500" },

  xpCard: {
    margin: 16,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  xpCardEmoji: { fontSize: 28 },
  xpCardTitle: { fontSize: 16, fontWeight: "800" },
  xpCardSub: { fontSize: 12, fontWeight: "500" },

  sectionTitle: { fontSize: 15, fontWeight: "800", marginBottom: 10, marginTop: 4 },
  weakTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  weakTagText: { fontSize: 13, fontWeight: "600" },
  revisionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 8,
  },
  revisionBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  summaryActions: { flexDirection: "row", gap: 12, paddingHorizontal: 16, marginTop: 20 },
  summaryBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  summaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});

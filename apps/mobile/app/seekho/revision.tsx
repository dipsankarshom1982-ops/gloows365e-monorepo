import { useTheme } from "@/context/ThemeContext";
import { useStudentProfile } from "@/context/StudentProfileContext";
import type { SeekhoPracticeQuestion, PracticeResultItem } from "@/lib/seekho/types";
import { useSeekhoStore } from "@/store/seekhoStore";
import { getPracticeByChapter } from "@/services/seekhoFirestore";
import RevisionCard from "@/components/seekho/RevisionCard";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RevisionScreen() {
  const { colors } = useTheme();
  const { user } = useStudentProfile();
  const { revisionQueue } = useSeekhoStore();

  const [questions, setQuestions] = useState<SeekhoPracticeQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [results, setResults] = useState<PracticeResultItem[]>([]);

  // Filter queue items due today
  const dueItems = revisionQueue.filter((item) => item.nextReviewAt <= Date.now());
  const dueCount = dueItems.length;

  useEffect(() => {
    if (!user || !dueItems.length) {
      setLoading(false);
      return;
    }
    (async () => {
      // Collect all question IDs from due items
      const allQuestionIds = [...new Set(dueItems.flatMap((i) => i.questionIds))];

      // Fetch questions — grouped by courseId from queue items
      const courseIds = [...new Set(dueItems.map((i) => i.docId.split("_")[0]))];
      const allQuestions: SeekhoPracticeQuestion[] = [];

      for (const courseId of courseIds) {
        if (courseId && courseId.length > 10) {
          const qs = await getPracticeByChapter(courseId).catch(() => []);
          allQuestions.push(...qs.filter((q) => allQuestionIds.includes(q.questionId)));
        }
      }

      setQuestions(allQuestions);
      setLoading(false);
    })();
  }, [user, dueCount]);

  const handleEasy = async () => {
    await submitRating(true);
  };

  const handleHard = async () => {
    await submitRating(false);
  };

  const submitRating = async (easy: boolean) => {
    const q = questions[currentIdx];
    if (!q) return;

    const result: PracticeResultItem = {
      courseId: q.courseId,
      questionId: q.questionId,
      conceptTag: q.conceptTag,
      correct: easy,
      responseTimeMs: easy ? 3000 : 12000,
    };
    setResults((prev) => [...prev, result]);

    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      setDone(true);
      // Submit all results to update SM-2 intervals
      if (user && results.length) {
        try {
          const fns = getFunctions();
          const updateRevision = httpsCallable<
            { results: PracticeResultItem[] },
            { updated: number }
          >(fns, "seekhoUpdateRevisionQueue");
          await updateRevision({ results: [...results, result] });
        } catch (e) {
          console.warn("SM-2 update failed:", e);
        }
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[S.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color="#4f46e5" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[S.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[S.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: colors.text }]}>Revision</Text>
        <View style={[S.badge, { backgroundColor: "#4f46e5" }]}>
          <Text style={S.badgeText}>{dueCount} due</Text>
        </View>
      </View>

      {/* Empty state */}
      {dueCount === 0 || questions.length === 0 ? (
        <View style={S.empty}>
          <Text style={S.emptyEmoji}>🎉</Text>
          <Text style={[S.emptyTitle, { color: colors.text }]}>All caught up!</Text>
          <Text style={[S.emptySub, { color: colors.textSecondary }]}>
            No revision cards due today. Keep learning to build your queue.
          </Text>
          <TouchableOpacity
            style={S.homeBtn}
            onPress={() => router.push("/(drawer)/(tabs)/seekho")}
          >
            <Text style={S.homeBtnText}>Back to Seekho</Text>
          </TouchableOpacity>
        </View>
      ) : done ? (
        <View style={S.empty}>
          <Text style={S.emptyEmoji}>✅</Text>
          <Text style={[S.emptyTitle, { color: colors.text }]}>Session Complete!</Text>
          <Text style={[S.emptySub, { color: colors.textSecondary }]}>
            Reviewed {questions.length} card{questions.length !== 1 ? "s" : ""} today.
          </Text>
          <TouchableOpacity
            style={S.homeBtn}
            onPress={() => router.push("/(drawer)/(tabs)/seekho")}
          >
            <Text style={S.homeBtnText}>Back to Seekho</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={S.cardArea}>
          {/* Progress */}
          <Text style={[S.progressText, { color: colors.textSecondary }]}>
            Card {currentIdx + 1} of {questions.length}
          </Text>
          <View style={[S.progressBarBg, { backgroundColor: colors.border }]}>
            <View
              style={[
                S.progressBarFill,
                { width: `${((currentIdx + 1) / questions.length) * 100}%` },
              ]}
            />
          </View>

          {/* Flip card */}
          <View style={S.cardWrap}>
            <RevisionCard
              question={questions[currentIdx]}
              onEasy={handleEasy}
              onHard={handleHard}
            />
          </View>

          <Text style={[S.hint, { color: colors.textSecondary }]}>
            Tap the card to reveal the answer
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "800" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 8,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontWeight: "900", textAlign: "center" },
  emptySub: { fontSize: 13, fontWeight: "500", textAlign: "center", lineHeight: 20 },
  homeBtn: {
    marginTop: 16,
    backgroundColor: "#4f46e5",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  homeBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  cardArea: { flex: 1, paddingTop: 16, paddingHorizontal: 16 },
  progressText: { fontSize: 13, fontWeight: "600", textAlign: "center", marginBottom: 8 },
  progressBarBg: { height: 4, borderRadius: 2, overflow: "hidden", marginBottom: 24 },
  progressBarFill: { height: 4, borderRadius: 2, backgroundColor: "#6366f1" },
  cardWrap: { flex: 1, justifyContent: "center" },
  hint: { fontSize: 11, fontWeight: "500", textAlign: "center", marginBottom: 16 },
});

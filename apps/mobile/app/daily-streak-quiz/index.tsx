// PATH: app/daily-streak-quiz/index.tsx
//
// Daily Streak Quiz — main student screen.
//
// Flow:
//  1. On mount, fetch today's question (server resolves by class/language/
//     active-status/date — see services/dailyStreakQuizService.ts). The
//     question payload never includes the correct answer.
//  2. Student picks an option, taps Submit — locked immediately
//     (isSubmitting + hasSubmittedToday both gate the UI so a double-tap
//     can't fire two requests).
//  3. Server validates + scores + updates streak/VCoins/XP atomically and
//     returns the result (including the correct answer + explanation,
//     now that it's safe to reveal).
//  4. Result is rendered in place; today's quiz is locked until midnight.

import AmbassadorBanner from "@/components/dailyStreakQuiz/AmbassadorBanner";
import ConfettiBurst, { ConfettiBurstRef } from "@/components/dailyStreakQuiz/ConfettiBurst";
import OptionCard, { OptionVisualState } from "@/components/dailyStreakQuiz/OptionCard";
import StreakStatsHeader from "@/components/dailyStreakQuiz/StreakStatsHeader";
import { useTheme } from "@/context/ThemeContext";
import {
  DAILY_STREAK_QUIZ_AMBASSADOR_WEEKS,
  DailyStreakProgress,
  DailyStreakQuizOption,
  DailyStreakQuizSubmitResult,
  PublicDailyStreakQuizQuestion,
} from "@/lib/dailyStreakQuiz/types";
import {
  applyForAmbassadorProgram,
  fetchTodaysStreakQuizQuestion,
  subscribeToStreakProgress,
  submitStreakQuizAnswer,
} from "@/services/dailyStreakQuizService";
import { useVCoins } from "@/hooks/useVCoins";
import { useLearnFun } from "@/hooks/useLearnFun";
import { useStudentProfile, STUDENT_STREAMS, StudentStream } from "@gloows/shared-logic";
import { auth, db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Class 11/12 only — mirrors dailyStreakQuizGeneration.ts / adminManagement.ts.
const STREAM_CLASSES = [11, 12];

const OPTION_LETTERS: DailyStreakQuizOption[] = ["A", "B", "C", "D"];

type ScreenState = "loading" | "ready" | "no-question" | "error";

export default function DailyStreakQuizScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { profileLoading, studentProfile } = useStudentProfile();
  const { balance: vCoinsBalance } = useVCoins();
  const { profile: learnFunProfile } = useLearnFun();

  const confettiRef = useRef<ConfettiBurstRef>(null);

  const [screenState, setScreenState] = useState<ScreenState>("loading");
  const [question, setQuestion] = useState<PublicDailyStreakQuizQuestion | null>(null);
  const [selected, setSelected] = useState<DailyStreakQuizOption | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DailyStreakQuizSubmitResult | null>(null);
  const [progress, setProgress] = useState<DailyStreakProgress | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [savingStream, setSavingStream] = useState<StudentStream | null>(null);

  // Class 11/12 without a stream set yet — getTodaysStreakQuizQuestion still
  // serves a fallback question in this case (see dailyStreakQuiz.ts), but
  // it isn't stream-personalized until they pick one. Never blocks the quiz
  // itself, just nudges.
  const missingStream = !!studentProfile?.class
    && STREAM_CLASSES.includes(Number(studentProfile.class))
    && !studentProfile?.stream;

  // ── Load today's question ───────────────────────────────────────────────
  const loadQuestion = useCallback(async () => {
    try {
      setScreenState("loading");
      const q = await fetchTodaysStreakQuizQuestion();
      if (!q) {
        setQuestion(null);
        setScreenState("no-question");
        return;
      }
      setQuestion(q);
      setScreenState("ready");
      // If the student already answered today (e.g. they navigated away
      // and back), reflect the lock immediately without re-submitting.
      if (q.alreadySubmitted) {
        setSelected(null); // we don't know which option they picked from this payload
      }
    } catch (e) {
      console.error("[DailyStreakQuiz] load error:", e);
      setScreenState("error");
    }
  }, []);

  useEffect(() => {
    loadQuestion();
  }, [loadQuestion]);

  // ── Subscribe to streak/progress rollup ─────────────────────────────────
  useEffect(() => {
    const unsub = subscribeToStreakProgress(setProgress);
    return unsub;
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadQuestion();
    setRefreshing(false);
  }, [loadQuestion]);

  // ── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!question || !selected || submitting || result) return;
    setSubmitting(true);
    try {
      const res = await submitStreakQuizAnswer(question.questionId, selected);
      setResult(res);

      if (res.isCorrect) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        confettiRef.current?.fire();
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (e: any) {
      if (e?.code === "already-exists") {
        // Already submitted today (e.g. duplicate tap / stale screen) —
        // re-sync rather than show an error.
        await loadQuestion();
      } else {
        console.error("[DailyStreakQuiz] submit error:", e);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyAmbassador = async () => {
    await applyForAmbassadorProgram();
  };

  // Direct write to the student's own doc — same pattern profile-settings.tsx
  // already uses, permitted by firestore.rules' students/{uid} update rule
  // (deny-list only blocks studentId/learnScore). studentProfile updates via
  // its own onSnapshot listener, which flips `missingStream` off and
  // re-renders; reloading the question picks up the now-personalized one.
  const handleSelectStream = async (stream: StudentStream) => {
    const uid = auth.currentUser?.uid;
    if (!uid || savingStream) return;
    setSavingStream(stream);
    try {
      await updateDoc(doc(db, "students", uid), { stream });
      await loadQuestion();
    } catch (e) {
      console.error("[DailyStreakQuiz] failed to save stream:", e);
    } finally {
      setSavingStream(null);
    }
  };

  const xp = learnFunProfile?.xp ?? 0;
  const isLocked = !!result || (question?.alreadySubmitted ?? false);

  const optionState = (letter: DailyStreakQuizOption): OptionVisualState => {
    if (result) {
      if (letter === result.correctOption) return "correct";
      if (letter === selected && !result.isCorrect) return "incorrect";
      return "default";
    }
    return selected === letter ? "selected" : "default";
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={["top"]}>
      {/* Header bar */}
      <View style={[styles.headerBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>🔥 Daily Streak Quiz</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <StreakStatsHeader
          currentStreak={progress?.currentStreak ?? 0}
          weeklyProgress={progress?.weeklyProgress ?? 0}
          completedWeeks={progress?.completedWeeks ?? 0}
          vCoinsBalance={vCoinsBalance ?? 0}
          xp={xp}
        />

        {/* Ambassador eligibility */}
        {progress && progress.completedWeeks >= DAILY_STREAK_QUIZ_AMBASSADOR_WEEKS && (
          <View style={{ marginTop: 16 }}>
            <AmbassadorBanner
              alreadyApplied={!!progress.ambassadorAppliedAt}
              onApply={handleApplyAmbassador}
            />
          </View>
        )}

        {/* Missing-stream nudge — Class 11/12 only, never blocks the quiz
            itself (a fallback question is still served either way), just
            offers immediate personalization. */}
        {!profileLoading && missingStream && (
          <View style={[styles.streamBanner, { backgroundColor: colors.card, borderColor: colors.accent }]}>
            <Text style={[styles.streamBannerText, { color: colors.text }]}>
              🎯 Please select your stream to personalize your learning experience.
            </Text>
            <View style={styles.streamButtonRow}>
              {STUDENT_STREAMS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.streamButton, { backgroundColor: colors.accent, opacity: savingStream && savingStream !== s ? 0.5 : 1 }]}
                  onPress={() => handleSelectStream(s)}
                  disabled={!!savingStream}
                >
                  {savingStream === s
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.streamButtonText}>{s}</Text>
                  }
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={{ marginTop: 18 }}>
          {(screenState === "loading" || profileLoading) && <QuizSkeleton colors={colors} />}

          {screenState === "error" && (
            <ErrorState colors={colors} onRetry={loadQuestion} />
          )}

          {screenState === "no-question" && <NoQuestionState colors={colors} />}

          {screenState === "ready" && question && (
            <View>
              {/* Subject chip */}
              <View style={[styles.subjectChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.subjectChipText, { color: colors.accent }]}>
                  {question.subject}
                </Text>
              </View>

              {/* Question card */}
              <View style={[styles.questionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.questionText, { color: colors.text }]}>
                  {question.question}
                </Text>
              </View>

              {/* Already submitted today, but UI re-opened without a fresh result
                  (e.g. came back from background) — locked state, no answer shown
                  since the server never re-sends it. */}
              {question.alreadySubmitted && !result ? (
                <View style={[styles.lockedBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                  <Text style={[styles.lockedBannerText, { color: colors.textSecondary }]}>
                    You've already completed today's quiz. Come back tomorrow for a new question!
                  </Text>
                </View>
              ) : (
                <>
                  {/* Options */}
                  <View>
                    {OPTION_LETTERS.map((letter) => {
                      const optionLabel: string =
                        letter === "A" ? question.optionA :
                        letter === "B" ? question.optionB :
                        letter === "C" ? question.optionC :
                        question.optionD;
                      return (
                        <OptionCard
                          key={letter}
                          letter={letter}
                          label={optionLabel}
                          state={optionState(letter)}
                          disabled={isLocked || submitting}
                          onPress={() => !isLocked && !submitting && setSelected(letter)}
                        />
                      );
                    })}
                  </View>

                  {/* Submit button */}
                  {!result && (
                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        { backgroundColor: selected ? colors.accent : colors.border },
                      ]}
                      disabled={!selected || submitting}
                      onPress={handleSubmit}
                      activeOpacity={0.85}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.submitButtonText}>Submit Answer</Text>
                      )}
                    </TouchableOpacity>
                  )}

                  {/* Result panel */}
                  {result && (
                    <ResultPanel result={result} colors={colors} />
                  )}
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <ConfettiBurst ref={confettiRef} />
    </SafeAreaView>
  );
}

// ─── Result panel ─────────────────────────────────────────────────────────

function ResultPanel({
  result,
  colors,
}: {
  result: DailyStreakQuizSubmitResult;
  colors: any;
}) {
  return (
    <View
      style={[
        styles.resultCard,
        {
          backgroundColor: result.isCorrect ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
          borderColor: result.isCorrect ? "#10b981" : "#ef4444",
        },
      ]}
    >
      <Text style={[styles.resultTitle, { color: colors.text }]}>
        {result.isCorrect ? "✅ Correct Answer!" : "❌ Wrong Answer"}
      </Text>

      {result.isCorrect ? (
        <View style={styles.resultRows}>
          <Text style={[styles.resultRow, { color: colors.text }]}>🔥 Daily Streak Updated</Text>
          <Text style={[styles.resultRow, { color: colors.text }]}>
            🪙 +{result.vCoinsAwarded} VCoins Added
          </Text>
          <Text style={[styles.resultRow, { color: colors.text }]}>
            ⭐ +{result.xpAwarded} XP Added
          </Text>
        </View>
      ) : (
        <View style={styles.resultRows}>
          <Text style={[styles.resultRow, { color: colors.text, fontWeight: "700" }]}>
            Correct answer: Option {result.correctOption}
          </Text>
          {!!result.explanation && (
            <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
              💡 {result.explanation}
            </Text>
          )}
        </View>
      )}

      <View style={[styles.lockedFooter, { borderTopColor: colors.border }]}>
        <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />
        <Text style={[styles.lockedFooterText, { color: colors.textSecondary }]}>
          Today's quiz is locked. Come back tomorrow!
        </Text>
      </View>
    </View>
  );
}

// ─── Loading / error / empty states ───────────────────────────────────────

// Question generation can take a few seconds (translation on first request
// for the student's language — see fetchTodaysStreakQuizQuestion's retry
// loop), so this needs to unmistakably read as "working", not "frozen": a
// spinner + label up top, plus the placeholder blocks actually pulse
// instead of sitting there as a flat static tint.
function PulseBlock({ style, colors }: { style: any; colors: any }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[style, { backgroundColor: colors.card, opacity }]} />;
}

function QuizSkeleton({ colors }: { colors: any }) {
  return (
    <View>
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading today's question…
        </Text>
      </View>
      <PulseBlock style={styles.skeletonChip} colors={colors} />
      <PulseBlock style={styles.skeletonQuestion} colors={colors} />
      {[0, 1, 2, 3].map((i) => (
        <PulseBlock key={i} style={styles.skeletonOption} colors={colors} />
      ))}
    </View>
  );
}

function ErrorState({ colors, onRetry }: { colors: any; onRetry: () => void }) {
  return (
    <View style={[styles.stateCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={styles.stateEmoji}>⚠️</Text>
      <Text style={[styles.stateTitle, { color: colors.text }]}>Something went wrong</Text>
      <Text style={[styles.stateBody, { color: colors.textSecondary }]}>
        We couldn't load today's quiz. Please check your connection and try again.
      </Text>
      <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.accent }]} onPress={onRetry}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

function NoQuestionState({ colors }: { colors: any }) {
  return (
    <View style={[styles.stateCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={styles.stateEmoji}>🗓️</Text>
      <Text style={[styles.stateTitle, { color: colors.text }]}>No quiz today</Text>
      <Text style={[styles.stateBody, { color: colors.textSecondary }]}>
        There's no Daily Streak Quiz published for your class yet. Check back soon!
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "800" },
  scrollContent: { padding: 16, paddingBottom: 40 },

  subjectChip: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  subjectChipText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },

  questionCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  questionText: { fontSize: 17, fontWeight: "700", lineHeight: 24 },

  submitButton: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 6,
  },
  submitButtonText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  lockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  lockedBannerText: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },

  streamBanner: {
    marginTop: 16,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  streamBannerText: { fontSize: 13, fontWeight: "700", lineHeight: 18 },
  streamButtonRow: { flexDirection: "row", gap: 8 },
  streamButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  streamButtonText: { color: "#fff", fontWeight: "800", fontSize: 12, textAlign: "center" },

  resultCard: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 18,
    marginTop: 8,
    gap: 12,
  },
  resultTitle: { fontSize: 18, fontWeight: "900" },
  resultRows: { gap: 8 },
  resultRow: { fontSize: 14, fontWeight: "700" },
  explanationText: { fontSize: 13, fontWeight: "500", lineHeight: 19, marginTop: 2 },
  lockedFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  lockedFooterText: { fontSize: 12, fontWeight: "600" },

  stateCard: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 18,
    padding: 28,
    gap: 8,
  },
  stateEmoji: { fontSize: 36, marginBottom: 4 },
  stateTitle: { fontSize: 16, fontWeight: "800" },
  stateBody: { fontSize: 13, fontWeight: "500", textAlign: "center", lineHeight: 19 },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryButtonText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  skeletonChip: { width: 90, height: 22, borderRadius: 10, marginBottom: 10 },
  skeletonQuestion: { height: 80, borderRadius: 18, marginBottom: 16 },
  skeletonOption: { height: 58, borderRadius: 16, marginBottom: 12 },

  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  loadingText: { fontSize: 13, fontWeight: "700" },
});

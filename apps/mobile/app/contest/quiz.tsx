import { auth, db } from "@/lib/firebase";
import { submitContestQuiz, QuizAnswer } from "@/services/submitContestQuiz";
import { getContestLesson } from "@/services/getContestLesson";
import { useStudentProfile } from "@gloows/shared-logic";
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

// SECURITY (VidyaStar Phase 1): no correctAnswerIndex here — the client
// never receives the answer key. getContestLesson strips it server-side
// before this shape ever reaches the app. See functions/src/
// contestLesson.ts and submitVidyastarContestQuiz.ts for where grading
// actually happens now.
interface Question {
  question: string;
  options: string[];
  difficulty?: string;
  concept?: string;
}

// Mirrors the VidyaStar hub's getDate — contest docs store either Firestore
// Timestamps or ISO strings depending on how they were created.
function getDate(t: any): Date | null {
  if (!t) return null;
  if (typeof t.toDate === "function") return t.toDate();
  if (t.seconds) return new Date(t.seconds * 1000);
  if (typeof t === "string" && t.length > 0) return new Date(t);
  return null;
}

export default function ContestQuizScreen() {
  const { contestId } = useLocalSearchParams<{ contestId: string }>();
  const router = useRouter();
  const userId = auth.currentUser?.uid;
  const { studentProfile } = useStudentProfile();

  const [questions, setQuestions]   = useState<Question[]>([]);
  const [loading, setLoading]       = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers]       = useState<QuizAnswer[]>([]);
  const [selected, setSelected]     = useState<number | null>(null);
  const [locked, setLocked]         = useState(false);
  const [timeLeft, setTimeLeft]     = useState(SECONDS_PER_Q);
  const [submitting, setSubmitting] = useState(false);
  // "upcoming" | "ended" | null (null = live, i.e. playable) — same deep-
  // link guard as the lesson screen: this is the actual scoring entry
  // point, so it's the more important of the two to gate. Reachable
  // directly via the OS back/forward stack even if the lesson screen
  // already turned someone away once.
  const [notLive, setNotLive] = useState<"upcoming" | "ended" | null>(null);
  const [contestStart, setContestStart] = useState<Date | null>(null);

  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStart = useRef<number>(Date.now());
  const progressAnim  = useRef(new Animated.Value(1)).current;

  // Load the quiz via getContestLesson — a callable, not a direct Firestore
  // read (contests/{id}/lessons/{language} is now deny-all in
  // firestore.rules; getContestLesson also strips quiz answers from its
  // response before it ever reaches the client — see contestLesson.ts).
  // Redirect if already completed.
  useEffect(() => {
    if (!contestId || !userId) return;
    (async () => {
      const language = studentProfile?.preferredLanguage ?? "English";
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
        const c     = contestSnap.data() as any;
        const now   = new Date();
        const start = getDate(c.startTime ?? c.startDate);
        const end   = getDate(c.endTime ?? c.endDate);
        const isLive = !!(start && start <= now && (!end || end > now));
        if (!isLive) {
          setContestStart(start);
          setNotLive(end && end < now ? "ended" : "upcoming");
          setLoading(false);
          return;
        }
      }

      try {
        const { lessonJson } = await getContestLesson(contestId as string, language);
        const quiz: Question[] = lessonJson?.quiz ?? [];
        setQuestions(quiz);
      } catch (e) {
        console.error("Failed to load quiz:", e);
      }
      setLoading(false);
    })();
  }, [contestId, userId, studentProfile?.preferredLanguage]);

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

  // SECURITY (VidyaStar Phase 1): no correctness is computed here — the
  // client doesn't have the answer key anymore. Only what the student
  // actually did (selection + time taken) is recorded; grading happens
  // server-side in submitVidyastarContestQuiz.
  const handleAdvance = (selectedIdx: number | null) => {
    const timeTakenSeconds = Math.min(
      SECONDS_PER_Q,
      Math.round((Date.now() - questionStart.current) / 1000)
    );

    const newAnswers: QuizAnswer[] = [
      ...answers,
      { questionIndex: currentIdx, selectedIndex: selectedIdx, timeTakenSeconds },
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
      // VidyaStar Phase 2: the submit callable no longer computes/returns
      // rank at all (that was the O(n) per-submission rank-rewrite this
      // phase removed) — result.tsx resolves rank itself (finalRank once
      // the contest is finalized, legacy rank for historical contests, or
      // a live estimate otherwise). See lib/contestLeaderboard.ts.
      const { score } = await submitContestQuiz(
        contestId as string,
        userId,
        finalAnswers
      );
      router.replace({
        pathname: "/contest/result",
        params: { contestId, score: String(score), total: String(questions.length) },
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

  if (notLive) {
    return (
      <SafeAreaView style={S.center}>
        <Ionicons name={notLive === "upcoming" ? "hourglass-outline" : "flag-outline"} size={64} color="#374151" />
        <Text style={S.emptyTitle}>
          {notLive === "upcoming" ? "Contest hasn't started yet" : "This contest has ended"}
        </Text>
        <Text style={S.emptySub}>
          {notLive === "upcoming"
            ? `You can play this contest once it goes live${contestStart ? ` on ${contestStart.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}.`
            : "Contests can only be played while they're live."}
        </Text>
        <TouchableOpacity style={S.backBtn} onPress={() => router.replace("/(drawer)/(tabs)/vidyastar" as any)}>
          <Text style={S.backBtnText}>Back to VidyaStar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView style={S.center}>
        <Ionicons name="help-circle-outline" size={64} color="#374151" />
        <Text style={S.emptyTitle}>No Quiz Available</Text>
        <Text style={S.emptySub}>The quiz for this contest hasn&apos;t been generated yet.</Text>
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

      {/* Options — SECURITY (VidyaStar Phase 1): no correct/wrong reveal
          here anymore. The client no longer has the answer key, so it
          genuinely can't show which option was right — only which one the
          student picked. Grading happens server-side after submission. */}
      <View style={S.options}>
        {q.options.map((opt, i) => {
          const isSelected = selected === i;
          return (
            <TouchableOpacity
              key={i}
              activeOpacity={locked ? 1 : 0.8}
              style={[S.optBtn, isSelected && S.optSelected]}
              onPress={() => handleSelect(i)}
            >
              <View style={S.optLabel}>
                <Text style={S.optLabelText}>{OPTION_LABELS[i]}</Text>
              </View>
              <Text style={[S.optText, isSelected && S.optTextBold]}>{opt}</Text>
              {isSelected && <Ionicons name="checkmark-circle" size={20} color="#6366f1" />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Progress tracker — answered/skipped only; correctness is unknown
          client-side by design until the server grades the submission. */}
      <View style={S.scoreTracker}>
        <Text style={S.scoreTrackerText}>
          ✍️ {answers.filter((a) => a.selectedIndex !== null).length} answered  ·  ⏩ {answers.filter((a) => a.selectedIndex === null).length} skipped
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
  optLabel:      { width: 32, height: 32, borderRadius: 8, backgroundColor: "#334155", justifyContent: "center", alignItems: "center" },
  optLabelText:  { color: "#a5b4fc", fontWeight: "800", fontSize: 13 },
  optText:       { flex: 1, color: "#cbd5e1", fontSize: 15, lineHeight: 22 },
  optTextBold:   { fontWeight: "700" },

  scoreTracker:     { position: "absolute", bottom: 16, left: 16, right: 16, backgroundColor: "#1e293b", borderRadius: 12, padding: 12, alignItems: "center" },
  scoreTrackerText: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
});

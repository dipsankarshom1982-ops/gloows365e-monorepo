import { auth, db } from "@/lib/firebase";
import { joinContest } from "@/services/joinContest";
import { getContestLesson } from "@/services/getContestLesson";
import { useTheme } from "@/context/ThemeContext";
import { useStudentProfile } from "@gloows/shared-logic";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ThemeColors = {
  background: string;
  text: string;
  textSecondary: string;
  accent: string;
  card: string;
  border: string;
};

interface Scene {
  sceneNumber: number;
  sceneTitle: string;
  narration: string;
  keyConcept: string;
  example: string;
  checkQuestion: {
    question: string;
    options: string[];
    correctAnswerIndex: number;
    explanation: string;
  };
}

const OPTION_LABELS = ["A", "B", "C", "D"];

// Mirrors the VidyaStar hub's getDate — contest docs store either Firestore
// Timestamps or ISO strings depending on how they were created.
function getDate(t: any): Date | null {
  if (!t) return null;
  if (typeof t.toDate === "function") return t.toDate();
  if (t.seconds) return new Date(t.seconds * 1000);
  if (typeof t === "string" && t.length > 0) return new Date(t);
  return null;
}

function SceneCard({
  scene,
  total,
  onNext,
  isLast,
  colors,
  isDarkMode,
}: {
  scene: Scene;
  total: number;
  onNext: () => void;
  isLast: boolean;
  colors: ThemeColors;
  isDarkMode: boolean;
}) {
  const [checkSelected, setCheckSelected] = useState<number | null>(null);
  const [checkRevealed, setCheckRevealed] = useState(false);

  const handleCheckAnswer = (idx: number) => {
    if (checkRevealed) return;
    setCheckSelected(idx);
    setCheckRevealed(true);
  };

  return (
    <ScrollView contentContainerStyle={S.sceneScroll} showsVerticalScrollIndicator={false}>
      {/* Scene header */}
      <LinearGradient colors={isDarkMode ? ["#1a0a2e", "#312e81"] : ["#6366f1", "#4f46e5"]} style={S.sceneHeader}>
        <Text style={S.sceneNum}>Scene {scene.sceneNumber} / {total}</Text>
        <Text style={S.sceneTitle}>{scene.sceneTitle}</Text>
      </LinearGradient>

      {/* Narration */}
      <View style={[S.card, { backgroundColor: colors.card }]}>
        <View style={S.cardLabel}>
          <Ionicons name="book-outline" size={14} color={colors.accent} />
          <Text style={[S.cardLabelText, { color: colors.accent }]}>Lesson</Text>
        </View>
        <Text style={[S.narration, { color: colors.text }]}>{scene.narration}</Text>
      </View>

      {/* Key concept */}
      {scene.keyConcept ? (
        <View style={[S.card, S.conceptCard, { backgroundColor: colors.card }]}>
          <View style={S.cardLabel}>
            <Ionicons name="bulb-outline" size={14} color="#f59e0b" />
            <Text style={[S.cardLabelText, { color: "#f59e0b" }]}>Key Concept</Text>
          </View>
          <Text style={[S.conceptText, { color: isDarkMode ? "#fde68a" : "#92400e" }]}>{scene.keyConcept}</Text>
        </View>
      ) : null}

      {/* Example */}
      {scene.example ? (
        <View style={[S.card, S.exampleCard, { backgroundColor: colors.card }]}>
          <View style={S.cardLabel}>
            <Ionicons name="flask-outline" size={14} color="#10b981" />
            <Text style={[S.cardLabelText, { color: "#10b981" }]}>Example</Text>
          </View>
          <Text style={[S.exampleText, { color: isDarkMode ? "#86efac" : "#065f46" }]}>{scene.example}</Text>
        </View>
      ) : null}

      {/* Check question */}
      {scene.checkQuestion?.question ? (
        <View style={[S.checkCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[S.checkTitle, { color: colors.accent }]}>Quick Check</Text>
          <Text style={[S.checkQ, { color: colors.text }]}>{scene.checkQuestion.question}</Text>
          {scene.checkQuestion.options.map((opt, i) => {
            const isCorrect = checkRevealed && i === scene.checkQuestion.correctAnswerIndex;
            const isWrong = checkRevealed && checkSelected === i && i !== scene.checkQuestion.correctAnswerIndex;
            return (
              <TouchableOpacity
                key={i}
                style={[
                  S.checkOpt,
                  { backgroundColor: colors.background, borderColor: colors.border },
                  isCorrect && S.checkOptCorrect,
                  isWrong && S.checkOptWrong,
                ]}
                onPress={() => handleCheckAnswer(i)}
                activeOpacity={checkRevealed ? 1 : 0.8}
              >
                <View style={[S.checkLabel, isCorrect && S.checkLabelCorrect, isWrong && S.checkLabelWrong]}>
                  <Text style={S.checkLabelText}>{OPTION_LABELS[i]}</Text>
                </View>
                <Text
                  style={[
                    S.checkOptText,
                    { color: colors.text },
                    (isCorrect || isWrong) && { fontWeight: "700", color: "#f1f5f9" },
                  ]}
                >
                  {opt}
                </Text>
                {isCorrect && <Ionicons name="checkmark-circle" size={18} color="#10b981" />}
                {isWrong && <Ionicons name="close-circle" size={18} color="#ef4444" />}
              </TouchableOpacity>
            );
          })}
          {checkRevealed && scene.checkQuestion.explanation ? (
            <View style={[S.explanationBox, { backgroundColor: colors.background }]}>
              <Text style={[S.explanationText, { color: colors.textSecondary }]}>{scene.checkQuestion.explanation}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Next / Start Quiz CTA */}
      <TouchableOpacity style={S.nextBtn} onPress={onNext} activeOpacity={0.9}>
        <LinearGradient
          colors={isLast ? ["#10b981", "#059669"] : ["#6366f1", "#4f46e5"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={S.nextGrad}
        >
          <Text style={S.nextBtnText}>{isLast ? "Take the Quiz →" : "Next Scene →"}</Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

export default function ContestLessonScreen() {
  const { contestId } = useLocalSearchParams<{ contestId: string }>();
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const { studentProfile } = useStudentProfile();

  const [contest, setContest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentScene, setCurrentScene] = useState(0);
  // "upcoming" | "ended" | null (null = live, i.e. playable). Set once the
  // contest doc loads — blocks a direct deep link (e.g. from a push
  // notification, or the OS back/forward stack) from reaching lesson/quiz
  // content outside the contest's actual start/end window. The VidyaStar
  // tab already only ever shows "Continue Lesson" while live, but that's
  // just UI — nothing previously stopped this screen itself from loading
  // regardless.
  const [notLive, setNotLive] = useState<"upcoming" | "ended" | null>(null);

  const [lesson, setLesson] = useState<{ lessonJson: any; bannerMeta: any } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!contestId) return;
    const userId = auth.currentUser?.uid;
    getDoc(doc(db, "contests", contestId as string)).then(async (snap) => {
      if (!snap.exists()) { setLoading(false); return; }
      const data = { id: snap.id, ...snap.data() } as any;

      const now   = new Date();
      const start = getDate(data.startTime ?? data.startDate);
      const end   = getDate(data.endTime ?? data.endDate);
      const isLive = !!(start && start <= now && (!end || end > now));
      if (!isLive) {
        setContest(data);
        setNotLive(end && end < now ? "ended" : "upcoming");
        setLoading(false);
        return;
      }

      // Auto-join so students entering from the preview card are registered.
      // This is also the path a direct deep link to /contest/lesson hits —
      // without checking the result, a student could reach paid-contest
      // lesson content without ever paying the V-Coins entry fee shown on
      // the VidyaStar tab. Content is only set into state (and therefore
      // rendered) once we know the join didn't get blocked for lack of
      // V-Coins.
      if (userId) {
        const result = await joinContest(userId, data as any).catch(() => null);
        if (result?.status === "insufficient_balance") {
          Alert.alert(
            "Not enough V-Coins",
            `This contest needs ${result.required} V-Coins — you have ${result.balance}. Earn more by watching reels, playing the Daily Streak Quiz, or joining a Skill Battle.`,
            [{ text: "OK", onPress: () => router.replace("/(drawer)/(tabs)/vidyastar" as any) }]
          );
          setLoading(false);
          return;
        }
      }

      setContest(data);
      setLoading(false);
    });
  }, [contestId]);

  // The lesson is generated lazily, in the viewing student's own
  // preferredLanguage, the first time anyone in that language opens this
  // contest — cached after that. If another student in the same language
  // is already generating it (already-exists), poll every 3s rather than
  // showing an error, up to 10 attempts (~30s, matching how long a fresh
  // Gemini generation typically takes).
  useEffect(() => {
    if (!contest || !contestId || notLive) return;
    const language = studentProfile?.preferredLanguage ?? "English";
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const requestLesson = (attempt: number) => {
      setGenerating(true);
      setLessonError(null);
      getContestLesson(contestId as string, language)
        .then((res) => {
          if (cancelled) return;
          setLesson(res);
          setGenerating(false);
        })
        .catch((err: any) => {
          if (cancelled) return;
          const code = String(err?.code ?? "");
          if (code.endsWith("already-exists") && attempt < 10) {
            retryTimer = setTimeout(() => requestLesson(attempt + 1), 3000);
            return;
          }
          setGenerating(false);
          setLessonError(
            code.endsWith("already-exists")
              ? "This lesson is taking longer than expected."
              : "Couldn't load the lesson."
          );
        });
    };

    requestLesson(0);
    return () => { cancelled = true; if (retryTimer) clearTimeout(retryTimer); };
  }, [contest, contestId, studentProfile?.preferredLanguage, retryTick]);

  const scenes: Scene[] = lesson?.lessonJson?.scenes ?? [];
  const lessonTitle: string = lesson?.lessonJson?.lessonTitle ?? contest?.title ?? "Lesson";

  const progressPct = scenes.length > 0 ? ((currentScene) / scenes.length) * 100 : 0;

  const handleNext = () => {
    if (currentScene + 1 < scenes.length) {
      setCurrentScene((i) => i + 1);
    } else {
      router.push({ pathname: "/contest/quiz", params: { contestId } });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[S.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[S.loadingText, { color: colors.textSecondary }]}>Loading lesson...</Text>
      </SafeAreaView>
    );
  }

  if (notLive) {
    const start = getDate(contest?.startTime ?? contest?.startDate);
    return (
      <SafeAreaView style={[S.center, { backgroundColor: colors.background }]}>
        <Ionicons name={notLive === "upcoming" ? "hourglass-outline" : "flag-outline"} size={56} color={colors.textSecondary} />
        <Text style={[S.emptyTitle, { color: colors.text }]}>
          {notLive === "upcoming" ? "Contest hasn't started yet" : "This contest has ended"}
        </Text>
        <Text style={[S.emptySub, { color: colors.textSecondary }]}>
          {notLive === "upcoming"
            ? `You can play this contest once it goes live${start ? ` on ${start.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}. Your spot is already reserved.`
            : "Contests can only be played while they're live."}
        </Text>
        <TouchableOpacity style={[S.backBtn, { backgroundColor: colors.card }]} onPress={() => router.replace("/(drawer)/(tabs)/vidyastar" as any)}>
          <Text style={[S.backBtnText, { color: colors.accent }]}>Back to VidyaStar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (generating) {
    return (
      <SafeAreaView style={[S.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[S.loadingText, { color: colors.textSecondary }]}>Generating your lesson...</Text>
      </SafeAreaView>
    );
  }

  if (lessonError) {
    return (
      <SafeAreaView style={[S.center, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={56} color={colors.textSecondary} />
        <Text style={[S.emptyTitle, { color: colors.text }]}>Couldn't load lesson</Text>
        <Text style={[S.emptySub, { color: colors.textSecondary }]}>{lessonError} Please try again.</Text>
        <TouchableOpacity style={[S.backBtn, { backgroundColor: colors.card }]} onPress={() => setRetryTick((t) => t + 1)}>
          <Text style={[S.backBtnText, { color: colors.accent }]}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!lesson?.lessonJson || scenes.length === 0) {
    return (
      <SafeAreaView style={[S.center, { backgroundColor: colors.background }]}>
        <Ionicons name="time-outline" size={56} color={colors.textSecondary} />
        <Text style={[S.emptyTitle, { color: colors.text }]}>Lesson Unavailable</Text>
        <Text style={[S.emptySub, { color: colors.textSecondary }]}>Something went wrong generating this lesson. Please try again.</Text>
        <TouchableOpacity style={[S.backBtn, { backgroundColor: colors.card }]} onPress={() => router.back()}>
          <Text style={[S.backBtnText, { color: colors.accent }]}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[S.container, { backgroundColor: colors.background }]}>
      {/* Top bar */}
      <LinearGradient colors={isDarkMode ? ["#0f0c29", "#1e1b4b"] : ["#6366f1", "#4f46e5"]} style={S.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={S.backIcon}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={S.topBarMid}>
          <Text style={S.topBarTitle} numberOfLines={1}>{lessonTitle}</Text>
          <View style={S.progressBg}>
            <View style={[S.progressFill, { width: `${progressPct}%` }]} />
          </View>
        </View>
        <View style={S.sceneCounter}>
          <Text style={S.sceneCounterText}>{currentScene + 1}/{scenes.length}</Text>
        </View>
      </LinearGradient>

      {/* Scene content */}
      <SceneCard
        key={currentScene}
        scene={scenes[currentScene]}
        total={scenes.length}
        onNext={handleNext}
        isLast={currentScene === scenes.length - 1}
        colors={colors}
        isDarkMode={isDarkMode}
      />
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container:    { flex: 1 },
  center:       { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, padding: 24 },
  loadingText:  { fontSize: 15, fontWeight: "600" },
  emptyTitle:   { fontSize: 20, fontWeight: "800", textAlign: "center" },
  emptySub:     { fontSize: 14, textAlign: "center", lineHeight: 22 },
  backBtn:      { marginTop: 8, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24 },
  backBtnText:  { fontWeight: "800" },

  topBar:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  backIcon:     { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  topBarMid:    { flex: 1, gap: 6 },
  topBarTitle:  { color: "#e2e8f0", fontSize: 14, fontWeight: "800" },
  progressBg:   { height: 4, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#6366f1", borderRadius: 2 },
  sceneCounter: { backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  sceneCounterText: { color: "#a5b4fc", fontSize: 12, fontWeight: "800" },

  sceneScroll:  { paddingBottom: 16 },
  sceneHeader:  { paddingHorizontal: 20, paddingVertical: 18 },
  sceneNum:     { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  sceneTitle:   { color: "#f1f5f9", fontSize: 20, fontWeight: "900", lineHeight: 28 },

  card:         { marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 16, gap: 8 },
  cardLabel:    { flexDirection: "row", alignItems: "center", gap: 6 },
  cardLabelText:{ fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  narration:    { fontSize: 15, lineHeight: 24 },
  conceptCard:  { borderLeftWidth: 3, borderLeftColor: "#f59e0b" },
  conceptText:  { fontSize: 14, lineHeight: 22, fontWeight: "600" },
  exampleCard:  { borderLeftWidth: 3, borderLeftColor: "#10b981" },
  exampleText:  { fontSize: 14, lineHeight: 22 },

  checkCard:    { marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1 },
  checkTitle:   { fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  checkQ:       { fontSize: 15, fontWeight: "700", lineHeight: 22 },
  checkOpt:     { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 12, borderWidth: 1, gap: 10 },
  checkOptCorrect: { borderColor: "#10b981", backgroundColor: "#052e16" },
  checkOptWrong:   { borderColor: "#ef4444", backgroundColor: "#450a0a" },
  checkLabel:   { width: 28, height: 28, borderRadius: 6, backgroundColor: "#334155", justifyContent: "center", alignItems: "center" },
  checkLabelCorrect: { backgroundColor: "#064e3b" },
  checkLabelWrong:   { backgroundColor: "#7f1d1d" },
  checkLabelText:    { color: "#a5b4fc", fontSize: 11, fontWeight: "800" },
  checkOptText:      { flex: 1, fontSize: 14 },
  explanationBox:    { borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: "#6366f1" },
  explanationText:   { fontSize: 13, lineHeight: 20 },

  nextBtn:    { marginHorizontal: 16, marginTop: 20, borderRadius: 16, overflow: "hidden" },
  nextGrad:   { paddingVertical: 16, alignItems: "center" },
  nextBtnText:{ color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
});

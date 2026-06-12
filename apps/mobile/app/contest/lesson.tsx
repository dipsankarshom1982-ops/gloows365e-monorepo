import { auth, db } from "@/lib/firebase";
import { joinContest } from "@/services/joinContest";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

function SceneCard({
  scene,
  total,
  onNext,
  isLast,
}: {
  scene: Scene;
  total: number;
  onNext: () => void;
  isLast: boolean;
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
      <LinearGradient colors={["#1a0a2e", "#312e81"]} style={S.sceneHeader}>
        <Text style={S.sceneNum}>Scene {scene.sceneNumber} / {total}</Text>
        <Text style={S.sceneTitle}>{scene.sceneTitle}</Text>
      </LinearGradient>

      {/* Narration */}
      <View style={S.card}>
        <View style={S.cardLabel}>
          <Ionicons name="book-outline" size={14} color="#6366f1" />
          <Text style={S.cardLabelText}>Lesson</Text>
        </View>
        <Text style={S.narration}>{scene.narration}</Text>
      </View>

      {/* Key concept */}
      {scene.keyConcept ? (
        <View style={[S.card, S.conceptCard]}>
          <View style={S.cardLabel}>
            <Ionicons name="bulb-outline" size={14} color="#f59e0b" />
            <Text style={[S.cardLabelText, { color: "#f59e0b" }]}>Key Concept</Text>
          </View>
          <Text style={S.conceptText}>{scene.keyConcept}</Text>
        </View>
      ) : null}

      {/* Example */}
      {scene.example ? (
        <View style={[S.card, S.exampleCard]}>
          <View style={S.cardLabel}>
            <Ionicons name="flask-outline" size={14} color="#10b981" />
            <Text style={[S.cardLabelText, { color: "#10b981" }]}>Example</Text>
          </View>
          <Text style={S.exampleText}>{scene.example}</Text>
        </View>
      ) : null}

      {/* Check question */}
      {scene.checkQuestion?.question ? (
        <View style={S.checkCard}>
          <Text style={S.checkTitle}>Quick Check</Text>
          <Text style={S.checkQ}>{scene.checkQuestion.question}</Text>
          {scene.checkQuestion.options.map((opt, i) => {
            const isCorrect = checkRevealed && i === scene.checkQuestion.correctAnswerIndex;
            const isWrong = checkRevealed && checkSelected === i && i !== scene.checkQuestion.correctAnswerIndex;
            return (
              <TouchableOpacity
                key={i}
                style={[S.checkOpt, isCorrect && S.checkOptCorrect, isWrong && S.checkOptWrong]}
                onPress={() => handleCheckAnswer(i)}
                activeOpacity={checkRevealed ? 1 : 0.8}
              >
                <View style={[S.checkLabel, isCorrect && S.checkLabelCorrect, isWrong && S.checkLabelWrong]}>
                  <Text style={S.checkLabelText}>{OPTION_LABELS[i]}</Text>
                </View>
                <Text style={[S.checkOptText, (isCorrect || isWrong) && { fontWeight: "700" }]}>{opt}</Text>
                {isCorrect && <Ionicons name="checkmark-circle" size={18} color="#10b981" />}
                {isWrong && <Ionicons name="close-circle" size={18} color="#ef4444" />}
              </TouchableOpacity>
            );
          })}
          {checkRevealed && scene.checkQuestion.explanation ? (
            <View style={S.explanationBox}>
              <Text style={S.explanationText}>{scene.checkQuestion.explanation}</Text>
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

  const [contest, setContest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentScene, setCurrentScene] = useState(0);

  useEffect(() => {
    if (!contestId) return;
    const userId = auth.currentUser?.uid;
    getDoc(doc(db, "contests", contestId as string)).then((snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setContest(data);
        // Auto-join so students entering from the preview card are registered
        if (userId) joinContest(userId, data).catch(() => {});
      }
      setLoading(false);
    });
  }, [contestId]);

  const scenes: Scene[] = contest?.lessonJson?.scenes ?? [];
  const lessonTitle: string = contest?.lessonJson?.lessonTitle ?? contest?.title ?? "Lesson";

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
      <SafeAreaView style={S.center}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={S.loadingText}>Loading lesson...</Text>
      </SafeAreaView>
    );
  }

  if (!contest?.lessonJson || scenes.length === 0) {
    return (
      <SafeAreaView style={S.center}>
        <Ionicons name="time-outline" size={56} color="#374151" />
        <Text style={S.emptyTitle}>Lesson Coming Soon</Text>
        <Text style={S.emptySub}>The AI lesson for this contest is being prepared. Check back shortly!</Text>
        <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
          <Text style={S.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.container}>
      {/* Top bar */}
      <LinearGradient colors={["#0f0c29", "#1e1b4b"]} style={S.topBar}>
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
      />
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#0f172a" },
  center:       { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a", gap: 14, padding: 24 },
  loadingText:  { color: "#94a3b8", fontSize: 15, fontWeight: "600" },
  emptyTitle:   { color: "#f1f5f9", fontSize: 20, fontWeight: "800", textAlign: "center" },
  emptySub:     { color: "#6b7280", fontSize: 14, textAlign: "center", lineHeight: 22 },
  backBtn:      { marginTop: 8, backgroundColor: "#1e293b", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24 },
  backBtnText:  { color: "#6366f1", fontWeight: "800" },

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

  card:         { marginHorizontal: 16, marginTop: 12, backgroundColor: "#1e293b", borderRadius: 16, padding: 16, gap: 8 },
  cardLabel:    { flexDirection: "row", alignItems: "center", gap: 6 },
  cardLabelText:{ color: "#6366f1", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  narration:    { color: "#cbd5e1", fontSize: 15, lineHeight: 24 },
  conceptCard:  { borderLeftWidth: 3, borderLeftColor: "#f59e0b" },
  conceptText:  { color: "#fde68a", fontSize: 14, lineHeight: 22, fontWeight: "600" },
  exampleCard:  { borderLeftWidth: 3, borderLeftColor: "#10b981" },
  exampleText:  { color: "#86efac", fontSize: 14, lineHeight: 22 },

  checkCard:    { marginHorizontal: 16, marginTop: 16, backgroundColor: "#1e293b", borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: "#334155" },
  checkTitle:   { color: "#a5b4fc", fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  checkQ:       { color: "#f1f5f9", fontSize: 15, fontWeight: "700", lineHeight: 22 },
  checkOpt:     { flexDirection: "row", alignItems: "center", backgroundColor: "#0f172a", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#334155", gap: 10 },
  checkOptCorrect: { borderColor: "#10b981", backgroundColor: "#052e16" },
  checkOptWrong:   { borderColor: "#ef4444", backgroundColor: "#450a0a" },
  checkLabel:   { width: 28, height: 28, borderRadius: 6, backgroundColor: "#334155", justifyContent: "center", alignItems: "center" },
  checkLabelCorrect: { backgroundColor: "#064e3b" },
  checkLabelWrong:   { backgroundColor: "#7f1d1d" },
  checkLabelText:    { color: "#a5b4fc", fontSize: 11, fontWeight: "800" },
  checkOptText:      { flex: 1, color: "#cbd5e1", fontSize: 14 },
  explanationBox:    { backgroundColor: "#0f172a", borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: "#6366f1" },
  explanationText:   { color: "#94a3b8", fontSize: 13, lineHeight: 20 },

  nextBtn:    { marginHorizontal: 16, marginTop: 20, borderRadius: 16, overflow: "hidden" },
  nextGrad:   { paddingVertical: 16, alignItems: "center" },
  nextBtnText:{ color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
});

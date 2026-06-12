import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { listenLessonStatus } from "@/services/aiGuruFirestore";
import AiGuruAvatar from "@/components/aiGuru/AiGuruAvatar";

const STEPS = [
  "Reading your content",
  "Understanding the syllabus",
  "Creating explanation",
  "Building visual scenes",
  "Designing quiz questions",
  "Preparing revision notes",
  "Finalising AI lesson",
];

export default function GeneratingScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const [stepsVisible, setStepsVisible] = useState<boolean[]>(Array(STEPS.length).fill(false));
  const [completedStep, setCompletedStep] = useState(-1);
  const [failed, setFailed] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  // Pulse animation for active step
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Reveal steps one by one with stagger
  useEffect(() => {
    STEPS.forEach((_, i) => {
      setTimeout(() => {
        setStepsVisible((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
        setCompletedStep(i - 1);
      }, i * 1800);
    });
  }, []);

  // Listen to Firestore lesson status
  useEffect(() => {
    if (!lessonId) return;
    const unsub = listenLessonStatus(lessonId, (lesson) => {
      if (lesson.status === "completed") {
        unsubRef.current?.();
        setTimeout(() => {
          router.replace({ pathname: "/ai-guru/player", params: { lessonId } });
        }, 600);
      } else if (lesson.status === "failed") {
        unsubRef.current?.();
        setFailed(true);
      }
    });
    unsubRef.current = unsub;
    return () => unsub();
  }, [lessonId]);

  return (
    <LinearGradient colors={["#0a0a1a", "#0f172a", "#1a0a2e"]} style={S.bg}>
      <View style={S.inner}>
        <AiGuruAvatar size={100} speaking />

        <Text style={S.title}>
          {failed ? "Generation Failed" : "Creating Your Lesson..."}
        </Text>
        <Text style={S.subtitle}>
          {failed
            ? "Something went wrong. Please try again."
            : "AI Guru is preparing your personalised learning experience"}
        </Text>

        <View style={S.stepsList}>
          {STEPS.map((step, i) => {
            const visible  = stepsVisible[i];
            const isDone   = completedStep >= i;
            const isActive = completedStep === i - 1 && visible;

            if (!visible) return null;

            return (
              <View key={step} style={S.stepRow}>
                <View style={[S.stepIcon, isDone && S.stepIconDone, isActive && S.stepIconActive]}>
                  {isDone ? (
                    <Text style={S.stepCheck}>✓</Text>
                  ) : isActive ? (
                    <Animated.View style={[S.stepDot, { opacity: pulseAnim }]} />
                  ) : (
                    <View style={S.stepDotGray} />
                  )}
                </View>
                <Text style={[S.stepText, isDone && S.stepTextDone, isActive && S.stepTextActive]}>
                  {step}
                </Text>
              </View>
            );
          })}
        </View>

        {failed && (
          <TouchableOpacity style={S.retryBtn} onPress={() => router.back()} activeOpacity={0.85}>
            <Text style={S.retryText}>← Go Back & Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  );
}

const S = StyleSheet.create({
  bg:             { flex: 1 },
  inner:          { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 20 },
  title:          { color: "#f1f5f9", fontSize: 22, fontWeight: "900", textAlign: "center" },
  subtitle:       { color: "#475569", fontSize: 14, textAlign: "center", lineHeight: 22 },
  stepsList:      { width: "100%", gap: 14, marginTop: 8 },
  stepRow:        { flexDirection: "row", alignItems: "center", gap: 14 },
  stepIcon:       { width: 28, height: 28, borderRadius: 14, backgroundColor: "#1e293b", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#334155" },
  stepIconDone:   { backgroundColor: "rgba(16,185,129,0.2)", borderColor: "#10b981" },
  stepIconActive: { backgroundColor: "rgba(99,102,241,0.2)", borderColor: "#6366f1" },
  stepCheck:      { color: "#10b981", fontSize: 13, fontWeight: "900" },
  stepDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: "#6366f1" },
  stepDotGray:    { width: 8, height: 8, borderRadius: 4, backgroundColor: "#334155" },
  stepText:       { color: "#475569", fontSize: 14, fontWeight: "600" },
  stepTextDone:   { color: "#10b981" },
  stepTextActive: { color: "#a5b4fc", fontWeight: "700" },
  retryBtn:       { marginTop: 20, backgroundColor: "#1e293b", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  retryText:      { color: "#a5b4fc", fontSize: 15, fontWeight: "700" },
});

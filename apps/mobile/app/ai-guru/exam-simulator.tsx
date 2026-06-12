// PATH: app/ai-guru/exam-simulator.tsx
// Exam Simulator — AI generates board-pattern mock tests, evaluates answers,
// shows score + weak topic analysis + board readiness %.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { useStudentProfile } from "@/context/StudentProfileContext";
import { useTheme } from "@/context/ThemeContext";
import { generateExam, evaluateExam, GeneratedExam, ExamEvaluation } from "@/services/examSimulatorApi";
import { SUBJECTS, SUBJECT_ICONS } from "@/lib/aiGuru/constants";

const DIFFICULTIES = ["Easy", "Standard", "Exam Level"] as const;

type Phase = "setup" | "generating" | "exam" | "submitting" | "results" | "limit" | "error";

export default function ExamSimulatorScreen() {
  const insets = useSafeAreaInsets();
  const { studentProfile } = useStudentProfile();
  const { colors, isDarkMode } = useTheme();

  const bg      = isDarkMode ? "#060612" : colors.background;
  const surface = isDarkMode ? "#1e293b" : colors.card;
  const border  = isDarkMode ? "#334155" : colors.border;
  const text    = isDarkMode ? "#f1f5f9" : colors.text;
  const muted   = isDarkMode ? "#94a3b8" : colors.textSecondary;
  const dim     = isDarkMode ? "#64748b" : colors.textSecondary;
  const backBg  = isDarkMode ? "rgba(255,255,255,0.08)" : colors.card;

  const classLevel = String(studentProfile?.class ?? "10");
  const board      = studentProfile?.board ?? "CBSE";
  const language   = studentProfile?.preferredLanguage ?? "English";

  // Setup state
  const [subject,    setSubject]    = useState("");
  const [chapter,    setChapter]    = useState("");
  const [difficulty, setDifficulty] = useState<typeof DIFFICULTIES[number]>("Standard");

  // Exam state
  const [phase,       setPhase]       = useState<Phase>("setup");
  const [exam,        setExam]        = useState<GeneratedExam | null>(null);
  const [answers,     setAnswers]     = useState<Record<number, number>>({});
  const [evaluation,  setEvaluation]  = useState<ExamEvaluation | null>(null);
  const [errMsg,      setErrMsg]      = useState("");

  // Timer
  const [timeLeft,   setTimeLeft]   = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = (minutes: number) => {
    setTimeLeft(minutes * 60);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); submitExam(); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Generate ─────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!subject || !chapter.trim()) {
      Alert.alert("Missing info", "Please pick a subject and enter the chapter name.");
      return;
    }
    setPhase("generating");
    try {
      const result = await generateExam({
        classLevel, board, subject, chapter: chapter.trim(),
        difficulty, language, questionCount: 15,
      });
      setExam(result);
      setAnswers({});
      setPhase("exam");
      startTimer(result.estimatedMinutes);
    } catch (e: any) {
      if (e?.code === "LIMIT_REACHED") { setPhase("limit"); }
      else { setErrMsg(e?.message ?? "Failed to generate exam"); setPhase("error"); }
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const submitExam = useCallback(async () => {
    if (!exam) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("submitting");
    try {
      const answersArr = Object.entries(answers).map(([qId, sel]) => ({
        questionId: Number(qId),
        selectedIndex: sel,
      }));
      const result = await evaluateExam({ examId: exam.examId, answers: answersArr });
      setEvaluation(result);
      setPhase("results");
    } catch (e: any) {
      setErrMsg(e?.message ?? "Failed to evaluate exam");
      setPhase("error");
    }
  }, [exam, answers]);

  const answeredCount  = Object.keys(answers).length;
  const totalQuestions = exam?.questions.length ?? 0;

  const gradeColor = (g: string) =>
    g.startsWith("A") ? "#10b981" : g.startsWith("B") ? "#6366f1" : g.startsWith("C") ? "#f59e0b" : "#ef4444";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[S.root, { backgroundColor: bg }]}>
      {isDarkMode && <LinearGradient colors={["#060612", "#0a0a1a"]} style={StyleSheet.absoluteFillObject} />}

      {/* Header */}
      <Animated.View entering={FadeIn.duration(350)} style={[S.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => { if (timerRef.current) clearInterval(timerRef.current); router.back(); }} style={[S.backBtn, { backgroundColor: backBg }]}>
          <Ionicons name="chevron-back" size={22} color={muted} />
        </TouchableOpacity>
        <View style={S.headerCenter}>
          <Text style={[S.headerTitle, { color: text }]}>🎯 Exam Simulator</Text>
          <Text style={[S.headerSub, { color: dim }]}>Board-pattern mock tests · AI-evaluated</Text>
        </View>
        {phase === "exam" && (
          <View style={[S.timerBadge, { backgroundColor: timeLeft < 120 ? "rgba(239,68,68,0.15)" : surface, borderColor: timeLeft < 120 ? "#ef4444" : border }]}>
            <Ionicons name="time-outline" size={14} color={timeLeft < 120 ? "#ef4444" : muted} />
            <Text style={[S.timerText, { color: timeLeft < 120 ? "#ef4444" : text }]}>{formatTime(timeLeft)}</Text>
          </View>
        )}
      </Animated.View>

      <ScrollView contentContainerStyle={[S.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>

        {/* ── SETUP PHASE ── */}
        {phase === "setup" && (
          <Animated.View entering={FadeInDown.duration(450).delay(100)}>
            <LinearGradient colors={["#450a0a", "#7f1d1d", "#dc2626"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.heroBanner}>
              <View style={S.heroOrb} />
              <Text style={S.heroBannerEmoji}>🎯</Text>
              <Text style={S.heroBannerTitle}>Board-Pattern Mock Test</Text>
              <Text style={S.heroBannerSub}>AI generates {classLevel === "12" || classLevel === "10" ? "board-exact" : "curriculum-aligned"} questions, evaluates your answers, and predicts your board score</Text>
            </LinearGradient>

            {/* Subject picker */}
            <Text style={[S.sectionLabel, { color: muted }]}>📚 Subject *</Text>
            <View style={S.subjectGrid}>
              {SUBJECTS.map((s) => (
                <TouchableOpacity key={s} onPress={() => setSubject(s)} activeOpacity={0.8}
                  style={[S.subjectCard, { backgroundColor: surface, borderColor: subject === s ? "#dc2626" : border },
                    subject === s && { backgroundColor: "rgba(220,38,38,0.1)" }]}>
                  <Text style={S.subjectEmoji}>{SUBJECT_ICONS[s] ?? "📚"}</Text>
                  <Text style={[S.subjectLabel, { color: subject === s ? "#fca5a5" : dim }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Chapter input */}
            <Text style={[S.sectionLabel, { color: muted }]}>📖 Chapter / Topic *</Text>
            <View style={[S.textInputWrap, { backgroundColor: surface, borderColor: border }]}>
              <Ionicons name="book-outline" size={18} color={dim} />
              <Text
                style={[S.textInputProxy, { color: chapter ? text : dim }]}
                onPress={() => {
                  Alert.prompt?.("Chapter / Topic", "Enter the chapter or topic name:", (val) => {
                    if (val) setChapter(val);
                  }, "plain-text", chapter) ??
                  Alert.alert("Enter chapter name", "Use a physical keyboard or type below.", [
                    { text: "Cancel" },
                    { text: "OK", onPress: () => {} },
                  ]);
                }}
              >
                {chapter || "e.g. Photosynthesis, Quadratic Equations…"}
              </Text>
            </View>
            {/* Fallback text hint since Alert.prompt is iOS-only */}
            <TouchableOpacity onPress={() => {
              Alert.alert("Enter Chapter Name", "Type the chapter name in the box below.", [
                { text: "Photosynthesis", onPress: () => setChapter("Photosynthesis") },
                { text: "Quadratic Equations", onPress: () => setChapter("Quadratic Equations") },
                { text: "Newton's Laws", onPress: () => setChapter("Newton's Laws of Motion") },
                { text: "Cancel", style: "cancel" },
              ]);
            }} style={[S.chapterSuggestBtn, { borderColor: border }]}>
              <Ionicons name="sparkles-outline" size={14} color={dim} />
              <Text style={[S.chapterSuggestText, { color: dim }]}>Quick pick a chapter</Text>
            </TouchableOpacity>

            {/* Difficulty */}
            <Text style={[S.sectionLabel, { color: muted }]}>⚡ Difficulty</Text>
            <View style={S.diffRow}>
              {DIFFICULTIES.map((d) => (
                <TouchableOpacity key={d} onPress={() => setDifficulty(d)} activeOpacity={0.8}
                  style={[S.diffCard, { backgroundColor: surface, borderColor: difficulty === d ? "#dc2626" : border },
                    difficulty === d && { backgroundColor: "rgba(220,38,38,0.1)" }]}>
                  <Text style={[S.diffLabel, { color: difficulty === d ? "#fca5a5" : text }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Context */}
            <View style={[S.contextBadge, { backgroundColor: surface, borderColor: border }]}>
              <Ionicons name="school-outline" size={14} color="#dc2626" />
              <Text style={[S.contextText, { color: dim }]}>Class {classLevel} · {board} · {language} · 15 Questions</Text>
            </View>

            <TouchableOpacity onPress={handleGenerate} disabled={!subject || !chapter.trim()} activeOpacity={0.85}
              style={[S.generateBtnWrap, { opacity: subject && chapter.trim() ? 1 : 0.45 }]}>
              <LinearGradient colors={["#7f1d1d", "#dc2626"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.generateBtn}>
                <Ionicons name="flash" size={20} color="#fff" />
                <Text style={S.generateBtnText}>Generate Exam</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── GENERATING PHASE ── */}
        {phase === "generating" && (
          <Animated.View entering={FadeIn.duration(300)} style={S.centerBlock}>
            <LinearGradient colors={["#7f1d1d", "#dc2626"]} style={S.thinkingOrb}>
              <ActivityIndicator color="#fff" size="large" />
            </LinearGradient>
            <Text style={[S.thinkingTitle, { color: text }]}>Generating your exam…</Text>
            <Text style={[S.thinkingNote, { color: dim }]}>Creating {difficulty} {subject} questions for {board} Class {classLevel}</Text>
          </Animated.View>
        )}

        {/* ── EXAM PHASE ── */}
        {phase === "exam" && exam && (
          <Animated.View entering={FadeInDown.duration(400)}>
            {/* Exam header card */}
            <View style={[S.examHeaderCard, { backgroundColor: surface, borderColor: border }]}>
              <Text style={[S.examTitle, { color: text }]}>{exam.examTitle}</Text>
              <View style={S.examMeta}>
                <View style={[S.examMetaBadge, { backgroundColor: "rgba(220,38,38,0.1)", borderColor: "#dc2626" }]}>
                  <Text style={S.examMetaText}>{exam.totalMarks} marks</Text>
                </View>
                <View style={[S.examMetaBadge, { backgroundColor: surface, borderColor: border }]}>
                  <Text style={[S.examMetaText, { color: dim }]}>{exam.estimatedMinutes} min</Text>
                </View>
                <View style={[S.examMetaBadge, { backgroundColor: surface, borderColor: border }]}>
                  <Text style={[S.examMetaText, { color: dim }]}>{answeredCount}/{totalQuestions} done</Text>
                </View>
              </View>
              {/* Progress bar */}
              <View style={[S.progressTrack, { backgroundColor: border }]}>
                <View style={[S.progressFill, { width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%`, backgroundColor: "#dc2626" }]} />
              </View>
            </View>

            {/* Questions */}
            {exam.questions.map((q, qi) => (
              <View key={q.id} style={[S.questionCard, { backgroundColor: surface, borderColor: border }]}>
                <View style={S.questionHeader}>
                  <View style={[S.questionNumBadge, { backgroundColor: answers[q.id] !== undefined ? "#dc2626" : border }]}>
                    <Text style={[S.questionNum, { color: answers[q.id] !== undefined ? "#fff" : dim }]}>{qi + 1}</Text>
                  </View>
                  <View style={S.questionMeta}>
                    {q.boardImportance === "high" && (
                      <View style={[S.importanceBadge, { backgroundColor: "rgba(251,191,36,0.15)", borderColor: "#fbbf24" }]}>
                        <Text style={S.importanceText}>⭐ Important</Text>
                      </View>
                    )}
                    <Text style={[S.questionMarks, { color: dim }]}>{q.marks} mark{q.marks > 1 ? "s" : ""}</Text>
                  </View>
                </View>
                <Text style={[S.questionText, { color: text }]}>{q.question}</Text>
                <View style={S.optionsBlock}>
                  {q.options.map((opt, oi) => (
                    <TouchableOpacity key={oi} onPress={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))} activeOpacity={0.8}
                      style={[S.optionRow, { backgroundColor: answers[q.id] === oi ? "rgba(220,38,38,0.12)" : "transparent", borderColor: answers[q.id] === oi ? "#dc2626" : border }]}>
                      <View style={[S.optionDot, { borderColor: answers[q.id] === oi ? "#dc2626" : border, backgroundColor: answers[q.id] === oi ? "#dc2626" : "transparent" }]}>
                        {answers[q.id] === oi && <View style={S.optionDotInner} />}
                      </View>
                      <Text style={[S.optionText, { color: answers[q.id] === oi ? "#fca5a5" : text }]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}

            {/* Submit button */}
            <TouchableOpacity onPress={() => {
              if (answeredCount < totalQuestions) {
                Alert.alert("Submit Exam?", `You've answered ${answeredCount}/${totalQuestions} questions. Submit anyway?`, [
                  { text: "Continue Exam", style: "cancel" },
                  { text: "Submit", onPress: submitExam },
                ]);
              } else { submitExam(); }
            }} activeOpacity={0.85} style={S.submitWrap}>
              <LinearGradient colors={["#7f1d1d", "#dc2626"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.submitBtn}>
                <Text style={S.submitText}>Submit Exam ({answeredCount}/{totalQuestions})</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── SUBMITTING PHASE ── */}
        {phase === "submitting" && (
          <Animated.View entering={FadeIn.duration(300)} style={S.centerBlock}>
            <LinearGradient colors={["#7f1d1d", "#dc2626"]} style={S.thinkingOrb}>
              <ActivityIndicator color="#fff" size="large" />
            </LinearGradient>
            <Text style={[S.thinkingTitle, { color: text }]}>Evaluating…</Text>
            <Text style={[S.thinkingNote, { color: dim }]}>AI is grading your answers and analysing weak areas</Text>
          </Animated.View>
        )}

        {/* ── RESULTS PHASE ── */}
        {phase === "results" && evaluation && exam && (
          <Animated.View entering={FadeInDown.duration(450)} style={S.resultsBlock}>
            {/* Score hero */}
            <LinearGradient
              colors={evaluation.percentage >= 60 ? ["#052e16", "#059669"] : ["#450a0a", "#dc2626"]}
              style={S.scoreHero}
            >
              <View style={S.scoreOrb} />
              <Text style={S.scoreGrade}>{evaluation.grade}</Text>
              <Text style={S.scorePercent}>{evaluation.percentage}%</Text>
              <Text style={S.scoreMarks}>{evaluation.earnedMarks} / {evaluation.totalMarks} marks</Text>
              <Text style={S.scoreSummary}>{evaluation.performanceSummary}</Text>
            </LinearGradient>

            {/* Board readiness */}
            <View style={[S.card, { backgroundColor: surface, borderColor: border }]}>
              <Text style={[S.cardLabel, { color: dim }]}>📊 Board Exam Readiness</Text>
              <View style={S.readinessRow}>
                <View style={[S.progressTrack, { flex: 1, backgroundColor: border }]}>
                  <View style={[S.progressFill, { width: `${evaluation.boardReadiness}%`, backgroundColor: evaluation.boardReadiness >= 60 ? "#10b981" : "#ef4444" }]} />
                </View>
                <Text style={[S.readinessNum, { color: evaluation.boardReadiness >= 60 ? "#10b981" : "#ef4444" }]}>
                  {evaluation.boardReadiness}%
                </Text>
              </View>
              <Text style={[S.predictedScore, { color: muted }]}>Predicted board score: {evaluation.predictedBoardScore}</Text>
            </View>

            {/* Weak/Strong concepts */}
            {evaluation.weakConcepts.length > 0 && (
              <View style={[S.card, { backgroundColor: surface, borderColor: border }]}>
                <Text style={[S.cardLabel, { color: dim }]}>⚠️ Need More Practice</Text>
                <View style={S.conceptTags}>
                  {evaluation.weakConcepts.map((c) => (
                    <View key={c} style={[S.weakTag, { backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.4)" }]}>
                      <Text style={S.weakTagText}>{c}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {evaluation.strongConcepts.length > 0 && (
              <View style={[S.card, { backgroundColor: surface, borderColor: border }]}>
                <Text style={[S.cardLabel, { color: dim }]}>✅ Strong Areas</Text>
                <View style={S.conceptTags}>
                  {evaluation.strongConcepts.slice(0, 6).map((c) => (
                    <View key={c} style={[S.strongTag, { backgroundColor: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.4)" }]}>
                      <Text style={S.strongTagText}>{c}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Study plan */}
            <View style={[S.card, { backgroundColor: surface, borderColor: border }]}>
              <Text style={[S.cardLabel, { color: dim }]}>📋 Your Study Plan</Text>
              {evaluation.studyPlan.map((step, i) => (
                <View key={i} style={S.studyStep}>
                  <View style={S.stepBadge}><Text style={S.stepNum}>{i + 1}</Text></View>
                  <Text style={[S.stepText, { color: text }]}>{step}</Text>
                </View>
              ))}
            </View>

            {/* Motivation */}
            <View style={[S.motivationCard, { backgroundColor: "rgba(99,102,241,0.1)", borderColor: "#6366f1" }]}>
              <Ionicons name="sparkles" size={18} color="#818cf8" />
              <Text style={[S.motivationText, { color: muted }]}>{evaluation.motivationalMessage}</Text>
            </View>

            {/* Actions */}
            <TouchableOpacity onPress={() => { setPhase("setup"); setExam(null); setEvaluation(null); setChapter(""); }} activeOpacity={0.85} style={S.retakeWrap}>
              <LinearGradient colors={["#7f1d1d", "#dc2626"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.retakeBtn}>
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={S.retakeBtnText}>Take Another Exam</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/ai-guru/setup" as any)} style={[S.lessonBtn, { borderColor: border }]}>
              <Text style={[S.lessonBtnText, { color: "#818cf8" }]}>✨ Generate Lesson on Weak Topics</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── LIMIT / ERROR ── */}
        {(phase === "limit" || phase === "error") && (
          <Animated.View entering={FadeIn.duration(300)} style={S.centerBlock}>
            <Text style={S.limitEmoji}>{phase === "limit" ? "⏰" : "⚠️"}</Text>
            <Text style={[S.thinkingTitle, { color: text }]}>
              {phase === "limit" ? "Daily limit reached" : "Something went wrong"}
            </Text>
            <Text style={[S.thinkingNote, { color: dim }]}>
              {phase === "limit"
                ? "Free tier: 1 exam/day. Upgrade for unlimited exams."
                : errMsg}
            </Text>
            {phase === "limit" ? (
              <TouchableOpacity onPress={() => router.push("/ai-guru/subscription" as any)} style={S.upgradeWrap}>
                <LinearGradient colors={["#92400e", "#d97706"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.upgradeBtn}>
                  <Text style={S.upgradeBtnText}>Upgrade to Premium</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setPhase("setup")} style={[S.retakeWrap]}>
                <LinearGradient colors={["#7f1d1d", "#dc2626"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.retakeBtn}>
                  <Text style={S.retakeBtnText}>Try Again</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root:   { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  backBtn:{ width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 17, fontWeight: "900" },
  headerSub:    { fontSize: 11, marginTop: 1 },
  timerBadge:   { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  timerText:    { fontSize: 13, fontWeight: "900" },
  scroll:       { paddingHorizontal: 16, paddingTop: 8 },

  heroBanner:     { borderRadius: 20, padding: 22, marginBottom: 20, overflow: "hidden", gap: 6 },
  heroOrb:        { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.08)", top: -40, right: -40 },
  heroBannerEmoji:{ fontSize: 36 },
  heroBannerTitle:{ color: "#fff", fontSize: 20, fontWeight: "900" },
  heroBannerSub:  { color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 20 },

  sectionLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.3, marginBottom: 10, marginTop: 4 },
  subjectGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  subjectCard:  { width: "22%", aspectRatio: 1, borderRadius: 14, justifyContent: "center", alignItems: "center", gap: 4, borderWidth: 1 },
  subjectEmoji: { fontSize: 24 },
  subjectLabel: { fontSize: 10, fontWeight: "700", textAlign: "center" },

  textInputWrap:    { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8 },
  textInputProxy:   { flex: 1, fontSize: 15 },
  chapterSuggestBtn:{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "flex-start", marginBottom: 20 },
  chapterSuggestText:{ fontSize: 12 },

  diffRow:  { flexDirection: "row", gap: 10, marginBottom: 16 },
  diffCard: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
  diffLabel:{ fontSize: 12, fontWeight: "700" },

  contextBadge: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  contextText:  { fontSize: 12 },

  generateBtnWrap: { borderRadius: 16, overflow: "hidden", marginBottom: 8 },
  generateBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 8 },
  generateBtnText: { color: "#fff", fontSize: 17, fontWeight: "900" },

  centerBlock:  { alignItems: "center", paddingVertical: 60, gap: 16 },
  thinkingOrb:  { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center" },
  thinkingTitle:{ fontSize: 20, fontWeight: "800" },
  thinkingNote: { fontSize: 13, textAlign: "center", maxWidth: 280, lineHeight: 20 },

  examHeaderCard:  { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 16, gap: 8 },
  examTitle:       { fontSize: 15, fontWeight: "800", lineHeight: 22 },
  examMeta:        { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  examMetaBadge:   { borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  examMetaText:    { color: "#fca5a5", fontSize: 11, fontWeight: "700" },
  progressTrack:   { height: 4, borderRadius: 2, overflow: "hidden", marginTop: 4 },
  progressFill:    { height: 4, borderRadius: 2 },

  questionCard:   { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 14, gap: 12 },
  questionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  questionNumBadge:{ width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  questionNum:    { fontSize: 12, fontWeight: "900" },
  questionMeta:   { flexDirection: "row", gap: 8, alignItems: "center" },
  importanceBadge:{ borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  importanceText: { color: "#fbbf24", fontSize: 10, fontWeight: "700" },
  questionMarks:  { fontSize: 11, fontWeight: "600" },
  questionText:   { fontSize: 14, lineHeight: 22, fontWeight: "600" },
  optionsBlock:   { gap: 8 },
  optionRow:      { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  optionDot:      { width: 18, height: 18, borderRadius: 9, borderWidth: 2, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  optionDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  optionText:     { flex: 1, fontSize: 13, lineHeight: 20 },

  submitWrap: { borderRadius: 16, overflow: "hidden", marginVertical: 8 },
  submitBtn:  { paddingVertical: 16, alignItems: "center" },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "900" },

  resultsBlock: { gap: 14, paddingTop: 4 },
  scoreHero:    { borderRadius: 20, padding: 24, alignItems: "center", gap: 6, overflow: "hidden", marginBottom: 4 },
  scoreOrb:     { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.08)", top: -60, right: -40 },
  scoreGrade:   { color: "#fff", fontSize: 36, fontWeight: "900" },
  scorePercent: { color: "#fff", fontSize: 52, fontWeight: "900", lineHeight: 56 },
  scoreMarks:   { color: "rgba(255,255,255,0.7)", fontSize: 16, fontWeight: "700" },
  scoreSummary: { color: "rgba(255,255,255,0.6)", fontSize: 13, textAlign: "center", lineHeight: 20, marginTop: 4, maxWidth: 280 },

  card:      { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  cardLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  readinessRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  readinessNum: { fontSize: 20, fontWeight: "900", minWidth: 48 },
  predictedScore: { fontSize: 13, fontStyle: "italic" },

  conceptTags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  weakTag:     { borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5 },
  weakTagText: { color: "#fca5a5", fontSize: 12, fontWeight: "700" },
  strongTag:   { borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5 },
  strongTagText:{ color: "#6ee7b7", fontSize: 12, fontWeight: "700" },

  studyStep:   { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepBadge:   { width: 26, height: 26, borderRadius: 13, backgroundColor: "#dc2626", justifyContent: "center", alignItems: "center", marginTop: 1, flexShrink: 0 },
  stepNum:     { color: "#fff", fontSize: 12, fontWeight: "900" },
  stepText:    { flex: 1, fontSize: 13, lineHeight: 21 },

  motivationCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 14, borderWidth: 1, padding: 14 },
  motivationText: { flex: 1, fontSize: 13, lineHeight: 20, fontStyle: "italic" },

  retakeWrap: { borderRadius: 16, overflow: "hidden", marginTop: 4 },
  retakeBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 15, gap: 8 },
  retakeBtnText:{ color: "#fff", fontSize: 16, fontWeight: "900" },
  lessonBtn:  { borderRadius: 14, borderWidth: 1, paddingVertical: 13, alignItems: "center" },
  lessonBtnText:{ fontSize: 14, fontWeight: "700" },

  limitEmoji:  { fontSize: 52 },
  upgradeWrap: { width: "100%", borderRadius: 16, overflow: "hidden" },
  upgradeBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 15, gap: 8 },
  upgradeBtnText:{ color: "#fff", fontSize: 16, fontWeight: "900" },
});

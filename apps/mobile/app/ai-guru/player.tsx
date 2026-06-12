// PATH: app/ai-guru/player.tsx
// Changes:
//  • Removed "quiz" from Section type and SECTIONS array
//  • Removed QuizSection component
//  • Removed quiz-related styles (quizGate, startQuizBtn, etc.)
//  • ProgressXpBar maxXp now uses flashcards length (was lj.quiz.length * 15)
//  • No other changes

import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal,
  Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { auth } from "@/lib/firebase";
import { getLesson, updateLessonProgress } from "@/services/aiGuruFirestore";
import { sendFollowUp } from "@/services/aiGuruApi";
import { AiGuruLesson, KeyConcept, LessonJson } from "@/lib/aiGuru/types";
import SceneCard from "@/components/aiGuru/SceneCard";
import FlashcardDeck from "@/components/aiGuru/FlashcardDeck";
import ProgressXpBar from "@/components/aiGuru/ProgressXpBar";
import AiGuruAvatar from "@/components/aiGuru/AiGuruAvatar";
import PracticalActivityCard from "@/components/aiGuru/PracticalActivityCard";

// "quiz" removed from Section type
type Section = "intro" | "scenes" | "concepts" | "activity" | "notes" | "flashcards" | "mission";

const SECTIONS: { id: Section; label: string; emoji: string }[] = [
  { id: "intro",      label: "Intro",      emoji: "🚀" },
  { id: "scenes",     label: "Scenes",     emoji: "🎬" },
  { id: "concepts",   label: "Concepts",   emoji: "💡" },
  { id: "activity",   label: "Activity",   emoji: "🔧" },
  { id: "notes",      label: "Notes",      emoji: "📝" },
  { id: "flashcards", label: "Flashcards", emoji: "🃏" },
  { id: "mission",    label: "Mission",    emoji: "🏆" },
];

export default function PlayerScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const [lesson, setLesson]         = useState<AiGuruLesson | null>(null);
  const [lj, setLj]                 = useState<LessonJson | null>(null);
  const [loading, setLoading]       = useState(true);
  const [section, setSection]       = useState<Section>("intro");
  const [sceneIdx, setSceneIdx]     = useState(0);
  const [xp, setXp]                 = useState(0);
  const [askVisible, setAskVisible] = useState(false);
  const [askText, setAskText]       = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [askAnswer, setAskAnswer]   = useState<string | null>(null);
  const tabsRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!lessonId) return;
    getLesson(lessonId).then((l) => {
      setLesson(l);
      setLj(l?.lessonJson ?? null);
      setLoading(false);
    });
  }, [lessonId]);

  useEffect(() => {
    if (!lj || section !== "scenes") return;
    updateLessonProgress(lessonId!, sceneIdx, lj.scenes.length).catch(() => {});
  }, [sceneIdx, section]);

  const handleFollowUp = async (mode: string) => {
    if (!lj || !lessonId) return;
    setAskLoading(true);
    setAskAnswer(null);
    try {
      const scene = lj.scenes[sceneIdx];
      const resp = await sendFollowUp(lessonId, scene?.narration ?? askText, lesson?.language ?? "English", mode as any);
      setAskAnswer(resp.answer);
    } catch {
      Alert.alert("Error", "Could not get AI response.");
    } finally {
      setAskLoading(false);
    }
  };

  const handleAsk = async () => {
    if (!askText.trim() || !lessonId) return;
    setAskLoading(true);
    setAskAnswer(null);
    try {
      const resp = await sendFollowUp(lessonId, askText.trim(), lesson?.language ?? "English", "doubt");
      setAskAnswer(resp.answer);
      setAskText("");
    } catch {
      Alert.alert("Error", "Could not get AI response.");
    } finally {
      setAskLoading(false);
    }
  };

  if (loading || !lj) {
    return (
      <LinearGradient colors={["#0a0a1a", "#0f172a"]} style={S.center}>
        <ActivityIndicator color="#6366f1" size="large" />
        <Text style={S.loadingText}>Loading your lesson...</Text>
      </LinearGradient>
    );
  }

  const totalScenes = lj.scenes.length;
  const progress    = totalScenes > 0 ? Math.round(((sceneIdx + 1) / totalScenes) * 100) : 0;

  return (
    <LinearGradient colors={["#0a0a1a", "#0f172a"]} style={S.bg}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#94a3b8" />
        </TouchableOpacity>
        <View style={S.headerMid}>
          <Text style={S.headerTitle} numberOfLines={1}>{lj.lessonTitle}</Text>
          <ProgressXpBar xp={xp} maxXp={(lj.flashcards?.length ?? 5) * 15} label="Session XP" />
        </View>
        <TouchableOpacity style={S.askFab} onPress={() => setAskVisible(true)}>
          <Ionicons name="chatbubble-ellipses" size={20} color="#a5b4fc" />
        </TouchableOpacity>
      </View>

      {/* Section tabs */}
      <ScrollView
        ref={tabsRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={S.tabsScroll}
        contentContainerStyle={S.tabsContent}
      >
        {SECTIONS.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[S.sectionTab, section === s.id && S.sectionTabActive]}
            onPress={() => setSection(s.id)}
          >
            <Text style={S.sectionEmoji}>{s.emoji}</Text>
            <Text style={[S.sectionTabText, section === s.id && S.sectionTabTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <View style={S.content}>
        {section === "intro"      && <IntroSection lj={lj} />}
        {section === "scenes"     && (
          <SceneSection
            lj={lj} sceneIdx={sceneIdx} setSceneIdx={setSceneIdx}
            progress={progress} totalScenes={totalScenes}
            onFollowUp={handleFollowUp}
          />
        )}
        {section === "concepts"   && <ConceptsSection lj={lj} />}
        {section === "activity"   && <ActivitySection lj={lj} lessonId={lessonId!} lesson={lesson} />}
        {section === "notes"      && <NotesSection lj={lj} />}
        {section === "flashcards" && <FlashcardSection lj={lj} />}
        {section === "mission"    && <MissionSection lj={lj} />}
      </View>

      {/* Ask AI Guru Modal */}
      <Modal visible={askVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={S.modalOverlay}>
            <View style={S.modalCard}>
              <View style={S.modalHeader}>
                <AiGuruAvatar size={44} speaking={askLoading} />
                <Text style={S.modalTitle}>Ask AI Guru</Text>
                <TouchableOpacity onPress={() => { setAskVisible(false); setAskAnswer(null); }}>
                  <Ionicons name="close" size={22} color="#64748b" />
                </TouchableOpacity>
              </View>

              {askAnswer ? (
                <ScrollView style={S.answerScroll} showsVerticalScrollIndicator={false}>
                  <Text style={S.answerText}>{askAnswer}</Text>
                </ScrollView>
              ) : askLoading ? (
                <View style={S.askLoading}>
                  <ActivityIndicator color="#6366f1" />
                  <Text style={S.askLoadingText}>AI Guru is thinking...</Text>
                </View>
              ) : null}

              <View style={S.askInputRow}>
                <TextInput
                  style={S.askInput}
                  placeholder="Ask anything about this lesson..."
                  placeholderTextColor="#475569"
                  value={askText}
                  onChangeText={setAskText}
                  multiline
                />
                <TouchableOpacity style={S.askSend} onPress={handleAsk} disabled={!askText.trim() || askLoading}>
                  <Ionicons name="send" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </LinearGradient>
  );
}

// ── Sub-section components ──────────────────────────────────────────────────

function IntroSection({ lj }: { lj: LessonJson }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.sectionScroll}>
      <LinearGradient colors={["#1e1b4b", "#312e81"]} style={S.introHook}>
        <Text style={S.hookTitle}>{lj.storyHook.title}</Text>
        <Text style={S.hookNarration}>{lj.storyHook.narration}</Text>
        <View style={S.missionBubble}>
          <Text style={S.missionLabel}>🎯 Your Mission</Text>
          <Text style={S.missionText}>{lj.storyHook.studentMission}</Text>
        </View>
      </LinearGradient>

      <View style={S.card}>
        <Text style={S.cardTitle}>📌 What you'll learn</Text>
        {lj.learningObjectives.map((o, i) => (
          <View key={i} style={S.bulletRow}>
            <Text style={S.bullet}>→</Text>
            <Text style={S.bulletText}>{o}</Text>
          </View>
        ))}
      </View>

      {lj.prerequisites?.length > 0 && (
        <View style={[S.card, { borderColor: "#334155" }]}>
          <Text style={S.cardTitle}>📋 Prerequisites</Text>
          {lj.prerequisites.map((p, i) => (
            <View key={i} style={S.bulletRow}>
              <Text style={S.bullet}>•</Text>
              <Text style={S.bulletText}>{p}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function SceneSection({
  lj, sceneIdx, setSceneIdx, progress, totalScenes, onFollowUp,
}: {
  lj: LessonJson; sceneIdx: number; setSceneIdx: (i: number) => void;
  progress: number; totalScenes: number;
  onFollowUp: (mode: string) => void;
}) {
  const scene = lj.scenes[sceneIdx];
  if (!scene) return null;
  return (
    <View style={{ flex: 1 }}>
      <View style={S.sceneNav}>
        <TouchableOpacity
          style={[S.sceneNavBtn, sceneIdx === 0 && S.sceneNavBtnDisabled]}
          disabled={sceneIdx === 0}
          onPress={() => setSceneIdx(sceneIdx - 1)}
        >
          <Ionicons name="chevron-back" size={18} color={sceneIdx === 0 ? "#334155" : "#6366f1"} />
        </TouchableOpacity>
        <View style={S.progressWrap}>
          <View style={S.progressTrack}>
            <View style={[S.progressFill, { width: `${progress}%` as any }]} />
          </View>
          <Text style={S.progressLabel}>{sceneIdx + 1} / {totalScenes}</Text>
        </View>
        <TouchableOpacity
          style={[S.sceneNavBtn, sceneIdx === totalScenes - 1 && S.sceneNavBtnDisabled]}
          disabled={sceneIdx === totalScenes - 1}
          onPress={() => setSceneIdx(sceneIdx + 1)}
        >
          <Ionicons name="chevron-forward" size={18} color={sceneIdx === totalScenes - 1 ? "#334155" : "#6366f1"} />
        </TouchableOpacity>
      </View>
      <SceneCard
        key={sceneIdx}
        scene={scene}
        totalScenes={totalScenes}
        onExplainAgain={() => onFollowUp("explain_again")}
        onSimplify={() => onFollowUp("simplify")}
        onExample={() => onFollowUp("real_life_example")}
        onTranslate={() => onFollowUp("translate")}
      />
    </View>
  );
}

function ConceptsSection({ lj }: { lj: LessonJson }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.sectionScroll}>
      {lj.keyConcepts.map((kc: KeyConcept, i: number) => (
        <View key={i} style={S.conceptCard}>
          <Text style={S.conceptTerm}>{kc.term}</Text>
          <Text style={S.conceptMeaning}>{kc.simpleMeaning}</Text>
          {kc.realLifeExample ? (
            <View style={S.conceptExample}>
              <Text style={S.conceptExampleLabel}>Real-life: </Text>
              <Text style={S.conceptExampleText}>{kc.realLifeExample}</Text>
            </View>
          ) : null}
        </View>
      ))}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function ActivitySection({ lj, lessonId, lesson }: { lj: LessonJson; lessonId: string; lesson: AiGuruLesson | null }) {
  const [evalResult, setEvalResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (response: string) => {
    setLoading(true);
    try {
      const resp = await sendFollowUp(lessonId, response, lesson?.language ?? "English", "evaluate_practical");
      setEvalResult(resp.answer);
    } catch {
      Alert.alert("Error", "Could not evaluate your response.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.sectionScroll}>
      <PracticalActivityCard
        activity={lj.practicalActivity}
        onSubmit={handleSubmit}
        loading={loading}
      />
      {evalResult && (
        <View style={S.evalCard}>
          <Text style={S.evalTitle}>🤖 AI Guru Feedback</Text>
          <Text style={S.evalText}>{evalResult}</Text>
        </View>
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function NotesSection({ lj }: { lj: LessonJson }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.sectionScroll}>
      <Text style={S.notesTitle}>📝 Quick Revision Notes</Text>
      {lj.quickRevisionNotes.map((note, i) => (
        <View key={i} style={S.noteRow}>
          <View style={S.noteDot} />
          <Text style={S.noteText}>{note}</Text>
        </View>
      ))}
      {lj.examTips?.length > 0 && (
        <>
          <Text style={[S.notesTitle, { marginTop: 20 }]}>🎯 Exam Tips</Text>
          {lj.examTips.map((tip, i) => (
            <View key={i} style={[S.noteRow, { borderColor: "#fbbf24" }]}>
              <View style={[S.noteDot, { backgroundColor: "#fbbf24" }]} />
              <Text style={S.noteText}>{tip}</Text>
            </View>
          ))}
        </>
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function FlashcardSection({ lj }: { lj: LessonJson }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[S.sectionScroll, { alignItems: "center" }]}>
      <FlashcardDeck flashcards={lj.flashcards} />
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function MissionSection({ lj }: { lj: LessonJson }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.sectionScroll}>
      <LinearGradient colors={["#1a1a2e", "#312e81"]} style={S.missionCard}>
        <Text style={S.missionCardEmoji}>🏆</Text>
        <Text style={S.missionCardTitle}>{lj.finalMission.title}</Text>
        <Text style={S.missionCardTask}>{lj.finalMission.task}</Text>
        {lj.finalMission.rewardText ? (
          <View style={S.rewardBadge}>
            <Text style={S.rewardText}>🎁 {lj.finalMission.rewardText}</Text>
          </View>
        ) : null}
      </LinearGradient>

      {lj.commonMistakes?.length > 0 && (
        <View style={S.card}>
          <Text style={S.cardTitle}>⚠️ Common Mistakes</Text>
          {lj.commonMistakes.map((m, i) => (
            <View key={i} style={S.mistakeRow}>
              <Text style={S.mistakeLabel}>✗ {m.mistake}</Text>
              <Text style={S.mistakeFix}>✓ {m.correction}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  bg:               { flex: 1 },
  center:           { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  loadingText:      { color: "#64748b", fontSize: 14 },
  header:           { flexDirection: "row", alignItems: "center", paddingTop: 52, paddingBottom: 10, paddingHorizontal: 16, gap: 10 },
  backBtn:          { width: 38, height: 38, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center" },
  headerMid:        { flex: 1, gap: 4 },
  headerTitle:      { color: "#f1f5f9", fontSize: 15, fontWeight: "800" },
  askFab:           { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(99,102,241,0.2)", justifyContent: "center", alignItems: "center" },
  tabsScroll:       { maxHeight: 52 },
  tabsContent:      { paddingHorizontal: 12, gap: 6 },
  sectionTab:       { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "#1e293b" },
  sectionTabActive: { backgroundColor: "rgba(99,102,241,0.25)", borderWidth: 1, borderColor: "#6366f1" },
  sectionEmoji:     { fontSize: 14 },
  sectionTabText:   { color: "#475569", fontSize: 12, fontWeight: "700" },
  sectionTabTextActive: { color: "#a5b4fc" },
  content:          { flex: 1 },
  sectionScroll:    { padding: 16, gap: 12 },
  sceneNav:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, gap: 10 },
  sceneNavBtn:      { width: 36, height: 36, borderRadius: 10, backgroundColor: "#1e293b", justifyContent: "center", alignItems: "center" },
  sceneNavBtnDisabled: { opacity: 0.3 },
  progressWrap:     { flex: 1, gap: 4 },
  progressTrack:    { height: 4, backgroundColor: "#1e293b", borderRadius: 3, overflow: "hidden" },
  progressFill:     { height: "100%", backgroundColor: "#6366f1", borderRadius: 3 },
  progressLabel:    { color: "#475569", fontSize: 10, textAlign: "center" },
  introHook:        { borderRadius: 20, padding: 20, marginBottom: 4, gap: 12 },
  hookTitle:        { color: "#f1f5f9", fontSize: 20, fontWeight: "900" },
  hookNarration:    { color: "#94a3b8", fontSize: 14, lineHeight: 22 },
  missionBubble:    { backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 12, padding: 12 },
  missionLabel:     { color: "#a5b4fc", fontSize: 11, fontWeight: "800", marginBottom: 4 },
  missionText:      { color: "#e2e8f0", fontSize: 13, lineHeight: 20 },
  card:             { backgroundColor: "#1e293b", borderRadius: 16, padding: 16, gap: 10 },
  cardTitle:        { color: "#94a3b8", fontSize: 12, fontWeight: "800", letterSpacing: 0.3, marginBottom: 4 },
  bulletRow:        { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  bullet:           { color: "#6366f1", fontSize: 14, marginTop: 1 },
  bulletText:       { flex: 1, color: "#cbd5e1", fontSize: 14, lineHeight: 20 },
  conceptCard:      { backgroundColor: "#1e293b", borderRadius: 16, padding: 16, gap: 8 },
  conceptTerm:      { color: "#a5b4fc", fontSize: 16, fontWeight: "900" },
  conceptMeaning:   { color: "#cbd5e1", fontSize: 14, lineHeight: 20 },
  conceptExample:   { flexDirection: "row", flexWrap: "wrap" },
  conceptExampleLabel: { color: "#06b6d4", fontSize: 12, fontWeight: "700" },
  conceptExampleText: { color: "#94a3b8", fontSize: 12, flex: 1 },
  evalCard:         { backgroundColor: "#0f172a", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#6366f1" },
  evalTitle:        { color: "#a5b4fc", fontSize: 13, fontWeight: "800", marginBottom: 8 },
  evalText:         { color: "#cbd5e1", fontSize: 14, lineHeight: 22 },
  notesTitle:       { color: "#94a3b8", fontSize: 13, fontWeight: "800", letterSpacing: 0.3 },
  noteRow:          { flexDirection: "row", gap: 12, alignItems: "flex-start", backgroundColor: "#1e293b", borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: "#6366f1" },
  noteDot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: "#6366f1", marginTop: 7 },
  noteText:         { flex: 1, color: "#cbd5e1", fontSize: 14, lineHeight: 20 },
  missionCard:      { borderRadius: 20, padding: 24, alignItems: "center", gap: 14 },
  missionCardEmoji: { fontSize: 48 },
  missionCardTitle: { color: "#f1f5f9", fontSize: 20, fontWeight: "900", textAlign: "center" },
  missionCardTask:  { color: "#94a3b8", fontSize: 14, lineHeight: 22, textAlign: "center" },
  rewardBadge:      { backgroundColor: "rgba(251,191,36,0.15)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#fbbf24" },
  rewardText:       { color: "#fbbf24", fontSize: 13, fontWeight: "700" },
  mistakeRow:       { gap: 4 },
  mistakeLabel:     { color: "#ef4444", fontSize: 13 },
  mistakeFix:       { color: "#10b981", fontSize: 13 },
  modalOverlay:     { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.7)" },
  modalCard:        { backgroundColor: "#0f172a", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14, maxHeight: "75%" },
  modalHeader:      { flexDirection: "row", alignItems: "center", gap: 12 },
  modalTitle:       { flex: 1, color: "#f1f5f9", fontSize: 17, fontWeight: "800" },
  answerScroll:     { maxHeight: 200 },
  answerText:       { color: "#cbd5e1", fontSize: 14, lineHeight: 22 },
  askLoading:       { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  askLoadingText:   { color: "#475569", fontSize: 14 },
  askInputRow:      { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  askInput:         { flex: 1, backgroundColor: "#1e293b", borderRadius: 14, padding: 14, color: "#f1f5f9", fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: "#334155" },
  askSend:          { width: 44, height: 44, borderRadius: 14, backgroundColor: "#6366f1", justifyContent: "center", alignItems: "center" },
});

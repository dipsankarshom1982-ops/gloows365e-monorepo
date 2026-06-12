import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useStudentProfile } from "@/context/StudentProfileContext";
import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import {
  SUBJECTS, SUBJECT_ICONS,
  LANGUAGES, DIFFICULTIES, DIFFICULTY_DESC,
  LESSON_STYLES, LESSON_STYLE_DESC,
} from "@/lib/aiGuru/constants";

export default function SetupScreen() {
  const { t } = useAppTranslation();
  const { studentProfile } = useStudentProfile();
  const { colors, isDarkMode } = useTheme();

  const surfaceBg = isDarkMode ? "#1e293b" : colors.card;
  const borderCol = isDarkMode ? "#334155" : colors.border;
  const textMain  = isDarkMode ? "#f1f5f9" : colors.text;
  const textSec   = isDarkMode ? "#94a3b8" : colors.textSecondary;
  const textDim   = isDarkMode ? "#475569" : colors.textSecondary;
  const headerBg  = isDarkMode ? "rgba(10,10,26,0.95)" : colors.background;
  const backBtnBg = isDarkMode ? "rgba(255,255,255,0.08)" : colors.card;

  const [board, setBoard]           = useState("");
  const [classLevel, setClass]      = useState("");
  const [subject, setSubject]       = useState("");
  const [chapter, setChapter]       = useState("");
  const [topic, setTopic]           = useState("");
  const [language, setLanguage]     = useState("English");
  const [difficulty, setDifficulty] = useState("Standard");
  const [lessonStyle, setStyle]     = useState("Simple Explanation");

  useEffect(() => {
    if (studentProfile?.board) setBoard(studentProfile.board);
    if (studentProfile?.class) setClass(String(studentProfile.class));
  }, [studentProfile?.board, studentProfile?.class]);

  const canContinue = subject && chapter.trim();

  const handleContinue = () => {
    if (!canContinue) {
      Alert.alert(t("fillRequiredFields"), t("fillRequiredFieldsDesc"));
      return;
    }
    router.push({
      pathname: "/ai-guru/content",
      params: { board, classLevel, subject, chapter: chapter.trim(), topic: topic.trim(), language, difficulty, lessonStyle },
    });
  };

  return (
    <View style={[S.bg, { backgroundColor: isDarkMode ? "#0a0a1a" : colors.background }]}>
      {isDarkMode && (
        <LinearGradient colors={["#0a0a1a", "#0f172a"]} style={StyleSheet.absoluteFillObject} />
      )}
      <SafeAreaView style={S.safeArea}>
        {/* Fixed header */}
        <View style={[S.header, { backgroundColor: headerBg }]}>
          <TouchableOpacity onPress={() => router.back()} style={[S.backBtn, { backgroundColor: backBtnBg }]}>
            <Ionicons name="chevron-back" size={22} color={textSec} />
          </TouchableOpacity>
          <Text style={[S.headerTitle, { color: textMain }]}>{t("lessonSetup")}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
          {/* Subject */}
          <Section label="📚 Subject" required textSec={textSec}>
            <View style={S.subjectGrid}>
              {SUBJECTS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[S.subjectCard, { backgroundColor: surfaceBg, borderColor: borderCol }, subject === s && S.subjectCardActive]}
                  onPress={() => setSubject(s)}
                  activeOpacity={0.8}
                >
                  <Text style={S.subjectEmoji}>{SUBJECT_ICONS[s] ?? "📚"}</Text>
                  <Text style={[S.subjectLabel, { color: textDim }, subject === s && S.subjectLabelActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          {/* Chapter */}
          <Section label="📖 Chapter Name" required textSec={textSec}>
            <TextInput
              style={[S.textInput, { backgroundColor: surfaceBg, borderColor: borderCol, color: textMain }]}
              placeholder="e.g. Photosynthesis, Quadratic Equations..."
              placeholderTextColor={textDim}
              value={chapter}
              onChangeText={setChapter}
            />
          </Section>

          {/* Topic (optional) */}
          <Section label="🔍 Specific Topic (optional)" textSec={textSec}>
            <TextInput
              style={[S.textInput, { backgroundColor: surfaceBg, borderColor: borderCol, color: textMain }]}
              placeholder="e.g. Light reactions, Discriminant formula..."
              placeholderTextColor={textDim}
              value={topic}
              onChangeText={setTopic}
            />
          </Section>

          {/* Language */}
          <Section label="🌐 Language" textSec={textSec}>
            <ChipRow
              items={LANGUAGES}
              selected={language}
              onSelect={setLanguage}
              surfaceBg={surfaceBg}
              borderCol={borderCol}
              textDim={textDim}
            />
          </Section>

          {/* Difficulty */}
          <Section label="⚡ Difficulty" textSec={textSec}>
            {DIFFICULTIES.map((d) => (
              <TouchableOpacity
                key={d}
                style={[S.diffCard, { backgroundColor: surfaceBg, borderColor: borderCol }, difficulty === d && S.diffCardActive]}
                onPress={() => setDifficulty(d)}
                activeOpacity={0.8}
              >
                <Text style={[S.diffLabel, { color: textSec }, difficulty === d && { color: "#a5b4fc" }]}>{d}</Text>
                <Text style={[S.diffDesc, { color: textDim }]}>{DIFFICULTY_DESC[d]}</Text>
                {difficulty === d && <Ionicons name="checkmark-circle" size={18} color="#6366f1" />}
              </TouchableOpacity>
            ))}
          </Section>

          {/* Lesson Style */}
          <Section label="🎨 Lesson Style" textSec={textSec}>
            {LESSON_STYLES.map((s) => {
              const info = LESSON_STYLE_DESC[s];
              return (
                <TouchableOpacity
                  key={s}
                  style={[S.styleCard, { backgroundColor: surfaceBg, borderColor: borderCol }, lessonStyle === s && S.styleCardActive]}
                  onPress={() => setStyle(s)}
                  activeOpacity={0.8}
                >
                  <Text style={S.styleEmoji}>{info.emoji}</Text>
                  <View style={S.styleText}>
                    <Text style={[S.styleLabel, { color: textSec }, lessonStyle === s && { color: "#a5b4fc" }]}>{s}</Text>
                    <Text style={[S.styleDesc, { color: textDim }]}>{info.desc}</Text>
                  </View>
                  {lessonStyle === s && <Ionicons name="checkmark-circle" size={18} color="#6366f1" />}
                </TouchableOpacity>
              );
            })}
          </Section>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Continue button */}
        <View style={[S.footer, { backgroundColor: headerBg }]}>
          <TouchableOpacity
            style={[S.continueBtn, !canContinue && S.continueBtnDisabled]}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={canContinue ? ["#4f46e5", "#7c3aed"] : [surfaceBg, surfaceBg] as any}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={S.continueBtnGrad}
            >
              <Text style={[S.continueBtnText, !canContinue && { color: textDim }]}>
                {t("continueBtn")}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Section({ label, required, children, textSec }: {
  label: string; required?: boolean; children: React.ReactNode; textSec: string;
}) {
  return (
    <View style={S.section}>
      <Text style={[S.sectionLabel, { color: textSec }]}>
        {label}{required ? <Text style={S.required}> *</Text> : null}
      </Text>
      {children}
    </View>
  );
}

function ChipRow({ items, selected, onSelect, labelSuffix = "", surfaceBg, borderCol, textDim }: {
  items: string[]; selected: string; onSelect: (v: string) => void; labelSuffix?: string;
  surfaceBg: string; borderCol: string; textDim: string;
}) {
  return (
    <View style={S.chipRow}>
      {items.map((item) => (
        <TouchableOpacity
          key={item}
          style={[S.chip, { backgroundColor: surfaceBg, borderColor: borderCol }, selected === item && S.chipActive]}
          onPress={() => onSelect(item)}
          activeOpacity={0.8}
        >
          <Text style={[S.chipText, { color: textDim }, selected === item && S.chipTextActive]}>
            {item}{labelSuffix}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const S = StyleSheet.create({
  bg:               { flex: 1 },
  safeArea:         { flex: 1 },
  header:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 8, paddingBottom: 12, paddingHorizontal: 16 },
  backBtn:          { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  headerTitle:      { fontSize: 18, fontWeight: "800" },
  scroll:           { paddingHorizontal: 16, paddingTop: 16 },
  section:          { marginBottom: 24, gap: 10 },
  sectionLabel:     { fontSize: 13, fontWeight: "800", letterSpacing: 0.3 },
  required:         { color: "#ef4444" },
  chipRow:          { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:             { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  chipActive:       { backgroundColor: "rgba(99,102,241,0.2)", borderColor: "#6366f1" },
  chipText:         { fontSize: 13, fontWeight: "600" },
  chipTextActive:   { color: "#a5b4fc" },
  subjectGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  subjectCard:      { width: "22%", aspectRatio: 1, borderRadius: 14, justifyContent: "center", alignItems: "center", gap: 4, borderWidth: 1 },
  subjectCardActive:{ backgroundColor: "rgba(99,102,241,0.2)", borderColor: "#6366f1" },
  subjectEmoji:     { fontSize: 24 },
  subjectLabel:     { fontSize: 10, fontWeight: "700", textAlign: "center" },
  subjectLabelActive:{ color: "#a5b4fc" },
  textInput:        { borderRadius: 14, padding: 16, fontSize: 15, borderWidth: 1 },
  diffCard:         { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 14, borderWidth: 1, gap: 10 },
  diffCardActive:   { borderColor: "#6366f1", backgroundColor: "rgba(99,102,241,0.08)" },
  diffLabel:        { fontSize: 14, fontWeight: "700", width: 100 },
  diffDesc:         { flex: 1, fontSize: 12 },
  styleCard:        { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 14, borderWidth: 1, gap: 12 },
  styleCardActive:  { borderColor: "#6366f1", backgroundColor: "rgba(99,102,241,0.08)" },
  styleEmoji:       { fontSize: 24, width: 36 },
  styleText:        { flex: 1, gap: 2 },
  styleLabel:       { fontSize: 14, fontWeight: "700" },
  styleDesc:        { fontSize: 12 },
  footer:           { padding: 16 },
  continueBtn:      { borderRadius: 16, overflow: "hidden" },
  continueBtnDisabled: { opacity: 0.7 },
  continueBtnGrad:  { paddingVertical: 16, alignItems: "center" },
  continueBtnText:  { color: "#fff", fontSize: 17, fontWeight: "900" },
});

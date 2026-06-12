// PATH: app/ai-guru/ask.tsx
// Ask AI Guru — completely rebuilt with:
//   • 6 prompt mode chips (Explain / Notes / Exam / Doubt / Summarize / Tip)
//   • "Explain in My Language" chip — full regional language support
//   • Language auto-detection + response in same language
//   • Save to My AI Notebook from any answer
//   • 5 free questions/day, premium unlimited

import { useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { ActivityIndicator } from "react-native";

import { useStudentProfile } from "@/context/StudentProfileContext";
import { useTheme } from "@/context/ThemeContext";
import { useAppTranslation } from "@/context/LanguageContext";
import { askAiGuruQuestion } from "@/services/askAiGuruApi";
import { saveToNotebook } from "@/services/aiNotebookService";

const FREE_DAILY_ASK = 5;

// ── Prompt mode chips ──────────────────────────────────────────────────────────
type ModeKey = "explain" | "notes" | "exam" | "doubt" | "summarize" | "tip" | "language";

interface ModeChip {
  key:    ModeKey;
  label:  string;
  emoji:  string;
  color:  string;        // accent colour for active state
  hint:   string;        // placeholder text when this mode is active
  sample: string;        // pre-fill example
}

// MODE_CHIPS is built inside the component using t() so labels change with language

// Language examples for the language chip
const LANGUAGE_EXAMPLES = [
  { lang: "Bengali",   text: "নিউটনের তৃতীয় সূত্রটা বুঝিয়ে দাও।" },
  { lang: "Hindi",     text: "प्रकाश संश्लेषण क्या होता है?" },
  { lang: "Tamil",     text: "ஒளிச்சேர்க்கை என்றால் என்ன?" },
  { lang: "Telugu",    text: "కిరణజన్య సంయోగక్రియ అంటే ఏమిటి?" },
  { lang: "Marathi",   text: "प्रकाशसंश्लेषण म्हणजे काय?" },
  { lang: "Gujarati",  text: "પ્રકાશસંશ્લેષણ શું છે?" },
  { lang: "Assamese",  text: "পোহৰ সংশ্লেষণ কি?" },
  { lang: "Odia",      text: "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ'ଣ?" },
  { lang: "Malayalam", text: "ഒരു ലഘുലേഖ തരൂ." },
  { lang: "Kannada",   text: "ಬೆಳಕಿನ ಸಂಶ್ಲೇಷಣೆ ಎಂದರೇನು?" },
  { lang: "Punjabi",   text: "ਪ੍ਰਕਾਸ਼ ਸੰਸ਼ਲੇਸ਼ਣ ਕੀ ਹੈ?" },
  { lang: "Urdu",      text: "روشنی ترکیب کیا ہے؟" },
];

type ResultState = "idle" | "loading" | "found" | "limit" | "error";

export default function AskAiGuruScreen() {
  const insets = useSafeAreaInsets();
  const { studentProfile } = useStudentProfile();
  const { colors, isDarkMode } = useTheme();
  const { t } = useAppTranslation();

  // Built with t() so labels re-render when user switches language
  const MODE_CHIPS: ModeChip[] = useMemo(() => [
    {
      key:    "explain",
      label:  t("modeExplain") ?? "Explain a Concept",
      emoji:  "📝",
      color:  "#6366f1",
      hint:   t("modeExplain") ?? "Explain a Concept",
      sample: "Explain Newton's Third Law of Motion",
    },
    {
      key:    "notes",
      label:  t("modeNotes") ?? "Make Notes",
      emoji:  "🗒️",
      color:  "#0284c7",
      hint:   t("modeNotes") ?? "Make Notes",
      sample: "Make notes on the French Revolution",
    },
    {
      key:    "exam",
      label:  t("modeExam") ?? "Prepare for Exam",
      emoji:  "🎯",
      color:  "#dc2626",
      hint:   t("modeExam") ?? "Prepare for Exam",
      sample: "Help me prepare for the Chapter 3 Science exam",
    },
    {
      key:    "doubt",
      label:  t("modeDoubt") ?? "Solve My Doubt",
      emoji:  "❓",
      color:  "#d97706",
      hint:   t("modeDoubt") ?? "Solve My Doubt",
      sample: "Why does ice float on water?",
    },
    {
      key:    "summarize",
      label:  t("modeSummarize") ?? "Summarize Chapter",
      emoji:  "📖",
      color:  "#059669",
      hint:   t("modeSummarize") ?? "Summarize Chapter",
      sample: "Summarize Chapter 5: Light – Reflection and Refraction",
    },
    {
      key:    "tip",
      label:  t("modeTip") ?? "Daily Study Tip",
      emoji:  "💡",
      color:  "#7c3aed",
      hint:   t("modeTip") ?? "Daily Study Tip",
      sample: "Give me a study tip for Mathematics",
    },
    {
      key:    "language",
      label:  t("modeLanguage") ?? "Explain in My Language",
      emoji:  "🌐",
      color:  "#be185d",
      hint:   "अपनी भाषा में लिखें • বাংলায় লিখুন • ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಬರೆಯಿರಿ",
      sample: "নিউটনের তৃতীয় সূত্রটা বুঝিয়ে দাও।",
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t]);

  const firstName    = studentProfile?.name?.split(" ")[0] ?? "there";
  const studentClass = String(studentProfile?.class ?? "10");
  const board        = studentProfile?.board ?? "CBSE";

  const surface = isDarkMode ? "#1e293b" : colors.card;
  const border  = isDarkMode ? "#334155" : colors.border;
  const text    = isDarkMode ? "#f1f5f9" : colors.text;
  const muted   = isDarkMode ? "#94a3b8" : colors.textSecondary;
  const dim     = isDarkMode ? "#64748b" : colors.textSecondary;
  const backBg  = isDarkMode ? "rgba(255,255,255,0.08)" : colors.card;

  const [query,       setQuery]       = useState("");
  const [activeMode,  setActiveMode]  = useState<ModeKey>("doubt");
  const [result,      setResult]      = useState<ResultState>("idle");
  const [answer,      setAnswer]      = useState("");
  const [askedQ,      setAskedQ]      = useState("");
  const [askedMode,   setAskedMode]   = useState<ModeKey>("doubt");
  const [errMsg,      setErrMsg]      = useState("");
  const [remaining,   setRemaining]   = useState(FREE_DAILY_ASK);
  const [saving,      setSaving]      = useState(false);
  const [savedId,     setSavedId]     = useState<string | null>(null);
  const [langExIdx,   setLangExIdx]   = useState(0);  // rotating example index
  const inputRef = useRef<TextInput>(null);

  const currentMode = MODE_CHIPS.find((c) => c.key === activeMode)!;

  // ── Handle ask ─────────────────────────────────────────────────────────────
  async function handleAsk() {
    const trimmed = query.trim();
    if (!trimmed || result === "loading") return;

    setAskedQ(trimmed);
    setAskedMode(activeMode);
    setQuery("");
    setResult("loading");
    setAnswer("");
    setErrMsg("");
    setSavedId(null);

    try {
      const data = await askAiGuruQuestion({
        question:   trimmed,
        classLevel: studentClass,
        board,
        mode:       activeMode,
      });
      setAnswer(data.answer);
      setResult("found");
      setRemaining((r) => Math.max(0, r - 1));
    } catch (err: any) {
      if (err?.code === "LIMIT_REACHED") {
        setResult("limit");
        setRemaining(0);
      } else {
        setErrMsg(err?.message ?? "Something went wrong");
        setResult("error");
      }
    }
  }

  // ── Save to notebook ────────────────────────────────────────────────────────
  async function handleSave() {
    if (!answer || saving) return;
    setSaving(true);
    try {
      const chip = MODE_CHIPS.find((c) => c.key === askedMode)!;
      const id = await saveToNotebook({
        question:  askedQ,
        answer,
        mode:      askedMode,
        modeLabel: `${chip.emoji} ${chip.label}`,
      });
      setSavedId(id);
    } catch (e: any) {
      Alert.alert("Could not save", e?.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setQuery("");
    setResult("idle");
    setAnswer("");
    setAskedQ("");
    setErrMsg("");
    setSavedId(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function handleModeSelect(key: ModeKey) {
    setActiveMode(key);
    setResult("idle");
    setAnswer("");
    setAskedQ("");
    setSavedId(null);
    // Rotate language example on each press of language chip
    if (key === "language") {
      setLangExIdx((i) => (i + 1) % LANGUAGE_EXAMPLES.length);
    }
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  const canSend = query.trim().length > 0 && result !== "loading";
  const chip = MODE_CHIPS.find((c) => c.key === activeMode)!;

  return (
    <KeyboardAvoidingView
      style={[S.root, { backgroundColor: isDarkMode ? "#0a0a1a" : colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {isDarkMode && (
        <LinearGradient colors={["#0a0a1a", "#0f172a"]} style={StyleSheet.absoluteFillObject} />
      )}

      {/* ── Header ── */}
      <Animated.View entering={FadeIn.duration(350)} style={[S.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={[S.backBtn, { backgroundColor: backBg }]}>
          <Ionicons name="chevron-back" size={22} color={muted} />
        </TouchableOpacity>

        <Text style={[S.headerTitle, { color: text }]}>Ask AI Guru</Text>

        <View style={S.headerRight}>
          {/* Notebook shortcut */}
          <TouchableOpacity
            onPress={() => router.push("/ai-guru/notebook" as any)}
            style={[S.notebookBtn, { backgroundColor: surface, borderColor: border }]}
          >
            <Ionicons name="book-outline" size={15} color="#6366f1" />
            <Text style={S.notebookBtnText}>Notebook</Text>
          </TouchableOpacity>

          {/* Quota badge */}
          <View style={[S.quotaBadge, { backgroundColor: surface, borderColor: remaining > 0 ? border : "rgba(239,68,68,0.4)" }]}>
            <View style={[S.quotaDot, { backgroundColor: remaining > 0 ? "#10b981" : "#ef4444" }]} />
            <Text style={[S.quotaText, { color: remaining > 0 ? "#10b981" : "#ef4444" }]}>
              {remaining}/{FREE_DAILY_ASK}
            </Text>
          </View>
        </View>
      </Animated.View>

      <ScrollView
        style={S.scroll}
        contentContainerStyle={S.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── IDLE: Mode chips + greeting ── */}
        {result === "idle" && (
          <Animated.View entering={FadeInDown.duration(400).delay(80)}>

            {/* Greeting */}
            <View style={S.greetingBlock}>
              <Text style={[S.greetingName, { color: text }]}>Hi {firstName} 👋</Text>
              <Text style={[S.greetingSub, { color: dim }]}>{t("askAnything") ?? "What do you need help with today?"}</Text>
            </View>

            {/* Mode chips — 2-column grid */}
            <View style={S.chipsGrid}>
              {MODE_CHIPS.map((chip) => {
                const active = activeMode === chip.key;
                return (
                  <TouchableOpacity
                    key={chip.key}
                    onPress={() => handleModeSelect(chip.key)}
                    activeOpacity={0.78}
                    style={[
                      S.modeChip,
                      { backgroundColor: surface, borderColor: active ? chip.color : border },
                      active && { backgroundColor: `${chip.color}18` },
                    ]}
                  >
                    <Text style={S.modeChipEmoji}>{chip.emoji}</Text>
                    <Text style={[S.modeChipLabel, { color: active ? chip.color : muted }]}>
                      {chip.label}
                    </Text>
                    {active && (
                      <Ionicons name="checkmark-circle" size={14} color={chip.color} style={S.modeChipCheck} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Language chip — special expanded hint */}
            {activeMode === "language" && (
              <Animated.View entering={FadeInDown.duration(300)}
                style={[S.langHintCard, { backgroundColor: surface, borderColor: "#be185d" }]}>
                <Text style={[S.langHintTitle, { color: "#f9a8d4" }]}>
                  🌐 Write in your language — AI answers in the same language
                </Text>
                <View style={S.langExamplesGrid}>
                  {LANGUAGE_EXAMPLES.slice(0, 6).map((ex, i) => (
                    <TouchableOpacity
                      key={ex.lang}
                      onPress={() => setQuery(ex.text)}
                      activeOpacity={0.75}
                      style={[S.langExChip, { borderColor: border, backgroundColor: isDarkMode ? "#1e293b" : "#fdf2f8" }]}
                    >
                      <Text style={[S.langExLang, { color: "#be185d" }]}>{ex.lang}</Text>
                      <Text style={[S.langExText, { color: muted }]} numberOfLines={1}>{ex.text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={() => setLangExIdx((i) => (i + 1) % LANGUAGE_EXAMPLES.length)}>
                  <Text style={[S.langMoreText, { color: dim }]}>See more languages →</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Active mode hint */}
            {activeMode !== "language" && (
              <View style={[S.activeHintBar, { backgroundColor: `${chip.color}12`, borderColor: `${chip.color}40` }]}>
                <Text style={S.activeHintEmoji}>{chip.emoji}</Text>
                <Text style={[S.activeHintText, { color: chip.color }]}>{chip.hint}</Text>
              </View>
            )}

            {/* Sample question tap */}
            <TouchableOpacity
              onPress={() => setQuery(chip.sample)}
              style={[S.sampleBtn, { backgroundColor: surface, borderColor: border }]}
            >
              <Ionicons name="sparkles-outline" size={13} color={dim} />
              <Text style={[S.sampleBtnText, { color: dim }]} numberOfLines={1}>
                Try: "{chip.sample}"
              </Text>
            </TouchableOpacity>

          </Animated.View>
        )}

        {/* ── LOADING ── */}
        {result === "loading" && (
          <Animated.View entering={FadeIn.duration(300)} style={S.centerBlock}>
            <LinearGradient colors={[chip.color, chip.color + "cc"]} style={S.thinkingOrb}>
              <ActivityIndicator color="#fff" size="large" />
            </LinearGradient>
            <Text style={[S.thinkingTitle, { color: text }]}>Thinking…</Text>
            <Text style={[S.thinkingQ, { color: dim }]} numberOfLines={2}>"{askedQ}"</Text>
          </Animated.View>
        )}

        {/* ── ANSWER ── */}
        {result === "found" && (
          <Animated.View entering={FadeInDown.duration(400)} style={S.answerBlock}>

            {/* Mode label */}
            <View style={[S.modeLabelRow, { backgroundColor: `${MODE_CHIPS.find((c) => c.key === askedMode)!.color}15` }]}>
              <Text style={[S.modeLabelText, { color: MODE_CHIPS.find((c) => c.key === askedMode)!.color }]}>
                {MODE_CHIPS.find((c) => c.key === askedMode)!.emoji}{" "}
                {MODE_CHIPS.find((c) => c.key === askedMode)!.label}
              </Text>
            </View>

            {/* User question bubble */}
            <View style={S.userRow}>
              <View style={[S.userBubble, { backgroundColor: isDarkMode ? "#312e81" : "#ede9fe" }]}>
                <Text style={[S.userBubbleText, { color: isDarkMode ? "#e0e7ff" : "#4338ca" }]}>
                  {askedQ}
                </Text>
              </View>
            </View>

            {/* AI answer card */}
            <View style={[S.answerCard, { backgroundColor: surface, borderColor: border }]}>
              <View style={S.answerCardHeader}>
                <LinearGradient colors={["#4f46e5", "#7c3aed"]} style={S.aiAvatar}>
                  <Text style={S.aiAvatarText}>AI</Text>
                </LinearGradient>
                <Text style={[S.aiLabel, { color: muted }]}>AI Guru</Text>
              </View>

              <Text style={[S.answerText, { color: text }]}>{answer}</Text>

              {/* Save to notebook */}
              <View style={[S.divider, { backgroundColor: border }]} />
              <View style={S.answerActions}>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saving || !!savedId}
                  style={[
                    S.saveBtn,
                    {
                      backgroundColor: savedId
                        ? "rgba(16,185,129,0.12)"
                        : isDarkMode ? "rgba(99,102,241,0.12)" : "#ede9fe",
                      borderColor: savedId ? "#10b981" : "#6366f1",
                    },
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator size={13} color="#6366f1" />
                  ) : (
                    <Ionicons
                      name={savedId ? "checkmark-circle" : "bookmark-outline"}
                      size={15}
                      color={savedId ? "#10b981" : "#6366f1"}
                    />
                  )}
                  <Text style={[S.saveBtnText, { color: savedId ? "#10b981" : "#6366f1" }]}>
                    {savedId ? t("savedToNotebook") ?? "Saved to Notebook" : saving ? "Saving…" : t("saveToNotebook") ?? "Save to Notebook"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push("/ai-guru/notebook" as any)}
                  style={[S.notebookLinkBtn, { borderColor: border }]}
                >
                  <Ionicons name="book-outline" size={14} color={muted} />
                  <Text style={[S.notebookLinkText, { color: muted }]}>{t("viewNotebook") ?? "View Notebook"}</Text>
                </TouchableOpacity>
              </View>

              {/* Upsell to deeper features */}
              <View style={S.upsellRow}>
                <TouchableOpacity
                  style={[S.upsellBtn, { backgroundColor: isDarkMode ? "rgba(99,102,241,0.1)" : "#ede9fe", borderColor: "#6366f1" }]}
                  onPress={() => router.push("/ai-guru/setup")}
                >
                  <Text style={S.upsellBtnText}>✨ Generate Full Lesson</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.upsellBtn, { backgroundColor: isDarkMode ? "rgba(220,38,38,0.1)" : "#fef2f2", borderColor: "#dc2626" }]}
                  onPress={() => router.push("/ai-guru/exam-simulator" as any)}
                >
                  <Text style={[S.upsellBtnText, { color: "#f87171" }]}>🎯 Practice Exam</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity onPress={reset} style={S.resetRow}>
              <Ionicons name="refresh-outline" size={15} color="#6366f1" />
              <Text style={S.resetText}>{t("askAnything") ?? "Ask another question"}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── LIMIT ── */}
        {result === "limit" && (
          <Animated.View entering={FadeIn.duration(300)} style={S.centerBlock}>
            <Text style={S.limitEmoji}>⏰</Text>
            <Text style={[S.limitTitle, { color: text }]}>Daily limit reached</Text>
            <Text style={[S.limitBody, { color: muted }]}>
              You've used all {FREE_DAILY_ASK} free questions today. Upgrade to Premium for unlimited questions.
            </Text>
            <TouchableOpacity style={S.limitPrimaryWrap} onPress={() => router.push("/ai-guru/subscription" as any)}>
              <LinearGradient colors={["#312e81", "#4f46e5"]} style={S.limitPrimaryBtn}>
                <Text style={S.limitPrimaryText}>✨ Upgrade to Premium</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={[S.limitSecondaryBtn, { borderColor: border }]} onPress={() => router.push("/ai-guru/vidyaguru")}>
              <Text style={[S.limitSecondaryText, { color: muted }]}>🤖 Chat with VidyaGuru instead</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── ERROR ── */}
        {result === "error" && (
          <Animated.View entering={FadeIn.duration(300)} style={S.centerBlock}>
            <Ionicons name="warning-outline" size={42} color="#f59e0b" />
            <Text style={[S.limitTitle, { color: text }]}>Something went wrong</Text>
            <Text style={[S.limitBody, { color: muted }]}>{errMsg}</Text>
            <TouchableOpacity style={[S.retryBtn, { borderColor: border }]} onPress={reset}>
              <Text style={[S.retryText, { color: colors.accent }]}>Try again</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── Bottom input bar ── */}
      <View style={[S.inputBar, {
        backgroundColor: isDarkMode ? "rgba(10,10,26,0.98)" : colors.background,
        borderTopColor: border,
        paddingBottom: insets.bottom + 8,
      }]}>
        {/* Mode chip row (compact, scrollable) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={S.inputModesRow}
        >
          {MODE_CHIPS.map((c) => (
            <TouchableOpacity
              key={c.key}
              onPress={() => handleModeSelect(c.key)}
              style={[
                S.inputModeChip,
                { borderColor: activeMode === c.key ? c.color : border },
                activeMode === c.key && { backgroundColor: `${c.color}18` },
              ]}
            >
              <Text style={S.inputModeEmoji}>{c.emoji}</Text>
              <Text style={[S.inputModeLabel, { color: activeMode === c.key ? c.color : dim }]}>
                {c.label.split(" ").slice(0, 2).join(" ")}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Text input */}
        <View style={[S.inputWrap, { backgroundColor: surface, borderColor: border }]}>
          <TextInput
            ref={inputRef}
            style={[S.input, { color: text }]}
            placeholder={currentMode.hint}
            placeholderTextColor={dim}
            value={query}
            onChangeText={setQuery}
            multiline
            maxLength={300}
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={handleAsk}
          />
          <TouchableOpacity
            style={[S.sendBtn, !canSend && S.sendBtnDisabled]}
            onPress={handleAsk}
            disabled={!canSend}
          >
            <LinearGradient
              colors={canSend ? [chip.color, chip.color + "cc"] : [surface, surface]}
              style={S.sendBtnInner}
            >
              <Ionicons name="arrow-up" size={18} color={canSend ? "#fff" : dim} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },

  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  backBtn:      { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  headerTitle:  { flex: 1, fontSize: 18, fontWeight: "900" },
  headerRight:  { flexDirection: "row", alignItems: "center", gap: 8 },
  notebookBtn:  { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  notebookBtnText: { color: "#6366f1", fontSize: 11, fontWeight: "700" },
  quotaBadge:   { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  quotaDot:     { width: 7, height: 7, borderRadius: 4 },
  quotaText:    { fontSize: 11, fontWeight: "800" },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, flexGrow: 1 },

  greetingBlock: { paddingTop: 8, paddingBottom: 16 },
  greetingName:  { fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  greetingSub:   { fontSize: 14, marginTop: 4, lineHeight: 20 },

  chipsGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 14 },
  modeChip:       { width: "47.5%", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12 },
  modeChipEmoji:  { fontSize: 18 },
  modeChipLabel:  { flex: 1, fontSize: 12, fontWeight: "700", lineHeight: 16 },
  modeChipCheck:  { flexShrink: 0 },

  langHintCard:        { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12, gap: 10 },
  langHintTitle:       { fontSize: 13, fontWeight: "700", lineHeight: 18 },
  langExamplesGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  langExChip:          { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, maxWidth: "48%" },
  langExLang:          { fontSize: 10, fontWeight: "800", marginBottom: 2 },
  langExText:          { fontSize: 11 },
  langMoreText:        { fontSize: 12, marginTop: 2 },

  activeHintBar:  { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10 },
  activeHintEmoji:{ fontSize: 16 },
  activeHintText: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 18 },

  sampleBtn:     { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4 },
  sampleBtnText: { flex: 1, fontSize: 12 },

  centerBlock:   { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 64, gap: 16 },
  thinkingOrb:   { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  thinkingTitle: { fontSize: 22, fontWeight: "800" },
  thinkingQ:     { fontSize: 13, textAlign: "center", lineHeight: 20, maxWidth: 280, fontStyle: "italic" },

  answerBlock:   { paddingTop: 8, gap: 12 },
  modeLabelRow:  { alignSelf: "flex-start", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  modeLabelText: { fontSize: 12, fontWeight: "800" },
  userRow:       { alignItems: "flex-end" },
  userBubble:    { maxWidth: "82%", borderRadius: 18, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  userBubbleText:{ fontSize: 14, lineHeight: 20, fontWeight: "500" },

  answerCard:       { borderRadius: 20, borderWidth: 1, padding: 18, gap: 12 },
  answerCardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  aiAvatar:         { width: 34, height: 34, borderRadius: 17, justifyContent: "center", alignItems: "center" },
  aiAvatarText:     { color: "#fff", fontSize: 11, fontWeight: "900" },
  aiLabel:          { fontSize: 13, fontWeight: "700" },
  answerText:       { fontSize: 15, lineHeight: 26 },
  divider:          { height: 1 },

  answerActions:    { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  saveBtn:          { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, borderWidth: 1, paddingVertical: 10 },
  saveBtnText:      { fontSize: 12, fontWeight: "700" },
  notebookLinkBtn:  { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  notebookLinkText: { fontSize: 12, fontWeight: "600" },

  upsellRow:        { flexDirection: "row", gap: 8 },
  upsellBtn:        { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 10, alignItems: "center" },
  upsellBtnText:    { color: "#818cf8", fontSize: 12, fontWeight: "700" },

  resetRow:  { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", paddingVertical: 6 },
  resetText: { color: "#6366f1", fontSize: 14, fontWeight: "600" },

  limitEmoji:       { fontSize: 52 },
  limitTitle:       { fontSize: 19, fontWeight: "800", textAlign: "center", maxWidth: 280 },
  limitBody:        { fontSize: 13, textAlign: "center", lineHeight: 20, maxWidth: 280 },
  limitPrimaryWrap: { width: "100%", borderRadius: 16, overflow: "hidden" },
  limitPrimaryBtn:  { paddingVertical: 15, alignItems: "center" },
  limitPrimaryText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  limitSecondaryBtn:{ width: "100%", borderRadius: 16, borderWidth: 1, paddingVertical: 14, alignItems: "center" },
  limitSecondaryText:{ fontSize: 14, fontWeight: "600" },
  retryBtn:         { borderRadius: 12, borderWidth: 1, paddingHorizontal: 28, paddingVertical: 12 },
  retryText:        { fontSize: 14, fontWeight: "700" },

  inputBar:       { paddingHorizontal: 16, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  inputModesRow:  { gap: 7, paddingBottom: 8 },
  inputModeChip:  { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  inputModeEmoji: { fontSize: 13 },
  inputModeLabel: { fontSize: 10, fontWeight: "700" },

  inputWrap:       { flexDirection: "row", alignItems: "flex-end", borderRadius: 26, borderWidth: 1, paddingLeft: 14, paddingRight: 5, paddingVertical: 5, gap: 6 },
  input:           { flex: 1, fontSize: 15, lineHeight: 22, maxHeight: 100, paddingVertical: 6 },
  sendBtn:         { borderRadius: 20, overflow: "hidden" },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnInner:    { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
});

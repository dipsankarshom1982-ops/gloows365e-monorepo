// PATH: app/ai-guru/ask.tsx
//
// REBUILD: this screen used to be functionally redundant with
// /ai-guru/skillguru — both were "type a question, get an AI answer"
// experiences, and this screen's own "limit reached" state even linked to
// SkillGuru as an alternative ("🤖 Chat with SkillGuru instead"),
// underlining the overlap. The split is now: SkillGuru is the ongoing,
// multi-turn conversational skills coach (memory, follow-ups, persisted
// history); Ask is a single-shot lookup tool — type a query, get one
// direct answer, search again. No conversation, no memory between
// searches, by design — that's SkillGuru's job now.
//
// Built to feel like a search app scoped to education, skills, and
// general knowledge: a centered search box on first load (no results
// yet, search icon instead of a chat bubble), filter chips for query
// intent (the same 7 modes the backend's `mode` param already branches
// on — kept, not dropped, just restyled as search-app category tabs), and
// a featured-snippet-style answer card once you search. The search box
// shrinks to the header area once a result exists — the same transform a
// real search app does after your first query.
//
// NOT changed: askAiGuruQuestion()'s payload/endpoint and
// aiNotebookService's saveToNotebook() — those were working correctly
// before; only the UI built around them changed.
//
// Related searches removed per request — the getRelatedSearches module
// (lib/aiGuru/relatedSearches.ts) is untouched since SkillGuru
// (app/ai-guru/skillguru.tsx) still uses it.

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
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { ActivityIndicator } from "react-native";

import { useStudentProfile } from "@gloows/shared-logic";
import { useTheme } from "@/context/ThemeContext";
import { useAppTranslation } from "@/context/LanguageContext";
import { auth } from "@/lib/firebase";
import { askAiGuruQuestion } from "@/services/askAiGuruApi";
import { saveToNotebook } from "@/services/aiNotebookService";
import AiGuruHeader from "@/components/aiGuru/AiGuruHeader";
import CreditBalanceBadge from "@/components/aiGuru/CreditBalanceBadge";

type ModeKey = "doubt" | "explain" | "notes" | "exam" | "summarize" | "tip" | "language";

interface ModeChip {
  key:    ModeKey;
  label:  string;
  emoji:  string;
  color:  string;
  hint:   string;
  sample: string;
}

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
  const { studentProfile } = useStudentProfile();
  const { colors, isDarkMode } = useTheme();
  const { t } = useAppTranslation();

  const MODE_CHIPS: ModeChip[] = useMemo(() => [
    { key: "doubt",     label: t("modeDoubt", "Quick Answer"), emoji: "🔍", color: "#6366f1", hint: t("modeDoubtHint", "Search anything…"),     sample: "Why does ice float on water?" },
    { key: "explain",   label: t("modeExplain", "Explain"),    emoji: "📝", color: "#0284c7", hint: t("modeExplainHint", "Explain a concept…"), sample: "Explain Newton's Third Law of Motion" },
    { key: "notes",     label: t("modeNotes", "Notes"),        emoji: "🗒️", color: "#059669", hint: t("modeNotesHint", "Make notes on…"),       sample: "Make notes on the French Revolution" },
    { key: "exam",      label: t("modeExam", "Exam Prep"),     emoji: "🎯", color: "#dc2626", hint: t("modeExamHint", "Help me prepare for…"),  sample: "Help me prepare for the Chapter 3 Science exam" },
    { key: "summarize", label: t("modeSummarize", "Summarize"),emoji: "📖", color: "#d97706", hint: t("modeSummarizeHint", "Summarize chapter…"),sample: "Summarize Chapter 5: Light – Reflection and Refraction" },
    { key: "tip",       label: t("modeTip", "Study Tip"),      emoji: "💡", color: "#7c3aed", hint: t("modeTipHint", "Give me a study tip for…"),sample: "Give me a study tip for Mathematics" },
    { key: "language",  label: t("modeLanguage", "My Language"),emoji: "🌐", color: "#be185d", hint: "अपनी भाषा में लिखें • বাংলায় লিখুন",         sample: "নিউটনের তৃতীয় সূত্রটা বুঝিয়ে দাও।" },
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

  const [query,      setQuery]      = useState("");
  const [activeMode, setActiveMode] = useState<ModeKey>("doubt");
  const [result,     setResult]     = useState<ResultState>("idle");
  const [answer,     setAnswer]     = useState("");
  const [askedQ,     setAskedQ]     = useState("");
  const [askedMode,  setAskedMode]  = useState<ModeKey>("doubt");
  const [errMsg,     setErrMsg]     = useState("");
  // Set only on a CREDITS_EXHAUSTED response — undefined keeps the "limit"
  // screen's plain pre-credits render (Upgrade only, no Buy Credits option).
  const [creditInfo, setCreditInfo] = useState<{ balance: number; required: number } | undefined>(undefined);
  const [saving,     setSaving]     = useState(false);
  const [savedId,    setSavedId]    = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const chip  = MODE_CHIPS.find((c) => c.key === activeMode)!;
  const aChip = MODE_CHIPS.find((c) => c.key === askedMode)!;
  const hasSearched = result !== "idle";

  async function runSearch(text?: string, mode?: ModeKey) {
    const q = (text ?? query).trim();
    const m = mode ?? activeMode;
    if (!q || result === "loading") return;
    // FIX: this used to hard-block after 1 question via a client-side
    // FREE_DAILY_ASK=1 constant that didn't match the server's real free
    // limit (5/day, functions/src/usageCheck.ts's checkAskGuruLimit) —
    // meaning nobody could ever reach the credits fallback past their
    // first question. Removed; the server is the only source of truth
    // for both the free limit and the credits fallback beyond it.
    if (mode) setActiveMode(mode);
    setQuery(q);
    setAskedQ(q); setAskedMode(m); setResult("loading"); setAnswer(""); setErrMsg(""); setSavedId(null);
    try {
      const data = await askAiGuruQuestion({ question: q, classLevel: studentClass, board, mode: m });
      setAnswer(data.answer);
      setResult("found");
    } catch (err: any) {
      if (err?.code === "CREDITS_EXHAUSTED") {
        setCreditInfo({ balance: err.creditBalance ?? 0, required: err.creditsRequired ?? 1 });
        setResult("limit");
      } else if (err?.code === "LIMIT_REACHED") {
        setCreditInfo(undefined);
        setResult("limit");
      } else {
        setErrMsg(err?.message ?? "Something went wrong");
        setResult("error");
      }
    }
  }

  async function handleSave() {
    if (!answer || saving) return;
    setSaving(true);
    try {
      const id = await saveToNotebook({
        question:  askedQ,
        answer,
        mode:      askedMode,
        modeLabel: `${aChip.emoji} ${aChip.label}`,
      });
      setSavedId(id);
    } catch (e: any) {
      Alert.alert("Could not save", e?.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function newSearch() {
    setQuery("");
    setResult("idle");
    setAnswer("");
    setAskedQ("");
    setErrMsg("");
    setSavedId(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function selectMode(key: ModeKey) {
    setActiveMode(key);
    // Switching mode mid-result re-runs the same query under the new mode
    // — matches what a search app's category tab does (re-filter the same
    // search), rather than discarding the query like the old reset-on-
    // mode-change behavior did.
    if (hasSearched && askedQ) runSearch(askedQ, key);
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  const canSend = query.trim().length > 0 && result !== "loading";

  return (
    <KeyboardAvoidingView
      style={[S.root, { backgroundColor: isDarkMode ? "#0a0a1a" : colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {isDarkMode && (
        <LinearGradient colors={["#0a0a1a", "#0f172a"]} style={StyleSheet.absoluteFillObject} />
      )}

      {/* ── Header — minimal until a search has happened ── */}
      <AiGuruHeader
        title={hasSearched ? t("askAiGuruTitle", "Ask AI Guru") : undefined}
        showLanguageBadge
        rightElement={
          <View style={S.headerRight}>
            {/* FIX: replaced the old "X/1" quota badge — it was built
                entirely around the removed FREE_DAILY_ASK=1 client
                constant and never reflected the server's real count. A
                credit balance is genuinely known and worth showing;
                remaining free questions today isn't, without the server
                returning that on every response. */}
            <CreditBalanceBadge uid={auth.currentUser?.uid ?? null} />
            <TouchableOpacity
              onPress={() => router.push("/ai-guru/notebook" as any)}
              style={[S.notebookBtn, { backgroundColor: surface, borderColor: border }]}
            >
              <Ionicons name="book-outline" size={15} color="#6366f1" />
              {hasSearched && <Text style={S.notebookBtnText}>{t("notebook", "Notebook")}</Text>}
            </TouchableOpacity>
          </View>
        }
      />

      {/* ── LANDING STATE: centered search box, search-app-homepage style ── */}
      {!hasSearched && (
        <View style={S.landingWrap}>
          <LinearGradient colors={["#4f46e5", "#7c3aed"]} style={S.landingOrb}>
            <Ionicons name="search" size={28} color="#fff" />
          </LinearGradient>
          <Text style={[S.landingTitle, { color: text }]}>{t("askAiGuruTitle", "Ask AI Guru")}</Text>
          <Text style={[S.landingSub, { color: dim }]}>
            {t("askAiGuruTagline", "Search anything about your studies, skills, or general knowledge")}
          </Text>

          <View style={[S.searchBoxLanding, { backgroundColor: surface, borderColor: canSend ? chip.color : border }]}>
            <Ionicons name="search-outline" size={17} color={dim} style={{ marginLeft: 14 }} />
            <TextInput
              ref={inputRef}
              style={[S.searchInputLanding, { color: text }]}
              placeholder={chip.hint}
              placeholderTextColor={dim}
              value={query}
              onChangeText={setQuery}
              multiline
              maxLength={300}
              returnKeyType="search"
              blurOnSubmit
              onSubmitEditing={() => runSearch()}
            />
            <TouchableOpacity
              style={[S.searchBtnLanding, !canSend && S.sendBtnDisabled]}
              onPress={() => runSearch()}
              disabled={!canSend}
            >
              <LinearGradient colors={canSend ? [chip.color, chip.color + "cc"] : [surface, surface]} style={S.searchBtnLandingInner}>
                <Ionicons name="arrow-forward" size={16} color={canSend ? "#fff" : dim} />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.modePillsRow} style={S.modePillsScroll}>
            {MODE_CHIPS.map((c) => (
              <TouchableOpacity
                key={c.key}
                onPress={() => selectMode(c.key)}
                style={[
                  S.modePill,
                  { borderColor: activeMode === c.key ? c.color : border },
                  activeMode === c.key && { backgroundColor: `${c.color}18` },
                ]}
              >
                <Text style={S.modePillEmoji}>{c.emoji}</Text>
                <Text style={[S.modePillLabel, { color: activeMode === c.key ? c.color : muted }]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {activeMode === "language" && (
            <Animated.View entering={FadeInDown.duration(300)} style={[S.langHintCard, { backgroundColor: surface, borderColor: "#be185d" }]}>
              <Text style={[S.langHintTitle, { color: "#f9a8d4" }]}>
                🌐 {t("writeInYourLanguage", "Write in your language — AI answers in the same language")}
              </Text>
              <View style={S.langExamplesGrid}>
                {LANGUAGE_EXAMPLES.slice(0, 6).map((ex) => (
                  <TouchableOpacity
                    key={ex.lang}
                    onPress={() => runSearch(ex.text)}
                    activeOpacity={0.75}
                    style={[S.langExChip, { borderColor: border, backgroundColor: isDarkMode ? "#1e293b" : "#fdf2f8" }]}
                  >
                    <Text style={[S.langExLang, { color: "#be185d" }]}>{ex.lang}</Text>
                    <Text style={[S.langExText, { color: muted }]} numberOfLines={1}>{ex.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          )}
        </View>
      )}

      {/* ── RESULTS STATE: compact search bar at top + scrollable answer area ── */}
      {hasSearched && (
        <>
          <View style={S.compactSearchWrap}>
            <View style={[S.searchBoxCompact, { backgroundColor: surface, borderColor: canSend ? chip.color : border }]}>
              <Ionicons name="search-outline" size={15} color={dim} style={{ marginLeft: 12 }} />
              <TextInput
                ref={inputRef}
                style={[S.searchInputCompact, { color: text }]}
                placeholder={chip.hint}
                placeholderTextColor={dim}
                value={query}
                onChangeText={setQuery}
                multiline
                maxLength={300}
                returnKeyType="search"
                blurOnSubmit
                onSubmitEditing={() => runSearch()}
              />
              <TouchableOpacity style={S.searchBtnCompact} onPress={() => runSearch()} disabled={!canSend}>
                <LinearGradient colors={canSend ? [chip.color, chip.color + "cc"] : [surface, surface]} style={S.searchBtnCompactInner}>
                  <Ionicons name="arrow-forward" size={14} color={canSend ? "#fff" : dim} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.inputModesRow}>
              {MODE_CHIPS.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => selectMode(c.key)}
                  style={[
                    S.inputModeChip,
                    { borderColor: activeMode === c.key ? c.color : border },
                    activeMode === c.key && { backgroundColor: `${c.color}18` },
                  ]}
                >
                  <Text style={S.inputModeEmoji}>{c.emoji}</Text>
                  <Text style={[S.inputModeLabel, { color: activeMode === c.key ? c.color : dim }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <ScrollView
            style={S.scroll}
            contentContainerStyle={S.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── LOADING ── */}
            {result === "loading" && (
              <Animated.View entering={FadeIn.duration(300)} style={S.centerBlock}>
                <LinearGradient colors={[chip.color, chip.color + "cc"]} style={S.thinkingOrb}>
                  <ActivityIndicator color="#fff" size="large" />
                </LinearGradient>
                <Text style={[S.thinkingTitle, { color: text }]}>{t("searching", "Searching…")}</Text>
                <Text style={[S.thinkingQ, { color: dim }]} numberOfLines={2}>"{askedQ}"</Text>
              </Animated.View>
            )}

            {/* ── ANSWER ── */}
            {result === "found" && (
              <Animated.View entering={FadeInDown.duration(400)} style={S.answerBlock}>
                <Text style={[S.resultsForText, { color: muted }]}>
                  {t("resultsFor", "Results for")} <Text style={{ color: text, fontWeight: "700" }}>"{askedQ}"</Text>
                </Text>

                <View style={[S.answerCard, { backgroundColor: surface, borderColor: `${aChip.color}40` }]}>
                  <View style={S.answerCardHeader}>
                    <LinearGradient colors={[aChip.color, aChip.color + "cc"]} style={S.aiAvatar}>
                      <Text style={S.aiAvatarEmoji}>{aChip.emoji}</Text>
                    </LinearGradient>
                    <Text style={[S.aiLabel, { color: aChip.color }]}>{aChip.label} · {t("aiGuru", "AI Guru")}</Text>
                  </View>

                  <Text style={[S.answerText, { color: text }]}>{answer}</Text>

                  <View style={[S.divider, { backgroundColor: border }]} />
                  <View style={S.answerActions}>
                    <TouchableOpacity
                      onPress={handleSave}
                      disabled={saving || !!savedId}
                      style={[
                        S.saveBtn,
                        {
                          backgroundColor: savedId ? "rgba(16,185,129,0.12)" : isDarkMode ? "rgba(99,102,241,0.12)" : "#ede9fe",
                          borderColor: savedId ? "#10b981" : "#6366f1",
                        },
                      ]}
                    >
                      {saving ? (
                        <ActivityIndicator size={13} color="#6366f1" />
                      ) : (
                        <Ionicons name={savedId ? "checkmark-circle" : "bookmark-outline"} size={15} color={savedId ? "#10b981" : "#6366f1"} />
                      )}
                      <Text style={[S.saveBtnText, { color: savedId ? "#10b981" : "#6366f1" }]}>
                        {savedId ? t("savedToNotebook", "Saved to Notebook") : saving ? "Saving…" : t("saveToNotebook", "Save to Notebook")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => router.push("/ai-guru/notebook" as any)} style={[S.notebookLinkBtn, { borderColor: border }]}>
                      <Ionicons name="book-outline" size={14} color={muted} />
                      <Text style={[S.notebookLinkText, { color: muted }]}>{t("viewNotebook", "View Notebook")}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={S.upsellRow}>
                    <TouchableOpacity
                      style={[S.upsellBtn, { backgroundColor: isDarkMode ? "rgba(99,102,241,0.1)" : "#ede9fe", borderColor: "#6366f1" }]}
                      onPress={() => router.push("/ai-guru/setup")}
                    >
                      <Text style={S.upsellBtnText}>✨ {t("generateFullLessonAction", "Generate Full Lesson")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[S.upsellBtn, { backgroundColor: isDarkMode ? "rgba(220,38,38,0.1)" : "#fef2f2", borderColor: "#dc2626" }]}
                      onPress={() => router.push("/ai-guru/exam-simulator" as any)}
                    >
                      <Text style={[S.upsellBtnText, { color: "#f87171" }]}>🎯 {t("practiceExam", "Practice Exam")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity onPress={newSearch} style={S.resetRow}>
                  <Ionicons name="refresh-outline" size={15} color="#6366f1" />
                  <Text style={S.resetText}>{t("newSearch", "New search")}</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* ── LIMIT ── */}
            {result === "limit" && (
              <Animated.View entering={FadeIn.duration(300)} style={S.centerBlock}>
                <Text style={S.limitEmoji}>⏰</Text>
                <Text style={[S.limitTitle, { color: text }]}>{t("dailyLimitTitle", "Daily limit reached")}</Text>
                <Text style={[S.limitBody, { color: muted }]}>
                  {creditInfo
                    ? `You've used today's free questions. You have ${creditInfo.balance} credit${creditInfo.balance === 1 ? "" : "s"} — buy more or upgrade to Premium for unlimited access.`
                    : t("dailyLimitMessage", { defaultValue: "You've reached today's free question limit. Come back tomorrow or upgrade to Premium.", count: 5 })}
                </Text>
                <TouchableOpacity
                  style={S.limitPrimaryWrap}
                  onPress={() => router.push((creditInfo ? "/ai-guru/credits" : "/ai-guru/subscription") as any)}
                >
                  <LinearGradient colors={["#312e81", "#4f46e5"]} style={S.limitPrimaryBtn}>
                    <Text style={S.limitPrimaryText}>
                      {creditInfo ? "⚡ Buy Credits" : `✨ ${t("upgradeToPremium", "Upgrade to Premium")}`}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
                {creditInfo && (
                  <TouchableOpacity onPress={() => router.push("/ai-guru/subscription" as any)}>
                    <Text style={[S.limitBody, { color: "#a5b4fc", fontSize: 12 }]}>
                      Or upgrade to Premium for unlimited access
                    </Text>
                  </TouchableOpacity>
                )}
                {/* NOTE: no longer links to SkillGuru as an alternative —
                    that cross-link was a symptom of the redundancy this
                    rebuild removes. The two tools now have distinct
                    purposes, so "out of searches" isn't a reason to push
                    someone toward the tutor chat instead. */}
              </Animated.View>
            )}

            {/* ── ERROR ── */}
            {result === "error" && (
              <Animated.View entering={FadeIn.duration(300)} style={S.centerBlock}>
                <Ionicons name="warning-outline" size={42} color="#f59e0b" />
                <Text style={[S.limitTitle, { color: text }]}>{t("somethingWentWrong", "Something went wrong")}</Text>
                <Text style={[S.limitBody, { color: muted }]}>{errMsg}</Text>
                <TouchableOpacity style={[S.retryBtn, { borderColor: border }]} onPress={() => runSearch(askedQ, askedMode)}>
                  <Text style={[S.retryText, { color: colors.accent }]}>{t("tryAgainLabel", "Try again")}</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            <View style={{ height: 16 }} />
          </ScrollView>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },

  headerRight:  { flexDirection: "row", alignItems: "center", gap: 8 },
  notebookBtn:  { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  notebookBtnText: { color: "#6366f1", fontSize: 11, fontWeight: "700" },
  quotaBadge:   { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  quotaDot:     { width: 7, height: 7, borderRadius: 4 },
  quotaText:    { fontSize: 11, fontWeight: "800" },

  // Landing state
  landingWrap:  { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, paddingBottom: 40 },
  landingOrb:   { width: 64, height: 64, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  landingTitle: { fontSize: 26, fontWeight: "900", marginBottom: 6, textAlign: "center" },
  landingSub:   { fontSize: 13, marginBottom: 24, textAlign: "center", maxWidth: 320, lineHeight: 18 },

  searchBoxLanding:      { width: "100%", maxWidth: 480, flexDirection: "row", alignItems: "flex-end", borderRadius: 28, borderWidth: 1.5, paddingRight: 5, paddingVertical: 4 },
  searchInputLanding:    { flex: 1, fontSize: 15, lineHeight: 21, maxHeight: 100, paddingVertical: 10, paddingHorizontal: 10 },
  searchBtnLanding:      { borderRadius: 20, overflow: "hidden" },
  searchBtnLandingInner: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },

  modePillsScroll: { width: "100%", maxWidth: 480, marginTop: 14 },
  modePillsRow:    { gap: 7, paddingVertical: 2 },
  modePill:        { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  modePillEmoji:   { fontSize: 13 },
  modePillLabel:   { fontSize: 12, fontWeight: "700" },

  langHintCard:     { width: "100%", maxWidth: 480, borderRadius: 16, borderWidth: 1, padding: 14, marginTop: 14, gap: 10 },
  langHintTitle:    { fontSize: 12, fontWeight: "700", lineHeight: 17 },
  langExamplesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  langExChip:       { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, maxWidth: "48%" },
  langExLang:       { fontSize: 10, fontWeight: "800", marginBottom: 2 },
  langExText:       { fontSize: 11 },

  // Compact (results state) search bar
  compactSearchWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  searchBoxCompact:  { flexDirection: "row", alignItems: "flex-end", borderRadius: 24, borderWidth: 1.5, paddingRight: 4, paddingVertical: 3 },
  searchInputCompact:{ flex: 1, fontSize: 14, lineHeight: 19, maxHeight: 80, paddingVertical: 8, paddingHorizontal: 8 },
  searchBtnCompact:      { borderRadius: 17, overflow: "hidden" },
  searchBtnCompactInner: { width: 34, height: 34, justifyContent: "center", alignItems: "center" },
  sendBtnDisabled:   { opacity: 0.4 },

  inputModesRow:  { gap: 6, paddingTop: 9 },
  inputModeChip:  { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  inputModeEmoji: { fontSize: 12 },
  inputModeLabel: { fontSize: 10, fontWeight: "700" },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4, flexGrow: 1 },

  resultsForText: { fontSize: 13, marginBottom: 4 },

  centerBlock:   { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 56, gap: 16 },
  thinkingOrb:   { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  thinkingTitle: { fontSize: 18, fontWeight: "800" },
  thinkingQ:     { fontSize: 13, textAlign: "center", lineHeight: 20, maxWidth: 280, fontStyle: "italic" },

  answerBlock:   { paddingTop: 6, gap: 12 },

  answerCard:       { borderRadius: 18, borderWidth: 1, padding: 18, gap: 12 },
  answerCardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  aiAvatar:         { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  aiAvatarEmoji:    { fontSize: 14 },
  aiLabel:          { fontSize: 12, fontWeight: "800" },
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

  resetRow:  { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", paddingVertical: 10, marginTop: 2 },
  resetText: { color: "#6366f1", fontSize: 14, fontWeight: "600" },

  limitEmoji:       { fontSize: 52 },
  limitTitle:       { fontSize: 19, fontWeight: "800", textAlign: "center", maxWidth: 280 },
  limitBody:        { fontSize: 13, textAlign: "center", lineHeight: 20, maxWidth: 280 },
  limitPrimaryWrap: { width: "100%", borderRadius: 16, overflow: "hidden" },
  limitPrimaryBtn:  { paddingVertical: 15, alignItems: "center" },
  limitPrimaryText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  retryBtn:         { borderRadius: 12, borderWidth: 1, paddingHorizontal: 28, paddingVertical: 12 },
  retryText:        { fontSize: 14, fontWeight: "700" },
});
// PATH: app/ai-guru/voice-tutor.tsx
// Voice Tutor — speak a doubt in Hindi/Bengali/Assamese/English,
// AI answers in the same language. expo-speech for TTS playback.
// Falls back to text input if recording not available.

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert,
  ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View
} from "react-native";
import Animated, {
  FadeIn, FadeInDown,
  useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// Graceful: expo-speech — falls back silently if not installed
let Speech: { speak: (text: string, opts?: any) => void; stop: () => void } | null = null;
try { Speech = require("expo-speech"); } catch {}

import { useStudentProfile } from "@/context/StudentProfileContext";
import { useTheme } from "@/context/ThemeContext";
import { askVoiceTutor, VoiceTutorResponse } from "@/services/voiceTutorApi";

// Graceful: expo-av for recording — falls back to text if unavailable
let Audio: any = null;
try { Audio = require("expo-av").Audio; } catch {}

const LANGUAGES = ["English", "Hindi", "Bengali", "Assamese"] as const;

const LANG_TTS_MAP: Record<string, string> = {
  English:  "en-IN",
  Hindi:    "hi-IN",
  Bengali:  "bn-IN",
  Assamese: "as-IN",
};

const FREE_VOICE_DAILY = 3;

type Phase = "idle" | "recording" | "processing" | "result" | "limit" | "error";

function PulseRing({ active }: { active: boolean }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(withSequence(withTiming(1.5, { duration: 800 }), withTiming(1, { duration: 800 })), -1);
      opacity.value = withRepeat(withSequence(withTiming(0.5, { duration: 800 }), withTiming(0, { duration: 800 })), -1);
    } else {
      scale.value = withTiming(1);
      opacity.value = withTiming(0);
    }
  }, [active]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
    position: "absolute",
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 2, borderColor: "#a855f7",
  }));

  return <Animated.View style={style} />;
}

export default function VoiceTutorScreen() {
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

  const [selectedLang, setLang]     = useState<typeof LANGUAGES[number]>("Hindi");
  const [phase,    setPhase]        = useState<Phase>("idle");
  const [response, setResponse]     = useState<VoiceTutorResponse | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [textInput, setTextInput]   = useState("");
  const [showTextFallback, setShowTextFallback] = useState(false);
  const [remaining, setRemaining]   = useState(FREE_VOICE_DAILY);
  const [errMsg, setErrMsg]         = useState("");

  const recordingRef = useRef<any>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        try { recordingRef.current.stopAndUnloadAsync(); } catch {}
      }
      Speech?.stop();
    };
  }, []);

  // ── Recording ─────────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (!Audio) { setShowTextFallback(true); return; }
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { Alert.alert("Permission needed", "Microphone access required for voice questions."); return; }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setPhase("recording");
    } catch (e: any) {
      // Fallback to text input if recording fails
      setShowTextFallback(true);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    setPhase("processing");
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error("No recording saved");

      // Read audio file as base64
      const { FileSystem } = require("expo-file-system");
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

      await askQuestion({ audioBase64: base64, audioMimeType: "audio/m4a" });
    } catch (e: any) {
      setErrMsg(e?.message ?? "Recording failed");
      setPhase("error");
    }
  };

  // ── Ask question ──────────────────────────────────────────────────────────
  const askQuestion = async (input: { audioBase64?: string; audioMimeType?: string; textQuestion?: string }) => {
    setPhase("processing");
    setResponse(null);
    setErrMsg("");
    try {
      const result = await askVoiceTutor({
        ...input,
        detectedLanguage: selectedLang,
        classLevel,
        board,
      });
      setResponse(result);
      setPhase("result");
      setRemaining((r) => Math.max(0, r - 1));
      // Auto-play answer
      speakAnswer(result.answer, result.detectedLanguage ?? selectedLang);
    } catch (e: any) {
      if (e?.code === "LIMIT_REACHED") { setPhase("limit"); }
      else { setErrMsg(e?.message ?? "Something went wrong"); setPhase("error"); }
    }
  };

  const handleTextSubmit = async () => {
    const q = textInput.trim();
    if (!q) return;
    setTextInput("");
    await askQuestion({ textQuestion: q, detectedLanguage: selectedLang });
  };

  // ── TTS playback ──────────────────────────────────────────────────────────
  const speakAnswer = (answerText: string, lang: string) => {
    const locale = LANG_TTS_MAP[lang] ?? "en-IN";
    setIsSpeaking(true);
    Speech?.speak(answerText, {
      language: locale,
      rate: 0.9,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const stopSpeaking = () => { Speech?.stop(); setIsSpeaking(false); };

  const reset = () => {
    Speech?.stop();
    setPhase("idle");
    setResponse(null);
    setErrMsg("");
    setTextInput("");
    setShowTextFallback(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[S.root, { backgroundColor: bg }]}>
      {isDarkMode && <LinearGradient colors={["#060612", "#0a0a1a"]} style={StyleSheet.absoluteFillObject} />}

      {/* Header */}
      <Animated.View entering={FadeIn.duration(350)} style={[S.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => { Speech?.stop(); router.back(); }} style={[S.backBtn, { backgroundColor: backBg }]}>
          <Ionicons name="chevron-back" size={22} color={muted} />
        </TouchableOpacity>
        <View style={S.headerCenter}>
          <Text style={[S.headerTitle, { color: text }]}>🎙️ Voice Tutor</Text>
          <Text style={[S.headerSub, { color: dim }]}>Speak your doubt · Get instant answer</Text>
        </View>
        <View style={[S.quotaBadge, { backgroundColor: surface, borderColor: remaining > 0 ? border : "rgba(239,68,68,0.4)" }]}>
          <View style={[S.quotaDot, { backgroundColor: remaining > 0 ? "#10b981" : "#ef4444" }]} />
          <Text style={[S.quotaText, { color: remaining > 0 ? "#10b981" : "#ef4444" }]}>
            {remaining}/{FREE_VOICE_DAILY}
          </Text>
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={[S.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>

        {/* Language selector */}
        <View style={S.langRow}>
          {LANGUAGES.map((l) => (
            <TouchableOpacity key={l} onPress={() => setLang(l)} activeOpacity={0.8}
              style={[S.langChip, { backgroundColor: selectedLang === l ? "rgba(168,85,247,0.2)" : surface, borderColor: selectedLang === l ? "#a855f7" : border }]}>
              <Text style={[S.langText, { color: selectedLang === l ? "#d8b4fe" : muted }]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── IDLE / RECORDING phases ── */}
        {(phase === "idle" || phase === "recording") && !showTextFallback && (
          <Animated.View entering={FadeInDown.duration(450).delay(80)} style={S.micSection}>
            {/* Hero */}
            <LinearGradient colors={["#2e1065", "#7c3aed", "#a855f7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.heroBanner}>
              <View style={S.heroOrb} />
              <Text style={S.heroBannerEmoji}>🎙️</Text>
              <Text style={S.heroBannerTitle}>बोलिए, पूछिए। Ask anything.</Text>
              <Text style={S.heroBannerSub}>Speak your doubt in {selectedLang}. Your AI tutor will answer in the same language.</Text>
            </LinearGradient>

            {/* Mic button */}
            <View style={S.micContainer}>
              <PulseRing active={phase === "recording"} />
              <TouchableOpacity
                onPress={phase === "recording" ? stopRecording : startRecording}
                activeOpacity={0.85}
                style={S.micBtnWrap}
              >
                <LinearGradient
                  colors={phase === "recording" ? ["#7f1d1d", "#dc2626"] : ["#2e1065", "#7c3aed"]}
                  style={S.micBtn}
                >
                  <Ionicons name={phase === "recording" ? "stop" : "mic"} size={36} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
            <Text style={[S.micHint, { color: dim }]}>
              {phase === "recording" ? "🔴 Recording… tap to stop" : "Tap to speak your question"}
            </Text>

            {/* Text fallback toggle */}
            <TouchableOpacity onPress={() => setShowTextFallback(true)} style={[S.textToggle, { borderColor: border }]}>
              <Ionicons name="pencil-outline" size={14} color={dim} />
              <Text style={[S.textToggleText, { color: dim }]}>Type instead</Text>
            </TouchableOpacity>

            {/* Example questions */}
            <View style={[S.examplesCard, { backgroundColor: surface, borderColor: border }]}>
              <Text style={[S.examplesLabel, { color: dim }]}>Try saying…</Text>
              {[
                selectedLang === "Hindi" ? "\"Newton ka तीसरा नियम क्या है?\"" : selectedLang === "Bengali" ? "\"আলোক সংশ্লেষণ কী?\"" : "\"What is photosynthesis?\"",
                selectedLang === "Hindi" ? "\"त्रिभुज का क्षेत्रफल कैसे निकालें?\"" : selectedLang === "Bengali" ? "\"দ্বিঘাত সমীকরণ কীভাবে সমাধান করব?\"" : "\"How to solve quadratic equations?\"",
              ].map((ex, i) => (
                <View key={i} style={S.exampleRow}>
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color="#a855f7" />
                  <Text style={[S.exampleText, { color: muted }]}>{ex}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Text input fallback */}
        {showTextFallback && phase === "idle" && (
          <Animated.View entering={FadeInDown.duration(350)} style={S.textSection}>
            <LinearGradient colors={["#2e1065", "#7c3aed"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.heroBanner}>
              <Text style={S.heroBannerEmoji}>💬</Text>
              <Text style={S.heroBannerTitle}>Type your question</Text>
              <Text style={S.heroBannerSub}>Type in {selectedLang} — your AI tutor will answer in the same language</Text>
            </LinearGradient>

            <View style={[S.textInputCard, { backgroundColor: surface, borderColor: border }]}>
              <TextInput
                style={[S.textInput, { color: text }]}
                placeholder={`Ask your question in ${selectedLang}…`}
                placeholderTextColor={dim}
                value={textInput}
                onChangeText={setTextInput}
                multiline
                maxLength={300}
                autoFocus
              />
              <TouchableOpacity
                onPress={handleTextSubmit}
                disabled={!textInput.trim()}
                style={[S.sendBtn, { opacity: textInput.trim() ? 1 : 0.4 }]}
              >
                <LinearGradient colors={["#2e1065", "#a855f7"]} style={S.sendBtnGrad}>
                  <Ionicons name="arrow-up" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => setShowTextFallback(false)} style={[S.textToggle, { borderColor: border }]}>
              <Ionicons name="mic-outline" size={14} color={dim} />
              <Text style={[S.textToggleText, { color: dim }]}>Use voice instead</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── PROCESSING ── */}
        {phase === "processing" && (
          <Animated.View entering={FadeIn.duration(300)} style={S.centerBlock}>
            <LinearGradient colors={["#2e1065", "#7c3aed"]} style={S.thinkingOrb}>
              <ActivityIndicator color="#fff" size="large" />
            </LinearGradient>
            <Text style={[S.thinkingTitle, { color: text }]}>Thinking…</Text>
            <Text style={[S.thinkingNote, { color: dim }]}>Your AI tutor is preparing an answer in {selectedLang}</Text>
          </Animated.View>
        )}

        {/* ── RESULT ── */}
        {phase === "result" && response && (
          <Animated.View entering={FadeInDown.duration(450)} style={S.resultBlock}>
            {/* Question bubble */}
            <View style={S.questionRow}>
              <View style={[S.questionBubble, { backgroundColor: isDarkMode ? "#312e81" : "#ede9fe" }]}>
                <Ionicons name="mic" size={14} color="#818cf8" />
                <Text style={[S.questionBubbleText, { color: isDarkMode ? "#e0e7ff" : "#4338ca" }]}>
                  {response.transcribedQuestion}
                </Text>
              </View>
            </View>

            {/* Answer card */}
            <View style={[S.answerCard, { backgroundColor: surface, borderColor: border }]}>
              <View style={S.answerHeader}>
                <LinearGradient colors={["#2e1065", "#a855f7"]} style={S.aiAvatar}>
                  <Ionicons name="mic" size={16} color="#fff" />
                </LinearGradient>
                <View style={S.answerHeaderText}>
                  <Text style={[S.answerHeaderTitle, { color: text }]}>Voice Tutor</Text>
                  <Text style={[S.answerLang, { color: dim }]}>Answered in {response.detectedLanguage}</Text>
                </View>
                {/* TTS control */}
                <TouchableOpacity
                  onPress={isSpeaking ? stopSpeaking : () => speakAnswer(response.answer, response.detectedLanguage ?? selectedLang)}
                  style={[S.ttsBtn, { backgroundColor: isSpeaking ? "rgba(168,85,247,0.2)" : surface, borderColor: "#a855f7" }]}
                >
                  <Ionicons name={isSpeaking ? "stop-circle" : "play-circle"} size={22} color="#a855f7" />
                </TouchableOpacity>
              </View>

              <Text style={[S.answerText, { color: text }]}>{response.answer}</Text>

              {/* Key points */}
              {response.keyPoints?.length > 0 && (
                <>
                  <View style={[S.divider, { backgroundColor: border }]} />
                  <Text style={[S.keyPointsLabel, { color: dim }]}>Key Points</Text>
                  {response.keyPoints.map((pt, i) => (
                    <View key={i} style={S.keyPointRow}>
                      <Ionicons name="checkmark-circle" size={14} color="#a855f7" />
                      <Text style={[S.keyPointText, { color: muted }]}>{pt}</Text>
                    </View>
                  ))}
                </>
              )}

              {/* Follow-up suggestion */}
              {response.followUpSuggestion && (
                <View style={[S.followUpBox, { backgroundColor: "rgba(168,85,247,0.08)", borderColor: "#a855f7" }]}>
                  <Ionicons name="bulb-outline" size={14} color="#a855f7" />
                  <Text style={[S.followUpText, { color: muted }]}>Try asking: {response.followUpSuggestion}</Text>
                </View>
              )}
            </View>

            {/* Actions */}
            <TouchableOpacity onPress={reset} activeOpacity={0.85} style={S.askAnotherWrap}>
              <LinearGradient colors={["#2e1065", "#7c3aed"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.askAnotherBtn}>
                <Ionicons name="mic" size={18} color="#fff" />
                <Text style={S.askAnotherText}>Ask Another Question</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/ai-guru/setup" as any)} style={[S.lessonBtn, { borderColor: border }]}>
              <Text style={[S.lessonBtnText, { color: "#d8b4fe" }]}>✨ Generate Full Lesson on {response.subject}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── LIMIT ── */}
        {phase === "limit" && (
          <Animated.View entering={FadeIn.duration(300)} style={S.centerBlock}>
            <Text style={S.limitEmoji}>⏰</Text>
            <Text style={[S.thinkingTitle, { color: text }]}>Daily limit reached</Text>
            <Text style={[S.thinkingNote, { color: dim }]}>
              Free tier: {FREE_VOICE_DAILY} voice questions/day. Upgrade for unlimited.
            </Text>
            <TouchableOpacity onPress={() => router.push("/ai-guru/subscription" as any)} style={S.upgradeWrap}>
              <LinearGradient colors={["#92400e", "#d97706"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.upgradeBtn}>
                <Ionicons name="star" size={16} color="#fff" />
                <Text style={S.upgradeBtnText}>Upgrade to Premium</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── ERROR ── */}
        {phase === "error" && (
          <Animated.View entering={FadeIn.duration(300)} style={S.centerBlock}>
            <Ionicons name="warning-outline" size={48} color="#f59e0b" />
            <Text style={[S.thinkingTitle, { color: text }]}>Something went wrong</Text>
            <Text style={[S.thinkingNote, { color: dim }]}>{errMsg}</Text>
            <TouchableOpacity onPress={reset} style={[S.retryBtn, { borderColor: border }]}>
              <Text style={[S.retryText, { color: "#d8b4fe" }]}>Try Again</Text>
            </TouchableOpacity>
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
  quotaBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  quotaDot:   { width: 7, height: 7, borderRadius: 4 },
  quotaText:  { fontSize: 11, fontWeight: "800" },
  scroll:     { paddingHorizontal: 16, paddingTop: 8 },

  langRow:  { flexDirection: "row", gap: 8, marginBottom: 16 },
  langChip: { flex: 1, borderRadius: 20, borderWidth: 1, paddingVertical: 9, alignItems: "center" },
  langText: { fontSize: 12, fontWeight: "700" },

  heroBanner:     { borderRadius: 20, padding: 22, marginBottom: 24, overflow: "hidden", gap: 6 },
  heroOrb:        { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.08)", top: -40, right: -40 },
  heroBannerEmoji:{ fontSize: 36 },
  heroBannerTitle:{ color: "#fff", fontSize: 20, fontWeight: "900" },
  heroBannerSub:  { color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 20 },

  micSection:  { alignItems: "center", gap: 20 },
  micContainer:{ alignItems: "center", justifyContent: "center", width: 88, height: 88, marginVertical: 8 },
  micBtnWrap:  { zIndex: 1 },
  micBtn:      { width: 88, height: 88, borderRadius: 44, justifyContent: "center", alignItems: "center" },
  micHint:     { fontSize: 14, textAlign: "center" },

  textToggle:     { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  textToggleText: { fontSize: 12, fontWeight: "600" },

  examplesCard:  { width: "100%", borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  examplesLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  exampleRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  exampleText:   { fontSize: 13, fontStyle: "italic" },

  textSection:   { gap: 14 },
  textInputCard: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 10 },
  textInput:     { fontSize: 15, lineHeight: 24, minHeight: 80 },
  sendBtn:       { alignSelf: "flex-end", borderRadius: 22, overflow: "hidden" },
  sendBtnGrad:   { width: 44, height: 44, justifyContent: "center", alignItems: "center" },

  centerBlock:  { alignItems: "center", paddingVertical: 60, gap: 16 },
  thinkingOrb:  { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center" },
  thinkingTitle:{ fontSize: 20, fontWeight: "800" },
  thinkingNote: { fontSize: 13, textAlign: "center", maxWidth: 280, lineHeight: 20 },

  resultBlock:  { gap: 14, paddingTop: 4 },
  questionRow:  { alignItems: "flex-end" },
  questionBubble:     { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "85%", borderRadius: 18, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  questionBubbleText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: "500" },

  answerCard:   { borderRadius: 20, borderWidth: 1, padding: 18, gap: 12 },
  answerHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  aiAvatar:     { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  answerHeaderText: { flex: 1 },
  answerHeaderTitle:{ fontSize: 13, fontWeight: "800" },
  answerLang:   { fontSize: 11 },
  ttsBtn:       { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  answerText:   { fontSize: 15, lineHeight: 26 },
  divider:      { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  keyPointsLabel:{ fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  keyPointRow:  { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  keyPointText: { flex: 1, fontSize: 13, lineHeight: 20 },
  followUpBox:  { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, borderWidth: 1, padding: 10 },
  followUpText: { flex: 1, fontSize: 12, lineHeight: 18, fontStyle: "italic" },

  askAnotherWrap: { borderRadius: 16, overflow: "hidden" },
  askAnotherBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 15, gap: 8 },
  askAnotherText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  lessonBtn:      { borderRadius: 14, borderWidth: 1, paddingVertical: 13, alignItems: "center" },
  lessonBtnText:  { fontSize: 14, fontWeight: "700" },

  limitEmoji:   { fontSize: 52 },
  upgradeWrap:  { width: "100%", borderRadius: 16, overflow: "hidden" },
  upgradeBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 15, gap: 8 },
  upgradeBtnText:{ color: "#fff", fontSize: 16, fontWeight: "900" },
  retryBtn:     { borderRadius: 12, borderWidth: 1, paddingHorizontal: 32, paddingVertical: 12 },
  retryText:    { fontSize: 14, fontWeight: "700" },
});
// PATH: apps/mobile/app/ai-guru/skillguru.tsx
// Replaces apps/mobile/app/ai-guru/vidyaguru.tsx.
//
// REBUILD (VidyaGuru → SkillGuru): VidyaGuru was a generic "ask me
// anything about your studies" chat tutor — the same job Ask AI Guru
// already does as a single-shot search, just turned into an ongoing
// conversation. SkillGuru drops the generic-syllabus framing and becomes
// a dedicated skills coach: resume building, interview prep,
// communication, coding/tech basics, and soft skills. See
// lib/aiGuru/skillGuruDomains.ts for the category definitions and the
// reasoning behind keeping the same backend endpoint.
//
// NEW in this rebuild:
//   - Skill-category strip (5 categories) above the avatar — picking one
//     swaps the starter prompts to that category's own list and tints
//     the header/avatar/bubbles/send button with that category's color,
//     instead of one fixed emerald identity and one flat prompt list for
//     every conversation.
//   - Every outgoing message is prefixed with a skill-context tag (see
//     buildSkillContextPrefix) naming the active category, so the shared
//     /vidyaguruChat endpoint stays anchored to skills coaching rather
//     than drifting back into syllabus-doubt tutoring.
//
// UNCHANGED: voice input/output (mic recording → base64 → backend →
// audio reply playback) works exactly as before via
// services/skillGuruApi.ts (renamed from vidyaguruApi.ts — same
// request/response shape, same /vidyaguruChat endpoint). Components
// moved from components/vidyaguru/ to components/skillguru/ (re-skinned
// to accept a dynamic accent color instead of a hardcoded emerald).

import { Ionicons } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { BlurView } from "expo-blur";
import * as FileSystem from "expo-file-system/legacy";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChatBubble from "@/components/skillguru/ChatBubble";
import GuruAvatar from "@/components/skillguru/GuruAvatar";
import VoiceWaveform from "@/components/skillguru/VoiceWaveform";
import { useAppTranslation, useLanguage } from "@/context/LanguageContext";
import { useStudentProfile } from "@gloows/shared-logic";
import { useTheme } from "@/context/ThemeContext";
import type { GuruMessage, GuruState } from "@/lib/skillguru/types";
import { askSkillGuru, playGuruAudio } from "@/services/skillGuruApi";
import {
  SKILL_CATEGORIES,
  getSkillCategory,
  buildSkillContextPrefix,
  buildSkillGuruGreeting,
  type SkillCategoryKey,
} from "@/lib/aiGuru/skillGuruDomains";
import AiGuruHeader from "@/components/aiGuru/AiGuruHeader";

// Neutral identity before any skill category is picked — once one is
// active, its own color (from SKILL_CATEGORIES) takes over.
const NEUTRAL      = "#6366f1";
const NEUTRAL_DARK = "#4338ca";
const GOLD         = "#d4a017";

export default function SkillGuruScreen() {
  const { colors, isDarkMode } = useTheme();
  const { t } = useAppTranslation();
  const { languageName } = useLanguage();
  const insets = useSafeAreaInsets();
  const { studentProfile } = useStudentProfile();
  const studentName = studentProfile?.name?.split(" ")[0] ?? "Student";
  const classLevel = studentProfile?.class ?? "8";

  const [activeCategory, setActiveCategory] = useState<SkillCategoryKey | null>(null);
  const [messages, setMessages] = useState<GuruMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [guruState, setGuruState] = useState<GuruState>("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const currentPlayerRef = useRef<any>(null);
  // Keep messages in a ref so sendMessage callback never goes stale
  const messagesRef = useRef<GuruMessage[]>([]);
  // Keep active category in a ref too, since the mic-driven sendMessage
  // call happens inside an async handler that shouldn't read stale state.
  const activeCategoryRef = useRef<SkillCategoryKey | null>(null);
  // FIX: this used to hard-block after 1 message per session via a
  // client-side, never-resetting studentMessagesSentRef counter — stricter
  // than the server's real daily limit (1/day, functions/src/usageCheck.ts's
  // checkVidyaGuruLimit — this screen and ai-guru/vidyaguru.tsx share the
  // same /vidyaguruChat backend function) and meant nobody could ever
  // reach the credits fallback past their first message of a session.
  // Removed; the server is the source of truth.
  const [creditInfo, setCreditInfo] = useState<{ balance: number; required: number } | undefined>(undefined);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const category = activeCategory ? getSkillCategory(activeCategory) : null;
  const accent     = category?.color ?? NEUTRAL;
  const accentDark = category ? `${category.color}cc` : NEUTRAL_DARK;

  // Show greeting on mount — greeting updates when language changes.
  useEffect(() => {
    const greetingBody = buildSkillGuruGreeting(t, languageName);

    const greetMsg: GuruMessage = {
      id: "greeting",
      role: "guru",
      text: `${t("helloGreet", "Hello")} ${studentName}! ${greetingBody}`,
      createdAt: Date.now(),
    };
    setMessages([greetMsg]);
    messagesRef.current = [greetMsg];
  }, [languageName]);

  function pickCategory(key: SkillCategoryKey) {
    setActiveCategory(key);
    activeCategoryRef.current = key;
  }

  const sendMessage = useCallback(
    async (text: string, audioBase64?: string, audioMimeType?: string, categoryOverride?: SkillCategoryKey) => {
      if (!text.trim() && !audioBase64) return;

      if (categoryOverride && categoryOverride !== activeCategoryRef.current) {
        activeCategoryRef.current = categoryOverride;
        setActiveCategory(categoryOverride);
      }
      const effectiveCategory = activeCategoryRef.current ? getSkillCategory(activeCategoryRef.current) : null;

      const studentMsg: GuruMessage = {
        id: `s_${Date.now()}`,
        role: "student",
        text: audioBase64 ? t("voiceMessage", "🎤 Voice message") : text.trim(),
        createdAt: Date.now(),
      };

      const nextMessages = [...messagesRef.current, studentMsg];
      messagesRef.current = nextMessages;
      setMessages(nextMessages);
      setInputText("");
      setGuruState("thinking");

      // Build history from ref (always current, no stale closure)
      const conversationHistory = messagesRef.current.slice(0, -1).map((m) => ({
        role: m.role === "guru" ? "guru" : "student",
        text: m.text,
      }));

      // Prefix the outgoing text message with a skill-context tag so the
      // shared chat endpoint stays anchored to skills coaching — see
      // skillGuruDomains.ts. Voice messages have no text to prefix (the
      // backend transcribes audio itself), so context comes from
      // conversationHistory continuity instead.
      const outgoingText = !audioBase64 && effectiveCategory
        ? `${buildSkillContextPrefix(effectiveCategory)}${text.trim()}`
        : text.trim() || undefined;

      try {
        const resp = await askSkillGuru({
          message: outgoingText,
          audioBase64,
          audioMimeType,
          conversationHistory,
          studentName,
          classLevel: String(classLevel),
          language: languageName,
        });

        if (resp.transcribedText) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === studentMsg.id ? { ...m, text: resp.transcribedText! } : m
            )
          );
          messagesRef.current = messagesRef.current.map((m) =>
            m.id === studentMsg.id ? { ...m, text: resp.transcribedText! } : m
          );
        }

        const guruMsg: GuruMessage = {
          id: `g_${Date.now()}`,
          role: "guru",
          text: resp.answer,
          audioBase64: resp.audioBase64 || undefined,
          createdAt: Date.now(),
        };

        messagesRef.current = [...messagesRef.current, guruMsg];
        setMessages([...messagesRef.current]);

        if (resp.audioBase64) {
          setGuruState("speaking");
          currentPlayerRef.current?.pause?.();
          const player = await playGuruAudio(resp.audioBase64);
          currentPlayerRef.current = player;
          const estimatedMs = Math.max(3000, resp.answer.length * 60);
          setTimeout(() => setGuruState("idle"), estimatedMs);
        } else {
          setGuruState("idle");
        }
      } catch (err: any) {
        setGuruState("idle");
        if (err?.code === "CREDITS_EXHAUSTED") {
          setCreditInfo({ balance: err.creditBalance ?? 0, required: err.creditsRequired ?? 1 });
          setShowPaywall(true);
        } else if (err?.code === "FREE_LIMIT_REACHED") {
          setCreditInfo(undefined);
          setShowPaywall(true);
        } else {
          Alert.alert("Oops!", err?.message ?? "Failed to get a response. Please try again.");
        }
      }
    },
    [studentName, classLevel, languageName, t]
  );

  const handleMicPress = async () => {
    if (isRecording) {
      try {
        await recorder.stop();
      } catch (e) {
        console.warn("recorder.stop() error:", e);
      }

      // Reset audio session back to playback mode before playing the response
      try {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      } catch (e) {
        console.warn("[SkillGuru] failed to reset audio mode after recording:", e);
      }

      setIsRecording(false);
      setGuruState("thinking");

      const uri = recorder.uri;
      if (!uri) {
        console.warn("recorder.uri is null after stop");
        setGuruState("idle");
        Alert.alert("Error", "No audio recorded. Please try again.");
        return;
      }

      try {
        // Brief wait for Android to flush the file
        await new Promise((r) => setTimeout(r, 200));

        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) {
          throw new Error(`Audio file not found at ${uri}`);
        }

        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (!base64) throw new Error("Empty audio data");

        await sendMessage("", base64, "audio/mp4");
      } catch (e: any) {
        console.error("Voice processing error:", e?.message ?? e);
        setGuruState("idle");
        Alert.alert("Error", "Failed to process voice message. Please try again.");
      }
    } else {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission needed", "Please allow microphone access to use voice input.");
        return;
      }
      try {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
        setIsRecording(true);
        setGuruState("listening");
      } catch (e: any) {
        console.error("Recorder start error:", e?.message ?? e);
        Alert.alert("Error", "Could not start recording. Please try again.");
      }
    }
  };

  const handleReplayAudio = async (msg: GuruMessage) => {
    if (!msg.audioBase64) return;
    currentPlayerRef.current?.pause?.();
    setGuruState("speaking");
    const player = await playGuruAudio(msg.audioBase64);
    currentPlayerRef.current = player;
    setTimeout(() => setGuruState("idle"), Math.max(3000, msg.text.length * 60));
  };

  // Theme-aware colors — accent follows the active skill category once
  // one is picked, falling back to neutral indigo before that.
  const bgGradient: [string, string] = isDarkMode
    ? ["#0a0a1a", "#0d0d24"]
    : ["#f5f6fb", "#eef0fa"];
  const surfaceBg  = isDarkMode ? "#161b33" : colors.card;
  const borderCol  = isDarkMode ? "#2a2f52" : colors.border;
  const inputColor = isDarkMode ? "#f1f5f9" : colors.text;
  const placeholderColor = isDarkMode ? "#7c83a8" : "#9ca3af";

  const stateText =
    guruState === "thinking"  ? t("thinking", "Thinking...")   :
    guruState === "speaking"  ? t("speaking", "Speaking...")   :
    guruState === "listening" ? t("listening", "Listening...")  : t("readyToHelp", "Ready to help!");


  return (
    <LinearGradient colors={bgGradient} style={S.bg}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <AiGuruHeader
          title={t("skillGuruAI", "SkillGuru AI")}
          subtitle={category ? category.label : t("personalAiSkillsCoach", "Your personal AI skills coach")}
          rightElement={
            <View style={S.premiumBadge}>
              <Ionicons name="sparkles" size={12} color="#fbbf24" />
              <Text style={S.premiumText}>AI</Text>
            </View>
          }
        />

        {/* Skill-category strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.categoryScroll} contentContainerStyle={S.categoryRow}>
          {SKILL_CATEGORIES.map((c) => {
            const isActive = activeCategory === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                onPress={() => pickCategory(c.key)}
                style={[
                  S.categoryChip,
                  {
                    borderColor: isActive ? c.color : borderCol,
                    backgroundColor: isActive ? `${c.color}18` : "transparent",
                  },
                ]}
                activeOpacity={0.75}
              >
                <Text style={S.categoryEmoji}>{c.emoji}</Text>
                <Text style={[S.categoryLabel, { color: isActive ? c.color : colors.textSecondary }]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Avatar */}
        <Animated.View entering={FadeIn.duration(600)} style={S.avatarSection}>
          <GuruAvatar state={guruState} size={100} color={accent} />
          <Text style={[S.stateLabel, { color: colors.textSecondary }]}>{stateText}</Text>
        </Animated.View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <ChatBubble message={item} onReplayAudio={handleReplayAudio} isDarkMode={isDarkMode} color={accent} />
          )}
          contentContainerStyle={S.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        />

        {/* Input bar */}
        <View
          style={[
            S.inputBar,
            {
              borderColor: borderCol,
              backgroundColor: isDarkMode ? "#0a0a1a" : colors.background,
              paddingBottom: insets.bottom + 8,
            },
          ]}
        >
          {/* Selected language badge — gold-themed, tappable, jumps
              straight to language settings. */}
          <View style={S.langRow}>
            <TouchableOpacity
              style={[S.langBadge, { backgroundColor: isDarkMode ? "rgba(212,160,23,0.15)" : "#fef3d6", borderColor: GOLD }]}
              onPress={() => router.push("/language-settings" as any)}
              activeOpacity={0.75}
            >
              <Ionicons name="globe-outline" size={12} color={GOLD} />
              <Text style={[S.langBadgeText, { color: GOLD }]}>
                {t("respondingIn", { defaultValue: `Responding in ${languageName}`, lang: languageName })}
              </Text>
              <Ionicons name="chevron-forward" size={11} color={GOLD} />
            </TouchableOpacity>
          </View>

          {/* Text + mic row */}
          <View style={S.inputRow}>
            {isRecording ? (
              <View style={[S.waveformContainer, { backgroundColor: surfaceBg }]}>
                <VoiceWaveform recording={isRecording} />
              </View>
            ) : (
              <TextInput
                style={[
                  S.textInput,
                  {
                    backgroundColor: surfaceBg,
                    borderColor: borderCol,
                    color: inputColor,
                  },
                ]}
                placeholder={t("askSkillGuruInputPlaceholder", "Ask about a skill...")}
                placeholderTextColor={placeholderColor}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={1000}
                returnKeyType="send"
                blurOnSubmit
                onSubmitEditing={() => sendMessage(inputText)}
              />
            )}

            <TouchableOpacity
              style={[
                S.micBtn,
                { backgroundColor: surfaceBg, borderColor: borderCol },
                isRecording && S.micBtnActive,
              ]}
              onPress={handleMicPress}
            >
              <Ionicons
                name={isRecording ? "stop" : "mic"}
                size={20}
                color={isRecording ? "#ef4444" : colors.textSecondary}
              />
            </TouchableOpacity>

            {!isRecording && (
              <TouchableOpacity
                style={[S.sendBtn, { backgroundColor: accent }, !inputText.trim() && { backgroundColor: surfaceBg }]}
                onPress={() => sendMessage(inputText)}
                disabled={!inputText.trim() || guruState === "thinking"}
              >
                <Ionicons
                  name="send"
                  size={18}
                  color={inputText.trim() ? "#fff" : colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Paywall modal */}
      {showPaywall && (
        <View style={S.paywallOverlay}>
          <BlurView intensity={40} tint={isDarkMode ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />
          <Animated.View
            entering={FadeIn.duration(400)}
            style={[S.paywallCard, { backgroundColor: colors.card, borderColor: borderCol }]}
          >
            <GuruAvatar state="idle" size={80} color={accent} />
            <Text style={[S.paywallTitle, { color: colors.text }]}>{t("paywallTitleSkillGuru", "Continue with SkillGuru?")}</Text>
            <Text style={[S.paywallBody, { color: colors.textSecondary }]}>
              {creditInfo
                ? `You've used your free question for today. You have ${creditInfo.balance} credit${creditInfo.balance === 1 ? "" : "s"} — buy more or upgrade to Premium for unlimited conversations.`
                : t("paywallBody", "You've used your free question for today. Upgrade to Premium for unlimited conversations!")}
            </Text>
            <TouchableOpacity
              style={S.paywallPrimary}
              onPress={() => {
                setShowPaywall(false);
                router.push((creditInfo ? "/ai-guru/credits" : "/ai-guru/subscription") as any);
              }}
            >
              <LinearGradient colors={[accent, accentDark]} style={S.paywallGradient}>
                <Ionicons name={creditInfo ? "flash" : "sparkles"} size={16} color="#fff" />
                <Text style={S.paywallPrimaryText}>{creditInfo ? "Buy Credits" : t("upgradeToPremium", "Upgrade to Premium")}</Text>
              </LinearGradient>
            </TouchableOpacity>
            {creditInfo && (
              <TouchableOpacity onPress={() => { setShowPaywall(false); router.push("/ai-guru/subscription" as any); }}>
                <Text style={[S.paywallBody, { color: "#a5b4fc", fontSize: 12 }]}>
                  Or upgrade to Premium for unlimited access
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={S.paywallClose} onPress={() => setShowPaywall(false)}>
              <Text style={[S.paywallCloseText, { color: colors.textSecondary }]}>{t("maybeLater", "Maybe Later")}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
    </LinearGradient>
  );
}

const S = StyleSheet.create({
  bg:                 { flex: 1 },
  premiumBadge:       { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(251,191,36,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: "#fbbf24" },
  premiumText:        { color: "#fbbf24", fontSize: 11, fontWeight: "900" },

  categoryScroll:     { flexGrow: 0, marginBottom: 4 },
  categoryRow:        { paddingHorizontal: 16, gap: 6, paddingBottom: 8 },
  categoryChip:       { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  categoryEmoji:      { fontSize: 13 },
  categoryLabel:      { fontSize: 12, fontWeight: "700" },

  avatarSection:      { alignItems: "center", paddingVertical: 8, gap: 6 },
  stateLabel:         { fontSize: 12, fontWeight: "600" },

  messageList:        { paddingHorizontal: 8, paddingBottom: 16, paddingTop: 4 },

  inputBar:           { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 8 },
  langRow:            { flexDirection: "row", marginBottom: 8 },
  langBadge:          { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  langBadgeText:      { fontSize: 11, fontWeight: "600" },

  inputRow:           { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  waveformContainer:  { flex: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", justifyContent: "center" },
  textInput:          { flex: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100, borderWidth: 1 },
  micBtn:             { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  micBtnActive:       { borderColor: "#ef4444", backgroundColor: "#450a0a" },
  sendBtn:            { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },

  paywallOverlay:     { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", padding: 24 },
  paywallCard:        { borderRadius: 24, padding: 28, alignItems: "center", gap: 16, width: "100%", borderWidth: 1 },
  paywallTitle:       { fontSize: 20, fontWeight: "900", textAlign: "center" },
  paywallBody:        { fontSize: 14, textAlign: "center", lineHeight: 22 },
  paywallPrimary:     { width: "100%", borderRadius: 16, overflow: "hidden" },
  paywallGradient:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 24 },
  paywallPrimaryText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  paywallClose:       { paddingVertical: 8 },
  paywallCloseText:   { fontSize: 14 },
});

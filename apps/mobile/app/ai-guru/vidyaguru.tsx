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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChatBubble from "@/components/vidyaguru/ChatBubble";
import GuruAvatar from "@/components/vidyaguru/GuruAvatar";
import VoiceWaveform from "@/components/vidyaguru/VoiceWaveform";
import { useAppTranslation, useLanguage } from "@/context/LanguageContext";
import { useStudentProfile } from "@gloows/shared-logic";
import { useTheme } from "@/context/ThemeContext";
import type { GuruMessage, GuruState } from "@/lib/vidyaguru/types";
import { askVidyaGuru, playGuruAudio } from "@/services/vidyaguruApi";

// FEATURE (distinct identity from other AI Guru screens): VidyaGuru's own
// color identity — emerald + gold, not the indigo (#6366f1/#0a0a1a) every
// other AI Guru screen (ask, dashboard, exam-simulator, photo-solve,
// voice-tutor, the index) already uses. Chosen over the app's default
// blue accent (colors.accent) specifically so this screen reads as its
// own thing, not screen #6 in the same palette. Used here and in
// GuruAvatar / ChatBubble / VoiceWaveform (all re-skinned to match).
const EMERALD       = "#10b981";
const EMERALD_DARK   = "#0f6e56";
const GOLD          = "#d4a017";

// FEATURE (starter prompts): this screen previously had a single static
// greeting bubble and nothing else — no tappable conversation starters,
// unlike ask.tsx's rich empty state. Worded as genuine doubts a student
// brings to a 1-on-1 tutor (confusion, exam nervousness, "explain it
// simpler"), not factual lookups — that tone belongs to ask.tsx's search
// experience, not here. Index 0-1 stay subject-neutral since they don't
// know the student's board/class yet at render time for every case.
const STARTER_PROMPTS = [
  "I don't understand this topic at all, can you explain it simply?",
  "I'm nervous about my exam next week, what should I do?",
  "Can you explain this like I'm in Class 6, step by step?",
  "Give me 3 tricks to remember this chapter easily",
  "I keep making the same mistake in my homework, help me fix it",
  "Quiz me on what I studied today",
];

export default function VidyaGuruScreen() {
  const { colors, isDarkMode } = useTheme();
  const { t } = useAppTranslation();
  const { languageName } = useLanguage();
  const insets = useSafeAreaInsets();
  const { studentProfile } = useStudentProfile();
  const studentName = studentProfile?.name?.split(" ")[0] ?? "Student";
  const classLevel = studentProfile?.class ?? "8";
  const board = studentProfile?.board as string | undefined;

  const [messages, setMessages] = useState<GuruMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [guruState, setGuruState] = useState<GuruState>("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  // Set only on a CREDITS_EXHAUSTED response — undefined keeps the
  // paywall's plain pre-credits copy/CTA.
  const [creditInfo, setCreditInfo] = useState<{ balance: number; required: number } | undefined>(undefined);
  const flatListRef = useRef<FlatList>(null);
  const currentPlayerRef = useRef<any>(null);
  // Keep messages in a ref so sendMessage callback never goes stale
  const messagesRef = useRef<GuruMessage[]>([]);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Show greeting on mount — greeting updates when language changes.
  // FEATURE: greeting now references the student's class (and board, when
  // known) instead of a generic "ask me anything" line — makes the first
  // message feel like it's actually addressed to *this* student, not a
  // copy-pasted intro every AI screen could show.
  useEffect(() => {
    const greetingBody = board
      ? t(
          "vidyaGuruGreetingWithBoard",
          `I'm VidyaGuru, your personal AI teacher for Class ${classLevel} (${board}). Ask me anything — doubts, homework help, exam tips, or just a friendly chat about what you're learning. I can answer in ${languageName} too!`,
          { classLevel, board, language: languageName }
        )
      : t(
          "vidyaGuruGreetingNoBoard",
          `I'm VidyaGuru, your personal AI teacher for Class ${classLevel}. Ask me anything — doubts, homework help, exam tips, or just a friendly chat about what you're learning. I can answer in ${languageName} too!`,
          { classLevel, language: languageName }
        );

    const greetMsg: GuruMessage = {
      id: "greeting",
      role: "guru",
      text: `${t("helloGreet", "Hello")} ${studentName}! ${greetingBody}`,
      createdAt: Date.now(),
    };
    setMessages([greetMsg]);
    messagesRef.current = [greetMsg];
  }, [languageName, classLevel, board]);

  const sendMessage = useCallback(
    async (text: string, audioBase64?: string, audioMimeType?: string) => {
      if (!text.trim() && !audioBase64) return;

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

      try {
        const resp = await askVidyaGuru({
          message: text.trim() || undefined,
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
    [studentName, classLevel]
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
        console.warn("[VidyaGuru] failed to reset audio mode after recording:", e);
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

  // Theme-aware colors — emerald/gold instead of the indigo every other
  // AI Guru screen uses (see EMERALD/GOLD constants above for why).
  const bgGradient: [string, string] = isDarkMode
    ? ["#06140f", "#0a1f17"]
    : ["#f0fbf6", "#e3f5ec"];
  const surfaceBg  = isDarkMode ? "#0f3d2e" : colors.card;
  const borderCol  = isDarkMode ? EMERALD_DARK : colors.border;
  const inputColor = isDarkMode ? "#f1f5f9" : colors.text;
  const placeholderColor = isDarkMode ? "#5a8b78" : "#9ca3af";

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
        {/* Header — respects status bar via paddingTop */}
        <View style={[S.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[S.backBtn, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : colors.card }]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={S.headerCenter}>
            <Text style={[S.headerTitle, { color: colors.text }]}>{t("vidyaGuruAI", "VidyaGuru AI")}</Text>
            <Text style={[S.headerSub, { color: colors.textSecondary }]}>{t("personalAiTeacher", "Your personal AI teacher")}</Text>
          </View>
          <View style={S.premiumBadge}>
            <Ionicons name="sparkles" size={12} color="#fbbf24" />
            <Text style={S.premiumText}>AI</Text>
          </View>
        </View>

        {/* Avatar */}
        <Animated.View entering={FadeIn.duration(600)} style={S.avatarSection}>
          <GuruAvatar state={guruState} size={100} />
          <Text style={[S.stateLabel, { color: colors.textSecondary }]}>{stateText}</Text>
        </Animated.View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <ChatBubble message={item} onReplayAudio={handleReplayAudio} isDarkMode={isDarkMode} />
          )}
          // FEATURE: starter prompts shown right after the greeting, while
          // the conversation is still just that one message — this screen
          // previously had nothing tappable before the first real message,
          // unlike ask.tsx's rich empty state. Hidden once a real exchange
          // starts so it doesn't clutter an ongoing conversation.
          ListFooterComponent={
            messages.length <= 1 ? (
              <View style={S.starterWrap}>
                <Text style={[S.starterLabel, { color: colors.textSecondary }]}>
                  {t("tryAskingVidyaGuru", "OR TRY ASKING")}
                </Text>
                {STARTER_PROMPTS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[S.starterChip, { backgroundColor: surfaceBg, borderColor: borderCol }]}
                    onPress={() => sendMessage(p)}
                    activeOpacity={0.75}
                  >
                    <Text style={[S.starterChipText, { color: colors.text }]} numberOfLines={2}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null
          }
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
              backgroundColor: isDarkMode ? "#0a1f17" : colors.background,
              paddingBottom: insets.bottom + 8,
            },
          ]}
        >
          {/* Selected language badge — gold-themed (VidyaGuru's highlight
              color, distinct from the emerald primary actions), and now
              tappable: jumps straight to language settings, since
              "preferred language" matters enough here that a student
              should be able to act on it without leaving the chat to dig
              through Settings manually. */}
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
                placeholder={t("askSomethingPlaceholder", "Ask something...")}
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
                style={[S.sendBtn, !inputText.trim() && { backgroundColor: surfaceBg }]}
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
            <GuruAvatar state="idle" size={80} />
            <Text style={[S.paywallTitle, { color: colors.text }]}>{t("paywallTitle", "Continue with VidyaGuru?")}</Text>
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
              <LinearGradient colors={[EMERALD, EMERALD_DARK]} style={S.paywallGradient}>
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
  header:             { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  backBtn:            { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  headerCenter:       { flex: 1 },
  headerTitle:        { fontSize: 18, fontWeight: "900" },
  headerSub:          { fontSize: 12 },
  premiumBadge:       { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(251,191,36,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: "#fbbf24" },
  premiumText:        { color: "#fbbf24", fontSize: 11, fontWeight: "900" },

  avatarSection:      { alignItems: "center", paddingVertical: 8, gap: 6 },
  stateLabel:         { fontSize: 12, fontWeight: "600" },

  messageList:        { paddingHorizontal: 8, paddingBottom: 16, paddingTop: 4 },

  starterWrap:        { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  starterLabel:       { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },
  starterChip:        { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11 },
  starterChipText:    { fontSize: 13, lineHeight: 18 },

  inputBar:           { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 8 },
  langRow:            { flexDirection: "row", marginBottom: 8 },
  langBadge:          { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  langBadgeText:      { fontSize: 11, fontWeight: "600" },

  inputRow:           { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  waveformContainer:  { flex: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", justifyContent: "center" },
  textInput:          { flex: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100, borderWidth: 1 },
  micBtn:             { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  micBtnActive:       { borderColor: "#ef4444", backgroundColor: "#450a0a" },
  sendBtn:            { width: 44, height: 44, borderRadius: 22, backgroundColor: EMERALD, justifyContent: "center", alignItems: "center" },

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
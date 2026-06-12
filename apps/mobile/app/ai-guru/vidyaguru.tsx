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
import { useStudentProfile } from "@/context/StudentProfileContext";
import { useTheme } from "@/context/ThemeContext";
import type { GuruMessage, GuruState } from "@/lib/vidyaguru/types";
import { askVidyaGuru, playGuruAudio } from "@/services/vidyaguruApi";

const GREETING =
  "Namaste! I am VidyaGuru AI — your personal AI teacher. Ask me anything about your studies — maths, science, history, anything! I'm here to help you learn and grow.";

export default function VidyaGuruScreen() {
  const { colors, isDarkMode } = useTheme();
  const { t } = useAppTranslation();
  const { languageName } = useLanguage();
  const insets = useSafeAreaInsets();
  const { studentProfile } = useStudentProfile();
  const studentName = studentProfile?.name?.split(" ")[0] ?? "Student";
  const classLevel = studentProfile?.class ?? "8";

  const [messages, setMessages] = useState<GuruMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [guruState, setGuruState] = useState<GuruState>("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const currentPlayerRef = useRef<any>(null);
  // Keep messages in a ref so sendMessage callback never goes stale
  const messagesRef = useRef<GuruMessage[]>([]);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Show greeting on mount — greeting updates when language changes
  useEffect(() => {
    const greetMsg: GuruMessage = {
      id: "greeting",
      role: "guru",
      text: `${t("helloGreet") ?? "Hello"} ${studentName}! ${GREETING}`,
      createdAt: Date.now(),
    };
    setMessages([greetMsg]);
    messagesRef.current = [greetMsg];
  }, [languageName]);

  const sendMessage = useCallback(
    async (text: string, audioBase64?: string, audioMimeType?: string) => {
      if (!text.trim() && !audioBase64) return;

      const studentMsg: GuruMessage = {
        id: `s_${Date.now()}`,
        role: "student",
        text: audioBase64 ? (t("voiceMessage") ?? "🎤 Voice message") : text.trim(),
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
        if (err?.code === "FREE_LIMIT_REACHED") {
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

  // Theme-aware colors
  const bgGradient: [string, string] = isDarkMode
    ? ["#0a0a1a", "#0f172a"]
    : ["#f0f4ff", "#e8eeff"];
  const surfaceBg  = isDarkMode ? "#1e293b" : colors.card;
  const borderCol  = isDarkMode ? "#334155" : colors.border;
  const inputColor = isDarkMode ? "#f1f5f9" : colors.text;
  const placeholderColor = isDarkMode ? "#475569" : "#9ca3af";

  const stateText =
    guruState === "thinking"  ? t("thinking")   :
    guruState === "speaking"  ? t("speaking")   :
    guruState === "listening" ? t("listening")  : t("readyToHelp");

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
            <Text style={[S.headerTitle, { color: colors.text }]}>{t("vidyaGuruAI")}</Text>
            <Text style={[S.headerSub, { color: colors.textSecondary }]}>{t("personalAiTeacher")}</Text>
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
              backgroundColor: isDarkMode ? "#0f172a" : colors.background,
              paddingBottom: insets.bottom + 8,
            },
          ]}
        >
          {/* Selected language badge */}
          <View style={S.langRow}>
            <View style={[S.langBadge, { backgroundColor: isDarkMode ? "rgba(99,102,241,0.15)" : "#ede9fe", borderColor: "#6366f1" }]}>
              <Ionicons name="globe-outline" size={12} color="#6366f1" />
              <Text style={[S.langBadgeText, { color: "#6366f1" }]}>
                {t("respondingIn", { lang: languageName }) ?? `Responding in ${languageName}`}
              </Text>
            </View>
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
                placeholder={t("askSomethingPlaceholder") ?? `Ask something...`}
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
            <Text style={[S.paywallTitle, { color: colors.text }]}>{t("paywallTitle")}</Text>
            <Text style={[S.paywallBody, { color: colors.textSecondary }]}>{t("paywallBody")}</Text>
            <TouchableOpacity
              style={S.paywallPrimary}
              onPress={() => {
                setShowPaywall(false);
                router.push("/ai-guru/subscription" as any);
              }}
            >
              <LinearGradient colors={["#6366f1", "#4f46e5"]} style={S.paywallGradient}>
                <Ionicons name="sparkles" size={16} color="#fff" />
                <Text style={S.paywallPrimaryText}>{t("upgradeToPremium")}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={S.paywallClose} onPress={() => setShowPaywall(false)}>
              <Text style={[S.paywallCloseText, { color: colors.textSecondary }]}>{t("maybeLater")}</Text>
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

  inputBar:           { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 8 },
  langRow:            { flexDirection: "row", marginBottom: 8 },
  langBadge:          { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  langBadgeText:      { fontSize: 11, fontWeight: "600" },

  inputRow:           { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  waveformContainer:  { flex: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", justifyContent: "center" },
  textInput:          { flex: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100, borderWidth: 1 },
  micBtn:             { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  micBtnActive:       { borderColor: "#ef4444", backgroundColor: "#450a0a" },
  sendBtn:            { width: 44, height: 44, borderRadius: 22, backgroundColor: "#6366f1", justifyContent: "center", alignItems: "center" },

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
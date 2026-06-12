// PATH: app/restart-education/ai-advisor.tsx
// Fixed: calls restartEducationAdvisor Cloud Function (Gemini-backed)
// instead of direct Anthropic API fetch which doesn't work from mobile.

import { auth, db, functions } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { SafeAreaView } from "react-native-safe-area-context";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import LeadCaptureModal from "@/components/restart/LeadCaptureModal";

interface Message {
  role:      "user" | "assistant";
  content:   string;
  timestamp: number;
}

// Cloud Function callable
const advisorCF = httpsCallable<
  { message: string },
  { reply: string }
>(functions, "restartEducationAdvisor");

const PREDEFINED_OPTIONS = [
  { emoji: "❌", text: "I failed Class 10" },
  { emoji: "❌", text: "I failed Class 12" },
  { emoji: "💸", text: "I left school due to financial problems" },
  { emoji: "👷", text: "I am working and want to study" },
  { emoji: "📖", text: "Tell me about Open Schooling" },
  { emoji: "🎓", text: "Tell me about Distance Learning" },
  { emoji: "🛠️", text: "Tell me about Vocational Education" },
  { emoji: "💡", text: "What are my options at my age?" },
  { emoji: "💬", text: "Other" },
];

const WELCOME_MESSAGE: Message = {
  role:      "assistant",
  content:   "Hello! I'm your Education Advisor. 🎓\n\nI'm here to help you find the best way to continue your education. There's no judgment here — just guidance.\n\nWhat brings you here today? You can choose one of the options below or type your own question.",
  timestamp: Date.now(),
};

export default function AiAdvisor() {
  const router  = useRouter();
  const listRef = useRef<FlatList>(null);

  const [messages,     setMessages]     = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputText,    setInputText]    = useState("");
  const [loading,      setLoading]      = useState(false);
  const [showLead,     setShowLead]     = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [showOptions,  setShowOptions]  = useState(true);
  const [initLoading,  setInitLoading]  = useState(true);

  const uid = auth.currentUser?.uid;

  // Load existing chat on mount
  useEffect(() => {
    if (!uid) { setInitLoading(false); return; }

    getDoc(doc(db, "restartEducationChats", uid))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const msgs = (data.messages ?? []) as Message[];
          if (msgs.length > 0) {
            setMessages(msgs);
            setShowOptions(false);
          }
          setMessageCount(data.messageCount ?? 0);
          setLeadCaptured(data.leadCaptured ?? false);
        }
      })
      .catch(() => {/* ignore, show welcome */})
      .finally(() => setInitLoading(false));
  }, [uid]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      role:      "user",
      content:   text.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setShowOptions(false);
    setLoading(true);

    try {
      const result = await advisorCF({ message: text.trim() });
      const reply  = result.data.reply;

      const assistantMsg: Message = {
        role:      "assistant",
        content:   reply,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      const newCount = messageCount + 1;
      setMessageCount(newCount);

      // Show lead capture after 3 user messages
      if (newCount >= 3 && !leadCaptured) {
        setTimeout(() => setShowLead(true), 1200);
      }

    } catch (e: any) {
      const errorMsg: Message = {
        role:      "assistant",
        content:   e?.message?.includes("Could not get a response")
          ? "I'm having trouble right now. Please check your connection and try again."
          : "Something went wrong. Please try again in a moment.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 300);
    }
  };

  const handleLeadCaptured = async () => {
    setLeadCaptured(true);
    setShowLead(false);
    if (uid) {
      updateDoc(doc(db, "restartEducationChats", uid), {
        leadCaptured: true,
      }).catch(() => {});
    }
  };

  if (initLoading) {
    return (
      <LinearGradient colors={["#0a0a1a", "#1a1040"]} style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#7c3aed" size="large" />
      </LinearGradient>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient colors={["#0a0a1a", "#1a1040"]} style={S.container}>

        {/* Header */}
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={S.headerInfo}>
            <Text style={S.headerTitle}>🤖 AI Education Advisor</Text>
            <Text style={S.headerSub}>Free · Confidential · Helpful</Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          {/* Messages */}
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={S.messagesList}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: false })
            }
            renderItem={({ item }) => (
              <View style={[
                S.bubble,
                item.role === "user" ? S.bubbleUser : S.bubbleBot,
              ]}>
                {item.role === "assistant" && (
                  <View style={S.botAvatar}>
                    <Text style={{ fontSize: 14 }}>🤖</Text>
                  </View>
                )}
                <View style={[
                  S.bubbleContent,
                  item.role === "user"
                    ? S.bubbleContentUser
                    : S.bubbleContentBot,
                ]}>
                  <Text style={[
                    S.bubbleText,
                    item.role === "user" && S.bubbleTextUser,
                  ]}>
                    {item.content}
                  </Text>
                </View>
              </View>
            )}
            ListFooterComponent={
              loading ? (
                <View style={[S.bubble, S.bubbleBot]}>
                  <View style={S.botAvatar}>
                    <Text style={{ fontSize: 14 }}>🤖</Text>
                  </View>
                  <View style={[S.bubbleContent, S.bubbleContentBot]}>
                    <View style={S.typingRow}>
                      <ActivityIndicator size="small" color="#7c3aed" />
                      <Text style={S.typingText}>Thinking…</Text>
                    </View>
                  </View>
                </View>
              ) : null
            }
          />

          {/* Predefined option chips */}
          {showOptions && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={S.optionChips}
              style={S.optionChipsScroll}
            >
              {PREDEFINED_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.text}
                  style={S.optionChip}
                  onPress={() => sendMessage(opt.text)}
                >
                  <Text style={S.optionChipEmoji}>{opt.emoji}</Text>
                  <Text style={S.optionChipText}>{opt.text}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Lead capture nudge */}
          {messageCount >= 3 && !leadCaptured && !showLead && (
            <TouchableOpacity
              style={S.guidanceNudge}
              onPress={() => setShowLead(true)}
            >
              <Text style={S.guidanceNudgeEmoji}>🤝</Text>
              <View style={{ flex: 1 }}>
                <Text style={S.guidanceNudgeTitle}>Get Free Personal Guidance</Text>
                <Text style={S.guidanceNudgeSub}>Our team will personally help you</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#4ade80" />
            </TouchableOpacity>
          )}

          {/* Input bar */}
          <View style={S.inputBar}>
            <TextInput
              style={S.textInput}
              placeholder="Type your question..."
              placeholderTextColor="#6b7280"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={() => sendMessage(inputText)}
            />
            <TouchableOpacity
              style={[
                S.sendBtn,
                (!inputText.trim() || loading) && S.sendBtnDisabled,
              ]}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim() || loading}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        <LeadCaptureModal
          visible={showLead}
          onClose={() => setShowLead(false)}
          onSubmitted={handleLeadCaptured}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container:   { flex: 1 },
  header:      {
    flexDirection: "row", alignItems: "center", padding: 16, gap: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)",
  },
  backBtn:     {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  headerInfo:  { flex: 1 },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  headerSub:   { color: "rgba(255,255,255,0.4)", fontSize: 11 },

  messagesList: { padding: 16, paddingBottom: 8, gap: 12 },

  bubble:            { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  bubbleUser:        { flexDirection: "row-reverse" },
  bubbleBot:         { flexDirection: "row" },
  botAvatar:         {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(124,58,237,0.2)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  bubbleContent:     { maxWidth: "78%", borderRadius: 18, padding: 12 },
  bubbleContentUser: { backgroundColor: "#4338ca", borderBottomRightRadius: 4 },
  bubbleContentBot:  {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderBottomLeftRadius: 4,
  },
  bubbleText:        { color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 21 },
  bubbleTextUser:    { color: "#fff" },

  typingRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  typingText:   { color: "rgba(255,255,255,0.4)", fontSize: 12 },

  optionChipsScroll: {
    maxHeight: 110,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  optionChips: { padding: 12, gap: 8, flexDirection: "row" },
  optionChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  optionChipEmoji: { fontSize: 14 },
  optionChipText:  {
    color: "rgba(255,255,255,0.8)", fontSize: 12,
    fontWeight: "600", maxWidth: 160,
  },

  guidanceNudge: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(22,163,74,0.15)",
    borderTopWidth: 1, borderTopColor: "rgba(22,163,74,0.3)",
    padding: 14, margin: 12, borderRadius: 14,
  },
  guidanceNudgeEmoji: { fontSize: 22 },
  guidanceNudgeTitle: { color: "#4ade80", fontSize: 13, fontWeight: "700" },
  guidanceNudgeSub:   { color: "rgba(255,255,255,0.5)", fontSize: 11 },

  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 8,
    padding: 12,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)",
  },
  textInput: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    color: "#fff", fontSize: 14, maxHeight: 100,
  },
  sendBtn:         {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#7c3aed",
    alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "rgba(124,58,237,0.3)" },
});

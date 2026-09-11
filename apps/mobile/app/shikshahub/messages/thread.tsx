// PATH: apps/mobile/app/shikshahub/messages/thread.tsx
// ShikshaHub messaging phase — one conversation thread. Mirrors
// apps/web/src/app/(app)/shikshahub/messages/thread/page.tsx.
// conversationId is computed client-side via conversationIdFor (mirrors
// the server's own deterministic formula) — no conversation doc may
// exist yet if this is the first message, useConversationMessages just
// renders empty until sendTutorMessageCall creates it.

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useAppTranslation } from "@/context/LanguageContext";
import { useStudentProfile, useConversationMessages } from "@gloows/shared-logic";
import {
  conversationIdFor, fetchTutorById, markConversationReadCall, sendTutorMessageCall,
  type MarketplaceTutor,
} from "@/lib/shikshahub";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ShikshaHubThreadScreen() {
  const { peer } = useLocalSearchParams<{ peer: string }>();
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const { user } = useStudentProfile();

  const [tutor, setTutor] = useState<MarketplaceTutor | null>(null);
  const [tutorLoading, setTutorLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<FlatList>(null);

  const conversationId = user?.uid && peer ? conversationIdFor(user.uid, peer) : null;
  const { messages, loading: messagesLoading } = useConversationMessages(conversationId);

  useEffect(() => {
    if (!peer) return;
    fetchTutorById(peer).then(setTutor).finally(() => setTutorLoading(false));
  }, [peer]);

  useEffect(() => {
    if (conversationId && !messagesLoading && messages.length > 0) {
      markConversationReadCall(conversationId).catch(() => {});
    }
  }, [conversationId, messagesLoading, messages.length]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || !peer) return;
    setSending(true);
    setError("");
    try {
      await sendTutorMessageCall(peer, trimmed);
      setText("");
    } catch (e: any) {
      setError(e?.message ?? "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  if (!peer) {
    return (
      <SafeAreaView style={[S.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Invalid conversation.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[S.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {tutorLoading ? "…" : (tutor?.name || "Tutor")}
        </Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        {messagesLoading ? (
          <View style={S.center}>
            <ActivityIndicator color="#14b8a6" />
          </View>
        ) : messages.length === 0 ? (
          <View style={S.center}>
            <Text style={[S.emptyText, { color: colors.textSecondary }]}>
              {t("shikshaHubMessageStartHint") ?? "Send a message to start the conversation."}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id!}
            contentContainerStyle={S.list}
            renderItem={({ item }) => {
              const mine = item.senderRole === "student";
              return (
                <View style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
                  <View style={[S.bubble, mine ? S.bubbleMine : [S.bubbleTheirs, { borderColor: colors.border, backgroundColor: colors.card }]]}>
                    <Text style={{ color: mine ? "#fff" : colors.text, fontSize: 13, lineHeight: 18 }}>{item.text}</Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        <View style={[S.composer, { borderTopColor: colors.border }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t("shikshaHubMessagePlaceholder") ?? "Write a message…"}
            placeholderTextColor={colors.textSecondary}
            maxLength={2000}
            style={[S.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
          />
          <TouchableOpacity
            onPress={send}
            disabled={sending || !text.trim()}
            style={[S.sendBtn, (sending || !text.trim()) && { opacity: 0.5 }]}
          >
            <Text style={S.sendBtnText}>{t("shikshaHubMessageSend") ?? "Send"}</Text>
          </TouchableOpacity>
        </View>
        {!!error && <Text style={S.errorText}>{error}</Text>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "900", flexShrink: 1 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 60 },
  emptyText: { fontSize: 12.5, fontWeight: "600", textAlign: "center", paddingHorizontal: 30 },

  list: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  bubble: { maxWidth: "78%", borderRadius: 16, paddingVertical: 9, paddingHorizontal: 13 },
  bubbleMine: { backgroundColor: "#0d9488" },
  bubbleTheirs: { borderWidth: 1 },

  composer: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, alignItems: "center" },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 13 },
  sendBtn: { backgroundColor: "#0d9488", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 11 },
  sendBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  errorText: { fontSize: 11.5, fontWeight: "600", color: "#ef4444", paddingHorizontal: 16, paddingBottom: 8 },
});

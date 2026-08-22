// apps/tutor-mobile/app/(app)/messages/thread.tsx
// RN mirror of apps/tutor's (app)/messages/thread/page.tsx — see its
// header comment. This screen never creates a conversation, only replies
// inside one that already exists (a student's first message is the only
// thing that ever creates it — see functions/src/tutorMessaging.ts).

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { useConversationMessages, useTutorProfile } from "@gloows/shared-logic";
import { router, useLocalSearchParams } from "expo-router";
import {
  FlatList, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, semantic, spacing } from "@gloows/tutor-ui";
import { LoadingState } from "@/components/ui";

const sendTutorMessageCall = httpsCallable<{ peerUid: string; text: string }, { conversationId: string; messageId: string }>(
  functions, "sendTutorMessage"
);
const markConversationReadCall = httpsCallable<{ conversationId: string }, { conversationId: string }>(
  functions, "markConversationRead"
);

function conversationIdFor(studentUid: string, tutorUid: string): string {
  return `${studentUid}_${tutorUid}`;
}

export default function MessagesThreadScreen() {
  const { peer } = useLocalSearchParams<{ peer: string }>();
  const { t } = useTranslation();
  const { user } = useTutorProfile();

  const [studentName, setStudentName] = useState("");
  const [nameLoading, setNameLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<FlatList>(null);

  const conversationId = user?.uid && peer ? conversationIdFor(peer, user.uid) : null;
  const { messages, loading: messagesLoading } = useConversationMessages(conversationId);

  useEffect(() => {
    if (!conversationId) return;
    getDoc(doc(db, "tutorConversations", conversationId))
      .then((snap) => setStudentName((snap.data()?.studentName as string | undefined) || "Student"))
      .catch(() => setStudentName("Student"))
      .finally(() => setNameLoading(false));
  }, [conversationId]);

  useEffect(() => {
    if (conversationId && !messagesLoading && messages.length > 0) {
      markConversationReadCall({ conversationId }).catch(() => {});
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
      await sendTutorMessageCall({ peerUid: peer, text: trimmed });
      setText("");
    } catch (e: any) {
      setError(e?.message ?? "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  if (!peer) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: semantic.textMuted }}>Invalid conversation.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 20, color: semantic.textPrimary }}>←</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: "900", color: semantic.textPrimary, flexShrink: 1 }} numberOfLines={1}>
          {nameLoading ? "…" : studentName}
        </Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        {messagesLoading ? (
          <LoadingState />
        ) : messages.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl }}>
            <Text style={{ color: semantic.textMuted, fontSize: 12.5, fontWeight: "600", textAlign: "center" }}>
              {t("noMessagesInThreadHint")}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id!}
            contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm }}
            renderItem={({ item }) => {
              const mine = item.senderRole === "tutor";
              return (
                <View style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
                  <View style={{
                    maxWidth: "78%", borderRadius: 16, paddingVertical: 9, paddingHorizontal: 13,
                    backgroundColor: mine ? semantic.primary : semantic.surface,
                    borderWidth: mine ? 0 : 1, borderColor: colors.slate[700],
                  }}>
                    <Text style={{ color: mine ? "#fff" : semantic.textPrimary, fontSize: 13, lineHeight: 18 }}>{item.text}</Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        <View style={{ flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.slate[700], alignItems: "center" }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t("messagePlaceholder") ?? ""}
            placeholderTextColor={colors.slate[500]}
            maxLength={2000}
            style={{
              flex: 1, borderWidth: 1, borderColor: colors.slate[700], borderRadius: 20,
              paddingHorizontal: 16, paddingVertical: 10, fontSize: 13, color: semantic.textPrimary, backgroundColor: semantic.surface,
            }}
          />
          <TouchableOpacity
            onPress={send}
            disabled={sending || !text.trim()}
            style={{ backgroundColor: semantic.primary, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 11, opacity: (sending || !text.trim()) ? 0.5 : 1 }}
          >
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>{t("sendMessage")}</Text>
          </TouchableOpacity>
        </View>
        {!!error && (
          <Text style={{ fontSize: 11.5, fontWeight: "600", color: semantic.danger ?? "#ef4444", paddingHorizontal: spacing.xl, paddingBottom: spacing.sm }}>
            {error}
          </Text>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

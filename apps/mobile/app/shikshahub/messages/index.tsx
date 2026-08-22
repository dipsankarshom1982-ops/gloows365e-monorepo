// PATH: apps/mobile/app/shikshahub/messages/index.tsx
// ShikshaHub messaging phase — "My Messages" inbox. Mirrors
// apps/web/src/app/(app)/shikshahub/messages/page.tsx. Every conversation
// the signed-in student has with a tutor (useTutorConversations, scoped
// to role "student"), most-recently-active first. Tapping a row opens
// /shikshahub/messages/thread?peer={tutorUid}.

import { useTheme } from "@/context/ThemeContext";
import { useAppTranslation } from "@/context/LanguageContext";
import { useStudentProfile, useTutorConversations } from "@gloows/shared-logic";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ShikshaHubMessagesScreen() {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const { user } = useStudentProfile();
  const { conversations, loading } = useTutorConversations(user?.uid, "student");

  return (
    <SafeAreaView style={[S.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: colors.text }]}>
          {t("shikshaHubMessagesTitle") ?? "Messages"}
        </Text>
      </View>

      {loading ? (
        <View style={S.center}>
          <ActivityIndicator color="#14b8a6" />
        </View>
      ) : conversations.length === 0 ? (
        <View style={S.center}>
          <Text style={{ fontSize: 40 }}>💬</Text>
          <Text style={[S.emptyText, { color: colors.textSecondary }]}>
            {t("shikshaHubNoMessages") ?? "No conversations yet — message a tutor from their profile."}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={S.list} showsVerticalScrollIndicator={false}>
          {conversations.map((c) => {
            const unread = c.studentUnreadCount ?? 0;
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => router.push({ pathname: "/shikshahub/messages/thread", params: { peer: c.tutorUid } } as any)}
                style={[S.row, { borderColor: colors.border, backgroundColor: colors.card }]}
              >
                <View style={S.avatar}>
                  <Text style={{ fontSize: 20 }}>🧑‍🏫</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Text style={[S.rowName, { color: colors.text }]} numberOfLines={1}>{c.tutorName || "Tutor"}</Text>
                    {unread > 0 && (
                      <View style={S.badge}>
                        <Text style={S.badgeText}>{unread > 9 ? "9+" : unread}</Text>
                      </View>
                    )}
                  </View>
                  {!!c.lastMessageText && (
                    <Text
                      style={[S.rowPreview, { color: unread > 0 ? colors.text : colors.textSecondary, fontWeight: unread > 0 ? "700" : "500" }]}
                      numberOfLines={1}
                    >
                      {c.lastMessageText}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "900" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 60 },
  emptyText: { fontSize: 13, fontWeight: "600", textAlign: "center", paddingHorizontal: 30 },

  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 16, padding: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(20,184,166,0.14)", alignItems: "center", justifyContent: "center" },
  rowName: { fontSize: 13.5, fontWeight: "800" },
  rowPreview: { fontSize: 12, marginTop: 2 },
  badge: { backgroundColor: "#0d9488", borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 10.5, fontWeight: "800" },
});

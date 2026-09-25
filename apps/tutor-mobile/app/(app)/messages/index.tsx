// apps/tutor-mobile/app/(app)/messages/index.tsx
// RN mirror of apps/tutor's (app)/messages/page.tsx — see its header
// comment. A tutor can only ever reply inside a conversation a student
// has already started — no "start a new conversation" action here.

import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { semantic, spacing } from "@gloows/tutor-ui";
import { useTutorConversations, useTutorProfile } from "@gloows/shared-logic";
import { Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

export default function MessagesScreen() {
  const { t } = useTranslation();
  const { user } = useTutorProfile();
  const { conversations, loading } = useTutorConversations(user?.uid, "tutor");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <View style={{ flex: 1, paddingTop: spacing.xl, paddingBottom: 100 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary, paddingHorizontal: spacing.xl, marginBottom: spacing.xl }}>
          {t("myMessagesTitle")}
        </Text>

        {loading ? (
          <LoadingState />
        ) : conversations.length === 0 ? (
          <EmptyState title={t("noMessagesTitle")} subtitle={t("noMessagesSubtitle")} />
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.md }} showsVerticalScrollIndicator={false}>
            {conversations.map((c) => {
              const unread = c.tutorUnreadCount ?? 0;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => router.push({ pathname: "/messages/thread", params: { peer: c.studentUid } } as any)}
                >
                  <Card style={{ marginBottom: spacing.md }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <Text style={{ fontWeight: "700", color: semantic.textPrimary }}>{c.studentName || "Student"}</Text>
                      {unread > 0 && (
                        <View style={{ backgroundColor: "#EF4444", borderRadius: 10, minWidth: 20, paddingHorizontal: 5, paddingVertical: 2, alignItems: "center" }}>
                          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{unread > 9 ? "9+" : unread}</Text>
                        </View>
                      )}
                    </View>
                    {!!c.lastMessageText && (
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 12, color: unread > 0 ? semantic.textPrimary : semantic.textMuted, fontWeight: unread > 0 ? "700" : "500", marginTop: 4 }}
                      >
                        {c.lastMessageText}
                      </Text>
                    )}
                  </Card>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
      <BottomNav />
    </SafeAreaView>
  );
}

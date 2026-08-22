// apps/tutor-mobile/app/(app)/notifications.tsx
// RN mirror of apps/tutor's notifications/page.tsx — see its header
// comment. ShikshaHub notifications phase.

import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import { useTutorProfile, useAppNotifications, type AppNotification } from "@gloows/shared-logic";
import { Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

const TYPE_META: Record<AppNotification["type"], string> = {
  instant_help: "⚡",
  payout: "💸",
  review: "⭐",
  shikshahub: "🎓",
};

function timeAgo(ts: any): string {
  if (!ts?.toDate) return "";
  const diff = Date.now() - ts.toDate().getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { user } = useTutorProfile();
  const { notifications, unreadCount, loading, markRead, markAllRead } = useAppNotifications(user?.uid);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <View style={{ flex: 1, paddingTop: spacing.xl, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl, marginBottom: spacing.xl }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary }}>{t("notificationsTitle", "Notifications")}</Text>
            {unreadCount > 0 && (
              <Text style={{ fontSize: 13, fontWeight: "800", color: semantic.accent }}>({unreadCount})</Text>
            )}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead}>
              <Text style={{ color: semantic.accent, fontSize: 12, fontWeight: "700" }}>{t("markAllRead", "Mark all read")}</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <LoadingState />
        ) : notifications.length === 0 ? (
          <EmptyState
            title={t("noNotificationsTitle", "All caught up!")}
            subtitle={t("noNotificationsSubtitle", "You'll see Instant Help requests, payout updates, and reviews here.")}
          />
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.md }} showsVerticalScrollIndicator={false}>
            {notifications.map((n) => (
              <TouchableOpacity key={n.id} onPress={() => !n.read && markRead(n.id)} disabled={n.read}>
                <Card
                  style={{
                    flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: spacing.md,
                    borderColor: n.read ? undefined : semantic.accent,
                    borderWidth: n.read ? undefined : 1,
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{TYPE_META[n.type] ?? "🔔"}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontSize: 13, flex: 1, color: semantic.textPrimary, fontWeight: n.read ? "600" : "800" }} numberOfLines={1}>
                        {n.title}
                      </Text>
                      {!n.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: semantic.accent }} />}
                    </View>
                    <Text style={{ fontSize: 12, color: semantic.textMuted, marginTop: 2 }} numberOfLines={2}>{n.body}</Text>
                    <Text style={{ fontSize: 11, color: semantic.textMuted, marginTop: 2 }}>{timeAgo(n.createdAt)}</Text>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
      <BottomNav />
    </SafeAreaView>
  );
}

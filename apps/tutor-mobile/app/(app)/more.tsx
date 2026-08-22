// apps/tutor-mobile/app/(app)/more.tsx
// RN mirror of apps/tutor's more/page.tsx — see its header comment.

import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, TouchableOpacity, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import { useTutorProfile, useUnreadNotificationCount } from "@gloows/shared-logic";
import { Card } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

const ITEMS = [
  { href: "/notifications", titleKey: "notificationsTitle", icon: "🔔" },
  { href: "/batches",      titleKey: "batchesTitle",      icon: "📚" },
  { href: "/services",     titleKey: "servicesTitle",     icon: "🧩" },
  { href: "/payouts",      titleKey: "payoutsTitle",      icon: "💸" },
  { href: "/bookings",     titleKey: "shikshaHubBookingRequestsTitle", icon: "🎓" },
  { href: "/profile",      titleKey: "profileTitle",      icon: "👤" },
  { href: "/verification", titleKey: "verificationTitle", icon: "📄" },
] as const;

export default function MoreScreen() {
  const { t } = useTranslation();
  const { user } = useTutorProfile();
  const unreadCount = useUnreadNotificationCount(user?.uid);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <View style={{ flex: 1, padding: spacing.xl, paddingBottom: 100 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary, marginBottom: spacing.xl }}>
          {t("moreTitle")}
        </Text>
        <View style={{ gap: spacing.md }}>
          {ITEMS.map((item) => (
            <TouchableOpacity key={item.href} onPress={() => router.push(item.href)}>
              <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                <Text style={{ fontWeight: "700", color: semantic.textPrimary, fontSize: 15, flex: 1 }}>{t(item.titleKey)}</Text>
                {item.href === "/notifications" && unreadCount > 0 && (
                  <View style={{ backgroundColor: "#EF4444", borderRadius: 10, minWidth: 20, paddingHorizontal: 5, paddingVertical: 2, alignItems: "center" }}>
                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <BottomNav />
    </SafeAreaView>
  );
}

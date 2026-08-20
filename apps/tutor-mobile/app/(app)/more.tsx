// apps/tutor-mobile/app/(app)/more.tsx
// RN mirror of apps/tutor's more/page.tsx — see its header comment.

import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, TouchableOpacity, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import { Card } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

const ITEMS = [
  { href: "/batches",      titleKey: "batchesTitle",      icon: "📚" },
  { href: "/services",     titleKey: "servicesTitle",     icon: "🧩" },
  { href: "/payouts",      titleKey: "payoutsTitle",      icon: "💸" },
  { href: "/bookings",     titleKey: "shikshaHubBookingRequestsTitle", icon: "🎓" },
  { href: "/profile",      titleKey: "profileTitle",      icon: "👤" },
  { href: "/verification", titleKey: "verificationTitle", icon: "📄" },
] as const;

export default function MoreScreen() {
  const { t } = useTranslation();

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
                <Text style={{ fontWeight: "700", color: semantic.textPrimary, fontSize: 15 }}>{t(item.titleKey)}</Text>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <BottomNav />
    </SafeAreaView>
  );
}

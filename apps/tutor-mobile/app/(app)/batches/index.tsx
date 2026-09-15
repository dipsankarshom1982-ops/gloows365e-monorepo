// apps/tutor-mobile/app/(app)/batches/index.tsx
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import { useTutorBatches, useTutorProfile } from "@gloows/shared-logic";
import type { TutorBatch } from "@gloows/shared-logic";
import { Button, Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

export default function BatchesScreen() {
  const { t } = useTranslation();
  const { user } = useTutorProfile();
  const { batches, loading } = useTutorBatches(user?.uid);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <View style={{ flex: 1, padding: spacing.xl, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xl }}>
          <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary }}>{t("batchesTitle")}</Text>
          <View style={{ width: 140 }}>
            <Button title={t("addBatch")} variant="secondary" onPress={() => router.push("/batches/new")} />
          </View>
        </View>

        {loading ? (
          <LoadingState />
        ) : batches.length === 0 ? (
          <EmptyState title={t("noBatchesTitle")} subtitle={t("noBatchesSubtitle")} />
        ) : (
          <FlatList
            data={batches}
            keyExtractor={(b) => b.id!}
            ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
            renderItem={({ item }: { item: TutorBatch }) => (
              <TouchableOpacity onPress={() => router.push(`/batches/${item.id}`)}>
                <Card>
                  <Text style={{ fontWeight: "700", color: semantic.textPrimary }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: semantic.textMuted, marginTop: 4 }}>
                    {[item.class, item.subject, item.board].filter(Boolean).join(" · ") || "—"}
                  </Text>
                  <Text style={{ fontSize: 12, color: semantic.textMuted, marginTop: 2 }}>{item.mode}</Text>
                </Card>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
      <BottomNav />
    </SafeAreaView>
  );
}

// apps/tutor-mobile/app/(app)/classes/index.tsx
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import { useTutorBatches, useTutorClasses, useTutorProfile } from "@gloows/shared-logic";
import type { TutorClass } from "@gloows/shared-logic";
import { Badge, Button, Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "danger"> = {
  Scheduled: "warning",
  Completed: "success",
  Cancelled: "danger",
};

export default function ClassesScreen() {
  const { t } = useTranslation();
  const { user } = useTutorProfile();
  const { classes, loading } = useTutorClasses(user?.uid);
  const { batches } = useTutorBatches(user?.uid);
  const batchName = (id?: string) => batches.find((b) => b.id === id)?.name ?? "—";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <View style={{ flex: 1, padding: spacing.xl, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xl }}>
          <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary }}>{t("classesTitle")}</Text>
          <View style={{ width: 150 }}>
            <Button title={t("addClass")} variant="secondary" onPress={() => router.push("/classes/new")} />
          </View>
        </View>

        {loading ? (
          <LoadingState />
        ) : classes.length === 0 ? (
          <EmptyState title={t("noClassesTitle")} subtitle={t("noClassesSubtitle")} />
        ) : (
          <FlatList
            data={classes}
            keyExtractor={(c) => c.id!}
            ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
            renderItem={({ item }: { item: TutorClass }) => {
              const start = (item.startTime as { toDate?: () => Date } | undefined)?.toDate?.();
              return (
                <TouchableOpacity onPress={() => router.push(`/classes/${item.id}`)}>
                  <Card>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ fontWeight: "700", color: semantic.textPrimary }}>{item.subject || item.topic || "—"}</Text>
                      <Badge label={t(`classStatus${item.status ?? "Scheduled"}`)} tone={STATUS_TONE[item.status ?? "Scheduled"]} />
                    </View>
                    <Text style={{ fontSize: 12, color: semantic.textMuted, marginTop: 4 }}>
                      {start ? start.toLocaleString() : "—"} · {batchName(item.batchId)}
                    </Text>
                  </Card>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
      <BottomNav />
    </SafeAreaView>
  );
}

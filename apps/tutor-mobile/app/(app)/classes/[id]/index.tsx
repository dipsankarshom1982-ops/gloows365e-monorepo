// apps/tutor-mobile/app/(app)/classes/[id]/index.tsx
import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Alert, ScrollView, Text, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import { useTutorBatches, useTutorProfile } from "@gloows/shared-logic";
import type { TutorClass } from "@gloows/shared-logic";
import { db } from "@/lib/firebase";
import { Badge, Button, Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "danger"> = {
  Scheduled: "warning",
  Completed: "success",
  Cancelled: "danger",
};

export default function ClassDetailScreen() {
  const { t } = useTranslation();
  const { user } = useTutorProfile();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [cls, setCls]         = useState<TutorClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const { batches } = useTutorBatches(user?.uid);

  useEffect(() => {
    return onSnapshot(
      doc(db, "tutorClasses", id),
      (snap) => {
        setCls(snap.exists() ? ({ id: snap.id, ...snap.data() } as TutorClass) : null);
        setLoading(false);
      },
      () => { setCls(null); setLoading(false); }
    );
  }, [id]);

  function confirmCancel() {
    Alert.alert(t("cancelClass"), t("cancelClassConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("cancelClass"), style: "destructive", onPress: async () => {
          setCancelling(true);
          try {
            await updateDoc(doc(db, "tutorClasses", id), { status: "Cancelled", updatedAt: serverTimestamp() });
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  }

  if (loading) return <LoadingState />;
  if (!cls) return <EmptyState title={t("classNotFound")} />;

  const start = (cls.startTime as { toDate?: () => Date } | undefined)?.toDate?.();
  const end   = (cls.endTime as { toDate?: () => Date } | undefined)?.toDate?.();
  const batch = batches.find((b) => b.id === cls.batchId);
  const canJoin = !!cls.meetingLink && cls.mode === "Online" && cls.status === "Scheduled";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xl }}>
          <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary, flex: 1 }}>{cls.subject || cls.topic}</Text>
          <Badge label={t(`classStatus${cls.status ?? "Scheduled"}`)} tone={STATUS_TONE[cls.status ?? "Scheduled"]} />
        </View>

        <Card style={{ marginBottom: spacing.md }}>
          <Field label={t("classTopicLabel")} value={cls.topic} />
          <Field label={t("classBatchLabel")} value={batch?.name} />
          <Field label={t("batchModeLabel")} value={cls.mode} />
          <Field label={t("classStartLabel")} value={start ? start.toLocaleString() : undefined} />
          <Field label={t("classEndLabel")} value={end ? end.toLocaleString() : undefined} />
          <Field label={t("classNotesLabel")} value={cls.notes} last />
        </Card>

        {canJoin && (
          <View style={{ marginBottom: spacing.md }}>
            <Button title={t("joinClass")} onPress={() => Linking.openURL(cls.meetingLink!)} />
          </View>
        )}

        <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.md }}>
          {batch && (
            <View style={{ flex: 1 }}>
              <Button title={t("viewBatch")} variant="secondary" onPress={() => router.push(`/batches/${batch.id}`)} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Button title={t("rescheduleClass")} variant="secondary" onPress={() => router.push(`/classes/${id}/edit`)} />
          </View>
        </View>

        {cls.status === "Scheduled" && (
          <Button title={t("cancelClass")} variant="secondary" loading={cancelling} onPress={confirmCancel} />
        )}
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

function Field({ label, value, last }: { label: string; value?: string; last?: boolean }) {
  return (
    <View style={{
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingVertical: 6, borderBottomWidth: last ? 0 : 1, borderBottomColor: semantic.surfaceElevated,
    }}>
      <Text style={{ fontSize: 12, color: semantic.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 14, color: semantic.textPrimary }}>{value || "—"}</Text>
    </View>
  );
}

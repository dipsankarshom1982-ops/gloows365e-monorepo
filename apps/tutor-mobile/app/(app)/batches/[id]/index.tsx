// apps/tutor-mobile/app/(app)/batches/[id]/index.tsx
import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  arrayRemove, collection, doc, getDocs, onSnapshot, query, serverTimestamp,
  where, writeBatch,
} from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import { useBatchStudents, useTutorProfile } from "@gloows/shared-logic";
import type { TutorBatch } from "@gloows/shared-logic";
import { db } from "@/lib/firebase";
import { Button, Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

export default function BatchDetailScreen() {
  const { t } = useTranslation();
  const { user } = useTutorProfile();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [batchDoc, setBatchDoc] = useState<TutorBatch | null>(null);
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState(false);
  const { students } = useBatchStudents(user?.uid, id);

  useEffect(() => {
    return onSnapshot(
      doc(db, "tutorBatches", id),
      (snap) => {
        setBatchDoc(snap.exists() ? ({ id: snap.id, ...snap.data() } as TutorBatch) : null);
        setLoading(false);
      },
      // Built in from the start — see the web detail page's comment.
      () => { setBatchDoc(null); setLoading(false); }
    );
  }, [id]);

  function confirmDelete() {
    Alert.alert(t("deleteBatch"), t("deleteBatchConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("deleteBatch"), style: "destructive", onPress: async () => {
          if (!user) return;
          setDeleting(true);
          try {
            const membersSnap = await getDocs(
              query(
                collection(db, "tutorStudents"),
                where("tutorId", "==", user.uid),
                where("batchIds", "array-contains", id)
              )
            );
            const wb = writeBatch(db);
            membersSnap.docs.forEach((s) => {
              wb.update(s.ref, { batchIds: arrayRemove(id), updatedAt: serverTimestamp() });
            });
            wb.delete(doc(db, "tutorBatches", id));
            await wb.commit();
            router.replace("/batches");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  if (loading) return <LoadingState />;
  if (!batchDoc) return <EmptyState title={t("batchNotFound")} />;

  const start = batchDoc.startDate as { toDate?: () => Date } | undefined;
  const end   = batchDoc.endDate as { toDate?: () => Date } | undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary, marginBottom: spacing.xl }}>
          {batchDoc.name}
        </Text>

        <Card style={{ marginBottom: spacing.md }}>
          <Field label={t("batchClassLabel")} value={batchDoc.class} />
          <Field label={t("batchSubjectLabel")} value={batchDoc.subject} />
          <Field label={t("batchBoardLabel")} value={batchDoc.board} />
          <Field label={t("batchModeLabel")} value={batchDoc.mode} />
          <Field label={t("batchFeeLabel")} value={batchDoc.fee != null ? String(batchDoc.fee) : undefined} />
          <Field label={t("batchStartDateLabel")} value={start?.toDate?.() ? start.toDate!().toLocaleDateString() : undefined} />
          <Field label={t("batchEndDateLabel")} value={end?.toDate?.() ? end.toDate!().toLocaleDateString() : undefined} last />
        </Card>

        <Card style={{ marginBottom: spacing.xl }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: semantic.textMuted }}>{t("studentsInBatchLabel")}</Text>
            <TouchableOpacity onPress={() => router.push(`/batches/${id}/assign`)}>
              <Text style={{ color: semantic.accent, fontSize: 12, fontWeight: "800" }}>{t("assignStudents")}</Text>
            </TouchableOpacity>
          </View>
          {students.length === 0 ? (
            <Text style={{ color: semantic.textMuted, fontSize: 12 }}>—</Text>
          ) : (
            students.map((s) => (
              <TouchableOpacity key={s.id} onPress={() => router.push(`/students/${s.id}`)}>
                <Text style={{ color: semantic.textPrimary, fontSize: 14, paddingVertical: 4 }}>{s.name}</Text>
              </TouchableOpacity>
            ))
          )}
        </Card>

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Button title={t("editBatch")} variant="secondary" onPress={() => router.push(`/batches/${id}/edit`)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={t("deleteBatch")} variant="secondary" loading={deleting} onPress={confirmDelete} />
          </View>
        </View>
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

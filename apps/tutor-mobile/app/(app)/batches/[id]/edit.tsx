// apps/tutor-mobile/app/(app)/batches/[id]/edit.tsx
import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { doc, getDoc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import type { TutorBatch } from "@gloows/shared-logic";
import { db } from "@/lib/firebase";
import { EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";
import BatchForm, { type BatchFormValues } from "@/components/BatchForm";

export default function EditBatchScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [batchDoc, setBatchDoc] = useState<TutorBatch | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    getDoc(doc(db, "tutorBatches", id))
      .then((snap) => {
        setBatchDoc(snap.exists() ? ({ id: snap.id, ...snap.data() } as TutorBatch) : null);
        setLoading(false);
      })
      .catch(() => { setBatchDoc(null); setLoading(false); });
  }, [id]);

  async function handleSubmit(values: BatchFormValues) {
    setSaving(true);
    try {
      await updateDoc(doc(db, "tutorBatches", id), {
        name: values.name.trim(),
        class: values.class.trim(),
        subject: values.subject.trim(),
        board: values.board.trim(),
        mode: values.mode,
        fee: values.fee ? Number(values.fee) : null,
        startDate: values.startDate ? Timestamp.fromDate(new Date(values.startDate)) : null,
        endDate: values.endDate ? Timestamp.fromDate(new Date(values.endDate)) : null,
        updatedAt: serverTimestamp(),
      });
      router.replace(`/batches/${id}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (!batchDoc) return <EmptyState title={t("batchNotFound")} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary, marginBottom: spacing.xl }}>
          {t("editBatch")}
        </Text>
        <BatchForm initial={batchDoc} submitting={saving} onSubmit={handleSubmit} />
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

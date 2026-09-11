// apps/tutor-mobile/app/(app)/classes/[id]/edit.tsx
import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { doc, getDoc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import type { TutorClass } from "@gloows/shared-logic";
import { db } from "@/lib/firebase";
import { EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";
import ClassForm, { type ClassFormValues } from "@/components/ClassForm";

export default function EditClassScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [cls, setCls]         = useState<TutorClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    getDoc(doc(db, "tutorClasses", id))
      .then((snap) => {
        setCls(snap.exists() ? ({ id: snap.id, ...snap.data() } as TutorClass) : null);
        setLoading(false);
      })
      .catch(() => { setCls(null); setLoading(false); });
  }, [id]);

  async function handleSubmit(values: ClassFormValues) {
    setSaving(true);
    try {
      await updateDoc(doc(db, "tutorClasses", id), {
        batchId: values.batchId,
        subject: values.subject.trim(),
        topic: values.topic.trim(),
        mode: values.mode,
        meetingLink: values.meetingLink.trim(),
        startTime: Timestamp.fromDate(new Date(values.startTime.replace(" ", "T"))),
        endTime: values.endTime ? Timestamp.fromDate(new Date(values.endTime.replace(" ", "T"))) : null,
        notes: values.notes.trim(),
        updatedAt: serverTimestamp(),
      });
      router.replace(`/classes/${id}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (!cls) return <EmptyState title={t("classNotFound")} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary, marginBottom: spacing.xl }}>
          {t("editClass")}
        </Text>
        <ClassForm initial={cls} submitting={saving} onSubmit={handleSubmit} />
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

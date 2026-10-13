// apps/tutor-mobile/app/(app)/batches/new.tsx
import { useState } from "react";
import { router } from "expo-router";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import { useTutorProfile } from "@gloows/shared-logic";
import { db } from "@/lib/firebase";
import BottomNav from "@/components/BottomNav";
import BatchForm, { type BatchFormValues } from "@/components/BatchForm";

export default function NewBatchScreen() {
  const { t } = useTranslation();
  const { user } = useTutorProfile();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(values: BatchFormValues) {
    if (!user) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "tutorBatches"), {
        tutorId: user.uid,
        name: values.name.trim(),
        class: values.class.trim(),
        subject: values.subject.trim(),
        board: values.board.trim(),
        mode: values.mode,
        fee: values.fee ? Number(values.fee) : null,
        startDate: values.startDate ? Timestamp.fromDate(new Date(values.startDate)) : null,
        endDate: values.endDate ? Timestamp.fromDate(new Date(values.endDate)) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      router.replace("/batches");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary, marginBottom: spacing.xl }}>
          {t("addBatch")}
        </Text>
        <BatchForm submitting={saving} onSubmit={handleSubmit} />
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

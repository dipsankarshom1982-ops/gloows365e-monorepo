// apps/tutor-mobile/app/(app)/classes/new.tsx
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
import ClassForm, { type ClassFormValues } from "@/components/ClassForm";

export default function NewClassScreen() {
  const { t } = useTranslation();
  const { user } = useTutorProfile();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(values: ClassFormValues) {
    if (!user) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "tutorClasses"), {
        tutorId: user.uid,
        batchId: values.batchId,
        subject: values.subject.trim(),
        topic: values.topic.trim(),
        mode: values.mode,
        meetingLink: values.meetingLink.trim(),
        startTime: Timestamp.fromDate(new Date(values.startTime.replace(" ", "T"))),
        endTime: values.endTime ? Timestamp.fromDate(new Date(values.endTime.replace(" ", "T"))) : null,
        notes: values.notes.trim(),
        status: "Scheduled",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      router.replace("/classes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary, marginBottom: spacing.xl }}>
          {t("addClass")}
        </Text>
        <ClassForm submitting={saving} onSubmit={handleSubmit} />
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

// apps/tutor-mobile/app/(app)/students/new.tsx
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
import StudentForm, { type StudentFormValues } from "@/components/StudentForm";

export default function NewStudentScreen() {
  const { t } = useTranslation();
  const { user } = useTutorProfile();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(values: StudentFormValues) {
    if (!user) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "tutorStudents"), {
        tutorId: user.uid,
        name: values.name.trim(),
        class: values.class.trim(),
        school: values.school.trim(),
        board: values.board.trim(),
        subjects: values.subjects.split(",").map((s) => s.trim()).filter(Boolean),
        joiningDate: values.joiningDate ? Timestamp.fromDate(new Date(values.joiningDate)) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      router.replace("/students");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary, marginBottom: spacing.xl }}>
          {t("addStudent")}
        </Text>
        <StudentForm submitting={saving} onSubmit={handleSubmit} />
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

// apps/tutor-mobile/app/(app)/students/[id]/edit.tsx
import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { doc, getDoc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import type { TutorStudent } from "@gloows/shared-logic";
import { db } from "@/lib/firebase";
import { EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";
import StudentForm, { type StudentFormValues } from "@/components/StudentForm";

export default function EditStudentScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [student, setStudent] = useState<TutorStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    getDoc(doc(db, "tutorStudents", id))
      .then((snap) => {
        setStudent(snap.exists() ? ({ id: snap.id, ...snap.data() } as TutorStudent) : null);
        setLoading(false);
      })
      // Same fix as the web edit page — a missing .catch() here left
      // `loading` stuck true forever on a denied/failed read.
      .catch(() => { setStudent(null); setLoading(false); });
  }, [id]);

  async function handleSubmit(values: StudentFormValues) {
    setSaving(true);
    try {
      await updateDoc(doc(db, "tutorStudents", id), {
        name: values.name.trim(),
        class: values.class.trim(),
        school: values.school.trim(),
        board: values.board.trim(),
        subjects: values.subjects.split(",").map((s) => s.trim()).filter(Boolean),
        joiningDate: values.joiningDate ? Timestamp.fromDate(new Date(values.joiningDate)) : null,
        updatedAt: serverTimestamp(),
      });
      router.replace(`/students/${id}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (!student) return <EmptyState title={t("studentNotFound")} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary, marginBottom: spacing.xl }}>
          {t("editStudent")}
        </Text>
        <StudentForm initial={student} submitting={saving} onSubmit={handleSubmit} />
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

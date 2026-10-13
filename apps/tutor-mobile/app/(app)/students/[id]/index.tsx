// apps/tutor-mobile/app/(app)/students/[id]/index.tsx
import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Alert, ScrollView, Text, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import type { TutorStudent } from "@gloows/shared-logic";
import { db } from "@/lib/firebase";
import { Button, Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

// See apps/tutor's equivalent detail page for why these are a hardcoded
// placeholder block rather than real schema fields.
const COMING_SOON_LABELS = ["Attendance", "Test Score", "Homework Completion", "Fee Status"];

export default function StudentDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [student, setStudent] = useState<TutorStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    return onSnapshot(
      doc(db, "tutorStudents", id),
      (snap) => {
        setStudent(snap.exists() ? ({ id: snap.id, ...snap.data() } as TutorStudent) : null);
        setLoading(false);
      },
      // Same fix as apps/tutor's detail page — a missing error handler
      // here left `loading` stuck true forever on a denied/deleted read.
      () => { setStudent(null); setLoading(false); }
    );
  }, [id]);

  function confirmDelete() {
    Alert.alert(t("deleteStudent"), t("deleteStudentConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("deleteStudent"), style: "destructive", onPress: async () => {
          setDeleting(true);
          try {
            await deleteDoc(doc(db, "tutorStudents", id));
            router.replace("/students");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  if (loading) return <LoadingState />;
  if (!student) return <EmptyState title={t("studentNotFound")} />;

  const joining = student.joiningDate as { toDate?: () => Date } | undefined;
  const joiningDate = joining?.toDate?.();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary, marginBottom: spacing.xl }}>
          {student.name}
        </Text>

        <Card style={{ marginBottom: spacing.md }}>
          <Field label={t("studentClassLabel")} value={student.class} />
          <Field label={t("studentSchoolLabel")} value={student.school} />
          <Field label={t("studentBoardLabel")} value={student.board} />
          <Field label={t("studentSubjectsLabel")} value={(student.subjects ?? []).join(", ")} />
          <Field label={t("studentJoiningDateLabel")} value={joiningDate ? joiningDate.toLocaleDateString() : undefined} last />
        </Card>

        <Card style={{ marginBottom: spacing.xl }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: semantic.textMuted, marginBottom: spacing.sm }}>
            {t("comingInLaterPhase")}
          </Text>
          {COMING_SOON_LABELS.map((label, i) => (
            <Field key={label} label={label} value={undefined} last={i === COMING_SOON_LABELS.length - 1} />
          ))}
        </Card>

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Button title={t("editStudent")} variant="secondary" onPress={() => router.push(`/students/${id}/edit`)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={t("deleteStudent")} variant="secondary" loading={deleting} onPress={confirmDelete} />
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

"use client";
// apps/tutor/src/app/(app)/students/edit/page.tsx
// /students/edit?id={id} — see students/detail/page.tsx's header comment
// for why this is a query-string route instead of a [id] path segment.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTutorT } from "@gloows/tutor-i18n";
import type { TutorStudent } from "@gloows/shared-logic";
import { EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";
import StudentForm, { type StudentFormValues } from "@/components/StudentForm";

function EditStudentContent() {
  const { t } = useTutorT();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const router = useRouter();
  const [student, setStudent] = useState<TutorStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    getDoc(doc(db, "tutorStudents", id))
      .then((snap) => {
        setStudent(snap.exists() ? ({ id: snap.id, ...snap.data() } as TutorStudent) : null);
        setLoading(false);
      })
      // Same fix as students/detail/page.tsx — a missing .catch() here
      // left `loading` stuck true forever on a denied/failed read.
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
      router.replace(`/students/detail?id=${id}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (!student) return <EmptyState title={t("studentNotFound")} />;

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-black text-slate-100 mb-6">{t("editStudent")}</h1>
      <StudentForm initial={student} submitting={saving} onSubmit={handleSubmit} />
    </div>
  );
}

export default function EditStudentPage() {
  return (
    <div className="min-h-dvh bg-bg pb-24">
      <Suspense fallback={<LoadingState />}>
        <EditStudentContent />
      </Suspense>
      <BottomNav />
    </div>
  );
}

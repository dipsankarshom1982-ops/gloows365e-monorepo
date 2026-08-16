"use client";
// apps/tutor/src/app/(app)/students/new/page.tsx

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTutorProfile } from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import BottomNav from "@/components/BottomNav";
import StudentForm, { type StudentFormValues } from "@/components/StudentForm";

export default function NewStudentPage() {
  const { t } = useTutorT();
  const { user } = useTutorProfile();
  const router = useRouter();
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
    <div className="min-h-dvh bg-bg pb-24">
      <div className="p-6 max-w-lg mx-auto">
        <h1 className="text-xl font-black text-slate-100 mb-6">{t("addStudent")}</h1>
        <StudentForm submitting={saving} onSubmit={handleSubmit} />
      </div>
      <BottomNav />
    </div>
  );
}

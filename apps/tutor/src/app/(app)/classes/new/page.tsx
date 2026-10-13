"use client";
// apps/tutor/src/app/(app)/classes/new/page.tsx

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTutorProfile } from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import BottomNav from "@/components/BottomNav";
import ClassForm, { type ClassFormValues } from "@/components/ClassForm";

export default function NewClassPage() {
  const { t } = useTutorT();
  const { user } = useTutorProfile();
  const router = useRouter();
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
        startTime: Timestamp.fromDate(new Date(values.startTime)),
        endTime: values.endTime ? Timestamp.fromDate(new Date(values.endTime)) : null,
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
    <div className="min-h-dvh bg-bg pb-24">
      <div className="p-6 max-w-lg mx-auto">
        <h1 className="text-xl font-black text-slate-100 mb-6">{t("addClass")}</h1>
        <ClassForm submitting={saving} onSubmit={handleSubmit} />
      </div>
      <BottomNav />
    </div>
  );
}

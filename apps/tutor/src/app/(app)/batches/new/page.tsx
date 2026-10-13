"use client";
// apps/tutor/src/app/(app)/batches/new/page.tsx

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTutorProfile } from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import BottomNav from "@/components/BottomNav";
import BatchForm, { type BatchFormValues } from "@/components/BatchForm";

export default function NewBatchPage() {
  const { t } = useTutorT();
  const { user } = useTutorProfile();
  const router = useRouter();
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
    <div className="min-h-dvh bg-bg pb-24">
      <div className="p-6 max-w-lg mx-auto">
        <h1 className="text-xl font-black text-slate-100 mb-6">{t("addBatch")}</h1>
        <BatchForm submitting={saving} onSubmit={handleSubmit} />
      </div>
      <BottomNav />
    </div>
  );
}

"use client";
// apps/tutor/src/app/(app)/classes/edit/page.tsx
// /classes/edit?id={id} — same query-string-route reasoning as
// students/detail/page.tsx. Also serves as "Reschedule".

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTutorT } from "@gloows/tutor-i18n";
import type { TutorClass } from "@gloows/shared-logic";
import { EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";
import ClassForm, { type ClassFormValues } from "@/components/ClassForm";

function EditClassContent() {
  const { t } = useTutorT();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const router = useRouter();
  const [cls, setCls]         = useState<TutorClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
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
        startTime: Timestamp.fromDate(new Date(values.startTime)),
        endTime: values.endTime ? Timestamp.fromDate(new Date(values.endTime)) : null,
        notes: values.notes.trim(),
        updatedAt: serverTimestamp(),
      });
      router.replace(`/classes/detail?id=${id}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (!cls) return <EmptyState title={t("classNotFound")} />;

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-black text-slate-100 mb-6">{t("editClass")}</h1>
      <ClassForm initial={cls} submitting={saving} onSubmit={handleSubmit} />
    </div>
  );
}

export default function EditClassPage() {
  return (
    <div className="min-h-dvh bg-bg pb-24">
      <Suspense fallback={<LoadingState />}>
        <EditClassContent />
      </Suspense>
      <BottomNav />
    </div>
  );
}

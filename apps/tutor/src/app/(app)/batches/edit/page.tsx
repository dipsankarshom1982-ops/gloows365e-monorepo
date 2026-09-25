"use client";
// apps/tutor/src/app/(app)/batches/edit/page.tsx
// /batches/edit?id={id} — see batches/detail/page.tsx's header comment.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTutorT } from "@gloows/tutor-i18n";
import type { TutorBatch } from "@gloows/shared-logic";
import { EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";
import BatchForm, { type BatchFormValues } from "@/components/BatchForm";

function EditBatchContent() {
  const { t } = useTutorT();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const router = useRouter();
  const [batchDoc, setBatchDoc] = useState<TutorBatch | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    getDoc(doc(db, "tutorBatches", id))
      .then((snap) => {
        setBatchDoc(snap.exists() ? ({ id: snap.id, ...snap.data() } as TutorBatch) : null);
        setLoading(false);
      })
      .catch(() => { setBatchDoc(null); setLoading(false); });
  }, [id]);

  async function handleSubmit(values: BatchFormValues) {
    setSaving(true);
    try {
      await updateDoc(doc(db, "tutorBatches", id), {
        name: values.name.trim(),
        class: values.class.trim(),
        subject: values.subject.trim(),
        board: values.board.trim(),
        mode: values.mode,
        fee: values.fee ? Number(values.fee) : null,
        startDate: values.startDate ? Timestamp.fromDate(new Date(values.startDate)) : null,
        endDate: values.endDate ? Timestamp.fromDate(new Date(values.endDate)) : null,
        updatedAt: serverTimestamp(),
      });
      router.replace(`/batches/detail?id=${id}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (!batchDoc) return <EmptyState title={t("batchNotFound")} />;

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-black text-slate-100 mb-6">{t("editBatch")}</h1>
      <BatchForm initial={batchDoc} submitting={saving} onSubmit={handleSubmit} />
    </div>
  );
}

export default function EditBatchPage() {
  return (
    <div className="min-h-dvh bg-bg pb-24">
      <Suspense fallback={<LoadingState />}>
        <EditBatchContent />
      </Suspense>
      <BottomNav />
    </div>
  );
}

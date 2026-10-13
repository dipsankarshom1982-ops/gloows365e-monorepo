"use client";
// apps/tutor/src/app/(app)/batches/detail/page.tsx
// /batches/detail?id={id} — same query-string-route reasoning as
// students/detail/page.tsx (output: "export", no server, can't
// enumerate every batch id at build time).

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  arrayRemove, collection, doc, getDocs, onSnapshot, query, serverTimestamp,
  where, writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTutorT } from "@gloows/tutor-i18n";
import { useTutorProfile, useBatchStudents } from "@gloows/shared-logic";
import type { TutorBatch } from "@gloows/shared-logic";
import { Button, Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

function BatchDetailContent() {
  const { t } = useTutorT();
  const { user } = useTutorProfile();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const router = useRouter();
  const [batchDoc, setBatchDoc] = useState<TutorBatch | null>(null);
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState(false);
  const { students } = useBatchStudents(user?.uid, id);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    return onSnapshot(
      doc(db, "tutorBatches", id),
      (snap) => {
        setBatchDoc(snap.exists() ? ({ id: snap.id, ...snap.data() } as TutorBatch) : null);
        setLoading(false);
      },
      // Built in from the start this time — Phase 1b had to retrofit
      // this same fix after live-testing caught an infinite spinner on
      // a denied/missing read (cross-tutor deep link, or the doc was
      // deleted while this page was open).
      () => { setBatchDoc(null); setLoading(false); }
    );
  }, [id]);

  async function handleDelete() {
    if (!user || !confirm(t("deleteBatchConfirm"))) return;
    setDeleting(true);
    try {
      // Orphan cleanup: remove this batchId from every student that has
      // it, atomically with the batch delete itself — see the Phase 1c
      // plan's "Batch deletion" section.
      const membersSnap = await getDocs(
        query(
          collection(db, "tutorStudents"),
          where("tutorId", "==", user.uid),
          where("batchIds", "array-contains", id)
        )
      );
      const wb = writeBatch(db);
      membersSnap.docs.forEach((s) => {
        wb.update(s.ref, { batchIds: arrayRemove(id), updatedAt: serverTimestamp() });
      });
      wb.delete(doc(db, "tutorBatches", id));
      await wb.commit();
      router.replace("/batches");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <LoadingState />;
  if (!batchDoc) return <EmptyState title={t("batchNotFound")} />;

  const start = batchDoc.startDate as { toDate?: () => Date } | undefined;
  const end   = batchDoc.endDate as { toDate?: () => Date } | undefined;

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-black text-slate-100 mb-6">{batchDoc.name}</h1>

      <Card className="mb-4">
        <Field label={t("batchClassLabel")} value={batchDoc.class} />
        <Field label={t("batchSubjectLabel")} value={batchDoc.subject} />
        <Field label={t("batchBoardLabel")} value={batchDoc.board} />
        <Field label={t("batchModeLabel")} value={batchDoc.mode} />
        <Field label={t("batchFeeLabel")} value={batchDoc.fee != null ? String(batchDoc.fee) : undefined} />
        <Field label={t("batchStartDateLabel")} value={start?.toDate?.() ? start.toDate!().toLocaleDateString() : undefined} />
        <Field label={t("batchEndDateLabel")} value={end?.toDate?.() ? end.toDate!().toLocaleDateString() : undefined} />
      </Card>

      <Card className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-500">{t("studentsInBatchLabel")}</p>
          <Link href={`/batches/assign?id=${id}`} className="text-brand-400 text-xs font-bold">
            {t("assignStudents")}
          </Link>
        </div>
        {students.length === 0 ? (
          <p className="text-slate-500 text-xs">—</p>
        ) : (
          <div className="flex flex-col gap-1">
            {students.map((s) => (
              <Link key={s.id} href={`/students/detail?id=${s.id}`} className="text-sm text-slate-200 py-1">
                {s.name}
              </Link>
            ))}
          </div>
        )}
      </Card>

      <div className="flex gap-3">
        <Link href={`/batches/edit?id=${id}`} className="flex-1">
          <Button variant="secondary">{t("editBatch")}</Button>
        </Link>
        <Button variant="secondary" className="flex-1 !text-danger" onClick={handleDelete} disabled={deleting}>
          {t("deleteBatch")}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-slate-800 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm text-slate-200">{value || "—"}</span>
    </div>
  );
}

export default function BatchDetailPage() {
  return (
    <div className="min-h-dvh bg-bg pb-24">
      <Suspense fallback={<LoadingState />}>
        <BatchDetailContent />
      </Suspense>
      <BottomNav />
    </div>
  );
}

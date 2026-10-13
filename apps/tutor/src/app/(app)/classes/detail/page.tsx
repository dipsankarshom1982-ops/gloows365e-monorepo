"use client";
// apps/tutor/src/app/(app)/classes/detail/page.tsx
// /classes/detail?id={id} — same query-string-route reasoning as
// students/detail/page.tsx and batches/detail/page.tsx.

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTutorT } from "@gloows/tutor-i18n";
import { useTutorBatches, useTutorProfile } from "@gloows/shared-logic";
import type { TutorClass } from "@gloows/shared-logic";
import { Badge, Button, Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "danger"> = {
  Scheduled: "warning",
  Completed: "success",
  Cancelled: "danger",
};

function ClassDetailContent() {
  const { t } = useTutorT();
  const { user } = useTutorProfile();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const [cls, setCls]         = useState<TutorClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const { batches } = useTutorBatches(user?.uid);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    return onSnapshot(
      doc(db, "tutorClasses", id),
      (snap) => {
        setCls(snap.exists() ? ({ id: snap.id, ...snap.data() } as TutorClass) : null);
        setLoading(false);
      },
      // Built in from the start — see students/detail's comment for why.
      () => { setCls(null); setLoading(false); }
    );
  }, [id]);

  async function handleCancel() {
    if (!confirm(t("cancelClassConfirm"))) return;
    setCancelling(true);
    try {
      await updateDoc(doc(db, "tutorClasses", id), { status: "Cancelled", updatedAt: serverTimestamp() });
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <LoadingState />;
  if (!cls) return <EmptyState title={t("classNotFound")} />;

  const start = (cls.startTime as { toDate?: () => Date } | undefined)?.toDate?.();
  const end   = (cls.endTime as { toDate?: () => Date } | undefined)?.toDate?.();
  const batch = batches.find((b) => b.id === cls.batchId);
  const canJoin = !!cls.meetingLink && cls.mode === "Online" && cls.status === "Scheduled";

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-black text-slate-100">{cls.subject || cls.topic}</h1>
        <Badge tone={STATUS_TONE[cls.status ?? "Scheduled"]}>{t(`classStatus${cls.status ?? "Scheduled"}`)}</Badge>
      </div>

      <Card className="mb-4">
        <Field label={t("classTopicLabel")} value={cls.topic} />
        <Field label={t("classBatchLabel")} value={batch?.name} />
        <Field label={t("batchModeLabel")} value={cls.mode} />
        <Field label={t("classStartLabel")} value={start ? start.toLocaleString() : undefined} />
        <Field label={t("classEndLabel")} value={end ? end.toLocaleString() : undefined} />
        <Field label={t("classNotesLabel")} value={cls.notes} />
      </Card>

      {canJoin && (
        <a href={cls.meetingLink} target="_blank" rel="noopener noreferrer" className="block mb-3">
          <Button>{t("joinClass")}</Button>
        </a>
      )}

      <div className="flex gap-3 mb-3">
        {batch && (
          <Link href={`/batches/detail?id=${batch.id}`} className="flex-1">
            <Button variant="secondary">{t("viewBatch")}</Button>
          </Link>
        )}
        <Link href={`/classes/edit?id=${id}`} className="flex-1">
          <Button variant="secondary">{t("rescheduleClass")}</Button>
        </Link>
      </div>

      {cls.status === "Scheduled" && (
        <Button variant="secondary" className="!text-danger" onClick={handleCancel} disabled={cancelling}>
          {t("cancelClass")}
        </Button>
      )}
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

export default function ClassDetailPage() {
  return (
    <div className="min-h-dvh bg-bg pb-24">
      <Suspense fallback={<LoadingState />}>
        <ClassDetailContent />
      </Suspense>
      <BottomNav />
    </div>
  );
}

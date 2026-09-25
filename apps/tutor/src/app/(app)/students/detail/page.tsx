"use client";
// apps/tutor/src/app/(app)/students/detail/page.tsx
// /students/detail?id={id} — was originally students/[id]/page.tsx (a
// dynamic path segment), but next.config.ts sets output: "export" for
// Firebase Hosting (no server), which requires generateStaticParams() to
// enumerate every possible id at build time — impossible for a
// tutor-managed, always-growing roster. Matches the same query-string
// pattern already used elsewhere in this monorepo for the identical
// reason (see apps/web's glostore/product/page.tsx, contest/result,
// contest/lesson, ...). Mobile keeps a real dynamic segment
// (app/(app)/students/[id]/index.tsx) — it has a real native router and
// isn't affected by this.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTutorT } from "@gloows/tutor-i18n";
import type { TutorStudent } from "@gloows/shared-logic";
import { Button, Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

// Fields the spec lists on a student profile that have no backing data
// source yet (Homework/Tests/Attendance/Fees are later phases) — shown
// as a static placeholder block, not stored on the doc. See the Phase 1b
// plan's schema section for why these were deliberately left out of
// tutorStudents' fields.
const COMING_SOON_LABELS = ["Attendance", "Test Score", "Homework Completion", "Fee Status"];

function StudentDetailContent() {
  const { t } = useTutorT();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const router = useRouter();
  const [student, setStudent] = useState<TutorStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    return onSnapshot(
      doc(db, "tutorStudents", id),
      (snap) => {
        setStudent(snap.exists() ? ({ id: snap.id, ...snap.data() } as TutorStudent) : null);
        setLoading(false);
      },
      // No error handler here left `loading` stuck true forever on a
      // denied read (cross-tutor deep link, or the doc got deleted while
      // this page was open) — confirmed live during Phase 1b's
      // cross-tutor isolation test: firestore.rules correctly denies the
      // read, but the UI just spun forever instead of showing "not
      // found". Treat any error the same as "doesn't exist" — the rule
      // already did the real security work, this only fixes the display.
      () => { setStudent(null); setLoading(false); }
    );
  }, [id]);

  async function handleDelete() {
    if (!confirm(t("deleteStudentConfirm"))) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "tutorStudents", id));
      router.replace("/students");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <LoadingState />;
  if (!student) return <EmptyState title={t("studentNotFound")} />; // removed, or not this tutor's — rules already denied the read

  const joining = student.joiningDate as { toDate?: () => Date } | undefined;
  const joiningDate = joining?.toDate?.();

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-black text-slate-100 mb-6">{student.name}</h1>

      <Card className="mb-4">
        <Field label={t("studentClassLabel")} value={student.class} />
        <Field label={t("studentSchoolLabel")} value={student.school} />
        <Field label={t("studentBoardLabel")} value={student.board} />
        <Field label={t("studentSubjectsLabel")} value={(student.subjects ?? []).join(", ")} />
        <Field label={t("studentJoiningDateLabel")} value={joiningDate ? joiningDate.toLocaleDateString() : undefined} />
      </Card>

      <Card className="mb-6">
        <p className="text-xs font-semibold text-slate-500 mb-3">{t("comingInLaterPhase")}</p>
        {COMING_SOON_LABELS.map((label) => (
          <Field key={label} label={label} value={undefined} />
        ))}
      </Card>

      <div className="flex gap-3">
        <Link href={`/students/edit?id=${id}`} className="flex-1">
          <Button variant="secondary">{t("editStudent")}</Button>
        </Link>
        <Button variant="secondary" className="flex-1 !text-danger" onClick={handleDelete} disabled={deleting}>
          {t("deleteStudent")}
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

export default function StudentDetailPage() {
  return (
    <div className="min-h-dvh bg-bg pb-24">
      <Suspense fallback={<LoadingState />}>
        <StudentDetailContent />
      </Suspense>
      <BottomNav />
    </div>
  );
}

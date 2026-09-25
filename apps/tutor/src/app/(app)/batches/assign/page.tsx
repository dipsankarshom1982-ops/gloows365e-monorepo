"use client";
// apps/tutor/src/app/(app)/batches/assign/page.tsx
// /batches/assign?id={id} — checklist of the tutor's full roster,
// checked state derived live from useBatchStudents (not local draft
// state) so a write immediately reflects. Immediate-write-per-toggle,
// not a batched "Save" — see the Phase 1c plan's reasoning. Built
// directly here rather than as a new ui.tsx primitive since it's used
// exactly once on this platform, unlike StudentForm/BatchForm's real
// new+edit reuse.

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { arrayRemove, arrayUnion, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTutorT } from "@gloows/tutor-i18n";
import { useBatchStudents, useTutorProfile, useTutorStudents } from "@gloows/shared-logic";
import { Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

function AssignStudentsContent() {
  const { t } = useTutorT();
  const { user } = useTutorProfile();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const { students: allStudents, loading: rosterLoading } = useTutorStudents(user?.uid);
  const { students: assigned, loading: assignedLoading } = useBatchStudents(user?.uid, id);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const assignedIds = new Set(assigned.map((s) => s.id));

  async function toggle(studentId: string, isAssigned: boolean) {
    if (pending.has(studentId)) return; // anti-double-tap, not draft state
    setPending((p) => new Set(p).add(studentId));
    try {
      await updateDoc(doc(db, "tutorStudents", studentId), {
        batchIds: isAssigned ? arrayRemove(id) : arrayUnion(id),
        updatedAt: serverTimestamp(),
      });
    } finally {
      setPending((p) => { const next = new Set(p); next.delete(studentId); return next; });
    }
  }

  if (rosterLoading || assignedLoading) return <LoadingState />;

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-black text-slate-100 mb-6">{t("assignStudentsTitle")}</h1>

      {allStudents.length === 0 ? (
        <EmptyState title={t("noStudentsToAssignTitle")} subtitle={t("noStudentsToAssignSubtitle")} />
      ) : (
        <div className="flex flex-col gap-2">
          {allStudents.map((s) => {
            const isAssigned = assignedIds.has(s.id);
            const isPending  = pending.has(s.id!);
            return (
              <button
                key={s.id}
                type="button"
                disabled={isPending}
                onClick={() => toggle(s.id!, isAssigned)}
                className="text-left disabled:opacity-50"
              >
                <Card className={`flex items-center justify-between ${isAssigned ? "border-brand-500" : ""}`}>
                  <div>
                    <p className="font-semibold text-slate-100 text-sm">{s.name}</p>
                    <p className="text-xs text-slate-500">{[s.class, s.school].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <span className="text-lg">{isAssigned ? "✅" : "⬜"}</span>
                </Card>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AssignStudentsPage() {
  return (
    <div className="min-h-dvh bg-bg pb-24">
      <Suspense fallback={<LoadingState />}>
        <AssignStudentsContent />
      </Suspense>
      <BottomNav />
    </div>
  );
}

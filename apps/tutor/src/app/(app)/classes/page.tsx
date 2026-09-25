"use client";
// apps/tutor/src/app/(app)/classes/page.tsx

import Link from "next/link";
import { useTutorBatches, useTutorClasses, useTutorProfile } from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import { Badge, Button, Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "danger"> = {
  Scheduled: "warning",
  Completed: "success",
  Cancelled: "danger",
};

export default function ClassesPage() {
  const { t } = useTutorT();
  const { user } = useTutorProfile();
  const { classes, loading } = useTutorClasses(user?.uid);
  const { batches } = useTutorBatches(user?.uid);
  const batchName = (id?: string) => batches.find((b) => b.id === id)?.name ?? "—";

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <div className="p-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-black text-slate-100">{t("classesTitle")}</h1>
          <Link href="/classes/new">
            <Button variant="secondary" className="w-auto px-4">{t("addClass")}</Button>
          </Link>
        </div>

        {loading ? (
          <LoadingState />
        ) : classes.length === 0 ? (
          <EmptyState title={t("noClassesTitle")} subtitle={t("noClassesSubtitle")} />
        ) : (
          <div className="flex flex-col gap-3">
            {classes.map((c) => {
              const start = (c.startTime as { toDate?: () => Date } | undefined)?.toDate?.();
              return (
                <Link key={c.id} href={`/classes/detail?id=${c.id}`}>
                  <Card className="hover:border-brand-500 transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-100">{c.subject || c.topic || "—"}</p>
                      <Badge tone={STATUS_TONE[c.status ?? "Scheduled"]}>{t(`classStatus${c.status ?? "Scheduled"}`)}</Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {start ? start.toLocaleString() : "—"} · {batchName(c.batchId)}
                    </p>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

"use client";
// apps/tutor/src/app/(app)/batches/page.tsx

import Link from "next/link";
import { useTutorBatches, useTutorProfile } from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import { Button, Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

export default function BatchesPage() {
  const { t } = useTutorT();
  const { user } = useTutorProfile();
  const { batches, loading } = useTutorBatches(user?.uid);

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <div className="p-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-black text-slate-100">{t("batchesTitle")}</h1>
          <Link href="/batches/new">
            <Button variant="secondary" className="w-auto px-4">{t("addBatch")}</Button>
          </Link>
        </div>

        {loading ? (
          <LoadingState />
        ) : batches.length === 0 ? (
          <EmptyState title={t("noBatchesTitle")} subtitle={t("noBatchesSubtitle")} />
        ) : (
          <div className="flex flex-col gap-3">
            {batches.map((b) => (
              <Link key={b.id} href={`/batches/detail?id=${b.id}`}>
                <Card className="hover:border-brand-500 transition-colors">
                  <p className="font-bold text-slate-100">{b.name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {[b.class, b.subject, b.board].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{b.mode}</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

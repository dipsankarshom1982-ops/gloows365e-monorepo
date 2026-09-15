"use client";
// apps/tutor/src/app/(app)/students/page.tsx
// Roster list — Phase 1b. Manual entries only; no account-linking yet
// (see functions/src... there is no callable here on purpose, same
// direct-Firestore-write reasoning as the Profile page).

import Link from "next/link";
import { useTutorProfile, useTutorStudents } from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import { Button, Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

export default function StudentsPage() {
  const { t } = useTutorT();
  const { user } = useTutorProfile();
  const { students, loading } = useTutorStudents(user?.uid);

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <div className="p-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-black text-slate-100">{t("studentsTitle")}</h1>
          <Link href="/students/new">
            <Button variant="secondary" className="w-auto px-4">{t("addStudent")}</Button>
          </Link>
        </div>

        {loading ? (
          <LoadingState />
        ) : students.length === 0 ? (
          <EmptyState title={t("noStudentsTitle")} subtitle={t("noStudentsSubtitle")} />
        ) : (
          <div className="flex flex-col gap-3">
            {students.map((s) => (
              <Link key={s.id} href={`/students/detail?id=${s.id}`}>
                <Card className="hover:border-brand-500 transition-colors">
                  <p className="font-bold text-slate-100">{s.name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {[s.class, s.school, s.board].filter(Boolean).join(" · ") || "—"}
                  </p>
                  {s.subjects && s.subjects.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">{s.subjects.join(", ")}</p>
                  )}
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

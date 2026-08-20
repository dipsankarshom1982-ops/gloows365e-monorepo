"use client";
// apps/tutor/src/app/(app)/services/page.tsx
// ShikshaHub Phase 3 — "My Services". Mirrors apps/tutor's bookings/page.tsx
// (useTutorServices — same onSnapshot-hook shape as useTutorBookings) plus
// batches/page.tsx's list-with-add-button layout. Publish/unpublish is an
// inline toggle here rather than a form field — see ServiceForm.tsx's
// header comment for why creation always starts as an unpublished draft.

import { useState } from "react";
import Link from "next/link";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { useTutorServices, useTutorProfile, type TutorService } from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import { Badge, Button, Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

const updateServiceCall = httpsCallable<
  { serviceId: string; published?: boolean },
  { serviceId: string }
>(functions, "updateService");

const deleteServiceCall = httpsCallable<{ serviceId: string }, { serviceId: string }>(functions, "deleteService");

const TYPE_LABEL: Record<TutorService["serviceType"], string> = {
  one_time: "One-time",
  short_term: "Short-term",
  long_term: "Long-term",
  instant_help: "Instant Help",
};

export default function ServicesPage() {
  const { t } = useTutorT();
  const { user } = useTutorProfile();
  const { services, loading } = useTutorServices(user?.uid);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  async function togglePublish(service: TutorService) {
    setActingOn(service.id!);
    setRowError((prev) => ({ ...prev, [service.id!]: "" }));
    try {
      await updateServiceCall({ serviceId: service.id!, published: !service.published });
    } catch (e: any) {
      setRowError((prev) => ({ ...prev, [service.id!]: e?.message ?? "Could not update this service." }));
    } finally {
      setActingOn(null);
    }
  }

  async function handleDelete(serviceId: string) {
    setActingOn(serviceId);
    try {
      await deleteServiceCall({ serviceId });
    } catch (e: any) {
      setRowError((prev) => ({ ...prev, [serviceId]: e?.message ?? "Could not delete this service." }));
    } finally {
      setActingOn(null);
    }
  }

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <div className="p-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-black text-slate-100">{t("servicesTitle", "My Services")}</h1>
          <Link href="/services/new">
            <Button variant="secondary" className="w-auto px-4">{t("addService", "Add service")}</Button>
          </Link>
        </div>

        {loading ? (
          <LoadingState />
        ) : services.length === 0 ? (
          <EmptyState
            title={t("noServicesTitle", "No services yet")}
            subtitle={t("noServicesSubtitle", "Create a service to become bookable through ShikshaHub.")}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {services.map((s) => (
              <Card key={s.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-100">{s.serviceName}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {s.subject} · {TYPE_LABEL[s.serviceType]}
                    </p>
                  </div>
                  <Badge tone={s.published ? "success" : "default"}>
                    {s.published ? t("servicePublished", "Published") : t("serviceDraft", "Draft")}
                  </Badge>
                </div>

                {s.serviceType !== "instant_help" && s.sessionFee != null && (
                  <p className="text-xs text-slate-500 mt-2">₹{s.sessionFee}</p>
                )}

                <div className="mt-4 flex gap-2">
                  <Link href={`/services/edit?id=${s.id}`} className="flex-1">
                    <Button variant="secondary" className="w-full">{t("edit", "Edit")}</Button>
                  </Link>
                  <button
                    onClick={() => togglePublish(s)}
                    disabled={actingOn === s.id}
                    className="flex-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold py-3 disabled:opacity-50"
                  >
                    {s.published ? t("unpublish", "Unpublish") : t("publish", "Publish")}
                  </button>
                </div>
                <button
                  onClick={() => handleDelete(s.id!)}
                  disabled={actingOn === s.id}
                  className="mt-2 w-full rounded-lg bg-surface2 border border-slate-600 text-danger text-xs font-bold py-2 disabled:opacity-50"
                >
                  {t("delete", "Delete")}
                </button>

                {rowError[s.id!] && <p className="text-danger text-xs font-semibold mt-2">{rowError[s.id!]}</p>}
              </Card>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

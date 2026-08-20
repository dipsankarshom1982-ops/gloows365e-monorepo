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
import { useTutorServices, useTutorProfile, useTutorEarnings, type TutorService } from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import { Badge, Button, Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

const setInstantHelpOnlineStatusCall = httpsCallable<{ online: boolean }, { online: boolean }>(
  functions, "setInstantHelpOnlineStatus"
);

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
  const { user, tutorProfile } = useTutorProfile();
  const { services, loading } = useTutorServices(user?.uid);
  const { balance: earningsBalance } = useTutorEarnings();
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [onlineError, setOnlineError] = useState("");

  // ShikshaHub Phase 4 — the online toggle is only offered once there's at
  // least one published instant_help service; setInstantHelpOnlineStatus
  // enforces this same rule server-side (see instantHelp.ts), this is just
  // the UI staying consistent with it rather than showing a dead control.
  const hasPublishedInstantHelp = services.some((s) => s.serviceType === "instant_help" && s.published);
  const isOnline = tutorProfile?.isOnlineForInstantHelp === true;

  async function toggleOnline() {
    setTogglingOnline(true);
    setOnlineError("");
    try {
      await setInstantHelpOnlineStatusCall({ online: !isOnline });
    } catch (e: any) {
      setOnlineError(e?.message ?? "Could not update your online status.");
    } finally {
      setTogglingOnline(false);
    }
  }

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

        {hasPublishedInstantHelp && (
          <Card className="mb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-slate-100 text-sm font-bold">
                  {t("instantHelpOnlineTitle", "Instant Help availability")}
                </p>
                <p className="text-slate-500 text-xs mt-0.5">
                  {isOnline
                    ? t("instantHelpOnlineOn", "Students can send you Instant Help requests right now")
                    : t("instantHelpOnlineOff", "You're offline — students can't reach you for Instant Help")}
                </p>
                {earningsBalance != null && (
                  <p className="text-slate-500 text-xs mt-1">
                    {t("instantHelpEarnings", "Earnings balance")}: <span className="text-slate-300 font-bold">{earningsBalance}</span>
                  </p>
                )}
              </div>
              <button
                onClick={toggleOnline}
                disabled={togglingOnline}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition-colors disabled:opacity-50 ${
                  isOnline ? "bg-success/20 text-success" : "bg-slate-700 text-slate-300"
                }`}
              >
                {isOnline ? t("goOffline", "🟢 Online") : t("goOnline", "Go Online")}
              </button>
            </div>
            {onlineError && <p className="text-danger text-xs font-semibold mt-2">{onlineError}</p>}
          </Card>
        )}

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

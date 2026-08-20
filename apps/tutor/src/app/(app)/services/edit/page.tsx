"use client";
// apps/tutor/src/app/(app)/services/edit/page.tsx
// /services/edit?id={id} — same query-string route shape as
// batches/edit/page.tsx (next.config.ts's output:"export" needs
// generateStaticParams() to enumerate every path at build time, impossible
// for an always-growing set of services — see that file's own comment).
// Reads tutorServices/{id} directly (firestore.rules allows owner read),
// writes via the updateService callable (see services/new/page.tsx's
// header comment for why this collection is callable-write-only).

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { useTutorT } from "@gloows/tutor-i18n";
import type { TutorService } from "@gloows/shared-logic";
import { EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";
import ServiceForm, { type ServiceFormValues } from "@/components/ServiceForm";

const updateServiceCall = httpsCallable<Record<string, unknown>, { serviceId: string }>(functions, "updateService");

function toPayload(serviceId: string, values: ServiceFormValues): Record<string, unknown> {
  const isInstantHelp = values.serviceType === "instant_help";
  const payload: Record<string, unknown> = {
    serviceId,
    serviceName: values.serviceName.trim(),
    description: values.description.trim(),
    subject: values.subject.trim(),
    topics: values.topics.split(",").map((s) => s.trim()).filter(Boolean),
    serviceType: values.serviceType,
    deliveryMode: values.deliveryMode,
  };
  if (isInstantHelp) {
    if (values.creditsPerMinute) payload.creditsPerMinute = Number(values.creditsPerMinute);
    if (values.minimumDurationMinutes) payload.minimumDurationMinutes = Number(values.minimumDurationMinutes);
    if (values.maximumDurationMinutes) payload.maximumDurationMinutes = Number(values.maximumDurationMinutes);
  } else {
    if (values.durationMinutes) payload.durationMinutes = Number(values.durationMinutes);
    if (values.sessionFee) payload.sessionFee = Number(values.sessionFee);
    payload.trialAvailable = values.trialAvailable;
    payload.availability = values.availability;
    if (values.serviceType === "short_term" || values.serviceType === "long_term") {
      if (values.numberOfSessions) payload.numberOfSessions = Number(values.numberOfSessions);
      if (values.sessionsPerWeek) payload.sessionsPerWeek = Number(values.sessionsPerWeek);
      if (values.startDate) payload.startDate = values.startDate;
      if (values.endDate) payload.endDate = values.endDate;
    }
  }
  return payload;
}

function EditServiceContent() {
  const { t } = useTutorT();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const router = useRouter();
  const [serviceDoc, setServiceDoc] = useState<TutorService | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    getDoc(doc(db, "tutorServices", id))
      .then((snap) => {
        setServiceDoc(snap.exists() ? ({ id: snap.id, ...snap.data() } as TutorService) : null);
        setLoading(false);
      })
      .catch(() => { setServiceDoc(null); setLoading(false); });
  }, [id]);

  async function handleSubmit(values: ServiceFormValues) {
    setSaving(true);
    setError("");
    try {
      await updateServiceCall(toPayload(id, values));
      router.replace("/services");
    } catch (e: any) {
      setError(e?.message ?? "Could not save this service. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (!serviceDoc) return <EmptyState title={t("serviceNotFound", "Service not found")} />;

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-black text-slate-100 mb-6">{t("editService", "Edit service")}</h1>
      {error && <p className="text-danger text-xs font-semibold mb-4">{error}</p>}
      <ServiceForm initial={serviceDoc} submitting={saving} onSubmit={handleSubmit} />
    </div>
  );
}

export default function EditServicePage() {
  return (
    <div className="min-h-dvh bg-bg pb-24">
      <Suspense fallback={<LoadingState />}>
        <EditServiceContent />
      </Suspense>
      <BottomNav />
    </div>
  );
}

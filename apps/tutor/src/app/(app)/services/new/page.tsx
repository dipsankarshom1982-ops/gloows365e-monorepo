"use client";
// apps/tutor/src/app/(app)/services/new/page.tsx
// ShikshaHub Phase 3. Calls createService (Admin-SDK callable) rather than
// writing tutorServices/{id} directly — see functions/src/tutorServices.ts's
// header comment for why this collection is callable-only, unlike
// tutorBatches' direct-client-write pattern batches/new/page.tsx uses.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { useTutorT } from "@gloows/tutor-i18n";
import BottomNav from "@/components/BottomNav";
import ServiceForm, { type ServiceFormValues } from "@/components/ServiceForm";

const createServiceCall = httpsCallable<Record<string, unknown>, { serviceId: string }>(functions, "createService");

function toPayload(values: ServiceFormValues): Record<string, unknown> {
  const isInstantHelp = values.serviceType === "instant_help";
  const payload: Record<string, unknown> = {
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

export default function NewServicePage() {
  const { t } = useTutorT();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  async function handleSubmit(values: ServiceFormValues) {
    setSaving(true);
    setError("");
    try {
      await createServiceCall(toPayload(values));
      router.replace("/services");
    } catch (e: any) {
      setError(e?.message ?? "Could not create this service. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <div className="p-6 max-w-lg mx-auto">
        <h1 className="text-xl font-black text-slate-100 mb-6">{t("addService", "Add service")}</h1>
        {error && <p className="text-danger text-xs font-semibold mb-4">{error}</p>}
        <ServiceForm submitting={saving} onSubmit={handleSubmit} />
      </div>
      <BottomNav />
    </div>
  );
}

// apps/tutor-mobile/app/(app)/services/[id]/edit.tsx
import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import type { TutorService } from "@gloows/shared-logic";
import { db, functions } from "@/lib/firebase";
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

export default function EditServiceScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [serviceDoc, setServiceDoc] = useState<TutorService | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");

  useEffect(() => {
    if (!id) return;
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      {loading ? (
        <LoadingState />
      ) : !serviceDoc ? (
        <EmptyState title={t("serviceNotFound")} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
          <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary, marginBottom: spacing.xl }}>
            {t("editService")}
          </Text>
          {!!error && <Text style={{ color: semantic.danger, fontSize: 12, fontWeight: "600", marginBottom: spacing.md }}>{error}</Text>}
          <ServiceForm initial={serviceDoc} submitting={saving} onSubmit={handleSubmit} />
        </ScrollView>
      )}
      <BottomNav />
    </SafeAreaView>
  );
}

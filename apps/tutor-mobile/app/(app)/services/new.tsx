// apps/tutor-mobile/app/(app)/services/new.tsx
import { useState } from "react";
import { router } from "expo-router";
import { httpsCallable } from "firebase/functions";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import { functions } from "@/lib/firebase";
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

export default function NewServiceScreen() {
  const { t } = useTranslation();
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
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary, marginBottom: spacing.xl }}>
          {t("addService")}
        </Text>
        {!!error && <Text style={{ color: semantic.danger, fontSize: 12, fontWeight: "600", marginBottom: spacing.md }}>{error}</Text>}
        <ServiceForm submitting={saving} onSubmit={handleSubmit} />
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

// apps/tutor-mobile/app/(app)/services/index.tsx
// ShikshaHub Phase 3 — RN mirror of apps/tutor's services/page.tsx.

import { useState } from "react";
import { router } from "expo-router";
import { httpsCallable } from "firebase/functions";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import { useTutorServices, useTutorProfile, type TutorService } from "@gloows/shared-logic";
import { functions } from "@/lib/firebase";
import { Badge, Button, Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

const updateServiceCall = httpsCallable<{ serviceId: string; published?: boolean }, { serviceId: string }>(functions, "updateService");
const deleteServiceCall = httpsCallable<{ serviceId: string }, { serviceId: string }>(functions, "deleteService");

const TYPE_LABEL: Record<TutorService["serviceType"], string> = {
  one_time: "One-time",
  short_term: "Short-term",
  long_term: "Long-term",
  instant_help: "Instant Help",
};

export default function ServicesScreen() {
  const { t } = useTranslation();
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
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <View style={{ flex: 1, paddingTop: spacing.xl, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl, marginBottom: spacing.xl }}>
          <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary }}>{t("servicesTitle")}</Text>
          <View style={{ width: 130 }}>
            <Button title={t("addService")} variant="secondary" onPress={() => router.push("/services/new")} />
          </View>
        </View>

        {loading ? (
          <LoadingState />
        ) : services.length === 0 ? (
          <EmptyState title={t("noServicesTitle")} subtitle={t("noServicesSubtitle")} />
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.md }} showsVerticalScrollIndicator={false}>
            {services.map((s) => (
              <Card key={s.id} style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <View>
                    <Text style={{ fontWeight: "700", color: semantic.textPrimary }}>{s.serviceName}</Text>
                    <Text style={{ fontSize: 12, color: semantic.textMuted, marginTop: 4 }}>
                      {s.subject} · {TYPE_LABEL[s.serviceType]}
                    </Text>
                  </View>
                  <Badge label={s.published ? t("servicePublished") : t("serviceDraft")} tone={s.published ? "success" : "default"} />
                </View>

                {s.serviceType !== "instant_help" && s.sessionFee != null && (
                  <Text style={{ fontSize: 12, color: semantic.textMuted, marginTop: 8 }}>₹{s.sessionFee}</Text>
                )}

                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: "/services/[id]/edit", params: { id: s.id! } })}
                    style={{ flex: 1, borderRadius: 8, backgroundColor: semantic.surfaceElevated, borderWidth: 1, borderColor: semantic.border, paddingVertical: 9, alignItems: "center" }}
                  >
                    <Text style={{ color: semantic.textPrimary, fontSize: 12, fontWeight: "700" }}>{t("edit")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => togglePublish(s)}
                    disabled={actingOn === s.id}
                    style={{ flex: 1, borderRadius: 8, backgroundColor: semantic.primary, paddingVertical: 9, alignItems: "center", opacity: actingOn === s.id ? 0.5 : 1 }}
                  >
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{s.published ? t("unpublish") : t("publish")}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(s.id!)}
                  disabled={actingOn === s.id}
                  style={{ marginTop: spacing.sm, borderRadius: 8, backgroundColor: semantic.surfaceElevated, borderWidth: 1, borderColor: semantic.border, paddingVertical: 8, alignItems: "center", opacity: actingOn === s.id ? 0.5 : 1 }}
                >
                  <Text style={{ color: semantic.danger, fontSize: 12, fontWeight: "700" }}>{t("delete")}</Text>
                </TouchableOpacity>

                {rowError[s.id!] ? (
                  <Text style={{ color: semantic.danger, fontSize: 12, fontWeight: "600", marginTop: spacing.sm }}>{rowError[s.id!]}</Text>
                ) : null}
              </Card>
            ))}
          </ScrollView>
        )}
      </View>
      <BottomNav />
    </SafeAreaView>
  );
}

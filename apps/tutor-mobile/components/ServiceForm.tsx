// apps/tutor-mobile/components/ServiceForm.tsx
// ShikshaHub Phase 3 — RN mirror of apps/tutor/src/components/ServiceForm.tsx.
// Same field set/branching (serviceType splits scheduled vs instant_help),
// same weekly-availability grid shape lifted from
// apps/tutor-mobile/app/(app)/profile.tsx's editor.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Switch, Text, TouchableOpacity, View } from "react-native";
import { colors, semantic, radii, spacing, typography } from "@gloows/tutor-ui";
import type {
  DeliveryMode, ServiceType, TutorService, TutorWeekday, TutorWeeklyAvailability,
} from "@gloows/shared-logic";
import { Button, Input } from "./ui";

export interface ServiceFormValues {
  serviceName: string;
  description: string;
  subject: string;
  topics: string;
  serviceType: ServiceType;
  deliveryMode: DeliveryMode;
  durationMinutes: string;
  numberOfSessions: string;
  sessionsPerWeek: string;
  startDate: string;
  endDate: string;
  sessionFee: string;
  trialAvailable: boolean;
  availability: TutorWeeklyAvailability;
  creditsPerMinute: string;
  minimumDurationMinutes: string;
  maximumDurationMinutes: string;
}

const WEEKDAYS: { key: TutorWeekday; label: string }[] = [
  { key: "monday",    label: "Mon" },
  { key: "tuesday",   label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday",  label: "Thu" },
  { key: "friday",    label: "Fri" },
  { key: "saturday",  label: "Sat" },
  { key: "sunday",    label: "Sun" },
];

const EMPTY_AVAILABILITY: TutorWeeklyAvailability = Object.fromEntries(
  WEEKDAYS.map((d) => [d.key, { enabled: false, start: "17:00", end: "20:00" }])
) as TutorWeeklyAvailability;

function toFormValues(service?: TutorService | null): ServiceFormValues {
  return {
    serviceName: service?.serviceName ?? "",
    description: service?.description ?? "",
    subject: service?.subject ?? "",
    topics: (service?.topics ?? []).join(", "),
    serviceType: service?.serviceType ?? "one_time",
    deliveryMode: service?.deliveryMode ?? "online",
    durationMinutes: service?.durationMinutes != null ? String(service.durationMinutes) : "60",
    numberOfSessions: service?.numberOfSessions != null ? String(service.numberOfSessions) : "",
    sessionsPerWeek: service?.sessionsPerWeek != null ? String(service.sessionsPerWeek) : "",
    startDate: service?.startDate ?? "",
    endDate: service?.endDate ?? "",
    sessionFee: service?.sessionFee != null ? String(service.sessionFee) : "",
    trialAvailable: service?.trialAvailable ?? false,
    availability: { ...EMPTY_AVAILABILITY, ...(service?.availability ?? {}) },
    creditsPerMinute: service?.creditsPerMinute != null ? String(service.creditsPerMinute) : "",
    minimumDurationMinutes: service?.minimumDurationMinutes != null ? String(service.minimumDurationMinutes) : "",
    maximumDurationMinutes: service?.maximumDurationMinutes != null ? String(service.maximumDurationMinutes) : "",
  };
}

const SERVICE_TYPES: { value: ServiceType; label: string }[] = [
  { value: "one_time",     label: "One-time" },
  { value: "short_term",   label: "Short-term" },
  { value: "long_term",    label: "Long-term" },
  { value: "instant_help", label: "Instant Help" },
];

const DELIVERY_MODES: { value: DeliveryMode; label: string }[] = [
  { value: "online",         label: "Online" },
  { value: "offline",        label: "Offline" },
  { value: "online_offline", label: "Online+Offline" },
];

interface Props {
  initial?: TutorService | null;
  submitting: boolean;
  onSubmit: (values: ServiceFormValues) => void;
}

export default function ServiceForm({ initial, submitting, onSubmit }: Props) {
  const { t } = useTranslation();
  const [values, setValues] = useState<ServiceFormValues>(() => toFormValues(initial));

  function set<K extends keyof ServiceFormValues>(key: K, value: ServiceFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }
  function updateDay(key: TutorWeekday, patch: Partial<TutorWeeklyAvailability[TutorWeekday]>) {
    setValues((v) => ({ ...v, availability: { ...v.availability, [key]: { ...v.availability[key], ...patch } } }));
  }

  const isInstantHelp = values.serviceType === "instant_help";
  const isScheduledPackage = values.serviceType === "short_term" || values.serviceType === "long_term";

  return (
    <View>
      <Input label={t("serviceNameLabel")} value={values.serviceName} onChangeText={(v) => set("serviceName", v)} placeholder="Class 10 Mathematics" />
      <Input label={t("serviceDescriptionLabel")} value={values.description} onChangeText={(v) => set("description", v)} multiline />
      <Input label={t("serviceSubjectLabel")} value={values.subject} onChangeText={(v) => set("subject", v)} placeholder="Mathematics" />
      <Input label={t("serviceTopicsLabel")} value={values.topics} onChangeText={(v) => set("topics", v)} placeholder="Algebra, Trigonometry" />

      <View style={{ marginBottom: spacing.lg }}>
        <Text style={{ color: semantic.textSecondary, fontSize: typography.size.xs, fontWeight: "600", marginBottom: 6 }}>
          {t("serviceTypeLabel")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {SERVICE_TYPES.map((s) => {
            const active = values.serviceType === s.value;
            return (
              <TouchableOpacity
                key={s.value}
                activeOpacity={0.85}
                onPress={() => set("serviceType", s.value)}
                style={{
                  minWidth: "47%", borderRadius: radii.md, paddingVertical: spacing.sm, alignItems: "center",
                  backgroundColor: active ? semantic.primary : semantic.surfaceElevated,
                  borderWidth: active ? 0 : 1, borderColor: colors.slate[600],
                }}
              >
                <Text style={{ color: active ? "#fff" : semantic.textPrimary, fontWeight: "700", fontSize: typography.size.sm }}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={{ marginBottom: spacing.lg }}>
        <Text style={{ color: semantic.textSecondary, fontSize: typography.size.xs, fontWeight: "600", marginBottom: 6 }}>
          {t("serviceDeliveryModeLabel")}
        </Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {DELIVERY_MODES.map((m) => {
            const active = values.deliveryMode === m.value;
            return (
              <TouchableOpacity
                key={m.value}
                activeOpacity={0.85}
                onPress={() => set("deliveryMode", m.value)}
                style={{
                  flex: 1, borderRadius: radii.md, paddingVertical: spacing.sm, alignItems: "center",
                  backgroundColor: active ? semantic.primary : semantic.surfaceElevated,
                  borderWidth: active ? 0 : 1, borderColor: colors.slate[600],
                }}
              >
                <Text style={{ color: active ? "#fff" : semantic.textPrimary, fontWeight: "700", fontSize: typography.size.xs }}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {isInstantHelp ? (
        <>
          <Input label={t("serviceCreditsPerMinuteLabel")} value={values.creditsPerMinute} onChangeText={(v) => set("creditsPerMinute", v)} keyboardType="numeric" />
          <Input label={t("serviceMinDurationLabel")} value={values.minimumDurationMinutes} onChangeText={(v) => set("minimumDurationMinutes", v)} keyboardType="numeric" />
          <Input label={t("serviceMaxDurationLabel")} value={values.maximumDurationMinutes} onChangeText={(v) => set("maximumDurationMinutes", v)} keyboardType="numeric" />
          <Text style={{ color: semantic.textMuted, fontSize: 11, marginTop: -8, marginBottom: spacing.lg }}>
            {t("serviceInstantHelpNote")}
          </Text>
        </>
      ) : (
        <>
          <Input label={t("serviceDurationLabel")} value={values.durationMinutes} onChangeText={(v) => set("durationMinutes", v)} keyboardType="numeric" />
          <Input label={t("shikshaHubSessionFeeLabel")} value={values.sessionFee} onChangeText={(v) => set("sessionFee", v)} keyboardType="numeric" />

          {isScheduledPackage && (
            <>
              <Input label={t("serviceNumberOfSessionsLabel")} value={values.numberOfSessions} onChangeText={(v) => set("numberOfSessions", v)} keyboardType="numeric" />
              <Input label={t("serviceSessionsPerWeekLabel")} value={values.sessionsPerWeek} onChangeText={(v) => set("sessionsPerWeek", v)} keyboardType="numeric" />
              <Input label={t("serviceStartDateLabel")} placeholder="YYYY-MM-DD" value={values.startDate} onChangeText={(v) => set("startDate", v)} />
              <Input label={t("serviceEndDateLabel")} placeholder="YYYY-MM-DD" value={values.endDate} onChangeText={(v) => set("endDate", v)} />
            </>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg }}>
            <Text style={{ color: semantic.textPrimary, fontSize: typography.size.sm, fontWeight: "600" }}>{t("serviceTrialAvailableLabel")}</Text>
            <Switch value={values.trialAvailable} onValueChange={(v) => set("trialAvailable", v)} />
          </View>
        </>
      )}

      <View style={{ marginBottom: spacing.lg }}>
        <Text style={{ color: semantic.textSecondary, fontSize: typography.size.xs, fontWeight: "600", marginBottom: spacing.sm }}>
          {t("shikshaHubAvailabilityLabel")}
        </Text>
        <View style={{ gap: spacing.sm }}>
          {WEEKDAYS.map(({ key, label }) => {
            const day = values.availability[key] ?? { enabled: false, start: "17:00", end: "20:00" };
            return (
              <View key={key} style={{
                flexDirection: "row", alignItems: "center", gap: spacing.sm,
                borderRadius: radii.md, backgroundColor: semantic.surface, borderWidth: 1, borderColor: colors.slate[700],
                paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
              }}>
                <TouchableOpacity
                  onPress={() => updateDay(key, { enabled: !day.enabled })}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, width: 56 }}
                >
                  <Switch value={!!day.enabled} onValueChange={(v) => updateDay(key, { enabled: v })} />
                </TouchableOpacity>
                <Text style={{ width: 32, fontSize: 11, fontWeight: "700", color: semantic.textPrimary }}>{label}</Text>
                <Input
                  value={day.start ?? "17:00"}
                  editable={!!day.enabled}
                  onChangeText={(v) => updateDay(key, { start: v })}
                  style={{ flex: 1, marginBottom: 0 }}
                />
                <Text style={{ color: semantic.textMuted, fontSize: 11 }}>–</Text>
                <Input
                  value={day.end ?? "20:00"}
                  editable={!!day.enabled}
                  onChangeText={(v) => updateDay(key, { end: v })}
                  style={{ flex: 1, marginBottom: 0 }}
                />
              </View>
            );
          })}
        </View>
      </View>

      <Button
        title={submitting ? t("loading") : t("serviceSaveLabel")}
        loading={submitting}
        disabled={!values.serviceName.trim() || !values.subject.trim()}
        onPress={() => onSubmit(values)}
      />
    </View>
  );
}

"use client";
// apps/tutor/src/components/ServiceForm.tsx
// ShikshaHub Phase 3 — shared field set for /services/new and
// /services/edit. Mirrors BatchForm.tsx's shape (pill-row single-selects,
// same Input/Button primitives) plus the weekly-availability grid lifted
// from apps/tutor/src/app/(app)/profile/page.tsx (identical shape/keys,
// just scoped to one service instead of the tutor's whole flat profile).
//
// serviceType is the field that branches the rest of the form:
// one_time/short_term/long_term share the "scheduled, fee-priced" field
// set; instant_help swaps in credits/duration-range config fields instead
// (Phase 3 scope: configuration only, no runtime behavior — see
// functions/src/tutorServices.ts's header comment). `published` is
// deliberately NOT a field here — createService always starts a service
// as an unpublished draft, and the publish/unpublish toggle lives on the
// services list page instead, not buried in this form.

import { useState } from "react";
import { useTutorT } from "@gloows/tutor-i18n";
import type {
  DeliveryMode, ServiceType, TutorService, TutorWeekday, TutorWeeklyAvailability,
} from "@gloows/shared-logic";
import { Button, Input, Textarea } from "./ui";

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
  { value: "online_offline", label: "Online + Offline" },
];

interface Props {
  initial?: TutorService | null;
  submitting: boolean;
  onSubmit: (values: ServiceFormValues) => void;
}

export default function ServiceForm({ initial, submitting, onSubmit }: Props) {
  const { t } = useTutorT();
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
    >
      <Input label={t("serviceNameLabel", "Service name")} required value={values.serviceName} onChange={(e) => set("serviceName", e.target.value)} placeholder="Class 10 Mathematics" />
      <Textarea label={t("serviceDescriptionLabel", "Description")} value={values.description} onChange={(e) => set("description", e.target.value)} />
      <Input label={t("serviceSubjectLabel", "Subject")} required value={values.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Mathematics" />
      <Input label={t("serviceTopicsLabel", "Specific topics (comma-separated)")} value={values.topics} onChange={(e) => set("topics", e.target.value)} placeholder="Algebra, Trigonometry" />

      <div className="mb-4">
        <span className="block text-xs font-semibold text-slate-400 mb-1.5">{t("serviceTypeLabel", "Service type")}</span>
        <div className="grid grid-cols-2 gap-2">
          {SERVICE_TYPES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => set("serviceType", s.value)}
              className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                values.serviceType === s.value ? "bg-brand-600 text-white" : "bg-surface2 text-slate-300 border border-slate-600"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <span className="block text-xs font-semibold text-slate-400 mb-1.5">{t("serviceDeliveryModeLabel", "Delivery mode")}</span>
        <div className="flex gap-2">
          {DELIVERY_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => set("deliveryMode", m.value)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                values.deliveryMode === m.value ? "bg-brand-600 text-white" : "bg-surface2 text-slate-300 border border-slate-600"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {isInstantHelp ? (
        <>
          <Input label={t("serviceCreditsPerMinuteLabel", "Credits per minute")} type="number" min={1} value={values.creditsPerMinute} onChange={(e) => set("creditsPerMinute", e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("serviceMinDurationLabel", "Min. duration (min)")} type="number" min={1} value={values.minimumDurationMinutes} onChange={(e) => set("minimumDurationMinutes", e.target.value)} />
            <Input label={t("serviceMaxDurationLabel", "Max. duration (min)")} type="number" min={1} value={values.maximumDurationMinutes} onChange={(e) => set("maximumDurationMinutes", e.target.value)} />
          </div>
          <p className="text-[11px] text-slate-500 -mt-2 mb-4">
            {t("serviceInstantHelpNote", "Instant Help booking isn't available yet — this configures the service for a future release.")}
          </p>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("serviceDurationLabel", "Session length (min)")} type="number" min={1} value={values.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value)} />
            <Input label={t("shikshaHubSessionFeeLabel", "Session fee (₹, per session)")} type="number" min={1} value={values.sessionFee} onChange={(e) => set("sessionFee", e.target.value)} />
          </div>

          {isScheduledPackage && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("serviceNumberOfSessionsLabel", "Total sessions")} type="number" min={1} value={values.numberOfSessions} onChange={(e) => set("numberOfSessions", e.target.value)} />
                <Input label={t("serviceSessionsPerWeekLabel", "Sessions/week")} type="number" min={1} value={values.sessionsPerWeek} onChange={(e) => set("sessionsPerWeek", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("serviceStartDateLabel", "Start date")} type="date" value={values.startDate} onChange={(e) => set("startDate", e.target.value)} />
                <Input label={t("serviceEndDateLabel", "End date")} type="date" value={values.endDate} onChange={(e) => set("endDate", e.target.value)} />
              </div>
            </>
          )}

          <label className="flex items-center gap-2 mb-4">
            <input type="checkbox" checked={values.trialAvailable} onChange={(e) => set("trialAvailable", e.target.checked)} />
            <span className="text-sm font-semibold text-slate-300">{t("serviceTrialAvailableLabel", "Offer a trial session")}</span>
          </label>
        </>
      )}

      <div className="mb-4">
        <span className="block text-xs font-semibold text-slate-400 mb-2">
          {t("shikshaHubAvailabilityLabel", "Weekly availability")}
        </span>
        <div className="flex flex-col gap-2">
          {WEEKDAYS.map(({ key, label }) => {
            const day = values.availability[key] ?? { enabled: false, start: "17:00", end: "20:00" };
            return (
              <div key={key} className="flex items-center gap-2 rounded-lg bg-surface border border-slate-700 px-3 py-2">
                <label className="flex items-center gap-2 w-20 shrink-0">
                  <input type="checkbox" checked={!!day.enabled} onChange={(e) => updateDay(key, { enabled: e.target.checked })} />
                  <span className="text-xs font-bold text-slate-200">{label}</span>
                </label>
                <input
                  type="time" disabled={!day.enabled} value={day.start ?? "17:00"}
                  onChange={(e) => updateDay(key, { start: e.target.value })}
                  className="flex-1 rounded bg-bg border border-slate-700 px-2 py-1 text-xs text-slate-100 disabled:opacity-40"
                />
                <span className="text-slate-500 text-xs">–</span>
                <input
                  type="time" disabled={!day.enabled} value={day.end ?? "20:00"}
                  onChange={(e) => updateDay(key, { end: e.target.value })}
                  className="flex-1 rounded bg-bg border border-slate-700 px-2 py-1 text-xs text-slate-100 disabled:opacity-40"
                />
              </div>
            );
          })}
        </div>
      </div>

      <Button type="submit" disabled={submitting || !values.serviceName.trim() || !values.subject.trim()}>
        {submitting ? t("loading") : t("serviceSaveLabel", "Save service")}
      </Button>
    </form>
  );
}

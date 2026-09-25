"use client";
// apps/tutor/src/components/ClassForm.tsx
// Shared field set for /classes/new and /classes/edit. Batch picker
// reuses BatchForm's single-select pill-row pattern (no dropdown/Picker
// precedent exists anywhere in this repo — see the Phase 1d plan) rather
// than adding a new component or dependency for one field. Guards with
// a "create a batch first" message when the tutor has no batches yet,
// since a class can't exist without one (batchId is required).

import { useState } from "react";
import Link from "next/link";
import { useTutorProfile, useTutorBatches } from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import type { TutorClass, TutorClassMode } from "@gloows/shared-logic";
import { Button, EmptyState, Input } from "./ui";

export interface ClassFormValues {
  batchId: string;
  subject: string;
  topic: string;
  mode: TutorClassMode;
  meetingLink: string;
  startTime: string; // datetime-local string
  endTime: string;   // datetime-local string
  notes: string;
}

function toDatetimeLocal(ts: unknown): string {
  const d = (ts as { toDate?: () => Date } | undefined)?.toDate?.();
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toFormValues(cls?: TutorClass | null): ClassFormValues {
  return {
    batchId: cls?.batchId ?? "",
    subject: cls?.subject ?? "",
    topic: cls?.topic ?? "",
    mode: cls?.mode ?? "Online",
    meetingLink: cls?.meetingLink ?? "",
    startTime: toDatetimeLocal(cls?.startTime),
    endTime: toDatetimeLocal(cls?.endTime),
    notes: cls?.notes ?? "",
  };
}

const MODES: { value: TutorClassMode; labelKey: string }[] = [
  { value: "Online",  labelKey: "batchModeOnline" },
  { value: "Offline", labelKey: "batchModeOffline" },
];

interface Props {
  initial?: TutorClass | null;
  submitting: boolean;
  onSubmit: (values: ClassFormValues) => void;
}

export default function ClassForm({ initial, submitting, onSubmit }: Props) {
  const { t } = useTutorT();
  const { user } = useTutorProfile();
  const { batches, loading: batchesLoading } = useTutorBatches(user?.uid);
  const [values, setValues] = useState<ClassFormValues>(() => toFormValues(initial));

  function set<K extends keyof ClassFormValues>(key: K, value: ClassFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  if (!batchesLoading && batches.length === 0) {
    return (
      <div>
        <EmptyState title={t("noBatchesForClassTitle")} subtitle={t("noBatchesForClassSubtitle")} />
        <Link href="/batches/new">
          <Button variant="secondary">{t("addBatch")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
    >
      <div className="mb-4">
        <span className="block text-xs font-semibold text-slate-400 mb-1.5">{t("classBatchLabel")}</span>
        <div className="flex flex-wrap gap-2">
          {batches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => set("batchId", b.id!)}
              className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                values.batchId === b.id
                  ? "bg-brand-600 text-white"
                  : "bg-surface2 text-slate-300 border border-slate-600"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      <Input label={t("classSubjectLabel")} value={values.subject} onChange={(e) => set("subject", e.target.value)} />
      <Input label={t("classTopicLabel")} value={values.topic} onChange={(e) => set("topic", e.target.value)} />

      <div className="mb-4">
        <span className="block text-xs font-semibold text-slate-400 mb-1.5">{t("batchModeLabel")}</span>
        <div className="flex gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => set("mode", m.value)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                values.mode === m.value
                  ? "bg-brand-600 text-white"
                  : "bg-surface2 text-slate-300 border border-slate-600"
              }`}
            >
              {t(m.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <Input label={t("classMeetingLinkLabel")} value={values.meetingLink} onChange={(e) => set("meetingLink", e.target.value)} />
      <Input label={t("classStartLabel")} type="datetime-local" required value={values.startTime} onChange={(e) => set("startTime", e.target.value)} />
      <Input label={t("classEndLabel")} type="datetime-local" value={values.endTime} onChange={(e) => set("endTime", e.target.value)} />
      <Input label={t("classNotesLabel")} value={values.notes} onChange={(e) => set("notes", e.target.value)} />

      <Button type="submit" disabled={submitting || !values.batchId || !values.startTime}>
        {submitting ? t("loading") : t("saveClass")}
      </Button>
    </form>
  );
}

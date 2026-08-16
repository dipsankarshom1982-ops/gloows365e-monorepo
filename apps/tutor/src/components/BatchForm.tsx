"use client";
// apps/tutor/src/components/BatchForm.tsx
// Shared field set for /batches/new and /batches/edit — mirrors
// StudentForm.tsx's shape exactly. `mode` is a compact single-select
// pill row (radio semantics — unconditional onClick, not the
// toggle/.includes() multi-select CreateContest.tsx's targetClass uses),
// not the stacked-card role-picker style from the register screen —
// that's the right weight for a 3-item description-free pick.

import { useState } from "react";
import { useTutorT } from "@gloows/tutor-i18n";
import type { TutorBatch, TutorBatchMode } from "@gloows/shared-logic";
import { Button, Input } from "./ui";

export interface BatchFormValues {
  name: string;
  class: string;
  subject: string;
  board: string;
  mode: TutorBatchMode;
  fee: string;
  startDate: string;
  endDate: string;
}

function toFormValues(batch?: TutorBatch | null): BatchFormValues {
  const start = batch?.startDate as { toDate?: () => Date } | undefined;
  const end   = batch?.endDate as { toDate?: () => Date } | undefined;
  return {
    name: batch?.name ?? "",
    class: batch?.class ?? "",
    subject: batch?.subject ?? "",
    board: batch?.board ?? "",
    mode: batch?.mode ?? "Online",
    fee: batch?.fee != null ? String(batch.fee) : "",
    startDate: start?.toDate?.() ? start.toDate!().toISOString().slice(0, 10) : "",
    endDate: end?.toDate?.() ? end.toDate!().toISOString().slice(0, 10) : "",
  };
}

const MODES: { value: TutorBatchMode; labelKey: string }[] = [
  { value: "Online",  labelKey: "batchModeOnline" },
  { value: "Offline", labelKey: "batchModeOffline" },
  { value: "Hybrid",  labelKey: "batchModeHybrid" },
];

interface Props {
  initial?: TutorBatch | null;
  submitting: boolean;
  onSubmit: (values: BatchFormValues) => void;
}

export default function BatchForm({ initial, submitting, onSubmit }: Props) {
  const { t } = useTutorT();
  const [values, setValues] = useState<BatchFormValues>(() => toFormValues(initial));

  function set<K extends keyof BatchFormValues>(key: K, value: BatchFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
    >
      <Input label={t("batchNameLabel")} required value={values.name} onChange={(e) => set("name", e.target.value)} />
      <Input label={t("batchClassLabel")} value={values.class} onChange={(e) => set("class", e.target.value)} />
      <Input label={t("batchSubjectLabel")} value={values.subject} onChange={(e) => set("subject", e.target.value)} />
      <Input label={t("batchBoardLabel")} value={values.board} onChange={(e) => set("board", e.target.value)} />

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

      <Input label={t("batchFeeLabel")} type="number" min={0} value={values.fee} onChange={(e) => set("fee", e.target.value)} />
      <Input label={t("batchStartDateLabel")} type="date" value={values.startDate} onChange={(e) => set("startDate", e.target.value)} />
      <Input label={t("batchEndDateLabel")} type="date" value={values.endDate} onChange={(e) => set("endDate", e.target.value)} />

      <Button type="submit" disabled={submitting || !values.name.trim()}>
        {submitting ? t("loading") : t("saveBatch")}
      </Button>
    </form>
  );
}

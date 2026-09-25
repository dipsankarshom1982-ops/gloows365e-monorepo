// apps/tutor-mobile/components/BatchForm.tsx
// RN mirror of apps/tutor/src/components/BatchForm.tsx — same field
// set. `mode` is a compact single-select pill row (radio semantics).

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, TouchableOpacity, View } from "react-native";
import { colors, semantic, radii, spacing, typography } from "@gloows/tutor-ui";
import type { TutorBatch, TutorBatchMode } from "@gloows/shared-logic";
import { Button, Input } from "./ui";

export interface BatchFormValues {
  name: string;
  class: string;
  subject: string;
  board: string;
  mode: TutorBatchMode;
  fee: string;
  startDate: string; // yyyy-mm-dd
  endDate: string;   // yyyy-mm-dd
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
  const { t } = useTranslation();
  const [values, setValues] = useState<BatchFormValues>(() => toFormValues(initial));

  function set<K extends keyof BatchFormValues>(key: K, value: BatchFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  return (
    <View>
      <Input label={t("batchNameLabel")} value={values.name} onChangeText={(v) => set("name", v)} />
      <Input label={t("batchClassLabel")} value={values.class} onChangeText={(v) => set("class", v)} />
      <Input label={t("batchSubjectLabel")} value={values.subject} onChangeText={(v) => set("subject", v)} />
      <Input label={t("batchBoardLabel")} value={values.board} onChangeText={(v) => set("board", v)} />

      <View style={{ marginBottom: spacing.lg }}>
        <Text style={{ color: semantic.textSecondary, fontSize: typography.size.xs, fontWeight: "600", marginBottom: 6 }}>
          {t("batchModeLabel")}
        </Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {MODES.map((m) => {
            const active = values.mode === m.value;
            return (
              <TouchableOpacity
                key={m.value}
                activeOpacity={0.85}
                onPress={() => set("mode", m.value)}
                style={{
                  flex: 1,
                  borderRadius: radii.md,
                  paddingVertical: spacing.sm,
                  alignItems: "center",
                  backgroundColor: active ? semantic.primary : semantic.surfaceElevated,
                  borderWidth: active ? 0 : 1,
                  borderColor: colors.slate[600],
                }}
              >
                <Text style={{ color: active ? "#fff" : semantic.textPrimary, fontWeight: "700", fontSize: typography.size.sm }}>
                  {t(m.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Input label={t("batchFeeLabel")} value={values.fee} onChangeText={(v) => set("fee", v)} keyboardType="numeric" />
      <Input label={t("batchStartDateLabel")} placeholder="YYYY-MM-DD" value={values.startDate} onChangeText={(v) => set("startDate", v)} />
      <Input label={t("batchEndDateLabel")} placeholder="YYYY-MM-DD" value={values.endDate} onChangeText={(v) => set("endDate", v)} />

      <Button
        title={submitting ? t("loading") : t("saveBatch")}
        loading={submitting}
        disabled={!values.name.trim()}
        onPress={() => onSubmit(values)}
      />
    </View>
  );
}

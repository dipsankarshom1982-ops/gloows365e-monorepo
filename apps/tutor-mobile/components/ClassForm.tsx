// apps/tutor-mobile/components/ClassForm.tsx
// RN mirror of apps/tutor/src/components/ClassForm.tsx — same field set,
// same batch-picker pill-row reasoning, no native date/time picker
// precedent so start/end are plain text fields like BatchForm's dates.

import { useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, TouchableOpacity, View } from "react-native";
import { colors, semantic, radii, spacing, typography } from "@gloows/tutor-ui";
import { useTutorBatches, useTutorProfile } from "@gloows/shared-logic";
import type { TutorClass, TutorClassMode } from "@gloows/shared-logic";
import { Button, EmptyState, Input } from "./ui";

export interface ClassFormValues {
  batchId: string;
  subject: string;
  topic: string;
  mode: TutorClassMode;
  meetingLink: string;
  startTime: string; // YYYY-MM-DD HH:mm
  endTime: string;   // YYYY-MM-DD HH:mm
  notes: string;
}

function toDatetimeText(ts: unknown): string {
  const d = (ts as { toDate?: () => Date } | undefined)?.toDate?.();
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toFormValues(cls?: TutorClass | null): ClassFormValues {
  return {
    batchId: cls?.batchId ?? "",
    subject: cls?.subject ?? "",
    topic: cls?.topic ?? "",
    mode: cls?.mode ?? "Online",
    meetingLink: cls?.meetingLink ?? "",
    startTime: toDatetimeText(cls?.startTime),
    endTime: toDatetimeText(cls?.endTime),
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
  const { t } = useTranslation();
  const { user } = useTutorProfile();
  const { batches, loading: batchesLoading } = useTutorBatches(user?.uid);
  const [values, setValues] = useState<ClassFormValues>(() => toFormValues(initial));

  function set<K extends keyof ClassFormValues>(key: K, value: ClassFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  if (!batchesLoading && batches.length === 0) {
    return (
      <View>
        <EmptyState title={t("noBatchesForClassTitle")} subtitle={t("noBatchesForClassSubtitle")} />
        <Button title={t("addBatch")} variant="secondary" onPress={() => router.push("/batches/new")} />
      </View>
    );
  }

  return (
    <View>
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={{ color: semantic.textSecondary, fontSize: typography.size.xs, fontWeight: "600", marginBottom: 6 }}>
          {t("classBatchLabel")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {batches.map((b) => {
            const active = values.batchId === b.id;
            return (
              <TouchableOpacity
                key={b.id}
                activeOpacity={0.85}
                onPress={() => set("batchId", b.id!)}
                style={{
                  borderRadius: radii.md,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  backgroundColor: active ? semantic.primary : semantic.surfaceElevated,
                  borderWidth: active ? 0 : 1,
                  borderColor: colors.slate[600],
                }}
              >
                <Text style={{ color: active ? "#fff" : semantic.textPrimary, fontWeight: "700", fontSize: typography.size.sm }}>
                  {b.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Input label={t("classSubjectLabel")} value={values.subject} onChangeText={(v) => set("subject", v)} />
      <Input label={t("classTopicLabel")} value={values.topic} onChangeText={(v) => set("topic", v)} />

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

      <Input label={t("classMeetingLinkLabel")} value={values.meetingLink} onChangeText={(v) => set("meetingLink", v)} autoCapitalize="none" />
      <Input label={t("classStartLabel")} placeholder="YYYY-MM-DD HH:mm" value={values.startTime} onChangeText={(v) => set("startTime", v)} />
      <Input label={t("classEndLabel")} placeholder="YYYY-MM-DD HH:mm" value={values.endTime} onChangeText={(v) => set("endTime", v)} />
      <Input label={t("classNotesLabel")} value={values.notes} onChangeText={(v) => set("notes", v)} />

      <Button
        title={submitting ? t("loading") : t("saveClass")}
        loading={submitting}
        disabled={!values.batchId || !values.startTime}
        onPress={() => onSubmit(values)}
      />
    </View>
  );
}

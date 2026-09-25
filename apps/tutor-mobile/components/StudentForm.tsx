// apps/tutor-mobile/components/StudentForm.tsx
// RN mirror of apps/tutor/src/components/StudentForm.tsx — same field
// set, same shared-by-new-and-edit reasoning.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import type { TutorStudent } from "@gloows/shared-logic";
import { Button, Input } from "./ui";

export interface StudentFormValues {
  name: string;
  class: string;
  school: string;
  board: string;
  subjects: string;
  joiningDate: string; // yyyy-mm-dd
}

function toFormValues(student?: TutorStudent | null): StudentFormValues {
  const joining = student?.joiningDate as { toDate?: () => Date } | undefined;
  const joiningDate = joining?.toDate?.() ?? null;
  return {
    name: student?.name ?? "",
    class: student?.class ?? "",
    school: student?.school ?? "",
    board: student?.board ?? "",
    subjects: (student?.subjects ?? []).join(", "),
    joiningDate: joiningDate ? joiningDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

interface Props {
  initial?: TutorStudent | null;
  submitting: boolean;
  onSubmit: (values: StudentFormValues) => void;
}

export default function StudentForm({ initial, submitting, onSubmit }: Props) {
  const { t } = useTranslation();
  const [values, setValues] = useState<StudentFormValues>(() => toFormValues(initial));

  function set<K extends keyof StudentFormValues>(key: K, value: StudentFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  return (
    <View>
      <Input label={t("studentNameLabel")} value={values.name} onChangeText={(v) => set("name", v)} />
      <Input label={t("studentClassLabel")} value={values.class} onChangeText={(v) => set("class", v)} />
      <Input label={t("studentSchoolLabel")} value={values.school} onChangeText={(v) => set("school", v)} />
      <Input label={t("studentBoardLabel")} value={values.board} onChangeText={(v) => set("board", v)} />
      <Input
        label={t("studentSubjectsLabel")}
        placeholder="Mathematics, Physics"
        value={values.subjects}
        onChangeText={(v) => set("subjects", v)}
      />
      <Input
        label={t("studentJoiningDateLabel")}
        placeholder="YYYY-MM-DD"
        value={values.joiningDate}
        onChangeText={(v) => set("joiningDate", v)}
      />
      <Button
        title={submitting ? t("loading") : t("saveStudent")}
        loading={submitting}
        disabled={!values.name.trim()}
        onPress={() => onSubmit(values)}
      />
    </View>
  );
}

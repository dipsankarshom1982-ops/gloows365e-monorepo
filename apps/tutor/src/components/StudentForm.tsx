"use client";
// apps/tutor/src/components/StudentForm.tsx
// Shared field set for /students/new and /students/[id]/edit — kept as
// one component so the two pages can't drift on which fields exist.

import { useState } from "react";
import { useTutorT } from "@gloows/tutor-i18n";
import type { TutorStudent } from "@gloows/shared-logic";
import { Button, Input } from "./ui";

export interface StudentFormValues {
  name: string;
  class: string;
  school: string;
  board: string;
  subjects: string; // comma-separated, same convention as Profile's subjects field
  joiningDate: string; // yyyy-mm-dd, <input type="date"> native format
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
  const { t } = useTutorT();
  const [values, setValues] = useState<StudentFormValues>(() => toFormValues(initial));

  function set<K extends keyof StudentFormValues>(key: K, value: StudentFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
    >
      <Input label={t("studentNameLabel")} required value={values.name} onChange={(e) => set("name", e.target.value)} />
      <Input label={t("studentClassLabel")} value={values.class} onChange={(e) => set("class", e.target.value)} />
      <Input label={t("studentSchoolLabel")} value={values.school} onChange={(e) => set("school", e.target.value)} />
      <Input label={t("studentBoardLabel")} value={values.board} onChange={(e) => set("board", e.target.value)} />
      <Input
        label={t("studentSubjectsLabel")}
        placeholder="Mathematics, Physics"
        value={values.subjects}
        onChange={(e) => set("subjects", e.target.value)}
      />
      <Input
        label={t("studentJoiningDateLabel")}
        type="date"
        value={values.joiningDate}
        onChange={(e) => set("joiningDate", e.target.value)}
      />
      <Button type="submit" disabled={submitting || !values.name.trim()}>
        {submitting ? t("loading") : t("saveStudent")}
      </Button>
    </form>
  );
}

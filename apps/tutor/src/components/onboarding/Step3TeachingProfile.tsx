"use client";
// apps/tutor/src/components/onboarding/Step3TeachingProfile.tsx
// Onboarding Step 3 — Teaching Profile: tutor type, subjects, student
// levels (+ streams for 11-12), curriculum boards, teaching mode,
// experience. See ../../app/onboarding/page.tsx's header for the flow.

import { useMemo, useState } from "react";
import { useTutorT } from "@gloows/tutor-i18n";
import {
  TUTOR_TYPE_OPTIONS, SUBJECT_OPTIONS, STUDENT_LEVEL_OPTIONS,
  SCHOOL_STUDENT_LEVELS, STREAM_OPTIONS, CURRICULUM_BOARD_OPTIONS,
  TEACHING_MODE_OPTIONS, EXPERIENCE_OPTIONS,
} from "@/lib/onboardingOptions";
import type { OnboardingData } from "@/lib/onboardingTypes";
import { Chip, FieldError, PrimaryButton, SecondaryButton, SectionLabel, TextLink } from "./OnboardingUI";

type Props = {
  data: OnboardingData;
  update: (patch: Partial<OnboardingData>) => void;
  onContinue: () => void;
  onBack: () => void;
  onSaveLater: () => void;
  saving: boolean;
};

function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export default function Step3TeachingProfile({ data, update, onContinue, onBack, onSaveLater, saving }: Props) {
  const { t } = useTutorT();

  const [subjectFilter, setSubjectFilter] = useState("");
  const [otherSubject, setOtherSubject] = useState("");
  const [showOtherSubject, setShowOtherSubject] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredSubjects = useMemo(
    () => SUBJECT_OPTIONS.filter((s) => s.toLowerCase().includes(subjectFilter.trim().toLowerCase())),
    [subjectFilter]
  );

  const showStreams = data.studentLevels.includes("HIGHER_SECONDARY");
  const showBoards = data.studentLevels.some((l) => SCHOOL_STUDENT_LEVELS.includes(l));
  const showServiceArea = data.teachingMode === "OFFLINE" || data.teachingMode === "BOTH";
  const serviceAreaValue = data.offlineServiceAreas[0] ?? "";

  function addOtherSubject() {
    const value = otherSubject.trim();
    if (!value) return;
    if (!data.subjects.includes(value)) update({ subjects: [...data.subjects, value] });
    setOtherSubject("");
    setShowOtherSubject(false);
  }

  function validateAndContinue() {
    const next: Record<string, string> = {};
    if (!data.tutorType) next.tutorType = t("ob3TutorTypeRequiredError");
    if (data.subjects.length === 0) next.subjects = t("ob3SubjectsRequiredError");
    if (data.studentLevels.length === 0) next.studentLevels = t("ob3LevelsRequiredError");
    if (!data.teachingMode) next.teachingMode = t("ob3ModeRequiredError");
    if (!data.experience) next.experience = t("ob3ExperienceRequiredError");
    setErrors(next);
    if (Object.keys(next).length === 0) onContinue();
  }

  const canContinue =
    !!data.tutorType && data.subjects.length > 0 && data.studentLevels.length > 0 && !!data.teachingMode && !!data.experience;

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-slate-50 mb-1.5 tracking-tight">{t("ob3Title")}</h1>
      <p className="text-sm text-slate-400 mb-7 leading-relaxed">{t("ob3Subtitle")}</p>

      {/* Tutor type */}
      <div className="mb-6">
        <SectionLabel required>{t("ob3TutorTypeQuestion")}</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5">
          {TUTOR_TYPE_OPTIONS.map((opt) => {
            const active = data.tutorType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { update({ tutorType: opt.value }); setErrors((e) => ({ ...e, tutorType: "" })); }}
                className={`rounded-2xl border px-3.5 py-3.5 text-left transition-colors ${
                  active ? "border-brand-400 bg-brand-500/10" : "border-white/10 bg-white/5 hover:bg-white/[0.07]"
                }`}
              >
                <div className="text-lg mb-1">{opt.icon}</div>
                <div className="text-[13px] font-bold text-slate-100 leading-tight">{opt.label}</div>
              </button>
            );
          })}
        </div>
        {errors.tutorType && <FieldError>{errors.tutorType}</FieldError>}
      </div>

      {/* Subjects */}
      <div className="mb-6">
        <SectionLabel required>{t("ob3SubjectsQuestion")}</SectionLabel>
        <input
          type="text"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          placeholder={t("ob3SubjectsSearchPlaceholder")}
          className="w-full mb-3 rounded-2xl border border-white/10 px-3.5 py-3 text-[14px] text-slate-50 placeholder-slate-500 bg-white/5 outline-none focus:border-brand-400 focus:bg-brand-500/10 transition-colors"
        />
        <div className="flex flex-wrap gap-2">
          {filteredSubjects.map((s) => (
            <Chip key={s} active={data.subjects.includes(s)} onClick={() => update({ subjects: toggleInArray(data.subjects, s) })}>
              {s}
            </Chip>
          ))}
          {data.subjects.filter((s) => !(SUBJECT_OPTIONS as readonly string[]).includes(s)).map((s) => (
            <Chip key={s} active onClick={() => update({ subjects: toggleInArray(data.subjects, s) })}>
              {s} ✕
            </Chip>
          ))}
          <Chip active={showOtherSubject} onClick={() => setShowOtherSubject((v) => !v)}>
            {t("ob3SubjectOther")} +
          </Chip>
        </div>
        {showOtherSubject && (
          <div className="flex gap-2 mt-2.5">
            <input
              type="text"
              value={otherSubject}
              onChange={(e) => setOtherSubject(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOtherSubject(); } }}
              placeholder={t("ob3SubjectOtherPlaceholder")}
              className="flex-1 rounded-xl border border-white/10 px-3.5 py-2.5 text-[14px] text-slate-50 placeholder-slate-500 bg-white/5 outline-none focus:border-brand-400"
            />
            <button type="button" onClick={addOtherSubject} className="px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[13px] font-extrabold transition-colors">
              {t("continue")}
            </button>
          </div>
        )}
        {errors.subjects && <FieldError>{errors.subjects}</FieldError>}
      </div>

      {/* Student levels */}
      <div className="mb-6">
        <SectionLabel required>{t("ob3LevelsQuestion")}</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {STUDENT_LEVEL_OPTIONS.map((lvl) => (
            <Chip
              key={lvl.value}
              active={data.studentLevels.includes(lvl.value)}
              onClick={() => { update({ studentLevels: toggleInArray(data.studentLevels, lvl.value) }); setErrors((e) => ({ ...e, studentLevels: "" })); }}
            >
              {lvl.label}{lvl.sub ? ` (${lvl.sub})` : ""}
            </Chip>
          ))}
        </div>
        {errors.studentLevels && <FieldError>{errors.studentLevels}</FieldError>}
      </div>

      {/* Streams — only if Higher Secondary selected */}
      {showStreams && (
        <div className="mb-6">
          <SectionLabel>{t("ob3StreamsQuestion")}</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {STREAM_OPTIONS.map((s) => (
              <Chip key={s.value} active={data.streams.includes(s.value)} onClick={() => update({ streams: toggleInArray(data.streams, s.value) })}>
                {s.label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Curriculum boards — only when a school-relevant level is selected */}
      {showBoards && (
        <div className="mb-6">
          <SectionLabel>{t("ob3BoardsQuestion")}</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {CURRICULUM_BOARD_OPTIONS.map((b) => (
              <Chip key={b.value} active={data.curriculumBoards.includes(b.value)} onClick={() => update({ curriculumBoards: toggleInArray(data.curriculumBoards, b.value) })}>
                {b.label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Teaching mode */}
      <div className="mb-6">
        <SectionLabel required>{t("ob3ModeQuestion")}</SectionLabel>
        <div className="grid grid-cols-3 gap-2.5">
          {TEACHING_MODE_OPTIONS.map((m) => {
            const active = data.teachingMode === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => { update({ teachingMode: m.value }); setErrors((e) => ({ ...e, teachingMode: "" })); }}
                className={`rounded-2xl border px-2 py-3.5 text-center transition-colors ${
                  active ? "border-brand-400 bg-brand-500/10" : "border-white/10 bg-white/5 hover:bg-white/[0.07]"
                }`}
              >
                <div className="text-xl mb-1">{m.icon}</div>
                <div className="text-[12.5px] font-bold text-slate-100">{m.label}</div>
              </button>
            );
          })}
        </div>
        {errors.teachingMode && <FieldError>{errors.teachingMode}</FieldError>}
      </div>

      {showServiceArea && (
        <div className="mb-6">
          <SectionLabel>{t("ob3ServiceAreaLabel")}</SectionLabel>
          <input
            type="text"
            value={serviceAreaValue}
            onChange={(e) => update({ offlineServiceAreas: e.target.value.trim() ? [e.target.value] : [] })}
            placeholder={t("ob3ServiceAreaPlaceholder")}
            className="w-full rounded-2xl border border-white/10 px-3.5 py-3.5 text-[15px] text-slate-50 placeholder-slate-500 bg-white/5 outline-none focus:border-brand-400 focus:bg-brand-500/10 transition-colors"
          />
          <p className="mt-1.5 ml-0.5 text-xs text-slate-500">{t("ob3ServiceAreaHint")}</p>
        </div>
      )}

      {/* Experience */}
      <div className="mb-6">
        <SectionLabel required>{t("ob3ExperienceQuestion")}</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {EXPERIENCE_OPTIONS.map((ex) => (
            <Chip
              key={ex.value}
              active={data.experience === ex.value}
              onClick={() => { update({ experience: ex.value }); setErrors((e) => ({ ...e, experience: "" })); }}
            >
              {ex.label}
            </Chip>
          ))}
        </div>
        {errors.experience && <FieldError>{errors.experience}</FieldError>}
      </div>

      <div className="flex gap-3">
        <SecondaryButton onClick={onBack} disabled={saving}>{t("back")}</SecondaryButton>
        <div className="flex-1">
          <PrimaryButton onClick={validateAndContinue} disabled={saving || !canContinue} loading={saving}>
            {t("onboardingContinue")} →
          </PrimaryButton>
        </div>
      </div>
      <TextLink onClick={onSaveLater} disabled={saving}>{t("onboardingSaveLater")}</TextLink>
    </div>
  );
}

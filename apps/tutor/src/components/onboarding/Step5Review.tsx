"use client";
// apps/tutor/src/components/onboarding/Step5Review.tsx
// Onboarding Step 5 — Review & Submit. Read-only summary cards (each
// with an Edit link back to the relevant step), a verification
// checklist, two required (never pre-checked) declarations, and the
// final submit — which calls functions/src/tutorAccounts.ts's
// submitTutorOnboarding, the only thing in this whole flow allowed to
// move profileStatus/onboardingVerificationStatus (see that file's
// header for why). See ../../app/onboarding/page.tsx for the caller.

import { useState } from "react";
import { useTutorT } from "@gloows/tutor-i18n";
import {
  TUTOR_TYPE_OPTIONS, STUDENT_LEVEL_OPTIONS, CURRICULUM_BOARD_OPTIONS,
  TEACHING_MODE_OPTIONS, EXPERIENCE_OPTIONS, QUALIFICATION_OPTIONS,
} from "@/lib/onboardingOptions";
import type { OnboardingData } from "@/lib/onboardingTypes";
import { Banner, PrimaryButton, SecondaryButton } from "./OnboardingUI";

function labelFor(options: { value: string; label: string }[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function Check({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className={`flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-black shrink-0 ${done ? "bg-green-400 text-[#0B1226]" : "bg-white/10 text-slate-500"}`}>
        {done ? "✓" : "—"}
      </span>
      <span className={`text-[13px] ${done ? "text-slate-200" : "text-slate-500"}`}>{label}</span>
    </div>
  );
}

function Card({ title, onEdit, editLabel, children }: { title: string; onEdit: () => void; editLabel: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-4">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[13.5px] font-extrabold text-slate-100">{title}</span>
        <button type="button" onClick={onEdit} className="text-xs font-extrabold text-brand-300 hover:text-brand-200 transition-colors">
          {editLabel}
        </button>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 text-[13px]">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-200 font-semibold text-right">{value}</span>
    </div>
  );
}

type Props = {
  data: OnboardingData;
  email: string | null;
  onEditStep: (step: number) => void;
  onBack: () => void;
  onSubmit: () => Promise<void>;
  submitting: boolean;
  submitError: string | null;
};

export default function Step5Review({ data, email, onEditStep, onBack, onSubmit, submitting, submitError }: Props) {
  const { t } = useTutorT();
  const [confirmAccurate, setConfirmAccurate] = useState(false);
  const [confirmTerms, setConfirmTerms] = useState(false);
  const [declarationsError, setDeclarationsError] = useState<string | null>(null);

  const streamLabel = data.streams.length ? ` (${data.streams.join(", ")})` : "";
  const boardsLabel = data.curriculumBoards.map((b) => labelFor(CURRICULUM_BOARD_OPTIONS, b)).join(", ");
  const modeLabel = labelFor(TEACHING_MODE_OPTIONS, data.teachingMode) + (data.offlineServiceAreas[0] ? ` — ${data.offlineServiceAreas[0]}` : "");
  const qualificationLabel = data.highestQualification === "OTHER" ? data.qualificationOtherText : labelFor(QUALIFICATION_OPTIONS, data.highestQualification);

  const qualificationDocCount = data.qualificationDocuments.length;
  const experienceDocCount = data.experienceDocuments.length;

  function handleSubmit() {
    if (!confirmAccurate || !confirmTerms) {
      setDeclarationsError(t("ob5DeclarationsRequiredError"));
      return;
    }
    setDeclarationsError(null);
    onSubmit();
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-slate-50 mb-1.5 tracking-tight">{t("ob5Title")}</h1>
      <p className="text-sm text-slate-400 mb-6 leading-relaxed">{t("ob5Subtitle")}</p>

      <Card title={t("ob5BasicInfoCard")} onEdit={() => onEditStep(2)} editLabel={t("ob5Edit")}>
        {data.profilePic && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.profilePic} alt="" className="w-12 h-12 rounded-full object-cover mb-2 border border-white/10" />
        )}
        <Row label="Name" value={data.name} />
        <Row label="Mobile" value={data.phoneVerified ? `+91 ${data.phoneNumber} ✓` : data.phoneNumber} />
        <Row label="Location" value={[data.city, data.state, data.pinCode].filter(Boolean).join(", ")} />
      </Card>

      <Card title={t("ob5TeachingProfileCard")} onEdit={() => onEditStep(3)} editLabel={t("ob5Edit")}>
        <Row label="Type" value={labelFor(TUTOR_TYPE_OPTIONS, data.tutorType)} />
        <Row label="Subjects" value={data.subjects.join(", ")} />
        <Row label="Levels" value={data.studentLevels.map((l) => labelFor(STUDENT_LEVEL_OPTIONS, l)).join(", ") + streamLabel} />
        {boardsLabel && <Row label="Boards" value={boardsLabel} />}
        <Row label="Mode" value={modeLabel} />
        <Row label="Experience" value={labelFor(EXPERIENCE_OPTIONS, data.experience)} />
      </Card>

      <Card title={t("ob5QualificationsCard")} onEdit={() => onEditStep(4)} editLabel={t("ob5Edit")}>
        <Row label="Qualification" value={qualificationLabel} />
        <Row label="Degree" value={data.degreeName} />
        <Row label="Institution" value={data.institutionName} />
        <Row label="Year" value={data.completionYear} />
        {data.specialization && <Row label="Specialization" value={data.specialization} />}
        <p className="text-[13px] text-slate-300 mt-2 leading-relaxed">{data.bio}</p>
      </Card>

      {/* Verification summary */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-4">
        <p className="text-[11px] font-bold text-slate-500 tracking-widest mb-1.5">{t("ob5AccountSection").toUpperCase()}</p>
        <Check done={!!email} label={t("ob5EmailVerified")} />
        <Check done={data.phoneVerified} label={t("ob5MobileVerified")} />

        <p className="text-[11px] font-bold text-slate-500 tracking-widest mb-1.5 mt-3">{t("ob5ProfileSection").toUpperCase()}</p>
        <Check done={!!data.name && !!data.city && !!data.state && !!data.profilePic && !!data.gender} label={t("ob5BasicCompleted")} />
        <Check done={!!data.tutorType && data.subjects.length > 0} label={t("ob5TeachingCompleted")} />

        <p className="text-[11px] font-bold text-slate-500 tracking-widest mb-1.5 mt-3">{t("ob5DocumentsSection").toUpperCase()}</p>
        <div className="flex items-center justify-between text-[13px] py-1">
          <span className="text-slate-400">{t("ob5QualificationDocStatus")}</span>
          <span className={qualificationDocCount ? "text-green-400 font-bold" : "text-slate-500"}>
            {qualificationDocCount ? t("ob5Submitted") : t("ob5NotSubmitted")}
          </span>
        </div>
        <div className="flex items-center justify-between text-[13px] py-1">
          <span className="text-slate-400">{t("ob5ExperienceDocStatus")}</span>
          <span className={experienceDocCount ? "text-green-400 font-bold" : "text-slate-500"}>
            {experienceDocCount ? t("ob5Submitted") : t("ob5NotSubmitted")}
          </span>
        </div>
      </div>

      {/* Declarations — never pre-checked */}
      <label className="flex items-start gap-3 mb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmAccurate}
          onChange={(e) => { setConfirmAccurate(e.target.checked); setDeclarationsError(null); }}
          className="mt-0.5 w-5 h-5 rounded border-white/20 bg-white/5 accent-brand-500 shrink-0"
        />
        <span className="text-[13px] text-slate-300 leading-relaxed">{t("ob5ConfirmAccurate")}</span>
      </label>
      <label className="flex items-start gap-3 mb-5 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmTerms}
          onChange={(e) => { setConfirmTerms(e.target.checked); setDeclarationsError(null); }}
          className="mt-0.5 w-5 h-5 rounded border-white/20 bg-white/5 accent-brand-500 shrink-0"
        />
        <span className="text-[13px] text-slate-300 leading-relaxed">{t("ob5ConfirmTerms")}</span>
      </label>
      {declarationsError && <Banner tone="error">{declarationsError}</Banner>}
      {submitError && <Banner tone="error">{submitError}</Banner>}

      <div className="flex gap-3">
        <SecondaryButton onClick={onBack} disabled={submitting}>{t("back")}</SecondaryButton>
        <div className="flex-1">
          <PrimaryButton
            onClick={handleSubmit}
            disabled={submitting || !confirmAccurate || !confirmTerms}
            loading={submitting}
            loadingLabel={t("ob5Submitting")}
          >
            {t("ob5SubmitButton")}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

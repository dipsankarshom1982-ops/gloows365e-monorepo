"use client";
// apps/tutor/src/components/onboarding/Step4Qualifications.tsx
// Onboarding Step 4 — Qualifications & Expertise: highest qualification,
// degree/institution/year, about-you bio, and three document-upload
// categories. See ../../app/onboarding/page.tsx's header for the flow.
//
// No AI-assisted bio suggestion button — the spec asked for one only
// "if this feature already exists in the platform," and it doesn't
// (checked: no bio-generation callable or UI anywhere in this repo).
// Adding a new LLM-backed feature here would be new product scope, not
// a wiring task, so it's left out rather than half-built.

import { useRef, useState } from "react";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useTutorT } from "@gloows/tutor-i18n";
import type { TutorOnboardingDocument } from "@gloows/shared-logic";
import { QUALIFICATION_OPTIONS, MIN_BIO_LENGTH, MAX_BIO_LENGTH, CURRENT_YEAR } from "@/lib/onboardingOptions";
import type { OnboardingData } from "@/lib/onboardingTypes";
import { Chip, FieldError, PrimaryButton, SecondaryButton, SectionLabel, TextField, TextLink } from "./OnboardingUI";

const ACCEPTED_TYPES = "application/pdf,image/jpeg,image/jpg,image/png";
const MAX_DOC_BYTES = 10 * 1024 * 1024;

type DocCategory = "qualification" | "experience" | "certificate";
type Props = {
  uid: string;
  data: OnboardingData;
  update: (patch: Partial<OnboardingData>) => void;
  onContinue: () => void;
  onBack: () => void;
  onSaveLater: () => void;
  saving: boolean;
};

function DocumentUploader({
  uid, category, docs, onChange, multiple, uploadLabel,
}: {
  uid: string; category: DocCategory; docs: TutorOnboardingDocument[];
  onChange: (docs: TutorOnboardingDocument[]) => void; multiple?: boolean;
  uploadLabel: string;
}) {
  const { t } = useTutorT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_DOC_BYTES) { setError("File must be under 10MB"); return; }
    if (!ACCEPTED_TYPES.split(",").includes(file.type)) { setError("Only PDF, JPG, JPEG or PNG are accepted"); return; }

    setError(null);
    setUploading(true);
    try {
      // Flat path (single segment after {uid}) — matches
      // storage.rules' tutorDocuments/{userId}/{fileName} exactly.
      const storagePath = `tutorDocuments/${uid}/${category}_${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const newDoc: TutorOnboardingDocument = { name: file.name, storagePath: url, status: "submitted", uploadedAt: new Date() };
      onChange(multiple ? [...docs, newDoc] : [newDoc]);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(index: number) {
    const doc = docs[index];
    onChange(docs.filter((_, i) => i !== index));
    if (!doc) return;
    try { await deleteObject(ref(storage, doc.storagePath)); } catch { /* best-effort, see Step2's photo remove */ }
  }

  return (
    <div>
      {docs.length > 0 && (
        <ul className="space-y-2 mb-2.5">
          {docs.map((d, i) => (
            <li key={d.storagePath} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5">
              <span className="flex items-center gap-2 text-[13px] text-slate-200 font-semibold truncate">
                📎 <span className="truncate">{d.name}</span>
              </span>
              <button type="button" onClick={() => handleRemove(i)} className="text-xs font-bold text-slate-500 hover:text-red-300 transition-colors shrink-0 ml-2">
                {t("ob4RemoveFile")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {(multiple || docs.length === 0) && (
        <>
          <input ref={inputRef} type="file" accept={ACCEPTED_TYPES} className="hidden" onChange={handleSelect} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-[13px] font-extrabold text-brand-300 hover:text-brand-200 transition-colors disabled:opacity-50"
          >
            {uploading ? t("ob4Uploading") : docs.length > 0 ? t("ob4AddAnother") : uploadLabel}
          </button>
        </>
      )}
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

export default function Step4Qualifications({ uid, data, update, onContinue, onBack, onSaveLater, saving }: Props) {
  const { t } = useTutorT();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validateAndContinue() {
    const next: Record<string, string> = {};
    if (!data.highestQualification || (data.highestQualification === "OTHER" && !data.qualificationOtherText.trim())) {
      next.highestQualification = t("ob4QualificationRequiredError");
    }
    if (!data.degreeName.trim()) next.degreeName = t("ob4DegreeRequiredError");
    if (!data.institutionName.trim()) next.institutionName = t("ob4InstitutionRequiredError");
    if (!data.completionYear) next.completionYear = t("ob4YearRequiredError");
    if (!data.specialization.trim()) next.specialization = t("ob4SpecializationRequiredError");
    if (data.bio.trim().length < MIN_BIO_LENGTH) next.bio = t("ob4AboutTooShort", { min: MIN_BIO_LENGTH });
    if (data.qualificationDocuments.length === 0) next.qualificationDocuments = t("ob4QualificationDocRequiredError");
    if (data.experienceDocuments.length === 0) next.experienceDocuments = t("ob4ExperienceDocRequiredError");
    if (data.additionalCertificates.length === 0) next.additionalCertificates = t("ob4CertificatesRequiredError");
    setErrors(next);
    if (Object.keys(next).length === 0) onContinue();
  }

  const canContinue =
    !!data.highestQualification &&
    !(data.highestQualification === "OTHER" && !data.qualificationOtherText.trim()) &&
    !!data.degreeName.trim() && !!data.institutionName.trim() && !!data.completionYear &&
    !!data.specialization.trim() &&
    data.bio.trim().length >= MIN_BIO_LENGTH &&
    data.qualificationDocuments.length > 0 &&
    data.experienceDocuments.length > 0 &&
    data.additionalCertificates.length > 0;

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-slate-50 mb-1.5 tracking-tight">{t("ob4Title")}</h1>
      <p className="text-sm text-slate-400 mb-7 leading-relaxed">{t("ob4Subtitle")}</p>

      {/* Highest qualification */}
      <div className="mb-5">
        <SectionLabel required>{t("ob4QualificationQuestion")}</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {QUALIFICATION_OPTIONS.map((q) => (
            <Chip
              key={q.value}
              active={data.highestQualification === q.value}
              onClick={() => { update({ highestQualification: q.value }); setErrors((e) => ({ ...e, highestQualification: "" })); }}
            >
              {q.label}
            </Chip>
          ))}
        </div>
        {data.highestQualification === "OTHER" && (
          <input
            type="text"
            value={data.qualificationOtherText}
            onChange={(e) => update({ qualificationOtherText: e.target.value })}
            placeholder={t("ob4QualificationOtherPlaceholder")}
            className="w-full mt-2.5 rounded-xl border border-white/10 px-3.5 py-2.5 text-[14px] text-slate-50 placeholder-slate-500 bg-white/5 outline-none focus:border-brand-400"
          />
        )}
        {errors.highestQualification && <FieldError>{errors.highestQualification}</FieldError>}
      </div>

      <TextField
        id="ob4-degree" label={t("ob4DegreeLabel")} required
        value={data.degreeName} onChange={(v) => { update({ degreeName: v }); setErrors((e) => ({ ...e, degreeName: "" })); }}
        placeholder={t("ob4DegreePlaceholder")} error={errors.degreeName}
      />
      <TextField
        id="ob4-institution" label={t("ob4InstitutionLabel")} required
        value={data.institutionName} onChange={(v) => { update({ institutionName: v }); setErrors((e) => ({ ...e, institutionName: "" })); }}
        placeholder={t("ob4InstitutionPlaceholder")} error={errors.institutionName}
      />
      <TextField
        id="ob4-year" label={t("ob4YearLabel")} required type="number" inputMode="numeric"
        value={data.completionYear} onChange={(v) => { update({ completionYear: v.slice(0, 4) }); setErrors((e) => ({ ...e, completionYear: "" })); }}
        placeholder={String(CURRENT_YEAR)} error={errors.completionYear}
      />
      <TextField
        id="ob4-specialization" label={t("ob4SpecializationLabel")} required
        value={data.specialization} onChange={(v) => { update({ specialization: v }); setErrors((e) => ({ ...e, specialization: "" })); }}
        placeholder={t("ob4SpecializationPlaceholder")} error={errors.specialization}
      />

      {/* About */}
      <div className="mb-6">
        <SectionLabel required>{t("ob4AboutQuestion")}</SectionLabel>
        <textarea
          rows={5}
          value={data.bio}
          onChange={(e) => { update({ bio: e.target.value.slice(0, MAX_BIO_LENGTH) }); if (errors.bio) setErrors((er) => ({ ...er, bio: "" })); }}
          placeholder={t("ob4AboutPlaceholder")}
          className={`w-full rounded-2xl border px-3.5 py-3.5 text-[15px] text-slate-50 placeholder-slate-500 bg-white/5 outline-none resize-none transition-colors focus:border-brand-400 focus:bg-brand-500/10 ${
            errors.bio ? "border-red-400" : "border-white/10"
          }`}
        />
        <div className="flex items-center justify-between mt-1.5 ml-0.5">
          <span className={`text-xs ${data.bio.trim().length < MIN_BIO_LENGTH ? "text-slate-500" : "text-green-400"}`}>
            {t("ob4AboutCounter", { count: data.bio.length, max: MAX_BIO_LENGTH })}
          </span>
        </div>
        {errors.bio && <FieldError>{errors.bio}</FieldError>}
      </div>

      {/* Documents */}
      <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[13px] font-bold text-slate-200">{t("ob4QualificationDocTitle")}</span>
          <span className="text-[10px] font-extrabold text-red-400">*</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">{t("ob4QualificationDocHint")}</p>
        <DocumentUploader
          uid={uid} category="qualification" docs={data.qualificationDocuments}
          onChange={(docs) => { update({ qualificationDocuments: docs }); setErrors((e) => ({ ...e, qualificationDocuments: "" })); }}
          uploadLabel={t("ob4UploadFile")}
        />
        {errors.qualificationDocuments && <FieldError>{errors.qualificationDocuments}</FieldError>}
      </div>

      <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[13px] font-bold text-slate-200">{t("ob4ExperienceDocTitle")}</span>
          <span className="text-[10px] font-extrabold text-red-400">*</span>
        </div>
        <p className="text-xs text-slate-500 mb-3 mt-1">{t("ob4ExperienceDocHint")}</p>
        <DocumentUploader
          uid={uid} category="experience" docs={data.experienceDocuments}
          onChange={(docs) => { update({ experienceDocuments: docs }); setErrors((e) => ({ ...e, experienceDocuments: "" })); }}
          uploadLabel={t("ob4UploadFile")}
        />
        {errors.experienceDocuments && <FieldError>{errors.experienceDocuments}</FieldError>}
      </div>

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[13px] font-bold text-slate-200">{t("ob4CertificatesTitle")}</span>
          <span className="text-[10px] font-extrabold text-red-400">*</span>
        </div>
        <p className="text-xs text-slate-500 mb-3 mt-1">{t("ob4CertificatesHint")}</p>
        <DocumentUploader
          uid={uid} category="certificate" docs={data.additionalCertificates}
          onChange={(docs) => { update({ additionalCertificates: docs }); setErrors((e) => ({ ...e, additionalCertificates: "" })); }}
          multiple uploadLabel={t("ob4UploadFile")}
        />
        {errors.additionalCertificates && <FieldError>{errors.additionalCertificates}</FieldError>}
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

// apps/tutor-mobile/components/onboarding/Step4Qualifications.tsx
// Mirrors apps/tutor/src/components/onboarding/Step4Qualifications.tsx
// — highest qualification, degree/institution/year, about-you bio, and
// three document-upload categories. Uses expo-document-picker (already
// this app's established Storage-upload pattern — see
// app/(app)/verification.tsx), same as Step2's photo upload.
//
// No AI-assisted bio suggestion — see the web file's header; no such
// feature exists anywhere in this codebase to wire up.

import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "@/lib/firebase";
import type { TutorOnboardingDocument } from "@gloows/shared-logic";
import { QUALIFICATION_OPTIONS, MIN_BIO_LENGTH, MAX_BIO_LENGTH, CURRENT_YEAR } from "@/lib/onboardingOptions";
import type { OnboardingData } from "@/lib/onboardingTypes";
import { Chip, FieldError, PrimaryButton, SecondaryButton, SectionLabel, TextField, TextLink } from "./OnboardingUI";

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
  t: (k: string, o?: any) => string;
};

function DocumentUploader({
  uid, category, docs, onChange, multiple, uploadLabel, t,
}: {
  uid: string; category: DocCategory; docs: TutorOnboardingDocument[];
  onChange: (docs: TutorOnboardingDocument[]) => void; multiple?: boolean;
  uploadLabel: string; t: (k: string, o?: any) => string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePick() {
    const result = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf"], multiple });
    if (result.canceled || !result.assets?.length) return;

    setError(null);
    setUploading(true);
    try {
      const uploaded: TutorOnboardingDocument[] = [];
      for (const file of result.assets) {
        if ((file.size ?? 0) > MAX_DOC_BYTES) { setError("File must be under 10MB"); continue; }
        const storagePath = `tutorDocuments/${uid}/${category}_${Date.now()}_${file.name}`;
        const response = await fetch(file.uri);
        const blob = await response.blob();
        await uploadBytes(ref(storage, storagePath), blob);
        const url = await getDownloadURL(ref(storage, storagePath));
        uploaded.push({ name: file.name, storagePath: url, status: "submitted", uploadedAt: new Date() });
      }
      if (uploaded.length) onChange(multiple ? [...docs, ...uploaded] : uploaded);
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
    try { await deleteObject(ref(storage, doc.storagePath)); } catch { /* best-effort */ }
  }

  return (
    <View>
      {docs.length > 0 && (
        <View style={{ gap: 8, marginBottom: 10 }}>
          {docs.map((d, i) => (
            <View key={d.storagePath} style={styles.docRow}>
              <Text style={styles.docName} numberOfLines={1}>📎 {d.name}</Text>
              <TouchableOpacity onPress={() => handleRemove(i)}>
                <Text style={styles.docRemove}>{t("ob4RemoveFile")}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      {(multiple || docs.length === 0) && (
        <TouchableOpacity onPress={handlePick} disabled={uploading}>
          <Text style={styles.uploadLink}>
            {uploading ? t("ob4Uploading") : docs.length > 0 ? t("ob4AddAnother") : uploadLabel}
          </Text>
        </TouchableOpacity>
      )}
      {error && <FieldError>{error}</FieldError>}
    </View>
  );
}

export default function Step4Qualifications({ uid, data, update, onContinue, onBack, onSaveLater, saving, t }: Props) {
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
    <View>
      <Text style={styles.title}>{t("ob4Title")}</Text>
      <Text style={styles.subtitle}>{t("ob4Subtitle")}</Text>

      <View style={styles.section}>
        <SectionLabel required>{t("ob4QualificationQuestion")}</SectionLabel>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {QUALIFICATION_OPTIONS.map((q) => (
            <Chip
              key={q.value}
              active={data.highestQualification === q.value}
              onPress={() => { update({ highestQualification: q.value }); setErrors((e) => ({ ...e, highestQualification: "" })); }}
            >
              {q.label}
            </Chip>
          ))}
        </View>
        {data.highestQualification === "OTHER" && (
          <TextInput
            value={data.qualificationOtherText}
            onChangeText={(v) => update({ qualificationOtherText: v })}
            placeholder={t("ob4QualificationOtherPlaceholder")}
            placeholderTextColor="#5B6478"
            style={styles.otherInput}
          />
        )}
        {errors.highestQualification && <FieldError>{errors.highestQualification}</FieldError>}
      </View>

      <TextField
        label={t("ob4DegreeLabel")} required
        value={data.degreeName} onChangeText={(v) => { update({ degreeName: v }); setErrors((e) => ({ ...e, degreeName: "" })); }}
        placeholder={t("ob4DegreePlaceholder")} error={errors.degreeName}
      />
      <TextField
        label={t("ob4InstitutionLabel")} required
        value={data.institutionName} onChangeText={(v) => { update({ institutionName: v }); setErrors((e) => ({ ...e, institutionName: "" })); }}
        placeholder={t("ob4InstitutionPlaceholder")} error={errors.institutionName}
      />
      <TextField
        label={t("ob4YearLabel")} required keyboardType="numeric"
        value={data.completionYear} onChangeText={(v) => { update({ completionYear: v.replace(/\D/g, "").slice(0, 4) }); setErrors((e) => ({ ...e, completionYear: "" })); }}
        placeholder={String(CURRENT_YEAR)} error={errors.completionYear}
      />
      <TextField
        label={t("ob4SpecializationLabel")} required
        value={data.specialization} onChangeText={(v) => { update({ specialization: v }); setErrors((e) => ({ ...e, specialization: "" })); }}
        placeholder={t("ob4SpecializationPlaceholder")} error={errors.specialization}
      />

      <View style={styles.section}>
        <SectionLabel required>{t("ob4AboutQuestion")}</SectionLabel>
        <TextInput
          multiline
          numberOfLines={5}
          value={data.bio}
          onChangeText={(v) => { update({ bio: v.slice(0, MAX_BIO_LENGTH) }); if (errors.bio) setErrors((er) => ({ ...er, bio: "" })); }}
          placeholder={t("ob4AboutPlaceholder")}
          placeholderTextColor="#5B6478"
          style={[styles.bioInput, errors.bio && { borderColor: "#F87171" }]}
        />
        <Text style={[styles.counter, data.bio.trim().length >= MIN_BIO_LENGTH && { color: "#4ADE80" }]}>
          {t("ob4AboutCounter", { count: data.bio.length, max: MAX_BIO_LENGTH })}
        </Text>
        {errors.bio && <FieldError>{errors.bio}</FieldError>}
      </View>

      <View style={styles.docCard}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <Text style={styles.docTitle}>{t("ob4QualificationDocTitle")}</Text>
          <Text style={styles.docRequiredMark}>*</Text>
        </View>
        <Text style={styles.docHint}>{t("ob4QualificationDocHint")}</Text>
        <DocumentUploader
          uid={uid} category="qualification" docs={data.qualificationDocuments}
          onChange={(docs) => { update({ qualificationDocuments: docs }); setErrors((e) => ({ ...e, qualificationDocuments: "" })); }}
          uploadLabel={t("ob4UploadFile")} t={t}
        />
        {errors.qualificationDocuments && <FieldError>{errors.qualificationDocuments}</FieldError>}
      </View>

      <View style={styles.docCard}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <Text style={styles.docTitle}>{t("ob4ExperienceDocTitle")}</Text>
          <Text style={styles.docRequiredMark}>*</Text>
        </View>
        <Text style={styles.docHint}>{t("ob4ExperienceDocHint")}</Text>
        <DocumentUploader
          uid={uid} category="experience" docs={data.experienceDocuments}
          onChange={(docs) => { update({ experienceDocuments: docs }); setErrors((e) => ({ ...e, experienceDocuments: "" })); }}
          uploadLabel={t("ob4UploadFile")} t={t}
        />
        {errors.experienceDocuments && <FieldError>{errors.experienceDocuments}</FieldError>}
      </View>

      <View style={[styles.docCard, { marginBottom: 8 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <Text style={styles.docTitle}>{t("ob4CertificatesTitle")}</Text>
          <Text style={styles.docRequiredMark}>*</Text>
        </View>
        <Text style={styles.docHint}>{t("ob4CertificatesHint")}</Text>
        <DocumentUploader
          uid={uid} category="certificate" docs={data.additionalCertificates}
          onChange={(docs) => { update({ additionalCertificates: docs }); setErrors((e) => ({ ...e, additionalCertificates: "" })); }}
          multiple uploadLabel={t("ob4UploadFile")} t={t}
        />
        {errors.additionalCertificates && <FieldError>{errors.additionalCertificates}</FieldError>}
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <SecondaryButton onPress={onBack} disabled={saving}>{t("back")}</SecondaryButton>
        <View style={{ flex: 1 }}>
          <PrimaryButton onPress={validateAndContinue} disabled={saving || !canContinue} loading={saving} loadingLabel={t("loading")}>
            {`${t("onboardingContinue")} →`}
          </PrimaryButton>
        </View>
      </View>
      <TextLink onPress={onSaveLater} disabled={saving}>{t("onboardingSaveLater")}</TextLink>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "800", color: "#F8FAFC", marginBottom: 6, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: "#94A3B8", marginBottom: 22, lineHeight: 20 },
  section: { marginBottom: 16 },

  otherInput: {
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    color: "#F8FAFC", fontSize: 14,
  },

  bioInput: {
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, minHeight: 110, textAlignVertical: "top",
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.10)",
    color: "#F8FAFC", fontSize: 15,
  },
  counter: { color: "#64748B", fontSize: 12, marginTop: 6, marginLeft: 2 },

  docCard: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.03)", padding: 14, marginBottom: 14 },
  docTitle: { color: "#E2E8F0", fontSize: 13.5, fontWeight: "700" },
  docRequiredMark: { color: "#F87171", fontSize: 10, fontWeight: "900" },
  docHint: { color: "#64748B", fontSize: 12, marginBottom: 10, marginTop: 4 },

  docRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.05)", paddingHorizontal: 12, paddingVertical: 10 },
  docName: { flex: 1, color: "#CBD5E1", fontSize: 13, fontWeight: "600", marginRight: 8 },
  docRemove: { color: "#64748B", fontSize: 12, fontWeight: "700" },
  uploadLink: { color: "#A5B4FC", fontSize: 13, fontWeight: "800" },
});

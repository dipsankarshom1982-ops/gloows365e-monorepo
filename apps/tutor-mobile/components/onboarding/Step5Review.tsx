// apps/tutor-mobile/components/onboarding/Step5Review.tsx
// Mirrors apps/tutor/src/components/onboarding/Step5Review.tsx —
// editable summary cards, verification checklist, two required (never
// pre-checked) declarations, final submit via submitTutorOnboarding.

import { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  TUTOR_TYPE_OPTIONS, STUDENT_LEVEL_OPTIONS, CURRICULUM_BOARD_OPTIONS,
  TEACHING_MODE_OPTIONS, EXPERIENCE_OPTIONS, QUALIFICATION_OPTIONS,
} from "@/lib/onboardingOptions";
import type { OnboardingData } from "@/lib/onboardingTypes";
import { Banner, PrimaryButton, SecondaryButton } from "./OnboardingUI";

function labelFor(options: { value: string; label: string }[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function CheckRow({ done, label }: { done: boolean; label: string }) {
  return (
    <View style={styles.checkRow}>
      <View style={[styles.checkBadge, done ? styles.checkBadgeDone : styles.checkBadgeUndone]}>
        <Text style={done ? styles.checkBadgeTextDone : styles.checkBadgeTextUndone}>{done ? "✓" : "—"}</Text>
      </View>
      <Text style={[styles.checkLabel, done && { color: "#E2E8F0" }]}>{label}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
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
  t: (k: string, o?: any) => string;
};

export default function Step5Review({ data, email, onEditStep, onBack, onSubmit, submitting, submitError, t }: Props) {
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
    <View>
      <Text style={styles.title}>{t("ob5Title")}</Text>
      <Text style={styles.subtitle}>{t("ob5Subtitle")}</Text>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t("ob5BasicInfoCard")}</Text>
          <TouchableOpacity onPress={() => onEditStep(2)}><Text style={styles.editLink}>{t("ob5Edit")}</Text></TouchableOpacity>
        </View>
        {!!data.profilePic && <Image source={{ uri: data.profilePic }} style={styles.avatar} />}
        <Row label="Name" value={data.name} />
        <Row label="Mobile" value={data.phoneVerified ? `+91 ${data.phoneNumber} ✓` : data.phoneNumber} />
        <Row label="Location" value={[data.city, data.state, data.pinCode].filter(Boolean).join(", ")} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t("ob5TeachingProfileCard")}</Text>
          <TouchableOpacity onPress={() => onEditStep(3)}><Text style={styles.editLink}>{t("ob5Edit")}</Text></TouchableOpacity>
        </View>
        <Row label="Type" value={labelFor(TUTOR_TYPE_OPTIONS, data.tutorType)} />
        <Row label="Subjects" value={data.subjects.join(", ")} />
        <Row label="Levels" value={data.studentLevels.map((l) => labelFor(STUDENT_LEVEL_OPTIONS, l)).join(", ") + streamLabel} />
        {!!boardsLabel && <Row label="Boards" value={boardsLabel} />}
        <Row label="Mode" value={modeLabel} />
        <Row label="Experience" value={labelFor(EXPERIENCE_OPTIONS, data.experience)} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t("ob5QualificationsCard")}</Text>
          <TouchableOpacity onPress={() => onEditStep(4)}><Text style={styles.editLink}>{t("ob5Edit")}</Text></TouchableOpacity>
        </View>
        <Row label="Qualification" value={qualificationLabel} />
        <Row label="Degree" value={data.degreeName} />
        <Row label="Institution" value={data.institutionName} />
        <Row label="Year" value={data.completionYear} />
        {!!data.specialization && <Row label="Specialization" value={data.specialization} />}
        <Text style={styles.bioText}>{data.bio}</Text>
      </View>

      {/* Verification summary */}
      <View style={styles.card}>
        <Text style={styles.sectionHeading}>{t("ob5AccountSection").toUpperCase()}</Text>
        <CheckRow done={!!email} label={t("ob5EmailVerified")} />
        <CheckRow done={data.phoneVerified} label={t("ob5MobileVerified")} />

        <Text style={[styles.sectionHeading, { marginTop: 10 }]}>{t("ob5ProfileSection").toUpperCase()}</Text>
        <CheckRow done={!!data.name && !!data.city && !!data.state} label={t("ob5BasicCompleted")} />
        <CheckRow done={!!data.tutorType && data.subjects.length > 0} label={t("ob5TeachingCompleted")} />

        <Text style={[styles.sectionHeading, { marginTop: 10 }]}>{t("ob5DocumentsSection").toUpperCase()}</Text>
        <View style={styles.docStatusRow}>
          <Text style={styles.docStatusLabel}>{t("ob5QualificationDocStatus")}</Text>
          <Text style={[styles.docStatusValue, qualificationDocCount ? { color: "#4ADE80" } : {}]}>
            {qualificationDocCount ? t("ob5Submitted") : t("ob5NotSubmitted")}
          </Text>
        </View>
        <View style={styles.docStatusRow}>
          <Text style={styles.docStatusLabel}>{t("ob5ExperienceDocStatus")}</Text>
          <Text style={[styles.docStatusValue, experienceDocCount ? { color: "#4ADE80" } : {}]}>
            {experienceDocCount ? t("ob5Submitted") : t("ob5OptionalLabel")}
          </Text>
        </View>
      </View>

      {/* Declarations — never pre-checked */}
      <TouchableOpacity style={styles.declarationRow} onPress={() => { setConfirmAccurate((v) => !v); setDeclarationsError(null); }} activeOpacity={0.8}>
        <View style={[styles.checkbox, confirmAccurate && styles.checkboxChecked]}>
          {confirmAccurate && <Text style={styles.checkboxMark}>✓</Text>}
        </View>
        <Text style={styles.declarationText}>{t("ob5ConfirmAccurate")}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.declarationRow} onPress={() => { setConfirmTerms((v) => !v); setDeclarationsError(null); }} activeOpacity={0.8}>
        <View style={[styles.checkbox, confirmTerms && styles.checkboxChecked]}>
          {confirmTerms && <Text style={styles.checkboxMark}>✓</Text>}
        </View>
        <Text style={styles.declarationText}>{t("ob5ConfirmTerms")}</Text>
      </TouchableOpacity>

      {declarationsError && <Banner tone="error">{declarationsError}</Banner>}
      {submitError && <Banner tone="error">{submitError}</Banner>}

      <View style={{ flexDirection: "row", gap: 12 }}>
        <SecondaryButton onPress={onBack} disabled={submitting}>{t("back")}</SecondaryButton>
        <View style={{ flex: 1 }}>
          <PrimaryButton
            onPress={handleSubmit}
            disabled={submitting || !confirmAccurate || !confirmTerms}
            loading={submitting}
            loadingLabel={t("ob5Submitting")}
          >
            {t("ob5SubmitButton")}
          </PrimaryButton>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "800", color: "#F8FAFC", marginBottom: 6, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: "#94A3B8", marginBottom: 20, lineHeight: 20 },

  card: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.03)", padding: 14, marginBottom: 14 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  cardTitle: { color: "#F1F5F9", fontSize: 13.5, fontWeight: "800" },
  editLink: { color: "#A5B4FC", fontSize: 12, fontWeight: "800" },
  avatar: { width: 48, height: 48, borderRadius: 24, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  bioText: { color: "#CBD5E1", fontSize: 13, lineHeight: 19, marginTop: 6 },

  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10, paddingVertical: 2 },
  rowLabel: { color: "#64748B", fontSize: 13 },
  rowValue: { color: "#E2E8F0", fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },

  sectionHeading: { color: "#64748B", fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 },
  checkBadge: { width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  checkBadgeDone: { backgroundColor: "#4ADE80" },
  checkBadgeUndone: { backgroundColor: "rgba(255,255,255,0.10)" },
  checkBadgeTextDone: { color: "#0B1226", fontSize: 10, fontWeight: "900" },
  checkBadgeTextUndone: { color: "#64748B", fontSize: 10, fontWeight: "900" },
  checkLabel: { color: "#64748B", fontSize: 13 },

  docStatusRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  docStatusLabel: { color: "#94A3B8", fontSize: 13 },
  docStatusValue: { color: "#64748B", fontSize: 13, fontWeight: "700" },

  declarationRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)", backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkboxChecked: { backgroundColor: "#6366F1", borderColor: "#6366F1" },
  checkboxMark: { color: "#fff", fontSize: 12, fontWeight: "900" },
  declarationText: { flex: 1, color: "#CBD5E1", fontSize: 13, lineHeight: 19 },
});

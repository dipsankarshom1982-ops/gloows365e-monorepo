// apps/tutor-mobile/components/onboarding/Step3TeachingProfile.tsx
// Mirrors apps/tutor/src/components/onboarding/Step3TeachingProfile.tsx
// — tutor type, subjects, student levels (+streams), curriculum boards,
// teaching mode, experience.

import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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
  t: (k: string, o?: any) => string;
};

function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export default function Step3TeachingProfile({ data, update, onContinue, onBack, onSaveLater, saving, t }: Props) {
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
    <View>
      <Text style={styles.title}>{t("ob3Title")}</Text>
      <Text style={styles.subtitle}>{t("ob3Subtitle")}</Text>

      {/* Tutor type */}
      <View style={styles.section}>
        <SectionLabel required>{t("ob3TutorTypeQuestion")}</SectionLabel>
        <View style={styles.grid2}>
          {TUTOR_TYPE_OPTIONS.map((opt) => {
            const active = data.tutorType === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => { update({ tutorType: opt.value }); setErrors((e) => ({ ...e, tutorType: "" })); }}
                style={[styles.typeCard, active && styles.typeCardActive]}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 18, marginBottom: 4 }}>{opt.icon}</Text>
                <Text style={styles.typeCardText}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {errors.tutorType && <FieldError>{errors.tutorType}</FieldError>}
      </View>

      {/* Subjects */}
      <View style={styles.section}>
        <SectionLabel required>{t("ob3SubjectsQuestion")}</SectionLabel>
        <TextInput
          value={subjectFilter}
          onChangeText={setSubjectFilter}
          placeholder={t("ob3SubjectsSearchPlaceholder")}
          placeholderTextColor="#5B6478"
          style={styles.searchInput}
        />
        <View style={styles.chipWrap}>
          {filteredSubjects.map((s) => (
            <Chip key={s} active={data.subjects.includes(s)} onPress={() => update({ subjects: toggleInArray(data.subjects, s) })}>
              {s}
            </Chip>
          ))}
          {data.subjects.filter((s) => !(SUBJECT_OPTIONS as readonly string[]).includes(s)).map((s) => (
            <Chip key={s} active onPress={() => update({ subjects: toggleInArray(data.subjects, s) })}>
              {`${s} ✕`}
            </Chip>
          ))}
          <Chip active={showOtherSubject} onPress={() => setShowOtherSubject((v) => !v)}>
            {`${t("ob3SubjectOther")} +`}
          </Chip>
        </View>
        {showOtherSubject && (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <TextInput
              value={otherSubject}
              onChangeText={setOtherSubject}
              onSubmitEditing={addOtherSubject}
              placeholder={t("ob3SubjectOtherPlaceholder")}
              placeholderTextColor="#5B6478"
              style={[styles.searchInput, { flex: 1, marginBottom: 0 }]}
            />
            <TouchableOpacity onPress={addOtherSubject} style={styles.addBtn}>
              <Text style={styles.addBtnText}>{t("continue")}</Text>
            </TouchableOpacity>
          </View>
        )}
        {errors.subjects && <FieldError>{errors.subjects}</FieldError>}
      </View>

      {/* Student levels */}
      <View style={styles.section}>
        <SectionLabel required>{t("ob3LevelsQuestion")}</SectionLabel>
        <View style={styles.chipWrap}>
          {STUDENT_LEVEL_OPTIONS.map((lvl) => (
            <Chip
              key={lvl.value}
              active={data.studentLevels.includes(lvl.value)}
              onPress={() => { update({ studentLevels: toggleInArray(data.studentLevels, lvl.value) }); setErrors((e) => ({ ...e, studentLevels: "" })); }}
            >
              {lvl.sub ? `${lvl.label} (${lvl.sub})` : lvl.label}
            </Chip>
          ))}
        </View>
        {errors.studentLevels && <FieldError>{errors.studentLevels}</FieldError>}
      </View>

      {showStreams && (
        <View style={styles.section}>
          <SectionLabel>{t("ob3StreamsQuestion")}</SectionLabel>
          <View style={styles.chipWrap}>
            {STREAM_OPTIONS.map((s) => (
              <Chip key={s.value} active={data.streams.includes(s.value)} onPress={() => update({ streams: toggleInArray(data.streams, s.value) })}>
                {s.label}
              </Chip>
            ))}
          </View>
        </View>
      )}

      {showBoards && (
        <View style={styles.section}>
          <SectionLabel>{t("ob3BoardsQuestion")}</SectionLabel>
          <View style={styles.chipWrap}>
            {CURRICULUM_BOARD_OPTIONS.map((b) => (
              <Chip key={b.value} active={data.curriculumBoards.includes(b.value)} onPress={() => update({ curriculumBoards: toggleInArray(data.curriculumBoards, b.value) })}>
                {b.label}
              </Chip>
            ))}
          </View>
        </View>
      )}

      {/* Teaching mode */}
      <View style={styles.section}>
        <SectionLabel required>{t("ob3ModeQuestion")}</SectionLabel>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {TEACHING_MODE_OPTIONS.map((m) => {
            const active = data.teachingMode === m.value;
            return (
              <TouchableOpacity
                key={m.value}
                onPress={() => { update({ teachingMode: m.value }); setErrors((e) => ({ ...e, teachingMode: "" })); }}
                style={[styles.modeCard, active && styles.typeCardActive]}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</Text>
                <Text style={styles.typeCardText}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {errors.teachingMode && <FieldError>{errors.teachingMode}</FieldError>}
      </View>

      {showServiceArea && (
        <View style={styles.section}>
          <SectionLabel>{t("ob3ServiceAreaLabel")}</SectionLabel>
          <TextInput
            value={serviceAreaValue}
            onChangeText={(v) => update({ offlineServiceAreas: v.trim() ? [v] : [] })}
            placeholder={t("ob3ServiceAreaPlaceholder")}
            placeholderTextColor="#5B6478"
            style={styles.searchInput}
          />
          <Text style={styles.hint}>{t("ob3ServiceAreaHint")}</Text>
        </View>
      )}

      {/* Experience */}
      <View style={styles.section}>
        <SectionLabel required>{t("ob3ExperienceQuestion")}</SectionLabel>
        <View style={styles.chipWrap}>
          {EXPERIENCE_OPTIONS.map((ex) => (
            <Chip
              key={ex.value}
              active={data.experience === ex.value}
              onPress={() => { update({ experience: ex.value }); setErrors((e) => ({ ...e, experience: "" })); }}
            >
              {ex.label}
            </Chip>
          ))}
        </View>
        {errors.experience && <FieldError>{errors.experience}</FieldError>}
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
  section: { marginBottom: 22 },
  hint: { color: "#5B6478", fontSize: 12, marginTop: 6, marginLeft: 2 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  grid2: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  typeCard: { width: "47%", borderRadius: 16, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.05)", paddingHorizontal: 14, paddingVertical: 14 },
  typeCardActive: { borderColor: "#818CF8", backgroundColor: "rgba(99,102,241,0.10)" },
  typeCardText: { color: "#F8FAFC", fontWeight: "700", fontSize: 13 },
  modeCard: { flex: 1, borderRadius: 16, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.05)", paddingVertical: 14, alignItems: "center" },

  searchInput: {
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    color: "#F8FAFC", fontSize: 14,
  },
  addBtn: { paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#4F46E5", alignItems: "center", justifyContent: "center" },
  addBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});

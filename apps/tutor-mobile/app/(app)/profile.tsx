import { useEffect, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import { useTutorProfile } from "@gloows/shared-logic";
import { db } from "@/lib/firebase";
import { Button, Input, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { user, tutorProfile, profileLoading } = useTutorProfile();

  const [qualification, setQualification] = useState("");
  const [subjects, setSubjects]           = useState("");
  const [experience, setExperience]       = useState("");
  const [language, setLanguage]           = useState("");
  const [saved, setSaved]                 = useState(false);
  const [saving, setSaving]               = useState(false);

  useEffect(() => {
    if (!tutorProfile) return;
    setQualification(tutorProfile.qualification ?? "");
    setSubjects((tutorProfile.subjects ?? []).join(", "));
    setExperience(tutorProfile.teachingExperienceYears?.toString() ?? "");
    setLanguage(tutorProfile.preferredLanguage ?? "");
  }, [tutorProfile]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    try {
      await setDoc(doc(db, "tutors", user.uid), {
        qualification: qualification.trim(),
        subjects: subjects.split(",").map((s) => s.trim()).filter(Boolean),
        teachingExperienceYears: experience ? Number(experience) : null,
        preferredLanguage: language.trim(),
        updatedAt: new Date(),
      }, { merge: true });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (profileLoading) return <LoadingState />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary, marginBottom: spacing.xl }}>
          {t("profileTitle")}
        </Text>
        <Input label={t("qualificationLabel")} value={qualification} onChangeText={setQualification} />
        <Input label={t("subjectsLabel")} placeholder="Mathematics, Physics" value={subjects} onChangeText={setSubjects} />
        <Input label={t("experienceLabel")} value={experience} onChangeText={setExperience} keyboardType="numeric" />
        <Input label={t("languageLabel")} value={language} onChangeText={setLanguage} />
        {saved && <Text style={{ color: semantic.success, fontSize: 12, fontWeight: "700", marginBottom: spacing.md }}>{t("profileSaved")}</Text>}
        <Button title={saving ? t("loading") : t("saveProfile")} onPress={handleSave} loading={saving} />
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

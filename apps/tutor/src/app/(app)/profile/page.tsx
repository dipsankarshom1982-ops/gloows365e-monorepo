"use client";
// apps/tutor/src/app/(app)/profile/page.tsx
// Plain profile field CRUD — direct Firestore read/write against
// tutors/{uid}, gated by firestore.rules' owner-write rule. No callable:
// see functions/src/tutorAccounts.ts's header comment for why business-
// logic operations (role grants, verification review) are callables but
// this isn't.

import { useEffect, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTutorProfile } from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import { Button, Input, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

export default function ProfilePage() {
  const { t } = useTutorT();
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
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
    <div className="min-h-dvh bg-bg pb-24">
      <div className="p-6 max-w-lg mx-auto">
        <h1 className="text-xl font-black text-slate-100 mb-6">{t("profileTitle")}</h1>
        <form onSubmit={handleSave}>
          <Input label={t("qualificationLabel")} value={qualification} onChange={(e) => setQualification(e.target.value)} />
          <Input label={t("subjectsLabel")} placeholder="Mathematics, Physics" value={subjects} onChange={(e) => setSubjects(e.target.value)} />
          <Input label={t("experienceLabel")} type="number" min={0} value={experience} onChange={(e) => setExperience(e.target.value)} />
          <Input label={t("languageLabel")} value={language} onChange={(e) => setLanguage(e.target.value)} />
          {saved && <p className="text-success text-xs font-semibold mb-4">{t("profileSaved")}</p>}
          <Button type="submit" disabled={saving}>{saving ? t("loading") : t("saveProfile")}</Button>
        </form>
      </div>
      <BottomNav />
    </div>
  );
}

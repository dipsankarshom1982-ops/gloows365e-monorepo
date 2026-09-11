"use client";
// apps/tutor/src/app/(app)/profile/page.tsx
// Plain profile field CRUD — direct Firestore read/write against
// tutors/{uid}, gated by firestore.rules' owner-write rule. No callable:
// see functions/src/tutorAccounts.ts's header comment for why business-
// logic operations (role grants, verification review) are callables but
// this isn't.
//
// ShikshaHub Phase 1 — sessionFee + a simple weekly availability editor
// added below the existing fields. sessionFee is the one field here that
// firestore.rules actually validates server-side (positive integer, see
// that collection's rules) since it's what a booking snapshots as the
// price; availability isn't rule-validated beyond "the owner wrote it",
// same trust level qualification/subjects/bio already have. Both flow
// into tutorMarketplaceProfiles automatically via the existing
// syncTutorMarketplaceProfile trigger — no extra write needed here.

import { useEffect, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTutorProfile, type TutorWeekday, type TutorWeeklyAvailability } from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Button, Input, LoadingState, Textarea } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

const WEEKDAYS: { key: TutorWeekday; label: string }[] = [
  { key: "monday",    label: "Mon" },
  { key: "tuesday",   label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday",  label: "Thu" },
  { key: "friday",    label: "Fri" },
  { key: "saturday",  label: "Sat" },
  { key: "sunday",    label: "Sun" },
];

const EMPTY_AVAILABILITY: TutorWeeklyAvailability = Object.fromEntries(
  WEEKDAYS.map((d) => [d.key, { enabled: false, start: "17:00", end: "20:00" }])
) as TutorWeeklyAvailability;

export default function ProfilePage() {
  const { t } = useTutorT();
  const { user, tutorProfile, profileLoading } = useTutorProfile();
  const { enabled: notificationsEnabled, loading: notifLoading, toggle: toggleNotifications } = usePushNotifications();

  const [qualification, setQualification] = useState("");
  const [subjects, setSubjects]           = useState("");
  const [experience, setExperience]       = useState("");
  const [language, setLanguage]           = useState("");
  const [bio, setBio]                     = useState("");
  const [sessionFee, setSessionFee]       = useState("");
  const [availability, setAvailability]   = useState<TutorWeeklyAvailability>(EMPTY_AVAILABILITY);
  const [saved, setSaved]                 = useState(false);
  const [saving, setSaving]               = useState(false);
  const [feeError, setFeeError]           = useState("");

  useEffect(() => {
    if (!tutorProfile) return;
    setQualification(tutorProfile.qualification ?? "");
    setSubjects((tutorProfile.subjects ?? []).join(", "));
    setExperience(tutorProfile.teachingExperienceYears?.toString() ?? "");
    setLanguage(tutorProfile.preferredLanguage ?? "");
    setBio(tutorProfile.bio ?? "");
    setSessionFee(tutorProfile.sessionFee != null ? String(tutorProfile.sessionFee) : "");
    setAvailability({ ...EMPTY_AVAILABILITY, ...(tutorProfile.availability ?? {}) });
  }, [tutorProfile]);

  function updateDay(key: TutorWeekday, patch: Partial<TutorWeeklyAvailability[TutorWeekday]>) {
    setAvailability((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setFeeError("");
    const feePayload: Record<string, unknown> = {};
    if (sessionFee.trim()) {
      const fee = Number(sessionFee);
      if (!Number.isInteger(fee) || fee <= 0) {
        setFeeError(t("shikshaHubFeeInvalid", "Session fee must be a whole number greater than 0"));
        return;
      }
      feePayload.sessionFee = fee;
    }

    setSaving(true);
    setSaved(false);
    try {
      await setDoc(doc(db, "tutors", user.uid), {
        qualification: qualification.trim(),
        subjects: subjects.split(",").map((s) => s.trim()).filter(Boolean),
        teachingExperienceYears: experience ? Number(experience) : null,
        preferredLanguage: language.trim(),
        bio: bio.trim(),
        availability,
        ...feePayload,
        updatedAt: new Date(),
      }, { merge: true });
      setSaved(true);
    } catch (err: any) {
      setFeeError(err?.message ?? "Could not save. Please try again.");
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
          <Textarea label={t("bioLabel")} placeholder="Tell students a bit about how you teach" value={bio} onChange={(e) => setBio(e.target.value)} />

          <Input
            label={t("shikshaHubSessionFeeLabel", "Session fee (₹, per session)")}
            type="number" min={1} step={1} placeholder="500"
            value={sessionFee} onChange={(e) => setSessionFee(e.target.value)}
          />
          {feeError && <p className="text-danger text-xs font-semibold -mt-3 mb-4">{feeError}</p>}

          <div className="mb-4">
            <span className="block text-xs font-semibold text-slate-400 mb-2">
              {t("shikshaHubAvailabilityLabel", "Weekly availability")}
            </span>
            <div className="flex flex-col gap-2">
              {WEEKDAYS.map(({ key, label }) => {
                const day = availability[key] ?? { enabled: false, start: "17:00", end: "20:00" };
                return (
                  <div key={key} className="flex items-center gap-2 rounded-lg bg-surface border border-slate-700 px-3 py-2">
                    <label className="flex items-center gap-2 w-20 shrink-0">
                      <input
                        type="checkbox"
                        checked={!!day.enabled}
                        onChange={(e) => updateDay(key, { enabled: e.target.checked })}
                      />
                      <span className="text-xs font-bold text-slate-200">{label}</span>
                    </label>
                    <input
                      type="time"
                      disabled={!day.enabled}
                      value={day.start ?? "17:00"}
                      onChange={(e) => updateDay(key, { start: e.target.value })}
                      className="flex-1 rounded bg-bg border border-slate-700 px-2 py-1 text-xs text-slate-100 disabled:opacity-40"
                    />
                    <span className="text-slate-500 text-xs">–</span>
                    <input
                      type="time"
                      disabled={!day.enabled}
                      value={day.end ?? "20:00"}
                      onChange={(e) => updateDay(key, { end: e.target.value })}
                      className="flex-1 rounded bg-bg border border-slate-700 px-2 py-1 text-xs text-slate-100 disabled:opacity-40"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {saved && <p className="text-success text-xs font-semibold mb-4">{t("profileSaved")}</p>}
          <Button type="submit" disabled={saving}>{saving ? t("loading") : t("saveProfile")}</Button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-700 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-100">{t("pushNotificationsLabel")}</span>
          <button
            role="switch"
            aria-checked={notificationsEnabled}
            onClick={toggleNotifications}
            disabled={notifLoading}
            className={`w-11 h-6 rounded-full relative transition-colors disabled:opacity-50 ${
              notificationsEnabled ? "bg-brand-600" : "bg-surface2 border border-slate-600"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                notificationsEnabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

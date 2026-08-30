"use client";
// apps/tutor/src/app/onboarding/page.tsx
// Post-account-creation Tutor Onboarding — Steps 2-5 + Success. Step 1
// (email/password/confirm) lives at ../(auth)/register/page.tsx and
// hands off here once the Firebase Auth user exists.
//
// ── Architecture in one place (referenced from several files below) ──
//
// Persistence: Steps 2-4 write plain, allowlist-covered fields directly
// to tutors/{uid} (setDoc/merge) as the tutor completes each step — same
// trust level as Phase 1a's existing qualification/subjects/bio fields
// (see firestore.rules' tutors/{uid} match block). This is what makes
// "auto-save as draft" and "resume from last incomplete step" both true
// without a callable per step: onMount, this page hydrates its local
// `data` state from the already-loaded tutorProfile (via
// useTutorProfile(), from @gloows/shared-logic) and resumes at
// tutorProfile.onboardingStep. A brand-new tutor (no tutors/{uid} doc
// yet — Step 1 no longer creates one) just starts at Step 2 with
// defaults.
//
// tutors/{uid} itself is first created at the END of Step 2 — via the
// EXISTING registerTutorAccount callable (unchanged), called with a
// fixed tutorRole:"TUTOR" default (Step 3's richer `tutorType` field,
// not this legacy claim-only enum, is what actually drives the product
// UI). registerTutorAccount is idempotent (batch.set + merge:true,
// setCustomUserClaims), so calling it again on a later visit to Step 2
// is harmless.
//
// Duplicate-profile safety: there is exactly one tutors/{uid} doc,
// merged into over the whole flow — nothing here ever creates a second
// one, and registerTutorAccount's own uid-keyed doc path makes a
// duplicate structurally impossible.
//
// Final submission (Step 5) is the ONE thing that goes through a
// callable instead of a plain write: functions/src/tutorAccounts.ts's
// submitTutorOnboarding re-validates every required field server-side,
// rejects a second submission once already under review, and is the
// only path allowed to set profileStatus/onboardingVerificationStatus
// (kept off firestore.rules' client-writable allowlist deliberately —
// same protection the existing `verified` field already has).
//
// Scoping notes (disclosed, not oversights):
//  - No localStorage draft layer — persistence is Firestore-only, saved
//    at each step's Continue/Save-and-continue-later. Mid-step keystrokes
//    are not individually persisted; a refresh mid-step (before tapping
//    Continue) loses that step's in-progress edits, not earlier ones.
//  - Reference-data lists (states, subjects, etc.) and this feature's
//    UI copy are English-only for now — see lib/onboardingOptions.ts's
//    header. i18next's fallbackLng keeps it working (in English) for
//    Hindi-selected tutors rather than breaking.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useTutorProfile } from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import { auth, db, functions } from "@/lib/firebase";
import {
  DEFAULT_ONBOARDING_DATA, step2Payload, step3Payload, step4Payload,
  type OnboardingData,
} from "@/lib/onboardingTypes";
import { BrandMark, ProgressBar } from "@/components/onboarding/OnboardingUI";
import Step2BasicInfo from "@/components/onboarding/Step2BasicInfo";
import Step3TeachingProfile from "@/components/onboarding/Step3TeachingProfile";
import Step4Qualifications from "@/components/onboarding/Step4Qualifications";
import Step5Review from "@/components/onboarding/Step5Review";
import SuccessScreen from "@/components/onboarding/SuccessScreen";

const TOTAL_STEPS = 4; // Steps 2-5 — see ProgressBar's percent math

const registerTutorAccountFn = httpsCallable<
  { tutorRole: "TUTOR"; name: string; phone?: string },
  { uid: string }
>(functions, "registerTutorAccount");

const submitTutorOnboardingFn = httpsCallable<undefined, { profileStatus: string }>(
  functions, "submitTutorOnboarding"
);

export default function OnboardingPage() {
  const { t } = useTutorT();
  const router = useRouter();
  const { user, authLoading, tutorProfile, profileLoading } = useTutorProfile();

  const [step, setStep] = useState(2);
  const [data, setData] = useState<OnboardingData>(DEFAULT_ONBOARDING_DATA);
  const hydratedRef = useRef(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function update(patch: Partial<OnboardingData>) {
    setData((prev) => ({ ...prev, ...patch }));
  }

  // Not logged in — send back to login rather than showing an
  // onboarding wizard with nothing to attach it to.
  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // Hydrate local wizard state from the already-loaded profile exactly
  // once — resuming from the last incomplete step. Deliberately a
  // one-shot hydration (guarded by hydratedRef), not a live sync: this
  // context's onSnapshot listener could otherwise overwrite in-progress
  // local edits with a stale server echo of what was there before them.
  useEffect(() => {
    if (profileLoading || hydratedRef.current) return;
    hydratedRef.current = true;

    if (tutorProfile?.onboardingCompleted) {
      router.replace("/dashboard");
      return;
    }

    if (tutorProfile) {
      setData((prev) => ({
        ...prev,
        name: tutorProfile.name ?? "",
        phoneNumber: tutorProfile.phoneNumber ?? tutorProfile.phone ?? "",
        phoneVerified: !!tutorProfile.phoneVerified,
        profilePic: tutorProfile.profilePic ?? "",
        pinCode: tutorProfile.pinCode ?? "",
        city: tutorProfile.city ?? "",
        state: tutorProfile.state ?? "",
        gender: tutorProfile.gender ?? "",
        tutorType: tutorProfile.tutorType ?? "",
        subjects: tutorProfile.subjects ?? [],
        studentLevels: tutorProfile.studentLevels ?? [],
        streams: tutorProfile.streams ?? [],
        curriculumBoards: tutorProfile.curriculumBoards ?? [],
        teachingMode: tutorProfile.teachingMode ?? "",
        offlineServiceAreas: tutorProfile.offlineServiceAreas ?? [],
        experience: tutorProfile.experience ?? "",
        highestQualification: tutorProfile.highestQualification ?? "",
        degreeName: tutorProfile.degreeName ?? "",
        institutionName: tutorProfile.institutionName ?? "",
        completionYear: tutorProfile.completionYear ? String(tutorProfile.completionYear) : "",
        specialization: tutorProfile.specialization ?? "",
        bio: tutorProfile.bio ?? "",
        qualificationDocuments: tutorProfile.qualificationDocuments ?? [],
        experienceDocuments: tutorProfile.experienceDocuments ?? [],
        additionalCertificates: tutorProfile.additionalCertificates ?? [],
      }));
      setStep(tutorProfile.onboardingStep ?? 2);
    }
  }, [profileLoading, tutorProfile, router]);

  async function persistStep2(nextStep: number) {
    // registerTutorAccount both bootstraps tutors/{uid} (first time) and
    // is a harmless no-op re-merge (later visits) — see file header.
    await registerTutorAccountFn({ tutorRole: "TUTOR", name: data.name.trim(), phone: data.phoneNumber.trim() });
    await auth.currentUser?.getIdToken(true); // claim only lands on the next token
    await setDoc(doc(db, "tutors", user!.uid), step2Payload(data, nextStep), { merge: true });
  }

  async function handleStep2Continue() {
    setSaving(true);
    setSaveError(null);
    try {
      await persistStep2(3);
      update({ onboardingStep: 3 });
      setStep(3);
    } catch (err: any) {
      setSaveError(err?.message ?? t("networkErrorRetry"));
    } finally {
      setSaving(false);
    }
  }

  async function handleStep3Continue() {
    setSaving(true);
    setSaveError(null);
    try {
      await setDoc(doc(db, "tutors", user!.uid), step3Payload(data, 4), { merge: true });
      update({ onboardingStep: 4 });
      setStep(4);
    } catch (err: any) {
      setSaveError(err?.message ?? t("networkErrorRetry"));
    } finally {
      setSaving(false);
    }
  }

  async function handleStep4Continue() {
    setSaving(true);
    setSaveError(null);
    try {
      await setDoc(doc(db, "tutors", user!.uid), step4Payload(data, 5), { merge: true });
      update({ onboardingStep: 5 });
      setStep(5);
    } catch (err: any) {
      setSaveError(err?.message ?? t("networkErrorRetry"));
    } finally {
      setSaving(false);
    }
  }

  // "Save and continue later" — persists the CURRENT step's fields
  // without advancing onboardingStep, so the tutor resumes exactly
  // where they left off, then exits to the dashboard.
  async function handleSaveLater() {
    setSaving(true);
    setSaveError(null);
    try {
      if (step === 2 && data.name.trim()) {
        await persistStep2(2);
      } else if (step === 3) {
        await setDoc(doc(db, "tutors", user!.uid), step3Payload(data, 3), { merge: true });
      } else if (step === 4) {
        await setDoc(doc(db, "tutors", user!.uid), step4Payload(data, 4), { merge: true });
      }
      router.push("/dashboard");
    } catch (err: any) {
      setSaveError(err?.message ?? t("networkErrorRetry"));
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitTutorOnboardingFn();
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err?.message ?? t("networkErrorRetry"));
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || profileLoading || !user) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-[#060A17] via-[#0B1226] to-[#111C3A]">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-brand-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center bg-gradient-to-br from-[#060A17] via-[#0B1226] to-[#111C3A] px-5 py-8">
      <div className="w-full max-w-sm">
        <BrandMark />

        {!submitted && <ProgressBar step={step} totalSteps={TOTAL_STEPS} t={t} />}
        {saveError && (
          <p className="mb-4 text-xs font-semibold text-red-300" role="alert">{saveError}</p>
        )}

        {submitted ? (
          <SuccessScreen />
        ) : step === 2 ? (
          <Step2BasicInfo uid={user.uid} data={data} update={update} onContinue={handleStep2Continue} onSaveLater={handleSaveLater} saving={saving} />
        ) : step === 3 ? (
          <Step3TeachingProfile data={data} update={update} onContinue={handleStep3Continue} onBack={() => setStep(2)} onSaveLater={handleSaveLater} saving={saving} />
        ) : step === 4 ? (
          <Step4Qualifications uid={user.uid} data={data} update={update} onContinue={handleStep4Continue} onBack={() => setStep(3)} onSaveLater={handleSaveLater} saving={saving} />
        ) : (
          <Step5Review
            data={data}
            email={user.email}
            onEditStep={setStep}
            onBack={() => setStep(4)}
            onSubmit={handleSubmit}
            submitting={submitting}
            submitError={submitError}
          />
        )}
      </div>
    </div>
  );
}

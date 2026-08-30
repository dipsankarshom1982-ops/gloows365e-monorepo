// apps/tutor-mobile/app/(auth)/onboarding.tsx
// Mirrors apps/tutor/src/app/onboarding/page.tsx — see that file's
// header for the full architecture writeup (persistence model, the
// registerTutorAccount/submitTutorOnboarding split, duplicate-profile
// safety, scoping notes). Same tutors/{uid} fields, same Cloud
// Functions, same firestore.rules allowlist — both platforms write the
// identical shape, so nothing backend-side needed changing for this
// port.
//
// Placed in the (auth) route group (not (app)) deliberately, same
// reasoning as web's top-level /onboarding route: app/(app)/_layout.tsx
// requires tutorProfile to already exist (AuthGuard-equivalent), but
// this screen's whole job is to CREATE that doc — so it needs its own,
// looser auth check (signed in only) instead.

import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { doc, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useTranslation } from "react-i18next";
import { useTutorProfile } from "@gloows/shared-logic";
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

const TOTAL_STEPS = 4; // Steps 2-5

const registerTutorAccountFn = httpsCallable<
  { tutorRole: "TUTOR"; name: string; phone?: string },
  { uid: string }
>(functions, "registerTutorAccount");

const submitTutorOnboardingFn = httpsCallable<undefined, { profileStatus: string }>(
  functions, "submitTutorOnboarding"
);

export default function OnboardingScreen() {
  const { t } = useTranslation();
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

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user]);

  // One-shot hydration from the already-loaded profile — see web
  // onboarding page.tsx's identical comment for why this isn't a live
  // sync (it would clobber in-progress local edits with a stale echo).
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
  }, [profileLoading, tutorProfile]);

  async function persistStep2(nextStep: number) {
    await registerTutorAccountFn({ tutorRole: "TUTOR", name: data.name.trim(), phone: data.phoneNumber.trim() });
    await auth.currentUser?.getIdToken(true);
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
      router.replace("/dashboard");
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
      <LinearGradient colors={["#060A17", "#0B1226", "#111C3A"]} style={styles.loadingScreen}>
        <ActivityIndicator color="#818CF8" size="large" />
      </LinearGradient>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <LinearGradient colors={["#060A17", "#0B1226", "#111C3A"]} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <BrandMark />
            {!submitted && <ProgressBar step={step} totalSteps={TOTAL_STEPS} t={t} />}
            {saveError && <Text style={styles.saveError} accessibilityRole="alert">{saveError}</Text>}

            {submitted ? (
              <SuccessScreen t={t} />
            ) : step === 2 ? (
              <Step2BasicInfo uid={user.uid} data={data} update={update} onContinue={handleStep2Continue} onSaveLater={handleSaveLater} saving={saving} t={t} />
            ) : step === 3 ? (
              <Step3TeachingProfile data={data} update={update} onContinue={handleStep3Continue} onBack={() => setStep(2)} onSaveLater={handleSaveLater} saving={saving} t={t} />
            ) : step === 4 ? (
              <Step4Qualifications uid={user.uid} data={data} update={update} onContinue={handleStep4Continue} onBack={() => setStep(3)} onSaveLater={handleSaveLater} saving={saving} t={t} />
            ) : (
              <Step5Review
                data={data}
                email={user.email}
                onEditStep={setStep}
                onBack={() => setStep(4)}
                onSubmit={handleSubmit}
                submitting={submitting}
                submitError={submitError}
                t={t}
              />
            )}
          </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#060A17" },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { flexGrow: 1, padding: 22, paddingTop: 8, paddingBottom: 32 },
  saveError: { color: "#FCA5A5", fontSize: 12, fontWeight: "600", marginBottom: 16 },
});

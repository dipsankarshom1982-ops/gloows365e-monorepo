// apps/tutor-mobile/app/(app)/dashboard.tsx
// Tutor Profile Completion & Verification Dashboard — mirrors
// apps/tutor/src/app/(app)/dashboard/page.tsx exactly (see that file's
// header for the full design note). Replaces the previous placeholder
// (greeting + old-system verification banner + two stat cards).

import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import {
  useTutorClasses, useTutorProfile, useTutorStudents, useTutorPayoutDetails,
  calculateTutorProfileCompletion,
} from "@gloows/shared-logic";
import { db } from "@/lib/firebase";
import { Card, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";
import { resolveDashboardStatus } from "@/lib/dashboardStatus";
import CompletionHero from "@/components/dashboard/CompletionHero";
import StatusCard from "@/components/dashboard/StatusCard";
import VerificationCentre from "@/components/dashboard/VerificationCentre";
import VerificationTimeline from "@/components/dashboard/VerificationTimeline";
import ActionRequired from "@/components/dashboard/ActionRequired";
import ProfileChecklist from "@/components/dashboard/ProfileChecklist";
import ProfileStrength from "@/components/dashboard/ProfileStrength";
import PublicProfileReadiness from "@/components/dashboard/PublicProfileReadiness";
import QuickActions from "@/components/dashboard/QuickActions";
import PhoneVerifyModal from "@/components/dashboard/PhoneVerifyModal";

function isToday(ts: unknown): boolean {
  const d = (ts as { toDate?: () => Date } | undefined)?.toDate?.();
  if (!d) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { user, tutorProfile, profileLoading } = useTutorProfile();
  const { students } = useTutorStudents(user?.uid);
  const { classes } = useTutorClasses(user?.uid);
  const { details: payoutDetails } = useTutorPayoutDetails(user?.uid);
  const todaysClasses = classes.filter((c) => c.status !== "Cancelled" && isToday(c.startTime));
  // Owned here (not inside VerificationCentre) so ActionRequired's
  // "Verify Now" phone item can open the same modal — see
  // VerificationCentre.tsx's header for the QA fix this replaced.
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  async function handlePhoneVerified() {
    setShowPhoneModal(false);
    if (!user) return;
    await setDoc(doc(db, "tutors", user.uid), { phoneVerified: true, updatedAt: new Date() }, { merge: true });
  }

  const completion = tutorProfile ? calculateTutorProfileCompletion(tutorProfile) : null;

  const lastSavedPercent = useRef<number | null>(null);
  useEffect(() => {
    if (!user || !completion) return;
    if (lastSavedPercent.current === completion.completionPercentage) return;
    if (tutorProfile?.profileCompletionPercentage === completion.completionPercentage) {
      lastSavedPercent.current = completion.completionPercentage;
      return;
    }
    lastSavedPercent.current = completion.completionPercentage;
    setDoc(doc(db, "tutors", user.uid), {
      profileCompletionPercentage: completion.completionPercentage,
      profileStrength: completion.profileStrength,
      updatedAt: new Date(),
    }, { merge: true }).catch(() => { /* best-effort */ });
  }, [user, completion, tutorProfile?.profileCompletionPercentage]);

  if (profileLoading || !user || !tutorProfile || !completion) return <LoadingState />;

  const status = resolveDashboardStatus(tutorProfile.profileStatus);
  const ctaHref = status === "draft" ? "/onboarding" : status === "verified" ? "/dashboard" : "/documents";
  const payoutSetUp = !!payoutDetails?.accountHolderName;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
        <CompletionHero
          name={tutorProfile.name ?? ""}
          status={status}
          completion={completion}
          payoutSetUp={payoutSetUp}
          ctaHref={ctaHref}
        />

        <StatusCard status={status} rejectionReason={tutorProfile.rejectionReason} />

        <ActionRequired tutorProfile={tutorProfile} completion={completion} onVerifyPhone={() => setShowPhoneModal(true)} />

        <VerificationCentre user={user} tutorProfile={tutorProfile} onVerifyPhone={() => setShowPhoneModal(true)} />

        <VerificationTimeline status={status} onboardingCompleted={tutorProfile.onboardingCompleted} />

        <ProfileChecklist user={user} tutorProfile={tutorProfile} completion={completion} payoutSetUp={payoutSetUp} />

        <ProfileStrength strength={completion.profileStrength} />

        <PublicProfileReadiness user={user} tutorProfile={tutorProfile} completion={completion} />

        <QuickActions status={status} />

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push("/students")}>
            <Card>
              <Text style={{ fontSize: 11, fontWeight: "700", color: semantic.textMuted, marginBottom: 4 }}>
                {t("activeStudentsLabel")}
              </Text>
              <Text style={{ fontSize: 24, fontWeight: "900", color: semantic.textPrimary }}>{students.length}</Text>
            </Card>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push("/classes")}>
            <Card>
              <Text style={{ fontSize: 11, fontWeight: "700", color: semantic.textMuted, marginBottom: 4 }}>
                {t("todaysClassesLabel")}
              </Text>
              <Text style={{ fontSize: 24, fontWeight: "900", color: semantic.textPrimary }}>{todaysClasses.length}</Text>
            </Card>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <BottomNav />
      {showPhoneModal && (
        <PhoneVerifyModal
          phoneNumber={tutorProfile.phoneNumber ?? ""}
          onVerified={handlePhoneVerified}
          onClose={() => setShowPhoneModal(false)}
        />
      )}
    </SafeAreaView>
  );
}

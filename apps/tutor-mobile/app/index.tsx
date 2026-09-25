// apps/tutor-mobile/app/index.tsx — root route, routes by auth state
// once resolved. Mirrors apps/tutor's page.tsx exactly.
//
// Onboarding-incomplete tutors go to /onboarding instead of /dashboard
// — see app/(auth)/onboarding.tsx's header for the full flow. Second
// (app-entry-level) resume point; /onboarding itself also resumes to
// the right step once loaded.

import { useEffect } from "react";
import { router } from "expo-router";
import { View } from "react-native";
import { useTutorProfile } from "@gloows/shared-logic";
import { semantic } from "@gloows/tutor-ui";
import { LoadingState } from "@/components/ui";

export default function RootIndex() {
  const { user, authLoading, tutorProfile, profileLoading } = useTutorProfile();

  useEffect(() => {
    if (authLoading || (user && profileLoading)) return;
    if (!user) { router.replace("/welcome"); return; }
    router.replace(tutorProfile?.onboardingCompleted ? "/dashboard" : "/onboarding");
  }, [authLoading, user, profileLoading, tutorProfile]);

  return (
    <View style={{ flex: 1, backgroundColor: semantic.background, justifyContent: "center" }}>
      <LoadingState />
    </View>
  );
}

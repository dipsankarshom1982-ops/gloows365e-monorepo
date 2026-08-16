// Mirrors apps/tutor/src/app/(app)/layout.tsx and, further back,
// apps/web's AuthGuard.tsx pattern: single source of truth from context,
// no separate auth listener here.
import { useEffect } from "react";
import { router, Stack } from "expo-router";
import { View, Text } from "react-native";
import { useTutorProfile } from "@gloows/shared-logic";
import { semantic } from "@gloows/tutor-ui";
import { LoadingState } from "@/components/ui";

export default function AppGroupLayout() {
  const { user, authLoading } = useTutorProfile();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user]);

  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: semantic.background, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 28, fontWeight: "900", color: semantic.textPrimary }}>Gloows Tutor</Text>
        <LoadingState />
      </View>
    );
  }

  if (!user) return null;

  return <Stack screenOptions={{ headerShown: false }} />;
}

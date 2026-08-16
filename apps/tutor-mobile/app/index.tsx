import { useEffect } from "react";
import { router } from "expo-router";
import { View } from "react-native";
import { useTutorProfile } from "@gloows/shared-logic";
import { semantic } from "@gloows/tutor-ui";
import { LoadingState } from "@/components/ui";

export default function RootIndex() {
  const { user, authLoading } = useTutorProfile();

  useEffect(() => {
    if (authLoading) return;
    router.replace(user ? "/dashboard" : "/welcome");
  }, [authLoading, user]);

  return (
    <View style={{ flex: 1, backgroundColor: semantic.background, justifyContent: "center" }}>
      <LoadingState />
    </View>
  );
}

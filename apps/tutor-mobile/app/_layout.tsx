import "@/lib/firebase";
import { I18nextProvider } from "react-i18next";
import { createTutorI18n } from "@gloows/tutor-i18n";
import { TutorProfileProvider } from "@gloows/shared-logic";
import { Stack } from "expo-router";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Phase 1a keeps this deliberately lean compared to apps/mobile/app/_layout.tsx
// — no vector-icon font preloading (screens use emoji, matching web's
// choice for the same reason: one less asset dependency for a foundation
// phase), no push notification registration (nothing to notify about yet
// — no enquiries/demo bookings exist in this phase), no crash reporter.
// Add those back when the features that need them land.

const i18n = createTutorI18n();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <I18nextProvider i18n={i18n}>
        <TutorProfileProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </TutorProfileProvider>
      </I18nextProvider>
    </SafeAreaProvider>
  );
}

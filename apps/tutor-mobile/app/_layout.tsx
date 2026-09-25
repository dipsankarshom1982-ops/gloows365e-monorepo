import "@/lib/firebase";
import { useRef } from "react";
import { I18nextProvider } from "react-i18next";
import { createTutorI18n } from "@gloows/tutor-i18n";
import { TutorProfileProvider } from "@gloows/shared-logic";
import { Stack } from "expo-router";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { silentlyRegisterForPushNotifications } from "@/hooks/usePushNotifications";

// Phase 1a kept this deliberately lean compared to apps/mobile/app/_layout.tsx
// — no vector-icon font preloading (screens use emoji, matching web's
// choice for the same reason: one less asset dependency for a foundation
// phase), no crash reporter. Add those back when the features that need
// them land.
//
// Tutor push notifications phase — push registration DOES belong here
// now: bookings, Instant Help requests, payouts, and reviews all
// generate tutor-facing events worth pushing (see
// functions/src/shikshahubNotify.ts's notifyTutor()), same silent,
// once-per-session, opt-out-respecting registration apps/mobile's own
// _layout.tsx already uses.

const i18n = createTutorI18n();

export default function RootLayout() {
  const pushRegisteredRef = useRef(false);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <I18nextProvider i18n={i18n}>
        <TutorProfileProvider
          onProfileLoaded={() => {
            if (!pushRegisteredRef.current) {
              pushRegisteredRef.current = true;
              silentlyRegisterForPushNotifications();
            }
          }}
        >
          <Stack screenOptions={{ headerShown: false }} />
        </TutorProfileProvider>
      </I18nextProvider>
    </SafeAreaProvider>
  );
}

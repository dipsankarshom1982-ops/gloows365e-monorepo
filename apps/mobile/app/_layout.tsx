import { auth } from "@/lib/firebase";
import { AppConfigProvider } from "@/context/AppConfigContext";
import { FeatureFlagsProvider, parseClassLevel, StudentProfileProvider } from "@gloows/shared-logic";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { useSeekhoStore } from "@/store/seekhoStore";
import { useDiscoverStore, resetDiscoverStateInMemory } from "@/store/discoverStore";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { setupGlobalErrorHandlers } from "@/services/crashReporter";
import { silentlyRegisterForPushNotifications } from "@/hooks/usePushNotifications";
import InstantHelpBar from "@/components/InstantHelpBar";
import {
  AntDesign, Feather,
  FontAwesome,
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { StatusBar, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

SplashScreen.preventAutoHideAsync();

// Set up global JS error handler once
setupGlobalErrorHandlers();

function ThemeStatusBar() {
  const { isDarkMode } = useTheme();
  return (
    <StatusBar
      barStyle={isDarkMode ? "light-content" : "dark-content"}
      backgroundColor="transparent"
      translucent
    />
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...MaterialIcons.font,
    ...MaterialCommunityIcons.font,
    ...FontAwesome.font,
    ...AntDesign.font,
    ...Feather.font,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // Auto-register for push notifications once per app session, the first
  // time a logged-in user's profile loads — covers both fresh logins and
  // existing sessions resumed on app start. Silent (no permission-denied
  // Alert) and skipped if the user previously opted out via Settings — see
  // silentlyRegisterForPushNotifications in hooks/usePushNotifications.ts.
  // Tracks the uid it last registered FOR (not a plain boolean): a boolean
  // meant a second user logging in on the same device, in the same app
  // session, never got their own push token registered.
  const pushRegisteredForUidRef = useRef<string | null>(null);

  // Discover per-user data isolation — useDiscoverStore persists under a
  // key suffixed with the CURRENT uid (store/discoverStore.ts), computed at
  // storage-access time. That alone only fixes FUTURE reads/writes; without
  // this listener, a store already hydrated for User A stays hydrated with
  // A's arrays in memory after A logs out and B logs in, since nothing
  // would ever re-trigger a load for B's key on a live app (no restart).
  //
  // On every real uid change: reset the in-memory state to empty FIRST,
  // synchronously, then rehydrate (async) from the new uid's key. The
  // reset closes the "flash" window completely — the previous user's data
  // is gone from memory before the new user's data has even started
  // loading, so it can never render, not even for one frame.
  useEffect(() => {
    let lastUid: string | null | undefined; // undefined = not yet seen a callback
    const unsub = auth.onAuthStateChanged((user) => {
      const uid = user?.uid ?? null;
      if (lastUid !== undefined) {
        if (uid === lastUid) return;
        resetDiscoverStateInMemory();
      }
      lastUid = uid;
      useDiscoverStore.persist.rehydrate();
    });
    return unsub;
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ThemeProvider>
          <ThemeStatusBar />
          <LanguageProvider>
            <StudentProfileProvider
              onProfileLoaded={(profile) => {
                if (profile.board) {
                  // 0 = no supported class on record; never falls back to another class.
                  useSeekhoStore.getState().setClassBoard(parseClassLevel(profile.class) ?? 0, profile.board as any);
                }
                const pushUid = auth.currentUser?.uid ?? null;
                if (pushUid && pushRegisteredForUidRef.current !== pushUid) {
                  pushRegisteredForUidRef.current = pushUid;
                  silentlyRegisterForPushNotifications();
                }
              }}
            >
              <AppConfigProvider>
                <FeatureFlagsProvider>
                  <View style={{ flex: 1 }}>
                    <Stack screenOptions={{ headerShown: false }} />
                    {/* ShikshaHub Phase 4 — global, not per-screen: see
                       components/InstantHelpBar.tsx's header comment.
                       Safe pre-login too — its hooks no-op without a uid. */}
                    <InstantHelpBar />
                  </View>
                </FeatureFlagsProvider>
              </AppConfigProvider>
            </StudentProfileProvider>
          </LanguageProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}


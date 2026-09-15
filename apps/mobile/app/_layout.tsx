import "@/lib/firebase";
import { AppConfigProvider } from "@/context/AppConfigContext";
import { FeatureFlagsProvider, StudentProfileProvider } from "@gloows/shared-logic";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { useSeekhoStore } from "@/store/seekhoStore";
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
  const pushRegisteredRef = useRef(false);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ThemeProvider>
          <ThemeStatusBar />
          <LanguageProvider>
            <StudentProfileProvider
              onProfileLoaded={(profile) => {
                if (profile.class && profile.board) {
                  useSeekhoStore.getState().setClassBoard(Number(profile.class), profile.board as any);
                }
                if (!pushRegisteredRef.current) {
                  pushRegisteredRef.current = true;
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


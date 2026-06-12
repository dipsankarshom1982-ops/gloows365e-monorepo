import { AppConfigProvider } from "@/context/AppConfigContext";
import { FeatureFlagsProvider } from "@/context/FeatureFlagsContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { StudentProfileProvider } from "@/context/StudentProfileContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { setupGlobalErrorHandlers } from "@/services/crashReporter";
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
import { useEffect } from "react";
import { StatusBar } from "react-native";

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

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ThemeStatusBar />
        <LanguageProvider>
          <StudentProfileProvider>
            <AppConfigProvider>
              <FeatureFlagsProvider>
                <Stack screenOptions={{ headerShown: false }} />
              </FeatureFlagsProvider>
            </AppConfigProvider>
          </StudentProfileProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
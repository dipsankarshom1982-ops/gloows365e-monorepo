// PATH: apps/mobile/app/(drawer)/(tabs)/_layout.tsx
// Tabs: Reels · AI Guru · Seekho · Skill Battle · VidyaStar
// Home moved off the tab bar (still reachable via the drawer's permanent,
// feature-flag-locked "Home" entry — see app/(drawer)/_layout.tsx) and
// replaced in the tab bar by Reels, an Instagram-style vertical feed
// (app/(drawer)/(tabs)/reels.tsx, moved here from the former top-level
// app/reels.tsx — same "/reels" route since route groups don't affect the
// URL, so every existing router.push({ pathname: "/reels", ... }) call
// elsewhere in the app keeps working unchanged).
// LearnFun and SkillBoost removed from tabs (still accessible via drawer).

import { useTheme } from "@/context/ThemeContext";
import { useAppConfig } from "@/context/AppConfigContext";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { AppModule } from "@/services/appConfigService";
import AiGuruIcon from "@/components/icons/AiGuruIcon";

// Only the 5 tab screens — learnFun and skillboost removed from nav bar.
// Their screen files still exist so drawer navigation to them still works.
// "seekho" -> "shikshahub" swap: Seekho hidden from nav (its screen file,
// route tree, and Firestore data all stay intact — see the ShikshaHub
// plan's Context section for why this is "hidden not deleted").
const ALL_SCREENS = [
  "reels",
  "ai-guru",
  "shikshahub",
  "skillbattle",
  "vidyastar",
];

// Default fallback — matches web app BottomNav exactly:
// Reels · AI Guru · ShikshaHub · Skill Battle · VidyaStar
const DEFAULT_MODULES: AppModule[] = [
  { id: "reels",       name: "Reels",       icon: "film",          order: 1, isEnabled: true },
  { id: "ai-guru",     name: "AI Guru",     icon: "school-outline",order: 2, isEnabled: true },
  { id: "shikshahub",  name: "ShikshaHub",  icon: "ribbon",        order: 3, isEnabled: true },
  { id: "skillbattle", name: "Skill Battle",icon: "trophy",        order: 4, isEnabled: true },
  { id: "vidyastar",   name: "VidyaStar",   icon: "star",          order: 5, isEnabled: true },
];

export default function TabsLayout() {
  const { colors } = useTheme();
  const { modules, configLoading } = useAppConfig();

  // Use Firestore modules once available; fall back to defaults while loading
  const activeModules = modules.length > 0 ? modules : DEFAULT_MODULES;

  const enabledIds = new Set(activeModules.map((m) => m.id));
  const moduleMap  = Object.fromEntries(activeModules.map((m) => [m.id, m]));

  // Key changes whenever enabled module set changes → forces Tabs to remount
  const tabsKey = [...enabledIds].sort().join(",");

  return (
    <Tabs
      key={tabsKey}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
      }}
    >
      {ALL_SCREENS.map((screenName) => {
        const mod = moduleMap[screenName];
        const isEnabled = enabledIds.has(screenName);

        if (!isEnabled || !mod) {
          return (
            <Tabs.Screen
              key={screenName}
              name={screenName}
              options={{ href: null }}
            />
          );
        }

        return (
          <Tabs.Screen
            key={screenName}
            name={screenName}
            options={{
              title: mod.name,
              tabBarIcon: ({ color, size, focused }) =>
                screenName === "ai-guru" ? (
                  <AiGuruIcon color={color} focused={focused} />
                ) : (
                  <Ionicons
                    name={mod.icon as React.ComponentProps<typeof Ionicons>["name"]}
                    size={size}
                    color={color}
                  />
                ),
            }}
          />
        );
      })}

      {/* Keep home, learnFun, skillboost, and seekho screens registered but
          hidden from the tab bar — home is reachable via the drawer instead,
          seekho is hidden-not-deleted (see ALL_SCREENS comment above); a
          registered-but-hidden Tabs.Screen is required or the still-existing
          seekho.tsx route file falls out of the navigator entirely. */}
      <Tabs.Screen name="home"       options={{ href: null }} />
      <Tabs.Screen name="learnFun"   options={{ href: null }} />
      <Tabs.Screen name="skillboost" options={{ href: null }} />
      <Tabs.Screen name="seekho"     options={{ href: null }} />
    </Tabs>
  );
}

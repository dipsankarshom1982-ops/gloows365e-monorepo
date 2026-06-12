import { useTheme } from "@/context/ThemeContext";
import { useAppConfig } from "@/context/AppConfigContext";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { AppModule } from "@/services/appConfigService";

// All screen files that exist in this directory.
// Any screen not returned by Firestore (or fallback) is hidden via href: null.
const ALL_SCREENS = [
  "home",
  "learnFun",
  "skillboost",
  "seekho",
  "skillbattle",
  "vidyastar",
];

// Used on first launch before Firestore data arrives (no cache yet).
const DEFAULT_MODULES: AppModule[] = [
  { id: "home",       name: "Home",        icon: "home",          order: 1, isEnabled: true },
  { id: "skillboost", name: "SkillBoost",  icon: "flash",         order: 2, isEnabled: true },
  { id: "seekho",     name: "Seekho",      icon: "school-outline",order: 3, isEnabled: true },
  { id: "skillbattle",name: "Skill-Battle",icon: "trophy",        order: 4, isEnabled: true },
  { id: "vidyastar",  name: "VidyaStar",   icon: "star",          order: 5, isEnabled: true },
];

export default function TabsLayout() {
  const { colors } = useTheme();
  const { modules, configLoading } = useAppConfig();

  // Use Firestore modules once available; fall back to defaults while loading
  const activeModules = modules.length > 0 ? modules : DEFAULT_MODULES;

  const enabledIds = new Set(activeModules.map((m) => m.id));
  const moduleMap  = Object.fromEntries(activeModules.map((m) => [m.id, m]));

  // Key changes whenever enabled module set changes → forces Tabs to remount
  // so href:null is correctly applied to newly-disabled tabs.
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
              tabBarIcon: ({ color, size }) => (
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
    </Tabs>
  );
}

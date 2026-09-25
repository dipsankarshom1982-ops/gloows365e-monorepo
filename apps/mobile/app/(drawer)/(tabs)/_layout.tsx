// PATH: apps/mobile/app/(drawer)/(tabs)/_layout.tsx
// Navigation restructure — fixed 5-tab bar: Home · Dashboard · Learn ·
// Challenge · Menu. No longer driven by AppConfigContext/appModules
// (that Firestore-configurable module list drove the old Reels/AI Guru/
// ShikshaHub/Skill Battle/VidyaStar tab set); this new tab set is fixed
// by the nav spec, not admin-toggleable, so this screen stops consuming
// useAppConfig() entirely. The admin AppModules page is left untouched —
// it's simply unused for bottom-nav purposes now.
//
// Reels became the post-login landing screen (see app/index.tsx) instead
// of a tab — still registered here with href:null so it stays reachable
// by direct link (SkillShortPreview, EarnMoreVCoinsModal, etc. all push
// to "/reels" directly, not via this tab bar).
//
// ai-guru, shikshahub, skillbattle, vidyastar, seekho, skillboost,
// learnFun are folded into the Learn/Challenge hub screens — still
// registered here with href:null (same pattern already used for home
// before this change) so their screens/routes keep working unchanged.
//
// Menu opens the existing Drawer (app/(drawer)/_layout.tsx) instead of
// navigating — see the "menu" Tabs.Screen's tabBarButton below, using the
// exact same parent-drawer-lookup already proven in components/header.tsx.

import { useTheme } from "@/context/ThemeContext";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { TouchableOpacity } from "react-native";

const NAV_TABS: { name: string; title: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { name: "home",      title: "Home",      icon: "home-outline" },
  { name: "dashboard", title: "Dashboard", icon: "stats-chart-outline" },
  { name: "learn",     title: "Learn",     icon: "book-outline" },
  { name: "challenge", title: "Challenge", icon: "flag-outline" },
];

// Screens folded into Learn/Challenge (or, for reels, replaced by the
// post-login landing flow) — kept registered so their routes still
// resolve, just hidden from the tab bar.
const HIDDEN_SCREENS = [
  "reels", "ai-guru", "shikshahub", "skillbattle", "vidyastar",
  "seekho", "skillboost", "learnFun",
];

function MenuTabButton(props: any) {
  const navigation = useNavigation();
  const handlePress = () => {
    let nav: any = navigation;
    while (nav) {
      if (nav.getState?.()?.type === "drawer") {
        nav.dispatch(DrawerActions.openDrawer());
        return;
      }
      nav = nav.getParent?.();
    }
    navigation?.dispatch(DrawerActions.openDrawer());
  };
  return <TouchableOpacity {...props} onPress={handlePress} />;
}

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
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
      {NAV_TABS.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, size }) => <Ionicons name={icon} size={size} color={color} />,
          }}
        />
      ))}

      <Tabs.Screen
        name="menu"
        options={{
          title: "Menu",
          tabBarIcon: ({ color, size }) => <Ionicons name="menu-outline" size={size} color={color} />,
          tabBarButton: (props) => <MenuTabButton {...props} />,
        }}
      />

      {HIDDEN_SCREENS.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}

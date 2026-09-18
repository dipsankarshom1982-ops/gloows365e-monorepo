// PATH: apps/mobile/app/(drawer)/(tabs)/learn.tsx
// Learn tab — navigation-only grouping of existing learning modules.
// No new business logic; every card routes to an already-built screen.
//
// FEATURE CONTROL + APP MODULE RESTRUCTURE (audit finding C): this screen
// used to render every module unconditionally — Admin had no way to hide
// any of them. Module-level enable/disable now reuses the existing
// (previously orphaned — no consumer read `modules` from useAppConfig()
// before this) appModules collection, the same one apps/admin/src/pages/
// AppModules.tsx already manages, with its existing tester/admin bypass
// (AppConfigContext forces isEnabled:true for every module when the
// signed-in user's users/{uid}.role is "tester" or "admin" — satisfying
// "tester gets full access" for free, no new mechanism). A module with no
// matching appModules doc yet (nothing configured for it in Admin) stays
// visible — same as today's behavior — rather than disappearing by default.

import Header from "@/components/header";
import { useTheme } from "@/context/ThemeContext";
import { useAppTranslation } from "@/context/LanguageContext";
import { useAppConfig } from "@/context/AppConfigContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// CourseHub is listed in the nav spec but doesn't exist anywhere in this
// codebase (confirmed via repo-wide search) — omitted rather than invented.
// Each `key` doubles as the appModules/{key} document id (Admin's "Add
// Module" form on the rebuilt App Structure page writes these same ids).
const MODULES: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; route: string }[] = [
  { key: "ai-guru",       label: "AI Guru",       icon: "school-outline",   route: "/ai-guru" },
  { key: "shikshahub",    label: "ShikshaHub",    icon: "ribbon-outline",   route: "/shikshahub" },
  { key: "knowledgehub",  label: "Knowledge Hub", icon: "bulb-outline",     route: "/knowledge-hub" },
  { key: "seekho",        label: "Seekho",        icon: "book-outline",     route: "/seekho" },
  { key: "skillboost",    label: "SkillBoost",    icon: "flash-outline",    route: "/(drawer)/(tabs)/skillboost" },
  { key: "learnfun",      label: "Learn Fun",     icon: "game-controller-outline", route: "/(drawer)/(tabs)/learnFun" },
];

export default function Learn() {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const { modules } = useAppConfig();

  // Visible unless Admin has explicitly configured this exact module id as
  // disabled — see header comment. Never hides a module Admin hasn't
  // touched yet.
  const visibleModules = MODULES.filter((m) => modules.find((am) => am.id === m.key)?.isEnabled !== false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={t("learn") ?? "Learn"} />
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {visibleModules.map((m) => (
          <TouchableOpacity
            key={m.key}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(m.route as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${colors.accent}20` }]}>
              <Ionicons name={m.icon} size={24} color={colors.accent} />
            </View>
            <Text style={[styles.label, { color: colors.text }]}>{m.label}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: 16, borderWidth: 1, padding: 16,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  label: { flex: 1, fontSize: 16, fontWeight: "700" },
});

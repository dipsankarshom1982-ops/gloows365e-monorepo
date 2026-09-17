// PATH: apps/mobile/app/(drawer)/(tabs)/learn.tsx
// Learn tab — navigation-only grouping of existing learning modules.
// No new business logic; every card routes to an already-built screen.

import Header from "@/components/header";
import { useTheme } from "@/context/ThemeContext";
import { useAppTranslation } from "@/context/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// CourseHub is listed in the nav spec but doesn't exist anywhere in this
// codebase (confirmed via repo-wide search) — omitted rather than invented.
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={t("learn") ?? "Learn"} />
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {MODULES.map((m) => (
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

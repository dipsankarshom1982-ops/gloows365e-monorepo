// PATH: apps/mobile/app/(drawer)/(tabs)/challenge.tsx
// Challenge tab — navigation-only grouping of existing gamified modules.
// No new business logic; every card routes to an already-built screen.

import Header from "@/components/header";
import { useTheme } from "@/context/ThemeContext";
import { useAppTranslation } from "@/context/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const MODULES: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; route: string }[] = [
  { key: "vidyastar",   label: "VidyaStar",              icon: "star-outline",       route: "/vidyastar" },
  { key: "dsq",         label: "Daily Streak Quiz",       icon: "flame-outline",      route: "/daily-streak-quiz" },
  { key: "skillbattle", label: "SkillBattle",             icon: "trophy-outline",     route: "/skillbattle" },
  { key: "leaderboard", label: "Leaderboard (V-Coins)",   icon: "podium-outline",     route: "/leaderboard" },
  { key: "starboard",   label: "Starboard",               icon: "sparkles-outline",   route: "/starboard" },
  { key: "skillboard",  label: "SkillBoard",              icon: "ribbon-outline",     route: "/skillboard" },
];

export default function Challenge() {
  const { colors } = useTheme();
  const { t } = useAppTranslation();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={t("challenge") ?? "Challenge"} />
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

// PATH: components/aiGuru/AiGuruHeader.tsx
//
// Shared header for every AI Guru sub-screen (ask, dashboard, exam-simulator,
// photo-solve, voice-tutor, setup, notebook, my-lessons, subscription,
// content, player, skillguru, vidyaguru, and the AI Guru landing page
// itself). Each of these used to carry its own copy-pasted back button +
// title block with slightly different padding/colors — this consolidates
// them into one component so every AI Guru screen looks and behaves
// consistently, and a future style tweak only needs to happen once.
//
// `subtitle` and `rightElement` accept any ReactNode (not just strings) so
// screens with richer needs — player.tsx's XP progress bar in place of a
// subtitle, exam-simulator's countdown timer badge, notebook's "Ask AI"
// button — still fit without a special case per screen.
//
// `showLanguageBadge` adds a small tappable "🌐 {language}" pill under the
// header row (routes to /language-settings), matching the language option
// SkillGuru already has (its own "Responding in {language}" badge above
// the input bar). Off by default — screens that already surface their own
// language control (AI Guru home's language card, SkillGuru's input-bar
// badge) leave it off so it isn't shown twice; every other AI Guru
// sub-feature (Ask AI Guru, Dashboard, Photo Solve, Exam Simulator, Voice
// Tutor, Generate Lesson, My Lessons, Notebook, Subscription, lesson
// Content/Player) turns it on.

import { useTheme } from "@/context/ThemeContext";
import { useAppTranslation, useLanguage } from "@/context/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  title?: string;
  subtitle?: ReactNode;
  onBack?: () => void;
  rightElement?: ReactNode;
  showLanguageBadge?: boolean;
};

export default function AiGuruHeader({ title, subtitle, onBack, rightElement, showLanguageBadge = false }: Props) {
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { languageName } = useLanguage();
  const { t } = useAppTranslation();

  const text   = isDarkMode ? "#f1f5f9" : colors.text;
  const dim    = isDarkMode ? "#64748b" : colors.textSecondary;
  const muted  = isDarkMode ? "#94a3b8" : colors.textSecondary;
  const backBg = isDarkMode ? "rgba(255,255,255,0.08)" : colors.card;

  return (
    <Animated.View entering={FadeIn.duration(350)} style={{ paddingTop: insets.top + 12 }}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack ?? (() => router.back())}
          style={[styles.backBtn, { backgroundColor: backBg }]}
        >
          <Ionicons name="chevron-back" size={22} color={muted} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          {!!title && <Text style={[styles.headerTitle, { color: text }]} numberOfLines={1}>{title}</Text>}
          {typeof subtitle === "string"
            ? !!subtitle && <Text style={[styles.headerSub, { color: dim }]}>{subtitle}</Text>
            : subtitle}
        </View>

        {rightElement ?? <View style={styles.rightSpacer} />}
      </View>

      {showLanguageBadge && (
        <TouchableOpacity
          onPress={() => router.push("/language-settings" as any)}
          activeOpacity={0.75}
          style={[
            styles.langBadge,
            { backgroundColor: isDarkMode ? "rgba(99,102,241,0.12)" : "#ede9fe", borderColor: "#6366f1" },
          ]}
        >
          <Ionicons name="globe-outline" size={12} color="#6366f1" />
          <Text style={styles.langBadgeText}>{t("respondingIn", { defaultValue: `Responding in ${languageName}`, lang: languageName })}</Text>
          <Ionicons name="chevron-forward" size={11} color="#6366f1" />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  backBtn:      { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 17, fontWeight: "900" },
  headerSub:    { fontSize: 11, marginTop: 1 },
  rightSpacer:  { width: 40 },
  langBadge:      { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 4, marginLeft: 16, marginBottom: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  langBadgeText:  { color: "#6366f1", fontSize: 11, fontWeight: "700" },
});

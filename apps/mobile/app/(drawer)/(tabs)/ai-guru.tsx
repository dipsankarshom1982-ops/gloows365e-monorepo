// PATH: apps/mobile/app/(drawer)/(tabs)/ai-guru.tsx
// AI Guru TAB screen — renders the full AI Guru dashboard directly.
// Cannot use <Redirect> here because Expo Router won't show the tab icon
// when the screen immediately redirects away. Instead we render the same
// content as app/ai-guru/index.tsx directly in this file.

import ScholarshipAdCard from "@/components/ads/ScholarshipAdCard";
import AiGuruAvatar from "@/components/aiGuru/AiGuruAvatar";
import { useAppTranslation, useLanguage } from "@/context/LanguageContext";
import { useStudentProfile, useFeatureFlags } from "@gloows/shared-logic";
import { useTheme } from "@/context/ThemeContext";
import { useAdFeed } from "@/hooks/useAdFeed";
import { auth } from "@/lib/firebase";
import { isSubscribed } from "@/services/aiGuruFirestore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

type MenuCardDef = {
  flagKey: string;
  titleKey: string;
  subtitleKey: string;
  emoji: string;
  gradient: [string, string, string];
  route: string;
  premium: boolean;
  accentColor: string;
};

const MENU_CARD_DEFS: MenuCardDef[] = [
  { flagKey: "dashboard",      titleKey: "menuAiDashboard",    subtitleKey: "menuAiDashboardSub",    emoji: "🧠",  gradient: ["#1e1b4b", "#312e81", "#4f46e5"], route: "/ai-guru/dashboard",      premium: false, accentColor: "#818cf8" },
  { flagKey: "skillguru",      titleKey: "menuSkillGuruCard",  subtitleKey: "menuSkillGuruCardSub",  emoji: "🎯", gradient: ["#1a0533", "#4c1d95", "#7c3aed"], route: "/ai-guru/skillguru",      premium: false, accentColor: "#c4b5fd" },
  { flagKey: "photo_solve",    titleKey: "menuPhotoSolve",     subtitleKey: "menuPhotoSolveSub",     emoji: "📸",  gradient: ["#451a03", "#92400e", "#d97706"], route: "/ai-guru/photo-solve",    premium: false, accentColor: "#fbbf24" },
  { flagKey: "exam_simulator", titleKey: "menuExamSimulator",  subtitleKey: "menuExamSimulatorSub",  emoji: "🎯",  gradient: ["#450a0a", "#7f1d1d", "#dc2626"], route: "/ai-guru/exam-simulator", premium: false, accentColor: "#fca5a5" },
  { flagKey: "voice_tutor",    titleKey: "menuVoiceTutor",     subtitleKey: "menuVoiceTutorSub",     emoji: "🎙️",  gradient: ["#2e1065", "#6d28d9", "#a855f7"], route: "/ai-guru/voice-tutor",    premium: false, accentColor: "#d8b4fe" },
  { flagKey: "generate",       titleKey: "menuGenerateLesson", subtitleKey: "menuGenerateLessonSub", emoji: "✨",  gradient: ["#0f172a", "#1e3a5f", "#0284c7"], route: "/ai-guru/setup",          premium: false, accentColor: "#38bdf8" },
  { flagKey: "my_lessons",     titleKey: "menuMyLessons",      subtitleKey: "menuMyLessonsSub",      emoji: "📚",  gradient: ["#052e16", "#064e3b", "#059669"], route: "/ai-guru/my-lessons",     premium: false, accentColor: "#34d399" },
  { flagKey: "ask_aiguru",     titleKey: "menuAskAiGuruCard",  subtitleKey: "menuAskAiGuruCardSub",  emoji: "🤖",  gradient: ["#0f0f1e", "#1a1a3e", "#6366f1"], route: "/ai-guru/ask",            premium: false, accentColor: "#a5b4fc" },
  { flagKey: "notebook",       titleKey: "menuAiNotebook",     subtitleKey: "menuAiNotebookSub",     emoji: "📓",  gradient: ["#0c1a0c", "#14532d", "#16a34a"], route: "/ai-guru/notebook",       premium: false, accentColor: "#86efac" },
  { flagKey: "revision_reels", titleKey: "menuRevisionReels",  subtitleKey: "menuRevisionReelsSub",  emoji: "🎬",  gradient: ["#1c1917", "#44403c", "#78716c"], route: "/ai-guru/my-lessons",     premium: true,  accentColor: "#d6d3d1" },
  { flagKey: "practice_tests", titleKey: "menuPracticeTests",  subtitleKey: "menuPracticeTestsSub",  emoji: "📝",  gradient: ["#450a0a", "#7f1d1d", "#dc2626"], route: "/ai-guru/my-lessons",     premium: true,  accentColor: "#f87171" },
  { flagKey: "discover",       titleKey: "menuDiscoverAI",     subtitleKey: "menuDiscoverAISub",     emoji: "🧭",  gradient: ["#0c1a2e", "#0f2d4a", "#0369a1"], route: "/discover",                premium: false, accentColor: "#7dd3fc" },
];

function PulseRing({ size }: { size: number }) {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(0.6);
  useEffect(() => {
    scale.value = withRepeat(withSequence(withTiming(1.25, { duration: 1600 }), withTiming(1, { duration: 1600 })), -1, false);
    opacity.value = withRepeat(withSequence(withTiming(0, { duration: 1600 }), withTiming(0.6, { duration: 1600 })), -1, false);
  }, []);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  return (
    <Animated.View style={[ring, { position: "absolute", width: size + 24, height: size + 24, borderRadius: (size + 24) / 2, borderWidth: 2, borderColor: "#6366f1" }]} />
  );
}

export default function AiGuruTab() {
  const { t }                  = useAppTranslation();
  const { languageName }       = useLanguage();
  const { colors, isDarkMode } = useTheme();
  const { studentProfile }     = useStudentProfile();
  const { aiGuru }             = useFeatureFlags();
  const classLevel             = String(studentProfile?.class ?? "all");

  const [subscribed, setSubscribed] = useState(false);
  const [loading,    setLoading]    = useState(true);

  const { currentAd: scholarshipAd } = useAdFeed({ module: "aiGuru", classLevel, adType: "scholarship" });

  const textMain = isDarkMode ? "#f1f5f9" : colors.text;
  const textSec  = isDarkMode ? "#64748b" : colors.textSecondary;

  useFocusEffect(useCallback(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    isSubscribed(uid).then((sub) => { setSubscribed(sub); setLoading(false); });
  }, []));

  const visibleCards = MENU_CARD_DEFS.filter((def) => aiGuru(def.flagKey));

  return (
    <View style={[S.bg, { backgroundColor: isDarkMode ? "#060612" : colors.background }]}>
      <LinearGradient
        colors={isDarkMode ? ["#060612", "#0d0d24", "#060612"] : ["#f0f4ff", "#e8eeff", "#f0f4ff"]}
        style={StyleSheet.absoluteFillObject}
      />
      {isDarkMode && (
        <>
          <View style={[S.orb, { top: -60, left: -60, backgroundColor: "rgba(99,102,241,0.12)", width: 220, height: 220 }]} />
          <View style={[S.orb, { top: 120, right: -80, backgroundColor: "rgba(124,58,237,0.10)", width: 180, height: 180 }]} />
        </>
      )}

      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(400)} style={S.header}>
          {!subscribed && !loading && (
            <Pressable
              onPress={() => router.push("/ai-guru/subscription" as any)}
              android_ripple={{ color: "rgba(255,255,255,0.2)" }}
              style={({ pressed }) => [S.upgradeBadge, { opacity: pressed ? 0.85 : 1 }]}
            >
              <LinearGradient
                colors={["#92400e", "#d97706", "#fbbf24"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={S.upgradeBadgeGrad}
              >
                <Ionicons name="star" size={12} color="#fff" />
                <Text style={S.upgradeBadgeText}>{t("upgrade") ?? "Upgrade"}</Text>
              </LinearGradient>
            </Pressable>
          )}
          <View style={[S.langBadge, { backgroundColor: isDarkMode ? "rgba(99,102,241,0.15)" : "#ede9fe", borderColor: "#6366f1" }]}>
            <Ionicons name="globe-outline" size={12} color="#6366f1" />
            <Text style={S.langBadgeText}>{languageName}</Text>
          </View>
        </Animated.View>

        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(500).delay(100)} style={S.heroSection}>
          <View style={S.avatarWrap}>
            <PulseRing size={88} />
            <AiGuruAvatar size={88} />
          </View>
          <Text style={[S.heroTitle, { color: textMain }]}>{t("aiGuru")}</Text>
          <View style={S.taglineRow}>
            <LinearGradient colors={["#6366f1", "#8b5cf6", "#ec4899"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.taglinePill}>
              <Ionicons name="sparkles" size={12} color="#fff" />
              <Text style={S.taglineText}>{t("aiGuruTagline") ?? "India's Most Useful AI Guru"}</Text>
            </LinearGradient>
          </View>
          <Text style={[S.heroSubtitle, { color: textSec }]}>{t("aiClassroom")}</Text>
        </Animated.View>

        {/* Change Language card — a distinct button (not the passive badge
            above), so students can switch straight from the AI Guru home
            screen. Ask AI Guru now falls back to whatever this is set to
            for English/ambiguous-language questions (see
            functions/src/askAiGuru.ts) — questions clearly written in
            another language still get answered in that language, unchanged. */}
        <Animated.View entering={FadeInDown.duration(400).delay(180)}>
          <Pressable
            onPress={() => router.push("/language-settings")}
            android_ripple={{ color: "rgba(255,255,255,0.1)" }}
            style={({ pressed }) => [
              S.langCard,
              { backgroundColor: isDarkMode ? "rgba(99,102,241,0.1)" : "#ede9fe", borderColor: "#6366f1", opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="globe-outline" size={18} color="#6366f1" />
              <View>
                <Text style={[S.langCardTitle, { color: textMain }]}>{t("language") ?? "Language"}</Text>
                <Text style={[S.langCardValue, { color: textSec }]}>{languageName}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6366f1" />
          </Pressable>
        </Animated.View>

        {/* Scholarship ad */}
        {!subscribed && !loading && scholarshipAd && (
          <Animated.View entering={FadeInDown.duration(400).delay(220)}>
            <ScholarshipAdCard ad={scholarshipAd} module="aiGuru" classLevel={classLevel} style={{ marginHorizontal: 0, marginBottom: 4 }} />
          </Animated.View>
        )}

        {/* Menu grid */}
        <View style={S.grid}>
          {visibleCards.map((def, idx) => (
            <Animated.View key={def.titleKey} entering={FadeInDown.duration(400).delay(280 + idx * 60)} style={S.cardWrap}>
              <Pressable
                onPress={() => router.push(def.route as any)}
                android_ripple={{ color: "rgba(255,255,255,0.15)" }}
                style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}
              >
                <LinearGradient colors={def.gradient} style={S.card}>
                  <View style={[S.cardGlow, { backgroundColor: def.accentColor + "18" }]} />
                  <Text style={S.cardEmoji}>{def.emoji}</Text>
                  <Text style={S.cardTitle}>{t(def.titleKey as any) ?? def.titleKey}</Text>
                  <Text style={S.cardSubtitle} numberOfLines={2}>{t(def.subtitleKey as any) ?? def.subtitleKey}</Text>
                  <View style={[S.cardAccentLine, { backgroundColor: def.accentColor + "60" }]} />
                </LinearGradient>
              </Pressable>
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={FadeInUp.duration(400).delay(900)} style={S.poweredRow}>
          <Ionicons name="flash" size={11} color={textSec} />
          <Text style={[S.poweredText, { color: textSec }]}>Powered by Gemini AI</Text>
        </Animated.View>
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  bg:            { flex: 1 },
  orb:           { position: "absolute", borderRadius: 999 },
  scroll:        { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 52 },
  header:        { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 6, paddingBottom: 8 },
  upgradeBadge:  { borderRadius: 10, overflow: "hidden" },
  upgradeBadgeGrad: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  upgradeBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  langBadge:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  langBadgeText: { color: "#6366f1", fontSize: 11, fontWeight: "700" },
  langCard:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 },
  langCardTitle: { fontSize: 13, fontWeight: "800" },
  langCardValue: { fontSize: 11, marginTop: 1 },
  heroSection:   { alignItems: "center", paddingVertical: 28, gap: 12 },
  avatarWrap:    { alignItems: "center", justifyContent: "center", marginBottom: 4 },
  heroTitle:     { fontSize: 32, fontWeight: "900", letterSpacing: -0.5 },
  taglineRow:    { alignItems: "center" },
  taglinePill:   { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  taglineText:   { color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },
  heroSubtitle:  { fontSize: 13, textAlign: "center", lineHeight: 20, opacity: 0.8, maxWidth: 260 },
  grid:          { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  cardWrap:      { width: "47.5%" },
  card:          { borderRadius: 20, padding: 18, minHeight: 148, justifyContent: "flex-end", overflow: "hidden", gap: 6 },
  cardGlow:      { position: "absolute", top: 0, left: 0, right: 0, height: 60, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  cardEmoji:     { fontSize: 34 },
  cardTitle:     { color: "#f1f5f9", fontSize: 15, fontWeight: "900", lineHeight: 20 },
  cardSubtitle:  { color: "rgba(255,255,255,0.5)", fontSize: 11, lineHeight: 15 },
  cardAccentLine:{ height: 3, borderRadius: 2, marginTop: 4 },
  poweredRow:    { flexDirection: "row", alignItems: "center", gap: 5, justifyContent: "center", paddingVertical: 4 },
  poweredText:   { fontSize: 11 },
});
// PATH: apps/mobile/components/DailyStreakQuizCard.tsx
// Home-feed hero card for the Daily Streak Quiz — same layout as home.tsx's
// inline "aiguru" card, re-themed. Streak count comes from
// subscribeToStreakProgress, the same real-time listener on
// studentDailyStreakProgress/{uid} the quiz screen's own header
// (StreakStatsHeader) uses, so this stays in sync the instant a submission
// commits. Mirrors web app/(app)/home/page.tsx's DailyStreakQuizCard.

import { useAppTranslation } from "@/context/LanguageContext";
import { subscribeToStreakProgress } from "@/services/dailyStreakQuizService";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function DailyStreakQuizCard() {
  const { t } = useAppTranslation();
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const unsub = subscribeToStreakProgress((progress) => setStreak(progress?.currentStreak ?? 0));
    return unsub;
  }, []);

  return (
    <TouchableOpacity
      onPress={() => router.push("/daily-streak-quiz")}
      activeOpacity={0.88}
      style={S.wrap}
    >
      <LinearGradient
        colors={["#451a03", "#92400e", "#78350f"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={S.box}
      >
        <View style={S.orb} />
        <View style={S.topRow}>
          <View style={S.badge}>
            <Text style={S.badgeText}>🎯 {t("dailyChallenge") ?? "Daily Challenge"}</Text>
          </View>
          <View style={S.streakTag}>
            <Text style={S.streakTagText}>🔥 {streak} {t("dayStreak") ?? "Day Streak"}</Text>
          </View>
        </View>
        <View style={S.main}>
          <Text style={S.emoji}>🔥</Text>
          <View style={{ flex: 1 }}>
            <Text style={S.title}>{t("dailyStreakQuiz") ?? "Daily Streak Quiz"}</Text>
            <Text style={S.subtitle}>{t("dailyStreakQuizSubtitle") ?? "Answer today's question — keep your streak alive"}</Text>
          </View>
        </View>
        <LinearGradient
          colors={["#f59e0b", "#ea580c"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={S.cta}
        >
          <Text style={S.ctaText}>{t("playTodaysQuiz") ?? "Play Today's Quiz →"}</Text>
        </LinearGradient>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  wrap: { marginHorizontal: 15, marginVertical: 10, borderRadius: 20, elevation: 8, shadowColor: "#f59e0b", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 },
  box:  { borderRadius: 20, padding: 18, overflow: "hidden", borderWidth: 1, borderColor: "rgba(251,191,36,0.35)" },
  orb:  { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(251,191,36,0.15)", top: -40, right: -40 },

  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  badge:      { backgroundColor: "rgba(251,191,36,0.2)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "rgba(251,191,36,0.4)" },
  badgeText:  { color: "#fde68a", fontSize: 11, fontWeight: "700" },
  streakTag:     { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(16,185,129,0.15)", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "rgba(16,185,129,0.3)" },
  streakTagText: { color: "#fbbf24", fontSize: 11, fontWeight: "700" },

  main:     { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  emoji:    { fontSize: 44 },
  title:    { color: "#fff", fontWeight: "900", fontSize: 22, letterSpacing: 0.3 },
  subtitle: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 2 },

  cta:     { borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 14, fontWeight: "800", letterSpacing: 0.3 },
});

// PATH: components/dailyStreakQuiz/StreakStatsHeader.tsx
// Top stats card: date, current streak, weekly progress dots, completed
// weeks, V-Coins balance, XP — plus a rotating motivational quote.
// Visually consistent with the drawer's profile gradient card
// (app/(drawer)/_layout.tsx) — same indigo gradient + frosted stat boxes.

import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  DAILY_STREAK_QUIZ_MAX_WEEKLY_PROGRESS,
} from "@/lib/dailyStreakQuiz/types";

interface Props {
  currentStreak: number;
  weeklyProgress: number;
  completedWeeks: number;
  vCoinsBalance: number;
  xp: number;
}

const QUOTES = [
  "Learn one thing every day.",
  "Small steps, every day, win the race.",
  "Curiosity is the engine of achievement.",
  "A little progress each day adds up to big results.",
  "Today's effort is tomorrow's strength.",
  "Consistency beats intensity.",
  "Every question answered is a step forward.",
];

function todayLabel(): string {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function quoteOfTheDay(): string {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return QUOTES[dayIndex % QUOTES.length];
}

export default function StreakStatsHeader({
  currentStreak,
  weeklyProgress,
  completedWeeks,
  vCoinsBalance,
  xp,
}: Props) {
  const quote = useMemo(() => quoteOfTheDay(), []);

  return (
    <LinearGradient
      colors={["#1e1b4b", "#3730a3"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Text style={styles.date}>{todayLabel()}</Text>

      {/* Streak + weekly progress */}
      <View style={styles.streakRow}>
        <View style={styles.streakBlock}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.streakValue}>
            {currentStreak}/{DAILY_STREAK_QUIZ_MAX_WEEKLY_PROGRESS}
          </Text>
          <Text style={styles.streakLabel}>Day Streak</Text>
        </View>

        <View style={styles.dotsBlock}>
          <View style={styles.dotsRow}>
            {Array.from({ length: DAILY_STREAK_QUIZ_MAX_WEEKLY_PROGRESS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < weeklyProgress ? styles.dotFilled : styles.dotEmpty,
                ]}
              />
            ))}
          </View>
          <Text style={styles.dotsLabel}>Weekly Progress</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statEmoji}>🏆</Text>
          <Text style={styles.statValue}>{completedWeeks}</Text>
          <Text style={styles.statLabel}>Weeks Done</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statEmoji}>🪙</Text>
          <Text style={styles.statValue}>{vCoinsBalance}</Text>
          <Text style={styles.statLabel}>V-Coins</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statEmoji}>⚡</Text>
          <Text style={styles.statValue}>{xp}</Text>
          <Text style={styles.statLabel}>XP</Text>
        </View>
      </View>

      {/* Motivational quote */}
      <View style={styles.quoteBox}>
        <Text style={styles.quoteMark}>“</Text>
        <Text style={styles.quoteText}>{quote}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  date: {
    color: "#c7d2fe",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 16,
    padding: 14,
    gap: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  streakBlock: {
    alignItems: "center",
    gap: 2,
  },
  streakEmoji: { fontSize: 22 },
  streakValue: { color: "#fff", fontSize: 20, fontWeight: "900" },
  streakLabel: { color: "#a5b4fc", fontSize: 10, fontWeight: "600" },
  dotsBlock: {
    flex: 1,
    gap: 6,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    flex: 1,
    height: 8,
    borderRadius: 5,
  },
  dotFilled: { backgroundColor: "#fbbf24" },
  dotEmpty: { backgroundColor: "rgba(255,255,255,0.18)" },
  dotsLabel: { color: "#a5b4fc", fontSize: 10, fontWeight: "600" },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  statBox: { flex: 1, alignItems: "center", gap: 3 },
  statEmoji: { fontSize: 17 },
  statValue: { color: "#fff", fontWeight: "800", fontSize: 14 },
  statLabel: { color: "#a5b4fc", fontSize: 9.5, fontWeight: "600" },
  statDivider: { width: 1, height: 34, backgroundColor: "rgba(255,255,255,0.18)" },
  quoteBox: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
    paddingHorizontal: 4,
  },
  quoteMark: { color: "#fbbf24", fontSize: 22, fontWeight: "900", lineHeight: 22 },
  quoteText: {
    flex: 1,
    color: "#e0e7ff",
    fontSize: 13,
    fontWeight: "600",
    fontStyle: "italic",
    lineHeight: 18,
  },
});

// PATH: components/dailyStreakQuiz/AmbassadorBanner.tsx
// Shown once completedWeeks reaches DAILY_STREAK_QUIZ_AMBASSADOR_WEEKS (52).
// "Apply Now" records intent via applyForAmbassadorProgram() — actual
// application review is out of scope per spec §7.

import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface Props {
  alreadyApplied: boolean;
  onApply: () => Promise<void>;
}

export default function AmbassadorBanner({ alreadyApplied, onApply }: Props) {
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(alreadyApplied);

  const handleApply = async () => {
    if (applied || applying) return;
    setApplying(true);
    try {
      await onApply();
      setApplied(true);
    } finally {
      setApplying(false);
    }
  };

  return (
    <LinearGradient
      colors={["#92400e", "#d97706", "#fbbf24"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Text style={styles.trophy}>🏆</Text>
      <Text style={styles.title}>Congratulations!</Text>
      <Text style={styles.body}>
        You have successfully completed 52 Weekly Learning Streaks. You are now
        eligible to apply for the Gloows365 Student Ambassador Program.
      </Text>

      <TouchableOpacity
        style={[styles.button, applied && styles.buttonApplied]}
        onPress={handleApply}
        disabled={applied || applying}
        activeOpacity={0.85}
      >
        {applying ? (
          <ActivityIndicator color="#92400e" size="small" />
        ) : (
          <Text style={styles.buttonText}>{applied ? "✓ Applied" : "Apply Now"}</Text>
        )}
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  trophy: { fontSize: 40 },
  title: { color: "#fff", fontSize: 19, fontWeight: "900" },
  body: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 6,
  },
  button: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
    minWidth: 160,
    alignItems: "center",
  },
  buttonApplied: {
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  buttonText: {
    color: "#92400e",
    fontWeight: "800",
    fontSize: 14,
  },
});

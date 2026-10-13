// PATH: components/dailyStreakQuiz/OptionCard.tsx
// Modern "radio card" for a single quiz option. Three visual states:
//  - default / selected (before submit)
//  - correct (green, after submit)
//  - incorrect-selected (red, after submit — only shown on the option the
//    student actually picked, if it was wrong)
// Disabled entirely once the day's quiz is locked.

import { useTheme } from "@/context/ThemeContext";
import { DailyStreakQuizOption } from "@/lib/dailyStreakQuiz/types";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type OptionVisualState = "default" | "selected" | "correct" | "incorrect";

interface Props {
  letter: DailyStreakQuizOption;
  label: string;
  state: OptionVisualState;
  disabled?: boolean;
  onPress: () => void;
}

const LETTER_COLORS: Record<OptionVisualState, { bg: string; border: string; letterBg: string; letterText: string; text: string }> = {
  default: {
    bg: "transparent",
    border: "rgba(148,163,184,0.25)",
    letterBg: "rgba(148,163,184,0.15)",
    letterText: "#94a3b8",
    text: "inherit",
  },
  selected: {
    bg: "rgba(99,102,241,0.12)",
    border: "#6366f1",
    letterBg: "#6366f1",
    letterText: "#ffffff",
    text: "inherit",
  },
  correct: {
    bg: "rgba(16,185,129,0.14)",
    border: "#10b981",
    letterBg: "#10b981",
    letterText: "#ffffff",
    text: "#10b981",
  },
  incorrect: {
    bg: "rgba(239,68,68,0.14)",
    border: "#ef4444",
    letterBg: "#ef4444",
    letterText: "#ffffff",
    text: "#ef4444",
  },
};

export default function OptionCard({ letter, label, state, disabled, onPress }: Props) {
  const { colors } = useTheme();
  const palette = LETTER_COLORS[state];

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: palette.bg === "transparent" ? colors.card : palette.bg,
          borderColor: palette.border,
          opacity: disabled && state === "default" ? 0.55 : 1,
        },
      ]}
    >
      <View style={[styles.letterBadge, { backgroundColor: palette.letterBg }]}>
        <Text style={[styles.letterText, { color: palette.letterText }]}>{letter}</Text>
      </View>
      <Text
        style={[
          styles.label,
          { color: palette.text === "inherit" ? colors.text : palette.text },
        ]}
        numberOfLines={4}
      >
        {label}
      </Text>
      {state === "correct" && <Text style={styles.icon}>✅</Text>}
      {state === "incorrect" && <Text style={styles.icon}>❌</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  letterBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  letterText: {
    fontWeight: "800",
    fontSize: 14,
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
  },
  icon: {
    fontSize: 16,
  },
});

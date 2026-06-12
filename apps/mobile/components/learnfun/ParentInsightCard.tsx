// components/learnfun/ParentInsightCard.tsx

import { useTheme } from "@/context/ThemeContext";
import { Skill } from "@/lib/learnfun/types";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface ParentInsightCardProps {
  insight: string;
  skill: Skill;
  score: number;
}

function getSkillColor(skill: Skill): string {
  switch (skill) {
    case "Money Management": return "#F59E0B";
    case "Time Management": return "#10B981";
    case "Digital Safety": return "#0EA5E9";
    case "Goal Setting": return "#8B5CF6";
    case "Career Awareness": return "#EC4899";
    case "Communication": return "#F97316";
    case "Health & Habits": return "#10B981";
    case "Leadership": return "#818CF8";
    case "Decision Making": return "#A78BFA";
    case "Emotional Control": return "#F43F5E";
    default: return "#38BDF8";
  }
}

function getHomeActivity(skill: Skill): string {
  switch (skill) {
    case "Money Management":
      return "Try this at home: Give your child ₹100 this week and ask them to plan how to spend it. Discuss their choices together!";
    case "Time Management":
      return "Try this at home: Help your child create a simple daily schedule. Review it together each morning!";
    case "Digital Safety":
      return "Try this at home: Do a 'safe/unsafe' quiz about internet usage at dinner. Ask: What should you never share online?";
    case "Goal Setting":
      return "Try this at home: Help your child write one goal for the month. Pin it somewhere visible!";
    case "Career Awareness":
      return "Try this at home: Ask your child: 'What are 3 things you love doing?' Explore careers that match those interests!";
    case "Communication":
      return "Try this at home: Practice a 2-minute 'tell me about yourself' exercise. Take turns and give kind feedback!";
    case "Health & Habits":
      return "Try this at home: Set a 9pm phone-free rule this week and see how sleep improves for the whole family!";
    case "Leadership":
      return "Try this at home: Give your child responsibility for one family task this week — let them lead!";
    case "Decision Making":
      return "Try this at home: When making a family decision, involve your child. Ask: 'What do you think we should do and why?'";
    case "Emotional Control":
      return "Try this at home: Practice the 'STOP' technique together: Stop, Take a breath, Observe feelings, Proceed calmly.";
    default:
      return "Try this at home: Talk about today's lesson over dinner and connect it to a real-life situation!";
  }
}

function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Outstanding!", color: "#10B981" };
  if (score >= 75) return { label: "Great job!", color: "#38BDF8" };
  if (score >= 60) return { label: "Good effort!", color: "#F59E0B" };
  if (score >= 40) return { label: "Keep trying!", color: "#F97316" };
  return { label: "Practice more!", color: "#EF4444" };
}

export default function ParentInsightCard({ insight, skill, score }: ParentInsightCardProps) {
  const { colors } = useTheme();
  const skillColor = getSkillColor(skill);
  const homeActivity = getHomeActivity(skill);
  const scoreInfo = getScoreLabel(score);

  return (
    <View style={[styles.card, { borderColor: `${skillColor}30` }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>👨‍👩‍👧</Text>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: skillColor }]}>Parent Insight</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            Share this with your parents!
          </Text>
        </View>
      </View>

      {/* Score bar */}
      <View style={styles.scoreSection}>
        <View style={styles.scoreRow}>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>Score</Text>
          <Text style={[styles.scoreValue, { color: scoreInfo.color }]}>
            {score}% — {scoreInfo.label}
          </Text>
        </View>
        <View style={[styles.scoreBarBg, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
          <View
            style={[
              styles.scoreBarFill,
              { width: `${score}%`, backgroundColor: scoreInfo.color },
            ]}
          />
        </View>
      </View>

      {/* Insight text */}
      <View style={[styles.insightBox, { backgroundColor: `${skillColor}12` }]}>
        <Text style={[styles.insightText, { color: colors.text }]}>{insight}</Text>
      </View>

      {/* Home activity */}
      <View style={[styles.activityBox, { backgroundColor: "rgba(255,255,255,0.05)" }]}>
        <Text style={[styles.activityTitle, { color: colors.text }]}>🏠 Home Activity</Text>
        <Text style={[styles.activityText, { color: colors.textSecondary }]}>{homeActivity}</Text>
      </View>

      {/* Skill tag */}
      <View style={[styles.skillTag, { backgroundColor: `${skillColor}20` }]}>
        <Text style={[styles.skillTagText, { color: skillColor }]}>Skill: {skill}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerEmoji: {
    fontSize: 36,
  },
  headerText: {
    gap: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  headerSub: {
    fontSize: 12,
  },
  scoreSection: {
    gap: 6,
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: "800",
  },
  scoreBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  scoreBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  insightBox: {
    borderRadius: 12,
    padding: 14,
  },
  insightText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
  },
  activityBox: {
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  activityText: {
    fontSize: 12,
    lineHeight: 18,
  },
  skillTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  skillTagText: {
    fontSize: 11,
    fontWeight: "700",
  },
});

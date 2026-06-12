// components/learnfun/BossBattleCard.tsx

import { useTheme } from "@/context/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface BossBattleCardProps {
  studentClass: number;
  daysUntilFriday: number;
  onPlay: () => void;
}

function getBossForClass(studentClass: number): { name: string; emoji: string; description: string } {
  if (studentClass <= 6) return { name: "Budget Goblin", emoji: "👺", description: "The Budget Goblin steals your savings! Can you outsmart him?" };
  if (studentClass <= 8) return { name: "Time Wraith", emoji: "👻", description: "The Time Wraith steals your hours! Defeat him with smart scheduling!" };
  if (studentClass <= 10) return { name: "Cyber Dragon", emoji: "🐉", description: "The Cyber Dragon spreads misinformation! Use your digital skills to defeat him!" };
  return { name: "The Decision Titan", emoji: "🤖", description: "The Decision Titan challenges your life choices! Show your wisdom!" };
}

export default function BossBattleCard({ studentClass, daysUntilFriday, onPlay }: BossBattleCardProps) {
  const { colors } = useTheme();
  const boss = getBossForClass(studentClass);
  const isUnlocked = daysUntilFriday === 0;

  return (
    <LinearGradient
      colors={isUnlocked ? ["#7F1D1D", "#991B1B"] : ["#1F2937", "#111827"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { borderColor: isUnlocked ? "#EF444450" : colors.border }]}
    >
      {/* Badge */}
      <View style={[styles.badge, { backgroundColor: isUnlocked ? "#EF4444" : "#374151" }]}>
        <Text style={styles.badgeText}>
          {isUnlocked ? "⚔️ LIVE NOW" : "🔒 FRIDAY"}
        </Text>
      </View>

      <View style={styles.mainRow}>
        <Text style={styles.bossEmoji}>{boss.emoji}</Text>

        <View style={styles.textGroup}>
          <Text style={styles.bossLabel}>Weekly Boss Battle</Text>
          <Text style={styles.bossName}>{boss.name}</Text>
          <Text style={[styles.bossDesc, { color: "rgba(255,255,255,0.7)" }]} numberOfLines={2}>
            {boss.description}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        {!isUnlocked && (
          <View style={styles.countdownPill}>
            <Text style={styles.countdownText}>
              🗓️ Available in {daysUntilFriday} day{daysUntilFriday !== 1 ? "s" : ""}
            </Text>
          </View>
        )}

        {isUnlocked && (
          <TouchableOpacity onPress={onPlay} style={styles.playBtn} activeOpacity={0.85}>
            <Text style={styles.playBtnText}>⚔️ BATTLE NOW</Text>
          </TouchableOpacity>
        )}

        <View style={styles.rewardPill}>
          <Text style={styles.rewardText}>🪙 150 coins  ⚡ 200 XP</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    marginHorizontal: 20,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  bossEmoji: {
    fontSize: 52,
  },
  textGroup: {
    flex: 1,
    gap: 4,
  },
  bossLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "600",
  },
  bossName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  bossDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  countdownPill: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  countdownText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "600",
  },
  playBtn: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  playBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  rewardPill: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: "auto",
  },
  rewardText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "600",
  },
});

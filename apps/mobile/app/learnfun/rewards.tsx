// PATH: app/learnfun/rewards.tsx
// Changes:
//  • Coins card now shows V-Coins (from useVCoins hook) not profile.coins (LearnFunCoins)
//  • Label changed from "LearnFun Coins" → "V-Coins"
//  • Mystery box reward no longer awards old coins — calls claimVCoinReward CF instead
//  • canOpenMysteryBox threshold unchanged
//  • buildMysteryReward still computes amount; the actual award goes via CF

import MysteryBoxModal from "@/components/learnfun/MysteryBoxModal";
import RewardBadgeCard from "@/components/learnfun/RewardBadgeCard";
import { useTheme } from "@/context/ThemeContext";
import { useLearnFun } from "@/hooks/useLearnFun";
import { useVCoins } from "@/hooks/useVCoins";
import { functions } from "@/lib/firebase";
import { MissionReward } from "@/lib/learnfun/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { httpsCallable } from "firebase/functions";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const claimVCoinRewardCF = httpsCallable<
  { activityId: string; referenceId?: string },
  { success: boolean; coinsAwarded: number }
>(functions, "claimVCoinReward");

function canOpenMysteryBox(completedCount: number): boolean {
  return completedCount >= 1;
}

function buildMysteryReward(level: number): MissionReward {
  const base = Math.min(level * 5, 30);
  return {
    coins: base + Math.floor(Math.random() * 20),
    xp:    base * 2 + Math.floor(Math.random() * 30),
    badge: level >= 3 ? "badge_streak_7" : undefined,
  };
}

export default function RewardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { profile, allBadges, loading } = useLearnFun();
  const { balance: vCoinsBalance } = useVCoins();

  const [mysteryVisible, setMysteryVisible] = useState(false);
  const mysteryBoxAnim = React.useRef(new Animated.Value(1)).current;

  const mysteryReward = useMemo(
    () => (profile ? buildMysteryReward(profile.level) : { coins: 10, xp: 15 }),
    [profile]
  );

  const handleOpenMystery = useCallback(async () => {
    setMysteryVisible(true);
    Animated.sequence([
      Animated.timing(mysteryBoxAnim, { toValue: 1.15, duration: 200, useNativeDriver: true }),
      Animated.timing(mysteryBoxAnim, { toValue: 1,    duration: 200, useNativeDriver: true }),
    ]).start();

    // Award V-Coins via Cloud Function for mystery box
    try {
      await claimVCoinRewardCF({
        activityId:  "lesson_complete", // reuse lesson_complete (max 5/day) for mystery box
        referenceId: `mystery_${new Date().toDateString()}`,
      });
    } catch (e: any) {
      if (e?.code !== "already-exists" && e?.code !== "resource-exhausted") {
        console.warn("[rewards] mystery box V-Coin claim failed:", e?.message);
      }
    }
  }, [mysteryBoxAnim]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Profile not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.accent }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const earnedBadges   = allBadges.filter((b) => profile.badges.includes(b.id));
  const unearnedBadges = allBadges.filter((b) => !profile.badges.includes(b.id));
  const mysteryAvailable = canOpenMysteryBox(profile.completedMissionIds.length);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Rewards & Badges</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* V-Coins summary card */}
        <LinearGradient
          colors={["#7C3AED", "#F59E0B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.coinsCard}
        >
          <Text style={styles.coinsEmoji}>🪙</Text>
          <View style={styles.coinsTextGroup}>
            <Text style={styles.coinsValue}>{(vCoinsBalance ?? 0).toLocaleString()}</Text>
            <Text style={styles.coinsLabel}>V-Coins Balance</Text>
          </View>
          <View style={styles.coinsStats}>
            <Text style={styles.coinsStatItem}>⭐ Level {profile.level}</Text>
            <Text style={styles.coinsStatItem}>⚡ {profile.xp} XP</Text>
          </View>
        </LinearGradient>

        {/* Mystery Box */}
        <View style={[styles.mysterySection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.mysteryTextGroup}>
            <Text style={[styles.mysteryTitle, { color: colors.text }]}>🎁 Mystery Box</Text>
            <Text style={[styles.mysterySubtitle, { color: colors.textSecondary }]}>
              {mysteryAvailable
                ? "You have a mystery box to open!"
                : "Complete more missions to unlock!"}
            </Text>
          </View>
          <Animated.View style={{ transform: [{ scale: mysteryBoxAnim }] }}>
            <TouchableOpacity
              onPress={mysteryAvailable ? handleOpenMystery : undefined}
              disabled={!mysteryAvailable}
              style={[styles.mysteryBtn, { opacity: mysteryAvailable ? 1 : 0.4 }]}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={mysteryAvailable ? ["#8B5CF6", "#6366F1"] : ["#374151", "#1F2937"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.mysteryBtnGradient}
              >
                <Text style={styles.mysteryBtnText}>
                  {mysteryAvailable ? "📦 Open Box!" : "🔒 Locked"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Earned Badges */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            🏅 Earned Badges ({earnedBadges.length})
          </Text>
          {earnedBadges.length > 0 ? (
            <View style={styles.badgesGrid}>
              {earnedBadges.map((badge) => (
                <RewardBadgeCard key={badge.id} badge={badge} earned={true} />
              ))}
            </View>
          ) : (
            <View style={[styles.emptyBadges, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={styles.emptyEmoji}>🏅</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No badges yet! Complete missions to earn your first badge.
              </Text>
            </View>
          )}
        </View>

        {/* Locked Badges */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            🔒 Badges to Unlock ({unearnedBadges.length})
          </Text>
          <View style={styles.badgesGrid}>
            {unearnedBadges.map((badge) => (
              <RewardBadgeCard key={badge.id} badge={badge} earned={false} />
            ))}
          </View>
        </View>

        {/* V-Coins info */}
        <View style={[styles.coinsInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.coinsInfoTitle, { color: colors.text }]}>💡 About V-Coins</Text>
          <Text style={[styles.coinsInfoText, { color: colors.textSecondary }]}>
            Earn V-Coins by completing daily missions, watching videos, using AI Guru, and winning Skill Battles.
            V-Coins are used for Pan-India rankings and unlock surprise rewards each year!
          </Text>
        </View>
      </ScrollView>

      <MysteryBoxModal
        visible={mysteryVisible}
        onClose={() => setMysteryVisible(false)}
        reward={mysteryReward}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  backBtn:     { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  content:     { padding: 20, gap: 20, paddingBottom: 40 },
  coinsCard: {
    borderRadius: 20, padding: 20, flexDirection: "row", alignItems: "center", gap: 14,
  },
  coinsEmoji:     { fontSize: 40 },
  coinsTextGroup: { flex: 1, gap: 3 },
  coinsValue:     { color: "#FEF3C7", fontSize: 28, fontWeight: "900" },
  coinsLabel:     { color: "rgba(254,243,199,0.7)", fontSize: 13 },
  coinsStats:     { alignItems: "flex-end", gap: 4 },
  coinsStatItem:  { color: "rgba(254,243,199,0.8)", fontSize: 12, fontWeight: "600" },
  mysterySection: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: 16, padding: 16, borderWidth: 1, gap: 12,
  },
  mysteryTextGroup:    { flex: 1, gap: 3 },
  mysteryTitle:        { fontSize: 16, fontWeight: "700" },
  mysterySubtitle:     { fontSize: 12, lineHeight: 17 },
  mysteryBtn:          { borderRadius: 14, overflow: "hidden" },
  mysteryBtnGradient:  { paddingHorizontal: 16, paddingVertical: 12, alignItems: "center", borderRadius: 14 },
  mysteryBtnText:      { color: "#fff", fontSize: 14, fontWeight: "800" },
  section:             { gap: 12 },
  sectionTitle:        { fontSize: 16, fontWeight: "800" },
  badgesGrid:          { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  emptyBadges:         { borderRadius: 16, padding: 24, borderWidth: 1, alignItems: "center", gap: 10 },
  emptyEmoji:          { fontSize: 36 },
  emptyText:           { fontSize: 13, textAlign: "center", lineHeight: 19 },
  coinsInfo:           { borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  coinsInfoTitle:      { fontSize: 14, fontWeight: "700" },
  coinsInfoText:       { fontSize: 13, lineHeight: 19 },
});

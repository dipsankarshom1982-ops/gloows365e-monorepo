// app/(drawer)/(tabs)/learnFun.tsx
// LearnFun Home Screen — complete replacement

import BossBattleCard from "@/components/learnfun/BossBattleCard";
import CoinXPBar from "@/components/learnfun/CoinXPBar";
import ComingSoonCard from "@/components/learnfun/ComingSoonCard";
import MissionCard from "@/components/learnfun/MissionCard";
import RewardBadgeCard from "@/components/learnfun/RewardBadgeCard";
import SkillWorldCard from "@/components/learnfun/SkillWorldCard";
import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useLearnFun } from "@/hooks/useLearnFun";
import { COMING_SOON } from "@/lib/learnfun/constants";
import { LearnFunGame, SkillWorld } from "@/lib/learnfun/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function getDaysUntilFriday(): number {
  const today = new Date().getDay();
  if (today === 5) return 0;
  const daysUntil = (5 - today + 7) % 7;
  return daysUntil === 0 ? 7 : daysUntil;
}

function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case "easy": return "#10B981";
    case "medium": return "#F59E0B";
    case "hard": return "#EF4444";
    case "boss": return "#8B5CF6";
    default: return "#94A3B8";
  }
}

interface GameCardItemProps {
  game: LearnFunGame;
  onPress: (game: LearnFunGame) => void;
  colors: {
    card: string;
    border: string;
    text: string;
    textSecondary: string;
    accent: string;
    background: string;
  };
}

function GameCardItem({ game, onPress, colors }: GameCardItemProps) {
  const { t } = useAppTranslation();
  const handlePress = useCallback(() => onPress(game), [game, onPress]);
  const difficultyColor = getDifficultyColor(game.difficulty);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      style={[styles.gameCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <LinearGradient
        colors={(game.gradientColors ?? ["#374151", "#1F2937"]) as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gameCardGradient}
      >
        <Text style={styles.gameCardEmoji}>{game.emoji}</Text>
        <View style={[styles.difficultyPill, { backgroundColor: `${difficultyColor}25` }]}>
          <Text style={[styles.difficultyPillText, { color: difficultyColor }]}>
            {game.difficulty.toUpperCase()}
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.gameCardBody}>
        <Text style={[styles.gameCardTitle, { color: colors.text }]} numberOfLines={2}>
          {game.title}
        </Text>
        <Text style={[styles.gameCardSkill, { color: colors.textSecondary }]} numberOfLines={1}>
          {game.skill}
        </Text>
        <View style={styles.gameCardMeta}>
          <Text style={[styles.gameCardDuration, { color: colors.textSecondary }]}>
            ⏱️ {game.durationMinutes}min
          </Text>
          <TouchableOpacity
            onPress={handlePress}
            style={[styles.gamePlayBtn, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.gamePlayBtnText}>{t("play")}</Text>
            <Ionicons name="play" size={10} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

interface SkillWorldItemProps {
  world: SkillWorld;
  onPress: (world: SkillWorld) => void;
}

function SkillWorldItem({ world, onPress }: SkillWorldItemProps) {
  const handlePress = useCallback(() => onPress(world), [world, onPress]);
  return <SkillWorldCard world={world} onPress={handlePress} />;
}

export default function LearnFunHomeScreen() {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const router = useRouter();
  const { profile, todaysMission, visibleGames, skillWorlds, allBadges, missionPlayedToday, loading } = useLearnFun();

  const daysUntilFriday = getDaysUntilFriday();

  const navigateToGame = useCallback(
    (gameType: string, extraParams?: Record<string, string>) => {
      const params = new URLSearchParams(extraParams ?? {});
      const query = params.toString() ? `?${params.toString()}` : "";

      switch (gameType) {
        case "budget_simulator":
          router.push((`/learnfun/play/budget${query}`) as never);
          break;
        case "time_planner":
          router.push((`/learnfun/play/time-planner${query}`) as never);
          break;
        case "choice_story":
          router.push((`/learnfun/play/choice-story${query}`) as never);
          break;
        case "digital_safety":
          router.push((`/learnfun/play/digital-safety${query}`) as never);
          break;
        case "career_goal":
          router.push((`/learnfun/play/career-goal${query}`) as never);
          break;
        case "boss_battle":
          router.push((`/learnfun/play/boss-battle${query}`) as never);
          break;
        default:
          break;
      }
    },
    [router]
  );

  const handleMissionPress = useCallback(() => {
    if (!todaysMission) return;
    navigateToGame(todaysMission.gameType, {
      missionId: todaysMission.id,
      missionTitle: todaysMission.missionTitle,
      studentClass: String(profile?.class ?? 8),
    });
  }, [todaysMission, navigateToGame, profile]);

  const handleGamePress = useCallback(
    (game: LearnFunGame) => {
      navigateToGame(game.gameType, {
        gameId: game.id,
        missionTitle: game.title,
        studentClass: String(profile?.class ?? 8),
      });
    },
    [navigateToGame, profile]
  );

  const handleWorldPress = useCallback((_world: SkillWorld) => {
    // Future: navigate to skill world detail
  }, []);

  const handleBossBattlePlay = useCallback(() => {
    navigateToGame("boss_battle", {
      studentClass: String(profile?.class ?? 8),
    });
  }, [navigateToGame, profile]);

  const renderGameItem = useCallback(
    ({ item }: { item: LearnFunGame }) => (
      <GameCardItem game={item} onPress={handleGamePress} colors={colors} />
    ),
    [handleGamePress, colors]
  );

  const gameKeyExtractor = useCallback((item: LearnFunGame) => item.id, []);

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {t("learnFunLoading")}
        </Text>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={styles.emptyEmoji}>😴</Text>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("profileNotFound")}</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          {t("profileSetupPrompt")}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 1. Header */}
        <LinearGradient
          colors={["#020617", "#1E1B4B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTopRow}>
            <View style={styles.headerTextGroup}>
              <Text style={styles.headerGreeting}>
                Hi {profile.name.split(" ")[0]}, ready for today's LearnFun? 🎮
              </Text>
              <View style={styles.classBadge}>
                <Text style={styles.classBadgeText}>Class {profile.class}</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => router.push("/learnfun/progress" as never)}
              style={styles.progressBtn}
            >
              <Ionicons name="stats-chart" size={18} color={colors.accent} />
            </TouchableOpacity>
          </View>

          <CoinXPBar
            vCoins={profile.coins}
            xp={profile.xp}
            level={profile.level}
            streak={profile.streak}
          />
        </LinearGradient>

        {/* 2. Streak Display */}
        <View style={styles.section}>
          <View style={[styles.streakCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.streakRow}>
              <Text style={styles.streakFlame}>{profile.streak > 0 ? "🔥" : "💤"}</Text>
              <View style={styles.streakTextGroup}>
                <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>{t("dailyStreak")}</Text>
                <Text style={[styles.streakCount, { color: profile.streak > 0 ? "#EF4444" : colors.textSecondary }]}>
                  {profile.streak > 0 ? `${profile.streak} Day${profile.streak !== 1 ? "s" : ""}!` : "0 Days"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push("/learnfun/streak" as never)}
                style={[styles.viewStreakBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.viewStreakText, { color: colors.accent }]}>{t("view")}</Text>
                <Ionicons name="chevron-forward" size={12} color={colors.accent} />
              </TouchableOpacity>
            </View>
            <View style={styles.milestoneDots}>
              {[3, 7, 14, 30].map((m) => (
                <View
                  key={m}
                  style={[
                    styles.milestoneDot,
                    profile.streak >= m
                      ? { backgroundColor: "#EF4444" }
                      : { backgroundColor: "rgba(255,255,255,0.08)" },
                  ]}
                >
                  <Text style={styles.milestoneDotText}>{m}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* 3. Daily Mission Card */}
        <View style={styles.sectionWithHeader}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              🎯 {t("todaysMission")}
            </Text>
            <View style={styles.liveChip}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{t("daily")}</Text>
            </View>
          </View>

          {todaysMission ? (
            <MissionCard
              mission={todaysMission}
              onPress={handleMissionPress}
              studentClass={profile.class}
              completed={missionPlayedToday}
            />
          ) : (
            <View style={[styles.emptyMissionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={styles.emptyEmoji}>🎮</Text>
              <Text style={[styles.emptyMissionText, { color: colors.textSecondary }]}>
                {t("noMissionToday")}
              </Text>
            </View>
          )}
        </View>

        {/* 4. Skill Worlds */}
        <View style={styles.sectionWithHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text, paddingHorizontal: 20 }]}>
            🌍 {t("skillWorlds")}
          </Text>
          <View style={styles.worldsGrid}>
            {skillWorlds.map((world) => (
              <SkillWorldItem key={world.id} world={world} onPress={handleWorldPress} />
            ))}
          </View>
        </View>

        {/* 5. Boss Battle */}
        <View style={styles.sectionWithHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text, paddingHorizontal: 20 }]}>
            ⚔️ {t("bossBattle")}
          </Text>
          <BossBattleCard
            studentClass={profile.class}
            daysUntilFriday={daysUntilFriday}
            onPlay={handleBossBattlePlay}
          />
        </View>

        {/* 6. Your Games */}
        <View style={styles.sectionWithHeader}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              🎮 {t("yourGames")}
            </Text>
            <View style={[styles.classFilterBadge, { backgroundColor: "rgba(56,189,248,0.15)" }]}>
              <Text style={[styles.classFilterText, { color: colors.accent }]}>
                Class {profile.class}
              </Text>
            </View>
          </View>

          {visibleGames.length > 0 ? (
            <FlatList
              data={visibleGames}
              renderItem={renderGameItem}
              keyExtractor={gameKeyExtractor}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.gamesList}
              scrollEnabled
            />
          ) : (
            <View style={[styles.emptyGamesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={styles.emptyEmoji}>🎮</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t("gamesLoading")}
              </Text>
            </View>
          )}
        </View>

        {/* 7. Badges */}
        <View style={styles.sectionWithHeader}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              🏅 {t("yourBadges")}
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/learnfun/rewards" as never)}
              style={[styles.viewAllBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.viewAllText, { color: colors.accent }]}>{t("viewAll")}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgesList}
          >
            {allBadges.slice(0, 6).map((badge) => (
              <RewardBadgeCard
                key={badge.id}
                badge={badge}
                earned={profile.badges.includes(badge.id)}
              />
            ))}
          </ScrollView>
        </View>

        {/* 8. Coming Soon */}
        <View style={styles.sectionWithHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text, paddingHorizontal: 20 }]}>
            🔒 {t("comingSoon")}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.comingSoonList}
          >
            {COMING_SOON.map((game) => (
              <ComingSoonCard key={game.id} game={game} />
            ))}
          </ScrollView>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: "500",
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  header: {
    padding: 20,
    paddingTop: 16,
    gap: 16,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  headerTextGroup: {
    flex: 1,
    gap: 8,
  },
  headerGreeting: {
    color: "#E2E8F0",
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 24,
  },
  classBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(56,189,248,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  classBadgeText: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "700",
  },
  progressBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(56,189,248,0.15)",
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionWithHeader: {
    paddingTop: 20,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  liveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(16,185,129,0.2)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  liveText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10B981",
  },
  classFilterBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  classFilterText: {
    fontSize: 12,
    fontWeight: "700",
  },
  streakCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  streakFlame: {
    fontSize: 32,
  },
  streakTextGroup: {
    flex: 1,
    gap: 2,
  },
  streakLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  streakCount: {
    fontSize: 20,
    fontWeight: "800",
  },
  viewStreakBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  viewStreakText: {
    fontSize: 12,
    fontWeight: "600",
  },
  milestoneDots: {
    flexDirection: "row",
    gap: 8,
  },
  milestoneDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneDotText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  emptyMissionCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    alignItems: "center",
    gap: 12,
  },
  emptyMissionText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  worldsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    gap: 12,
  },
  gamesList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  gameCard: {
    width: 200,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
  },
  gameCardGradient: {
    height: 100,
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 12,
    flexDirection: "row",
  },
  gameCardEmoji: {
    fontSize: 32,
  },
  difficultyPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  difficultyPillText: {
    fontSize: 9,
    fontWeight: "800",
  },
  gameCardBody: {
    padding: 12,
    gap: 4,
  },
  gameCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17,
  },
  gameCardSkill: {
    fontSize: 11,
    fontWeight: "500",
  },
  gameCardMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  gameCardDuration: {
    fontSize: 11,
  },
  gamePlayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  gamePlayBtnText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  emptyGamesCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
  },
  badgesList: {
    paddingHorizontal: 20,
    gap: 10,
  },
  viewAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: "600",
  },
  comingSoonList: {
    paddingHorizontal: 20,
    gap: 10,
  },
});

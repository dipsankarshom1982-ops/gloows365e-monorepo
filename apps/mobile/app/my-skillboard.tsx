// PATH: app/my-skillboard.tsx
//
// Phase 2D-7 — Persistent SkillBoard: the student's own reputation/
// identity surface, distinct from the legacy per-battle leaderboard at
// app/skillboard.tsx (untouched by this phase — see this file's header
// for why that screen was NOT reused: it's a month/scope-scoped legacy
// posts leaderboard, not a persistent cross-battle identity model at all).
//
// SCOPE: current student's OWN SkillBoard only. firestore.rules'
// students/{userId} read rule is `auth.uid == userId || admin` — there is
// no backend support for viewing another student's profile, so this
// screen doesn't attempt one (brief §16: "If a public student SkillBoard
// is not currently supported: implement the current student's SkillBoard
// only. Do NOT create a new public-profile architecture in this phase.")
//
// TRUST RULE: every skill point, achievement count, rank, score, and
// winner flag rendered here is either a direct read of an authoritative,
// client-write-denied Firestore doc (skillPoints, achievementEvents,
// battleResults — all `write: if false`) or the existing VCoins wallet
// service (services/vCoinsService.ts, reused verbatim, not duplicated).
// See components/battle/skillboardApi.ts's header for the full forensic
// findings (no SkillBoard summary callable exists; no composite indexes
// exist for these collections) that shaped every query in this screen.

import Header from "@/components/header";
import EmptyState from "@/components/battle/EmptyState";
import { BattleCardSkeleton } from "@/components/battle/SkeletonBlock";
import { ACHIEVEMENT_LABELS, type AchievementRuleId } from "@/components/battle/battleResultsApi";
import {
  fetchMyProfile, fetchMySkillIdentity, fetchMyTrophyCounts, fetchMyBattleHistoryPage,
  type MyProfile, type MySkillEntry, type TrophyCounts, type HistoryItem,
} from "@/components/battle/skillboardApi";
import { useTheme } from "@/context/ThemeContext";
import { auth } from "@/lib/firebase";
import { getVCoinsBalance } from "@/services/vCoinsService";
import { getActiveSkillCategories, getActiveSkills, type Skill, type SkillCategory } from "@/services/skillTaxonomyService";
import { formatVCoins } from "@/utils/formatVCoins";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { useCallback, useState } from "react";
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ACCENT = "#ff9f43";
const TROPHY_ORDER: AchievementRuleId[] = ["winner", "top3", "top10", "participated"];

export default function MySkillBoardScreen() {
  const { colors } = useTheme();

  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [vcoins, setVcoins] = useState<number | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [skillEntries, setSkillEntries] = useState<MySkillEntry[]>([]);
  const [trophies, setTrophies] = useState<TrophyCounts | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyCursor, setHistoryCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyLoadMoreError, setHistoryLoadMoreError] = useState(false);
  const [historyDone, setHistoryDone] = useState(false);

  const loadAll = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setErrorMsg("Please sign in to view your SkillBoard."); setPhase("error"); return; }
    setPhase("loading"); setErrorMsg("");
    try {
      const [myProfile, skillList, categoryList, myVcoins] = await Promise.all([
        fetchMyProfile(uid),
        getActiveSkills(),
        getActiveSkillCategories(),
        getVCoinsBalance(uid),
      ]);
      setProfile(myProfile);
      setSkills(skillList);
      setCategories(categoryList);
      setVcoins(myVcoins);

      const [mySkillEntries, myTrophies, firstHistoryPage] = await Promise.all([
        fetchMySkillIdentity(uid, skillList, categoryList),
        fetchMyTrophyCounts(uid),
        fetchMyBattleHistoryPage(uid, null, skillList, categoryList, 10),
      ]);
      setSkillEntries(mySkillEntries);
      setTrophies(myTrophies);
      setHistory(firstHistoryPage.items);
      setHistoryCursor(firstHistoryPage.nextCursor);
      setHistoryDone(firstHistoryPage.nextCursor === null);

      setPhase("ready");
    } catch {
      setErrorMsg("Couldn't load your SkillBoard. Try again.");
      setPhase("error");
    }
  }, []);

  const loadMoreHistory = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !historyCursor || historyLoadingMore) return;
    setHistoryLoadingMore(true); setHistoryLoadMoreError(false);
    try {
      const page = await fetchMyBattleHistoryPage(uid, historyCursor, skills, categories, 10);
      setHistory((prev) => [...prev, ...page.items]);
      setHistoryCursor(page.nextCursor);
      setHistoryDone(page.nextCursor === null);
    } catch {
      setHistoryLoadMoreError(true);
    } finally {
      setHistoryLoadingMore(false);
    }
  };

  // Phase 2D-8 polish: useFocusEffect alone covers both "initial mount"
  // (a freshly pushed screen is immediately focused) and "returned to this
  // screen" — a separate plain useEffect(loadAll) here used to duplicate
  // the same call on every first load (brief §23: "duplicate API calls").
  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const onRefresh = () => { setRefreshing(true); loadAll().finally(() => setRefreshing(false)); };

  if (phase === "loading") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header hideMenu />
        <View style={{ padding: 16, gap: 12 }}>
          <BattleCardSkeleton />
          <BattleCardSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  if (phase === "error") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header hideMenu />
        <EmptyState emoji="⚠️" title={errorMsg} actionLabel="Retry" onAction={loadAll} />
      </SafeAreaView>
    );
  }

  const isFullyEmpty = skillEntries.length === 0 && (trophies?.participated ?? 0) === 0 && history.length === 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header hideMenu />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
      >
        {/* Student identity */}
        <View style={styles.identityRow} accessible accessibilityLabel={`${profile?.name ?? "Student"}'s SkillBoard`}>
          <View style={styles.avatar} accessibilityElementsHidden>
            <Text style={styles.avatarInitial}>{(profile?.name ?? "S").charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{profile?.name ?? "Student"}</Text>
            {profile?.studentClass ? <Text style={styles.classLabel}>Class {profile.studentClass}</Text> : null}
          </View>
        </View>
        <Text style={styles.boardTitle}>🏆 SkillBoard</Text>

        {isFullyEmpty ? (
          <EmptyState
            emoji="🌱"
            title="Your SkillBoard is waiting for your first achievement."
            subtitle="Join a Skill Battle to earn your first achievement."
            actionLabel="Explore Skill Battles"
            onAction={() => router.push("/skillbattle")}
          />
        ) : (
          <>
            {/* Profile hero — primary skill, only if authoritative data exists */}
            {skillEntries.length > 0 && (
              <View style={styles.heroCard}>
                <Text style={styles.heroLabel}>PRIMARY SKILL</Text>
                <Text style={styles.heroSkill}>🎯 {skillEntries[0].skillName}</Text>
                {skillEntries[0].categoryName ? <Text style={styles.heroCategory}>{skillEntries[0].categoryName}</Text> : null}
                {vcoins !== null ? (
                  <View style={styles.vcoinsChip}>
                    <Text style={styles.vcoinsChipText}>🪙 {formatVCoins(vcoins)} VCoins</Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Skills */}
            {skillEntries.length > 0 && (
              <Section title="Skills">
                <View style={styles.skillsGrid}>
                  {skillEntries.map((s) => (
                    <View
                      key={s.skillId}
                      style={styles.skillCard}
                      accessible
                      accessibilityLabel={`${s.skillName}, ${s.totalPoints} skill points, ${s.battlesParticipated} battles`}
                    >
                      <Text style={styles.skillCardName} numberOfLines={1}>🎯 {s.skillName}</Text>
                      <Text style={styles.skillCardPoints}>{s.totalPoints.toLocaleString("en-IN")} Skill Points</Text>
                      <Text style={styles.skillCardMeta}>{s.battlesParticipated} battle{s.battlesParticipated === 1 ? "" : "s"}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            )}

            {/* Trophy Case */}
            <Section title="Trophy Case">
              {trophies && trophies.participated === 0 ? (
                <Text style={styles.muted}>No trophies yet — compete in a Skill Battle to earn your first one.</Text>
              ) : (
                <View style={styles.trophyGrid}>
                  {TROPHY_ORDER.map((ruleId) => (
                    <View
                      key={ruleId}
                      style={styles.trophyCard}
                      accessible
                      accessibilityLabel={`${ACHIEVEMENT_LABELS[ruleId]}: ${trophies?.[ruleId] ?? 0}`}
                    >
                      <Text style={styles.trophyCount}>{trophies?.[ruleId] ?? 0}</Text>
                      <Text style={styles.trophyLabel}>{ACHIEVEMENT_LABELS[ruleId]}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Section>

            {/* Battle History */}
            {history.length > 0 && (
              <Section title="Battle History">
                <View style={{ gap: 10 }}>
                  {history.map((h) => (
                    <Pressable
                      key={h.battleId}
                      onPress={() => router.push({ pathname: "/battle-results" as any, params: { battleId: h.battleId } })}
                      accessibilityRole="button"
                      accessibilityLabel={`View result: ${h.battleTitle}, rank ${h.rank}${h.isWinner ? ", winner" : ""}`}
                      style={({ pressed }) => [styles.historyCard, pressed && { opacity: 0.88 }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyTitle} numberOfLines={1}>{h.battleTitle}</Text>
                        {h.skillLabel ? <Text style={styles.historySkill} numberOfLines={1}>🎯 {h.skillLabel}</Text> : null}
                        <Text style={styles.historyDate}>{formatDate(h.earnedAtMillis)}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 2 }}>
                        <Text style={styles.historyRank}>#{h.rank}</Text>
                        {h.score !== null ? <Text style={styles.historyScore}>{h.score} pts</Text> : null}
                        {h.isWinner ? (
                          <View style={styles.winnerChip}><Text style={styles.winnerChipText}>🏆 Winner</Text></View>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.footer}>
                  {historyLoadingMore ? (
                    <ActivityIndicator color={ACCENT} />
                  ) : historyLoadMoreError ? (
                    <Pressable onPress={loadMoreHistory} accessibilityRole="button" accessibilityLabel="Retry loading more battle history" hitSlop={8} style={{ paddingVertical: 6 }}>
                      <Text style={styles.retryText}>Couldn&rsquo;t load more — Tap to retry</Text>
                    </Pressable>
                  ) : !historyDone ? (
                    <Pressable onPress={loadMoreHistory} accessibilityRole="button" accessibilityLabel="Load more battle history" style={styles.loadMoreBtn}>
                      <Text style={styles.loadMoreText}>Load More</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.endText}>That&rsquo;s your full battle history.</Text>
                  )}
                </View>
              </Section>
            )}

            {/* Next opportunity */}
            <Pressable
              onPress={() => router.push("/skillbattle")}
              accessibilityRole="button"
              accessibilityLabel="Explore Skill Battles"
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Explore Skill Battles</Text>
            </Pressable>
          </>
        )}

        <View style={{ height: 8 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function formatDate(millis: number): string {
  if (!millis) return "—";
  return new Date(millis).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 18, paddingBottom: 32 },

  identityRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,159,67,0.18)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: ACCENT },
  avatarInitial: { color: ACCENT, fontSize: 20, fontWeight: "900" },
  name: { color: "#fff", fontSize: 18, fontWeight: "900" },
  classLabel: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600" },
  boardTitle: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },

  heroCard: { backgroundColor: "rgba(255,159,67,0.08)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,159,67,0.3)", padding: 16, gap: 4 },
  heroLabel: { color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  heroSkill: { color: "#fff", fontSize: 20, fontWeight: "900" },
  heroCategory: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "600" },
  vcoinsChip: { alignSelf: "flex-start", marginTop: 8, backgroundColor: "rgba(255,209,102,0.14)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  vcoinsChipText: { color: "#ffd166", fontSize: 12, fontWeight: "800" },

  sectionTitle: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  muted: { color: "rgba(255,255,255,0.5)", fontSize: 12.5, fontWeight: "600" },

  skillsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  skillCard: { flexBasis: "47%", flexGrow: 1, backgroundColor: "rgba(255,255,255,0.035)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 12, gap: 3 },
  skillCardName: { color: "#fff", fontSize: 13, fontWeight: "800" },
  skillCardPoints: { color: ACCENT, fontSize: 12, fontWeight: "800" },
  skillCardMeta: { color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "600" },

  trophyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  trophyCard: { flexBasis: "47%", flexGrow: 1, backgroundColor: "rgba(255,255,255,0.035)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 14, alignItems: "center", gap: 4 },
  trophyCount: { color: "#fff", fontSize: 22, fontWeight: "900" },
  trophyLabel: { color: "rgba(255,255,255,0.6)", fontSize: 11.5, fontWeight: "700" },

  historyCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.035)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 12 },
  historyTitle: { color: "#fff", fontSize: 13.5, fontWeight: "800" },
  historySkill: { color: ACCENT, fontSize: 11, fontWeight: "700", marginTop: 2 },
  historyDate: { color: "rgba(255,255,255,0.4)", fontSize: 10.5, fontWeight: "600", marginTop: 2 },
  historyRank: { color: "#ffd166", fontSize: 15, fontWeight: "900" },
  historyScore: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700" },
  winnerChip: { backgroundColor: "rgba(6,214,160,0.15)", borderWidth: 1, borderColor: "rgba(6,214,160,0.4)", borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 },
  winnerChipText: { color: "#06d6a0", fontSize: 9.5, fontWeight: "800" },

  footer: { paddingVertical: 14, alignItems: "center" },
  loadMoreBtn: { backgroundColor: "rgba(255,159,67,0.12)", borderWidth: 1, borderColor: "rgba(255,159,67,0.4)", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  loadMoreText: { color: ACCENT, fontSize: 13, fontWeight: "800" },
  retryText: { color: "#ff6b9d", fontSize: 12.5, fontWeight: "700" },
  endText: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: "600" },

  primaryBtn: { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "900" },
});

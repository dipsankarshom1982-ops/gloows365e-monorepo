// PATH: app/battle-results.tsx
//
// Phase 2D-6 — Results + Winners + Rewards (canonical battles only).
// The "emotional payoff" screen: Competition → battle closes → ranking
// finalizes → RESULT_LOCKED → this screen → student sees their final
// rank, winner status (if authoritative), and VCoins award status.
//
// TRUST RULE (brief §4/§15, non-negotiable): this file never computes a
// score, rank, winner flag, or reward amount. Every number/flag here is
// either (a) the verbatim return value of getMyBattleRank /
// getBattleLeaderboardPage (functions/src/battleRanking.ts, reused as-is
// from Phase 2D-5's battleCompetitionApi.ts) or (b) a direct read of an
// authoritative, client-write-denied Firestore doc (battleAwards,
// achievementEvents — both `write: if false` in firestore.rules), or (c)
// the verbatim response of the claimBattleReward callable
// (functions/src/battleRewards.ts). See battleResultsApi.ts's header for
// exactly what was verified, not assumed, about that callable's
// idempotency before this screen was built to auto-invoke it.
//
// RESULT READINESS (brief §6): "final" is never inferred from a countdown
// reaching zero. It's read from the battle's own real lifecycle state
// (skillBattleDomain.ts's BATTLE_STATES) AND cross-checked against
// getMyBattleRank's own `final` flag (battleResults existence) before
// anything is presented as a locked result.

import Header from "@/components/header";
import EmptyState from "@/components/battle/EmptyState";
import { BattleDetailsSkeleton } from "@/components/battle/SkeletonBlock";
import Podium, { type PodiumEntry } from "@/components/battle/Podium";
import {
  fetchMyBattleRank, fetchLeaderboardPage, fetchSubmissionDisplay, type MyBattleRank,
} from "@/components/battle/battleCompetitionApi";
import {
  fetchMyAward, fetchMyAchievements, claimReward, ACHIEVEMENT_LABELS,
  type MyAward, type AchievementRuleId,
} from "@/components/battle/battleResultsApi";
import {
  buildBattleCardViewModel, classifyBattleEngine, type RawBattle,
} from "@/components/battle/resolveBattleExperience";
import type { BattleCardViewModel } from "@/components/battle/types";
import { useTheme } from "@/context/ThemeContext";
import { auth, db } from "@/lib/firebase";
import { getActiveSkillCategories, getActiveSkills } from "@/services/skillTaxonomyService";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ACCENT = "#ff9f43";

// The 4 post-lock lifecycle states this screen treats as "results exist
// to show" — never invented, straight from skillBattleDomain.ts's
// BATTLE_STATES graph.
const RESULT_STATES = new Set(["RESULT_LOCKED", "WINNERS_ANNOUNCED", "AWARDS_PROCESSING", "COMPLETED"]);

const RESULT_STATE_BADGE: Record<string, { label: string; bg: string }> = {
  RESULT_LOCKED: { label: "🔒 Results Locked", bg: "#6b7280" },
  WINNERS_ANNOUNCED: { label: "📢 Winners Announced", bg: "#8b5cf6" },
  AWARDS_PROCESSING: { label: "⏳ Awards Processing", bg: "#f59e0b" },
  COMPLETED: { label: "✅ Completed", bg: "#06d6a0" },
};

type ScreenPhase = "loading" | "not_ready" | "cancelled" | "ready" | "error" | "unavailable";

export default function BattleResultsScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ battleId?: string }>();
  const battleId = params.battleId;

  const [phase, setPhase] = useState<ScreenPhase>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [card, setCard] = useState<BattleCardViewModel | null>(null);
  const [battleState, setBattleState] = useState<string | undefined>(undefined);
  const [reduceMotion, setReduceMotion] = useState(false);

  const [myRank, setMyRank] = useState<MyBattleRank | null>(null);
  const [myRankLoading, setMyRankLoading] = useState(true);
  const [myRankError, setMyRankError] = useState(false);

  const [top3, setTop3] = useState<PodiumEntry[]>([]);
  const [top3Loading, setTop3Loading] = useState(true);

  const [achievements, setAchievements] = useState<AchievementRuleId[]>([]);

  const [award, setAward] = useState<MyAward | null>(null);
  const [awardLoading, setAwardLoading] = useState(false);
  const [awardError, setAwardError] = useState(false);
  const claimAttemptedRef = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduceMotion).catch(() => {});
  }, []);

  // ── Load battle + classify engine + result readiness ──────────────────
  const loadBattle = useCallback(async () => {
    if (!battleId) { setErrorMsg("Missing battle."); setPhase("error"); return; }
    setPhase("loading"); setErrorMsg("");
    try {
      const [battleSnap, skillList, categoryList] = await Promise.all([
        getDoc(doc(db, "skillBattles", battleId)),
        getActiveSkills(),
        getActiveSkillCategories(),
      ]);
      if (!battleSnap.exists()) { setErrorMsg("This battle is currently unavailable."); setPhase("error"); return; }

      const raw = { id: battleSnap.id, ...battleSnap.data() } as RawBattle;
      const engine = classifyBattleEngine(raw);
      if (engine !== "canonical") { setPhase("unavailable"); return; }

      const vm = buildBattleCardViewModel(raw, { skills: skillList, categories: categoryList });
      setCard(vm);
      setBattleState(raw.state);

      if (raw.state === "CANCELLED") { setPhase("cancelled"); return; }
      if (!raw.state || !RESULT_STATES.has(raw.state)) { setPhase("not_ready"); return; }

      setPhase("ready");
    } catch {
      setErrorMsg("Couldn't load this battle. Try again.");
      setPhase("error");
    }
  }, [battleId]);

  // ── My authoritative final result ──────────────────────────────────────
  const loadRank = useCallback(async () => {
    if (!battleId) return;
    setMyRankLoading(true); setMyRankError(false);
    try {
      setMyRank(await fetchMyBattleRank(battleId));
    } catch {
      setMyRankError(true);
    } finally {
      setMyRankLoading(false);
    }
  }, [battleId]);

  // ── Top 3 winners (public, authoritative — same API Phase 2D-5 uses) ──
  const loadTop3 = useCallback(async () => {
    if (!battleId) return;
    setTop3Loading(true);
    try {
      const page = await fetchLeaderboardPage(battleId, null, 20);
      if (page.final) {
        const winners = page.entries.filter(
          (e): e is typeof e & { rank: number } => typeof e.rank === "number" && e.rank <= 3
        );
        // Bounded to at most 3 extra reads — same display-metadata pattern
        // Phase 2D-5 uses for the full feed, just applied to the podium's
        // 3 entries here.
        const enriched = await Promise.all(winners.map(async (w) => {
          const display = await fetchSubmissionDisplay(w.submissionId);
          return { submissionId: w.submissionId, studentName: display?.studentName ?? "Student", score: w.score, rank: w.rank };
        }));
        setTop3(enriched);
      }
    } catch {
      // Non-critical for this screen's core promise (the student's own
      // result) — fail silently here; the personal result hero has its
      // own retry, and the podium simply doesn't render without data.
    } finally {
      setTop3Loading(false);
    }
  }, [battleId]);

  // ── Award status + the one-and-only necessary claim integration ───────
  // (brief §13: claiming IS necessary here — claimBattleReward is the
  // ONLY path that ever credits canonical-engine VCoins; nothing does it
  // automatically. See battleResultsApi.ts's header for the idempotency
  // verification this relies on.)
  const loadAward = useCallback(async () => {
    if (!battleId || !auth.currentUser) return;
    setAwardLoading(true); setAwardError(false);
    try {
      const uid = auth.currentUser.uid;
      let existing = await fetchMyAward(battleId, uid);
      if (!existing && !claimAttemptedRef.current) {
        claimAttemptedRef.current = true;
        await claimReward(battleId);
        // Re-read the persisted doc rather than trusting the callable's
        // own response shape for a definitive display value — see this
        // file's header / battleResultsApi.ts for why.
        existing = await fetchMyAward(battleId, uid);
      }
      setAward(existing);
    } catch {
      setAwardError(true);
    } finally {
      setAwardLoading(false);
    }
  }, [battleId]);

  useEffect(() => { loadBattle(); }, [loadBattle]);

  useEffect(() => {
    if (phase !== "ready") return;
    loadRank();
    loadTop3();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Once we know the student actually has a ranked entry, fetch their
  // achievements and award status — both battle-scoped, both bounded.
  useEffect(() => {
    if (phase !== "ready" || !battleId || !auth.currentUser) return;
    if (!myRank || myRank.rank === 0) return;
    fetchMyAchievements(battleId, auth.currentUser.uid).then(setAchievements).catch(() => {});
    loadAward();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, myRank?.rank]);

  useFocusEffect(useCallback(() => {
    if (phase === "ready") { loadRank(); loadTop3(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]));

  // ── Render ───────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header hideMenu />
        <BattleDetailsSkeleton />
      </SafeAreaView>
    );
  }

  if (phase === "unavailable") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header hideMenu />
        <EmptyState emoji="🏗️" title="Results view isn't available for this battle" actionLabel="Go Back" onAction={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (phase === "error" || !card) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header hideMenu />
        <EmptyState emoji="⚠️" title={errorMsg || "Something went wrong."} actionLabel="Retry" onAction={loadBattle} />
      </SafeAreaView>
    );
  }

  if (phase === "cancelled") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header hideMenu />
        <EmptyState emoji="🚫" title="This battle was cancelled" subtitle="No results were finalized for this battle." actionLabel="Explore More Skill Battles" onAction={() => router.push("/skillbattle")} />
      </SafeAreaView>
    );
  }

  if (phase === "not_ready") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header hideMenu />
        <EmptyState
          emoji="⏳"
          title="Results are being finalized"
          subtitle="Check back once the competition has closed and ranking is complete."
          actionLabel="View Live Competition"
          onAction={() => router.push({ pathname: "/battle-competition" as any, params: { battleId } })}
        />
      </SafeAreaView>
    );
  }

  // phase === "ready"
  const badge = battleState ? RESULT_STATE_BADGE[battleState] : undefined;
  const finalConfirmed = myRank?.final === true;
  const participated = finalConfirmed && !!myRank && myRank.rank > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header hideMenu />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.headerCard}>
          {card.skill ? <Text style={styles.skillLabel}>🎯 {card.skill.name}</Text> : null}
          <Text style={styles.title} numberOfLines={2}>{card.title}</Text>
          <View style={styles.badgeRow}>
            {badge ? (
              <View style={[styles.pill, { backgroundColor: badge.bg }]}>
                <Text style={styles.pillText}>{badge.label}</Text>
              </View>
            ) : null}
            <View style={[styles.pill, { backgroundColor: "#4b5563" }]}>
              <Text style={styles.pillText}>🏁 FINAL</Text>
            </View>
          </View>
        </View>

        {/* Result hero */}
        {myRankLoading ? (
          <View style={styles.card}><Text style={styles.muted}>Loading your result…</Text></View>
        ) : myRankError ? (
          <Pressable onPress={loadRank} accessibilityRole="button" accessibilityLabel="Retry loading your result" style={styles.card}>
            <Text style={styles.retryText}>Couldn&rsquo;t load your result — Tap to retry</Text>
          </Pressable>
        ) : !finalConfirmed ? (
          <View style={styles.card}>
            <Text style={styles.muted}>Results are still being finalized. Check back shortly.</Text>
          </View>
        ) : !participated ? (
          <View style={styles.card}>
            <Text style={styles.muted}>You didn&rsquo;t participate in this battle.</Text>
          </View>
        ) : myRank!.isWinner ? (
          <WinnerHero myRank={myRank!} battleTitle={card.title} reduceMotion={reduceMotion} />
        ) : (
          <ParticipantHero myRank={myRank!} />
        )}

        {/* Achievements (small indicator only — not the SkillBoard, brief §24) */}
        {participated && achievements.length > 0 && (
          <View style={styles.achievementRow}>
            {achievements.map((a) => (
              <View key={a} style={styles.achievementChip}>
                <Text style={styles.achievementChipText}>{ACHIEVEMENT_LABELS[a]}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Reward / award status */}
        {participated && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Reward</Text>
            {awardLoading ? (
              <View style={styles.rewardRow}>
                <ActivityIndicator size="small" color={ACCENT} />
                <Text style={styles.muted}>Processing your reward…</Text>
              </View>
            ) : awardError ? (
              <Pressable onPress={loadAward} accessibilityRole="button" accessibilityLabel="Retry checking your reward">
                <Text style={styles.retryText}>Couldn&rsquo;t check your reward — Tap to retry</Text>
              </Pressable>
            ) : award && award.status === "credited" && (award.totalCredited ?? 0) > 0 ? (
              <Text style={styles.rewardAwarded}>🪙 +{award.totalCredited} VCoins awarded</Text>
            ) : award && award.status === "credited" ? (
              <Text style={styles.muted}>No VCoins reward for this rank.</Text>
            ) : (
              <Text style={styles.muted}>Your reward is being processed.</Text>
            )}
          </View>
        )}

        {/* Winners podium — authoritative rank only, never derived from position */}
        {!top3Loading && top3.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🏆 Winners</Text>
            <Podium entries={top3} />
          </View>
        )}

        {/* Next actions */}
        <View style={{ gap: 10, marginTop: 4 }}>
          <Pressable
            onPress={() => router.push({ pathname: "/battle-competition" as any, params: { battleId } })}
            accessibilityRole="button"
            accessibilityLabel="View final leaderboard"
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>View Final Leaderboard</Text>
          </Pressable>
          {participated && (
            <Pressable
              onPress={() => router.push("/my-skillboard" as any)}
              accessibilityRole="button"
              accessibilityLabel="View my SkillBoard"
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>View My SkillBoard</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push("/skillbattle")}
            accessibilityRole="button"
            accessibilityLabel="Explore more skill battles"
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>Explore More Skill Battles</Text>
          </Pressable>
        </View>

        <View style={{ height: 8 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components (presentation only) ─────────────────────────────────

function WinnerHero({ myRank, battleTitle, reduceMotion }: { myRank: MyBattleRank; battleTitle: string; reduceMotion: boolean }) {
  return (
    <View
      style={[styles.card, styles.winnerCard]}
      accessible
      accessibilityLabel={`You won! Final rank ${myRank.rank}, score ${myRank.score}, in ${battleTitle}`}
    >
      <Text style={styles.trophy}>🏆</Text>
      <Text style={styles.winnerTitle}>YOU WON!</Text>
      <Text style={styles.winnerBattle} numberOfLines={1}>{battleTitle}</Text>
      <View style={styles.winnerStatsRow}>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.winnerRank}>#{myRank.rank}</Text>
          <Text style={styles.winnerStatLabel}>FINAL RANK</Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.winnerScore}>{myRank.score}</Text>
          <Text style={styles.winnerStatLabel}>FINAL SCORE</Text>
        </View>
      </View>
      {/* No confetti/flashing per brief §22 — a still trophy + bold text is
          the entire "celebration," respecting reduced-motion by default
          (nothing here animates regardless of the setting). */}
      {reduceMotion ? null : null}
    </View>
  );
}

function ParticipantHero({ myRank }: { myRank: MyBattleRank }) {
  return (
    <View style={styles.card} accessible accessibilityLabel={`Your final rank was ${myRank.rank}, score ${myRank.score}`}>
      <Text style={styles.participantMsg}>Great performance!</Text>
      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.summaryLabel}>FINAL RANK</Text>
          <Text style={styles.summaryRank}>#{myRank.rank}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.summaryLabel}>FINAL SCORE</Text>
          <Text style={styles.summaryScore}>{myRank.score}</Text>
        </View>
      </View>
      {myRank.rank <= 10 ? (
        <View style={styles.topChip}><Text style={styles.topChipText}>Top 10 Finish</Text></View>
      ) : null}
      <Text style={styles.encourage}>Keep competing — your next Skill Battle is waiting.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 14, paddingBottom: 32 },

  headerCard: { gap: 6 },
  skillLabel: { color: "#ffd166", fontSize: 12, fontWeight: "800" },
  title: { color: "#fff", fontSize: 22, fontWeight: "900" },
  badgeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 2 },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  pillText: { color: "#fff", fontSize: 10, fontWeight: "900" },

  card: { backgroundColor: "rgba(255,255,255,0.035)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 16, gap: 8 },
  cardTitle: { fontSize: 13, fontWeight: "900", color: "rgba(255,255,255,0.85)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  muted: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600", textAlign: "center" },
  retryText: { color: "#ff6b9d", fontSize: 12.5, fontWeight: "700", textAlign: "center" },

  winnerCard: { alignItems: "center", borderColor: "rgba(255,209,102,0.45)", backgroundColor: "rgba(255,209,102,0.06)", paddingVertical: 24 },
  trophy: { fontSize: 48 },
  winnerTitle: { color: "#ffd166", fontSize: 24, fontWeight: "900", letterSpacing: 1, marginTop: 4 },
  winnerBattle: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "700", marginTop: 2 },
  winnerStatsRow: { flexDirection: "row", gap: 32, marginTop: 16 },
  winnerRank: { color: "#fff", fontSize: 32, fontWeight: "900" },
  winnerScore: { color: ACCENT, fontSize: 26, fontWeight: "900" },
  winnerStatLabel: { color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: "800", letterSpacing: 0.5, marginTop: 2 },

  participantMsg: { color: "#fff", fontSize: 16, fontWeight: "900", textAlign: "center" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  summaryLabel: { color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  summaryRank: { color: "#fff", fontSize: 26, fontWeight: "900" },
  summaryScore: { color: ACCENT, fontSize: 20, fontWeight: "900" },
  topChip: { alignSelf: "center", borderWidth: 1, borderColor: "rgba(255,159,67,0.4)", backgroundColor: "rgba(255,159,67,0.12)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  topChipText: { color: ACCENT, fontSize: 11, fontWeight: "800" },
  encourage: { color: "rgba(255,255,255,0.5)", fontSize: 12, textAlign: "center", fontStyle: "italic" },

  achievementRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  achievementChip: { borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  achievementChipText: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "700" },

  rewardRow: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" },
  rewardAwarded: { color: "#06d6a0", fontSize: 16, fontWeight: "900", textAlign: "center" },

  primaryBtn: { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  secondaryBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  secondaryBtnText: { color: "rgba(255,255,255,0.8)", fontSize: 13.5, fontWeight: "800" },
});

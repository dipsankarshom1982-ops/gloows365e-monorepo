// PATH: app/battle-competition.tsx
//
// Phase 2D-5 — Competition + Live/Final Leaderboard (canonical battles
// only — see this file's header note on legacy). Reachable from
// battle-details.tsx's CTA when a student's canonical submission is
// APPROVED_COMPETING, or once the battle's results are locked
// (VIEW_RESULTS). This screen covers BOTH the live, provisional
// competition and the final, locked leaderboard — it tells them apart
// using the `final` flag Phase 2C's own APIs already return (battleResults
// exists or not), never a locally-guessed state.
//
// SCOPE (Phase 2D-5 brief §4/§26): Competition feed + leaderboard +
// engagement only. NOT built here: Results/Winner-celebration screen,
// prize claiming, SkillBoard, Trophy Case, notifications. The podium below
// is a leaderboard visual, not a winner-announcement moment.
//
// SECURITY POSTURE (brief §8/§14/§15): every score/rank/order value
// rendered on this screen comes verbatim from getMyBattleRank /
// getBattleLeaderboardPage (functions/src/battleRanking.ts) or from a
// direct read of an authoritative, client-write-denied Firestore doc
// (submissions/{id}, submissions/{id}/engagements/{id}). Nothing here
// computes a rank, a score, a tie-break, or a "places away" estimate —
// see battleCompetitionApi.ts's header for exactly what each real API
// does and does not return, and why LIVE entries never get a numeric rank
// badge (only FINAL entries carry a server-computed `rank`).

import Header from "@/components/header";
import EmptyState from "@/components/battle/EmptyState";
import BattleStatusBadge from "@/components/battle/BattleStatusBadge";
import Countdown from "@/components/battle/Countdown";
import { BattleCardSkeleton, BattleDetailsSkeleton } from "@/components/battle/SkeletonBlock";
import CompetitionCard, { type CompetitionCardData } from "@/components/battle/CompetitionCard";
import SharedPodium from "@/components/battle/Podium";
import {
  fetchMyBattleRank, fetchLeaderboardPage, fetchSubmissionDisplay, fetchMyLikeState,
  likeSubmission, type MyBattleRank,
} from "@/components/battle/battleCompetitionApi";
import {
  buildBattleCardViewModel, classifyBattleEngine, resolveSkillViewModel, type RawBattle,
} from "@/components/battle/resolveBattleExperience";
import type { BattleCardViewModel } from "@/components/battle/types";
import { useTheme } from "@/context/ThemeContext";
import { auth, db } from "@/lib/firebase";
import { getActiveSkillCategories, getActiveSkills, type Skill, type SkillCategory } from "@/services/skillTaxonomyService";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ACCENT = "#ff9f43";
const PAGE_SIZE = 20;
const MAX_REFRESH_PAGE_SIZE = 50; // matches getBattleLeaderboardPage's own server-enforced cap

type ScreenPhase = "loading" | "ready" | "error" | "unavailable";

export default function BattleCompetitionScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ battleId?: string }>();
  const battleId = params.battleId;

  const [phase, setPhase] = useState<ScreenPhase>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [card, setCard] = useState<BattleCardViewModel | null>(null);
  const [battleState, setBattleState] = useState<string | undefined>(undefined);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);

  const [myRank, setMyRank] = useState<MyBattleRank | null>(null);
  const [myRankLoading, setMyRankLoading] = useState(true);
  const [myRankError, setMyRankError] = useState(false);

  const [entries, setEntries] = useState<CompetitionCardData[]>([]);
  const [final, setFinal] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [likingId, setLikingId] = useState<string | null>(null);
  // Phase 2D-8 polish — at most one card's video plays at a time across
  // the whole feed (brief §29); owned here, not per-card, so opening a
  // new one always stops the previous one.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadedCountRef = useRef(0);
  const engagementOpenRef = useRef(false);

  // ── Load battle + classify engine (§3/§5 — reuse the one existing
  // engine-detection mechanism, never a second one) ──────────────────────
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
      setSkills(skillList);
      setCategories(categoryList);

      // Legacy battles keep their existing experience untouched — this
      // screen only exists for the Phase 2C canonical engine (brief §5,
      // §24). Reachable defensively (e.g. a stale link) without crashing.
      if (engine !== "canonical") { setPhase("unavailable"); return; }

      const vm = buildBattleCardViewModel(raw, { skills: skillList, categories: categoryList });
      setCard(vm);
      setBattleState(raw.state);
      engagementOpenRef.current = raw.state === "OPEN";
      setPhase("ready");
    } catch {
      setErrorMsg("Couldn't load this battle. Try again.");
      setPhase("error");
    }
  }, [battleId]);

  // ── My authoritative rank (never blocks the feed) ──────────────────────
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

  // ── Leaderboard feed (battle-scoped, paginated — §7/§9) ────────────────
  const loadFeed = useCallback(async (reset: boolean, pageSize = PAGE_SIZE) => {
    if (!battleId) return;
    if (reset) { setFeedLoading(true); setFeedError(false); }
    else { setLoadingMore(true); setLoadMoreError(false); }
    try {
      const cursor = reset ? null : nextCursor;
      const page = await fetchLeaderboardPage(battleId, cursor, pageSize);
      setFinal(page.final);

      const uid = auth.currentUser?.uid;
      const enriched = await Promise.all(page.entries.map(async (e): Promise<CompetitionCardData> => {
        const [display, liked] = await Promise.all([
          fetchSubmissionDisplay(e.submissionId),
          uid ? fetchMyLikeState(e.submissionId, uid) : Promise.resolve(false),
        ]);
        const skillVm = display?.skillId ? resolveSkillViewModel(display.skillId, skills, categories) : undefined;
        return {
          submissionId: e.submissionId,
          studentName: display?.studentName ?? "Student",
          studentClass: display?.studentClass ?? "",
          skillLabel: skillVm?.name,
          title: display?.title ?? "",
          mediaRef: display?.mediaRef ?? "",
          score: e.score,
          rank: e.rank,
          isWinner: e.isWinner,
          rawEngagement: e.rawEngagement,
          isMine: !!uid && e.studentId === uid,
          liked,
          engagementOpen: engagementOpenRef.current,
        };
      }));

      loadedCountRef.current = reset ? enriched.length : loadedCountRef.current + enriched.length;
      setEntries((prev) => (reset ? enriched : [...prev, ...enriched]));
      setNextCursor(page.nextCursor);
    } catch {
      if (reset) setFeedError(true); else setLoadMoreError(true);
    } finally {
      if (reset) setFeedLoading(false); else setLoadingMore(false);
    }
  }, [battleId, nextCursor, skills, categories]);

  useEffect(() => { loadBattle(); }, [loadBattle]);

  // Refresh on screen focus (brief §16 — allowed, bounded refresh trigger;
  // no timers, no polling loop). Phase 2D-8 polish: this is now the ONLY
  // trigger for loadRank/loadFeed — a separate plain useEffect([phase])
  // used to fire the identical call a second time, because useFocusEffect
  // already re-runs whenever its memoized callback changes (which
  // includes `phase` flipping to "ready") while the screen is focused,
  // covering both "just became ready" and "returned to this screen" on
  // its own.
  useFocusEffect(useCallback(() => {
    if (phase === "ready") { loadRank(); loadFeed(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]));

  const onPullToRefresh = () => {
    setRefreshing(true);
    Promise.all([loadRank(), loadFeed(true)]).finally(() => setRefreshing(false));
  };

  // ── Engagement (§13/§16 — refresh after engagement is explicitly
  // allowed; nothing else here polls) ─────────────────────────────────────
  const onLike = async (submissionId: string) => {
    if (!auth.currentUser) { Alert.alert("Sign in required", "Please sign in to like a submission."); return; }
    setLikingId(submissionId);
    try {
      await likeSubmission(submissionId);
      setEntries((prev) => prev.map((e) => (e.submissionId === submissionId ? { ...e, liked: true } : e)));
      // Bounded refresh of exactly what's already loaded (never more than
      // the API's own 50-per-call cap) — the liked submission's score may
      // have just changed server-side; re-fetch from the authoritative
      // source rather than guessing a new value locally.
      const refreshSize = Math.min(Math.max(loadedCountRef.current, PAGE_SIZE), MAX_REFRESH_PAGE_SIZE);
      await loadFeed(true, refreshSize);
    } catch (err: any) {
      Alert.alert("Couldn't like this submission", mapEngagementError(err));
    } finally {
      setLikingId(null);
    }
  };

  const onLoadMore = () => { if (nextCursor && !loadingMore) loadFeed(false); };

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
        <EmptyState emoji="🏗️" title="Competition view isn't available for this battle" actionLabel="Go Back" onAction={() => router.back()} />
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

  const top3 = final
    ? entries
        .filter((e): e is CompetitionCardData & { rank: number } => typeof e.rank === "number" && e.rank <= 3)
        .map((e) => ({ submissionId: e.submissionId, studentName: e.studentName, score: e.score, rank: e.rank }))
    : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header hideMenu />
      <FlatList
        data={entries}
        keyExtractor={(item) => item.submissionId}
        renderItem={({ item }) => (
          <CompetitionCard
            data={item}
            onLike={onLike}
            liking={likingId === item.submissionId}
            expanded={expandedId === item.submissionId}
            onExpand={() => setExpandedId(item.submissionId)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullToRefresh} tintColor={ACCENT} />}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 16 }}>
            <Hero card={card} battleState={battleState} final={final} />
            <SummaryCard myRank={myRank} loading={myRankLoading} error={myRankError} onRetry={loadRank} />
            {final && myRank && myRank.rank > 0 && (
              <Pressable
                onPress={() => router.push({ pathname: "/battle-results" as any, params: { battleId } })}
                accessibilityRole="button"
                accessibilityLabel="View your final result"
                style={styles.resultsBanner}
              >
                <Text style={styles.resultsBannerText}>🏁 Results are final — View Your Result</Text>
              </Pressable>
            )}
            {top3.length > 0 && <SharedPodium entries={top3} />}
            <Text style={styles.feedTitle}>{final ? "🏁 Final Leaderboard" : "🎬 Competition"}</Text>
          </View>
        }
        ListEmptyComponent={
          feedLoading ? (
            <View style={{ gap: 12 }}><BattleCardSkeleton /><BattleCardSkeleton /></View>
          ) : feedError ? (
            <EmptyState emoji="⚠️" title="Couldn't load the competition" actionLabel="Retry" onAction={() => loadFeed(true)} />
          ) : (
            <EmptyState emoji="🎬" title="No competitors yet" subtitle="Be the first approved submission to appear here." />
          )
        }
        ListFooterComponent={
          entries.length === 0 ? null : (
            <View style={styles.footer}>
              {loadingMore ? (
                <ActivityIndicator color={ACCENT} />
              ) : loadMoreError ? (
                <Pressable onPress={onLoadMore} accessibilityRole="button" accessibilityLabel="Retry loading more competitors" style={styles.retryRow}>
                  <Text style={styles.retryText}>Couldn&rsquo;t load more — Tap to retry</Text>
                </Pressable>
              ) : nextCursor ? (
                <Pressable onPress={onLoadMore} accessibilityRole="button" accessibilityLabel="Load more competitors" style={styles.loadMoreBtn}>
                  <Text style={styles.loadMoreText}>Load More</Text>
                </Pressable>
              ) : (
                <Text style={styles.endText}>You&rsquo;ve reached the end of the leaderboard.</Text>
              )}
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function mapEngagementError(err: any): string {
  const code = err?.code || err?.details?.code || "";
  const msg = err?.message || "";
  if (/permission-denied/.test(code) || /own submission/i.test(msg)) return "You can't like your own submission.";
  if (/failed-precondition/.test(code) || /not currently live|not accepting engagement/i.test(msg)) return "This submission isn't open for engagement right now.";
  if (/not-found/.test(code)) return "This submission is no longer available.";
  return "Please try again.";
}

// ── Sub-components (presentation only) ────────────────────────────────

function Hero({ card, battleState, final }: { card: BattleCardViewModel; battleState?: string; final: boolean }) {
  return (
    <View style={styles.hero}>
      {card.skill ? <Text style={styles.skillLabel}>🎯 {card.skill.name}</Text> : null}
      <Text style={styles.heroTitle} numberOfLines={2}>{card.title}</Text>
      <View style={styles.heroBadges}>
        <BattleStatusBadge status={card.status} />
        <View style={[styles.liveFinalPill, { backgroundColor: final ? "#4b5563" : "#ef4444" }]}>
          <Text style={styles.liveFinalText}>{final ? "🏁 FINAL" : "🔴 LIVE"}</Text>
        </View>
      </View>
      {!final && battleState === "OPEN" && (
        <View style={styles.heroTimer}>
          <Ionicons name="time-outline" size={13} color="#ffd166" />
          <Countdown deadline={card.deadline} />
        </View>
      )}
      {!final && (
        <Text style={styles.liveNote}>Ranking is live and may change as engagement comes in.</Text>
      )}
    </View>
  );
}

function SummaryCard({
  myRank, loading, error, onRetry,
}: { myRank: MyBattleRank | null; loading: boolean; error: boolean; onRetry: () => void }) {
  return (
    <View style={styles.card}>
      {loading ? (
        <Text style={styles.muted}>Loading your rank…</Text>
      ) : error ? (
        <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry loading your rank">
          <Text style={styles.retryText}>Couldn&rsquo;t load your rank — Tap to retry</Text>
        </Pressable>
      ) : !myRank || myRank.rank === 0 ? (
        <Text style={styles.muted}>You haven&rsquo;t entered the competition yet.</Text>
      ) : (
        <View style={{ gap: 6 }}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>YOUR RANK</Text>
              <Text style={styles.summaryRank}>#{myRank.rank}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.summaryLabel}>YOUR SCORE</Text>
              <Text style={styles.summaryScore}>{myRank.score}</Text>
            </View>
          </View>
          <View style={styles.summaryChipsRow}>
            {myRank.rank <= 10 ? (
              <View style={styles.summaryChip}><Text style={styles.summaryChipText}>Top 10</Text></View>
            ) : null}
            {myRank.isWinner ? (
              <View style={[styles.summaryChip, { borderColor: "rgba(6,214,160,0.4)", backgroundColor: "rgba(6,214,160,0.12)" }]}>
                <Text style={[styles.summaryChipText, { color: "#06d6a0" }]}>🏆 Winner</Text>
              </View>
            ) : null}
            <Text style={styles.summaryTotal}>{myRank.totalParticipants} competitor{myRank.totalParticipants === 1 ? "" : "s"}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 40 },

  hero: { borderRadius: 18, padding: 16, gap: 8, backgroundColor: "rgba(255,255,255,0.035)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  skillLabel: { color: "#ffd166", fontSize: 12, fontWeight: "800" },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
  heroBadges: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  liveFinalPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  liveFinalText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  heroTimer: { flexDirection: "row", alignItems: "center", gap: 5 },
  liveNote: { color: "rgba(255,255,255,0.45)", fontSize: 11, fontStyle: "italic" },

  resultsBanner: { backgroundColor: "rgba(255,159,67,0.12)", borderWidth: 1, borderColor: "rgba(255,159,67,0.4)", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center" },
  resultsBannerText: { color: ACCENT, fontSize: 12.5, fontWeight: "800" },

  card: { backgroundColor: "rgba(255,255,255,0.035)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 14 },
  muted: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600", textAlign: "center" },
  retryText: { color: "#ff6b9d", fontSize: 12.5, fontWeight: "700", textAlign: "center" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  summaryLabel: { color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  summaryRank: { color: "#fff", fontSize: 26, fontWeight: "900" },
  summaryScore: { color: ACCENT, fontSize: 20, fontWeight: "900" },
  summaryChipsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  summaryChip: { borderWidth: 1, borderColor: "rgba(255,159,67,0.4)", backgroundColor: "rgba(255,159,67,0.12)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  summaryChipText: { color: ACCENT, fontSize: 10.5, fontWeight: "800" },
  summaryTotal: { color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "700", marginLeft: "auto" },

  podiumRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 10 },
  podiumItem: { alignItems: "center", flex: 1 },
  podiumAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,159,67,0.18)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: ACCENT },
  podiumAvatarLarge: { width: 54, height: 54, borderRadius: 27 },
  podiumInitial: { color: ACCENT, fontSize: 17, fontWeight: "900" },
  podiumMedal: { fontSize: 14, marginTop: 2 },
  podiumName: { color: "#fff", fontSize: 11, fontWeight: "800", marginTop: 2, maxWidth: 80 },
  podiumScore: { color: "#ffd166", fontSize: 11, fontWeight: "800" },

  feedTitle: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },

  footer: { paddingVertical: 18, alignItems: "center" },
  loadMoreBtn: { backgroundColor: "rgba(255,159,67,0.12)", borderWidth: 1, borderColor: "rgba(255,159,67,0.4)", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  loadMoreText: { color: ACCENT, fontSize: 13, fontWeight: "800" },
  retryRow: { paddingVertical: 8 },
  endText: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: "600" },
});

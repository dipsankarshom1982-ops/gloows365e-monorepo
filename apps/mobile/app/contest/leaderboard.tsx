// PATH: apps/mobile/app/contest/leaderboard.tsx
//
// VidyaStar Phase 2 — rewritten to use a bounded, ordered, paginated
// Firestore query (lib/contestLeaderboard.ts) instead of reading every
// participant and sorting client-side by a batch-rewritten `rank` field.
// See that file and functions/src/contestLeaderboard.ts for the full
// architecture.
//
// UX change this necessitates: the old screen force-pinned "You" to the
// very first row of page 1 regardless of actual rank — with real cursor
// pagination that's no longer possible (it would either duplicate a real
// entry or desync the "Load More" cursor). Instead, "Your Position" is now
// a dedicated, always-visible card above the list; the list itself shows
// the real, unmodified page-by-page order, and highlights your own row
// wherever it naturally falls once you've loaded that far.

import { auth, db } from "@/lib/firebase";
import {
  fetchFinalizedLeaderboardPage,
  fetchLeaderboardPage,
  fetchMyLiveRank,
  LEADERBOARD_PAGE_SIZE,
  type LeaderboardRow,
} from "@/lib/contestLeaderboard";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, QueryDocumentSnapshot } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function parseDate(t: any): Date | null {
  if (!t) return null;
  if (typeof t.toDate === "function") return t.toDate();
  if (t.seconds) return new Date(t.seconds * 1000);
  if (typeof t === "string" && t.length > 0) return new Date(t);
  return null;
}

const MEDAL = ["🥇", "🥈", "🥉"];

// "Not ranked" is never shown just because a student is outside the
// currently-loaded page — MyPosition is resolved via its own dedicated
// lookup (finalRank / legacy rank / a live count-aggregation estimate),
// entirely independent of which page happens to be loaded.
type MyPositionState =
  | { kind: "not_participated" }
  | { kind: "pending" } // joined, hasn't completed the quiz yet
  | { kind: "ranked"; rank: number; isFinal: boolean; score: number };

export default function ContestLeaderboardScreen() {
  const { contestId } = useLocalSearchParams<{ contestId: string }>();
  const router = useRouter();
  const userId = auth.currentUser?.uid;

  const [contest, setContest]         = useState<any>(null);
  const [rows, setRows]               = useState<LeaderboardRow[]>([]);
  const [cursor, setCursor]           = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore]         = useState(false);
  const [isEnded, setIsEnded]         = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const [myPosition, setMyPosition]   = useState<MyPositionState>({ kind: "pending" });
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);

  const load = useCallback(async () => {
    if (!contestId) return;

    const [contestSnap, mySnap] = await Promise.all([
      getDoc(doc(db, "contests", contestId as string)),
      userId ? getDoc(doc(db, "contests", contestId as string, "participant", userId)) : Promise.resolve(null),
    ]);

    let finalized = false;
    if (contestSnap.exists()) {
      const data = { id: contestSnap.id, ...contestSnap.data() } as any;
      setContest(data);
      const end = parseDate(data.endTime ?? data.endDate);
      setIsEnded(!!(end && end < new Date()));
      finalized = data.leaderboardFinalized === true;
      setIsFinalized(finalized);
    }

    const page = finalized
      ? await fetchFinalizedLeaderboardPage(contestId as string)
      : await fetchLeaderboardPage(contestId as string);
    setRows(page.rows);
    setCursor(page.cursor);
    setHasMore(page.hasMore);

    // ── Resolve "Your Position" independently of the loaded page ──
    if (!mySnap || !mySnap.exists()) {
      setMyPosition({ kind: "not_participated" });
    } else {
      const my = mySnap.data();
      if (!my.completed) {
        setMyPosition({ kind: "pending" });
      } else if (typeof my.finalRank === "number") {
        setMyPosition({ kind: "ranked", rank: my.finalRank, isFinal: true, score: my.score ?? 0 });
      } else if (typeof my.rank === "number") {
        // Legacy (pre-Phase-2) contest that already has a stored rank and
        // hasn't gone through the new finalization process — show it as-is,
        // never recalculated automatically.
        setMyPosition({ kind: "ranked", rank: my.rank, isFinal: !!finalized, score: my.score ?? 0 });
      } else {
        try {
          const liveRank = await fetchMyLiveRank(contestId as string, my.score ?? 0, my.correctAnswers ?? 0);
          setMyPosition({ kind: "ranked", rank: liveRank, isFinal: false, score: my.score ?? 0 });
        } catch {
          setMyPosition({ kind: "ranked", rank: 0, isFinal: false, score: my.score ?? 0 });
        }
      }
    }
  }, [contestId, userId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (!contestId || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = isFinalized
        ? await fetchFinalizedLeaderboardPage(contestId as string, cursor)
        : await fetchLeaderboardPage(contestId as string, cursor);
      setRows((prev) => [...prev, ...page.rows]);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={S.center}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={S.loadingText}>Loading leaderboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.container}>
      {/* Header */}
      <LinearGradient colors={["#0f0c29", "#302b63"]} style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={S.headerMid}>
          <Text style={S.headerTitle} numberOfLines={1}>
            {contest?.title ?? "Leaderboard"}
          </Text>
          {isFinalized ? (
            <View style={S.endedBadge}>
              <Text style={S.endedText}>🏆 Final Results</Text>
            </View>
          ) : isEnded ? (
            <View style={S.pendingBadge}>
              <Text style={S.pendingText}>⏳ Finalizing…</Text>
            </View>
          ) : (
            <View style={S.liveBadge}>
              <View style={S.liveDot} />
              <Text style={S.liveText}>Live Standings</Text>
            </View>
          )}
        </View>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Your Position — always resolved independently of the loaded page,
          never shows a false "not ranked" just because you're outside it. */}
      {myPosition.kind === "ranked" && (
        <View style={S.myPosCard}>
          <Ionicons name="person-circle" size={22} color="#818cf8" />
          <Text style={S.myPosLabel}>Your Position</Text>
          <Text style={S.myPosRank}>{myPosition.rank > 0 ? `#${myPosition.rank}` : "—"}</Text>
          <Text style={S.myPosScore}>{myPosition.score} pts</Text>
          {!myPosition.isFinal && <Text style={S.myPosNote}>Live estimate</Text>}
        </View>
      )}
      {myPosition.kind === "pending" && (
        <View style={S.myPosCardMuted}>
          <Ionicons name="hourglass-outline" size={18} color="#94a3b8" />
          <Text style={S.myPosMutedText}>Complete the quiz to see your position</Text>
        </View>
      )}

      <FlatList
        data={rows}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={S.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          !isFinalized ? (
            <View style={S.disclaimer}>
              <Ionicons name="information-circle-outline" size={16} color="#94a3b8" />
              <Text style={S.disclaimerText}>
                {isEnded
                  ? "Final ranks are being calculated — check back shortly."
                  : "Rankings update as more students complete the quiz"}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={S.empty}>
            <Text style={S.emptyIcon}>📊</Text>
            <Text style={S.emptyTitle}>No scores yet</Text>
            <Text style={S.emptyMsg}>Be the first to complete the quiz!</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const isMe = item.userId === userId;
          const rank = (isFinalized ? item.finalRank : item.rank) ?? index + 1;
          return (
            <View style={[S.row, isMe && S.rowMe, rank === 1 && S.rowFirst]}>
              <Text style={[S.rankText, rank === 1 && S.gold, rank === 2 && S.silver, rank === 3 && S.bronze]}>
                {rank <= 3 ? MEDAL[rank - 1] : `#${rank}`}
              </Text>
              <View style={S.nameCol}>
                <Text style={[S.name, isMe && S.nameMe]} numberOfLines={1}>
                  {isMe ? "You" : item.name}
                </Text>
                {!!item.timeBonus && <Text style={S.timeBonusText}>+{item.timeBonus} speed bonus</Text>}
              </View>
              <View style={S.scoreCol}>
                <Text style={[S.score, isMe && S.scoreMe]}>{item.score}</Text>
                <Text style={S.scorePts}>pts</Text>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          hasMore ? (
            <TouchableOpacity style={S.loadMoreBtn} onPress={loadMore} disabled={loadingMore} activeOpacity={0.85}>
              {loadingMore ? (
                <ActivityIndicator size="small" color="#6366f1" />
              ) : (
                <Text style={S.loadMoreText}>Load More ({LEADERBOARD_PAGE_SIZE} more)</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={{ height: 24 }} />
          )
        }
      />
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#0f172a" },
  center:      { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a", gap: 12 },
  loadingText: { color: "#94a3b8", fontSize: 15, fontWeight: "600" },

  header:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 14, gap: 10 },
  backBtn:     { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerMid:   { flex: 1, alignItems: "center", gap: 5 },
  headerTitle: { color: "#f1f5f9", fontSize: 15, fontWeight: "800", textAlign: "center" },

  liveBadge:   { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(239,68,68,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  liveDot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: "#ef4444" },
  liveText:    { color: "#fca5a5", fontSize: 11, fontWeight: "800" },

  endedBadge:  { backgroundColor: "rgba(251,191,36,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  endedText:   { color: "#fbbf24", fontSize: 11, fontWeight: "800" },
  pendingBadge:{ backgroundColor: "rgba(148,163,184,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  pendingText: { color: "#cbd5e1", fontSize: 11, fontWeight: "800" },

  myPosCard: {
    flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 4, marginBottom: 8,
    backgroundColor: "#1e1b4b", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#6366f155",
  },
  myPosLabel: { color: "#a5b4fc", fontSize: 13, fontWeight: "700", flex: 1 },
  myPosRank:  { color: "#fbbf24", fontSize: 20, fontWeight: "900" },
  myPosScore: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  myPosNote:  { color: "#818cf8", fontSize: 10, fontWeight: "700" },
  myPosCardMuted: {
    flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 4, marginBottom: 8,
    backgroundColor: "#1e293b", borderRadius: 16, padding: 12,
  },
  myPosMutedText: { color: "#94a3b8", fontSize: 13, fontWeight: "600" },

  scroll:      { padding: 16, paddingTop: 8 },

  disclaimer:  { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#1e293b", borderRadius: 12, padding: 12, marginBottom: 16 },
  disclaimerText: { color: "#64748b", fontSize: 12, flex: 1, lineHeight: 18 },

  empty:       { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyIcon:   { fontSize: 48 },
  emptyTitle:  { color: "#f1f5f9", fontSize: 18, fontWeight: "800" },
  emptyMsg:    { color: "#64748b", fontSize: 14 },

  row:         { flexDirection: "row", alignItems: "center", backgroundColor: "#1e293b", borderRadius: 16, padding: 14, marginBottom: 10, gap: 12, borderWidth: 1, borderColor: "#334155" },
  rowMe:       { borderColor: "#6366f1", backgroundColor: "#1e1b4b" },
  rowFirst:    { borderColor: "#f59e0b55", backgroundColor: "#1c1506" },

  rankText:    { width: 36, fontSize: 20, textAlign: "center", fontWeight: "800", color: "#94a3b8" },
  gold:        { color: "#fbbf24" },
  silver:      { color: "#94a3b8" },
  bronze:      { color: "#d97706" },

  nameCol:     { flex: 1, gap: 2 },
  name:        { color: "#cbd5e1", fontSize: 15, fontWeight: "700" },
  nameMe:      { color: "#818cf8", fontWeight: "900" },
  timeBonusText: { color: "#10b981", fontSize: 11, fontWeight: "600" },

  scoreCol:    { alignItems: "flex-end", gap: 1 },
  score:       { color: "#f1f5f9", fontSize: 20, fontWeight: "900" },
  scoreMe:     { color: "#a5b4fc" },
  scorePts:    { color: "#475569", fontSize: 10, fontWeight: "600" },

  loadMoreBtn: { alignItems: "center", justifyContent: "center", paddingVertical: 14, marginTop: 4, backgroundColor: "#1e293b", borderRadius: 14, borderWidth: 1, borderColor: "#334155" },
  loadMoreText:{ color: "#a5b4fc", fontSize: 14, fontWeight: "800" },
});

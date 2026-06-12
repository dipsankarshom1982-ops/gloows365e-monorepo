import { auth, db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
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

type Row = {
  userId: string;
  name: string;
  score: number;
  timeBonus: number;
  rank: number;
};

const MEDAL = ["🥇", "🥈", "🥉"];

export default function ContestLeaderboardScreen() {
  const { contestId } = useLocalSearchParams<{ contestId: string }>();
  const router = useRouter();
  const userId = auth.currentUser?.uid;

  const [contest, setContest]     = useState<any>(null);
  const [rows, setRows]           = useState<Row[]>([]);
  const [isEnded, setIsEnded]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!contestId) return;

    const [contestSnap, participantSnap] = await Promise.all([
      getDoc(doc(db, "contests", contestId as string)),
      getDocs(collection(db, "contests", contestId as string, "participant")),
    ]);

    if (contestSnap.exists()) {
      const data = { id: contestSnap.id, ...contestSnap.data() } as any;
      setContest(data);
      const end = parseDate(data.endTime ?? data.endDate);
      setIsEnded(!!(end && end < new Date()));
    }

    // Build ranked list from completed participants only
    const completed = participantSnap.docs
      .filter((d) => d.data().completed)
      .map((d) => ({
        userId:    d.data().userId as string,
        score:     d.data().score     ?? 0,
        timeBonus: d.data().timeBonus ?? 0,
        rank:      d.data().rank      ?? 999,
        name:      "Student",
      }))
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 50);

    // Fetch names in parallel
    const named: Row[] = await Promise.all(
      completed.map(async (r) => {
        try {
          const snap = await getDoc(doc(db, "students", r.userId));
          return { ...r, name: snap.exists() ? (snap.data()?.name ?? "Student") : "Student" };
        } catch {
          return r;
        }
      })
    );

    setRows(named);
  }, [contestId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
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
          {isEnded ? (
            <View style={S.endedBadge}>
              <Text style={S.endedText}>🏆 Final Results</Text>
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

      <ScrollView
        contentContainerStyle={S.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Live disclaimer */}
        {!isEnded && (
          <View style={S.disclaimer}>
            <Ionicons name="information-circle-outline" size={16} color="#94a3b8" />
            <Text style={S.disclaimerText}>
              Rankings update as more students complete the quiz
            </Text>
          </View>
        )}

        {/* Empty state */}
        {rows.length === 0 && (
          <View style={S.empty}>
            <Text style={S.emptyIcon}>📊</Text>
            <Text style={S.emptyTitle}>No scores yet</Text>
            <Text style={S.emptyMsg}>Be the first to complete the quiz!</Text>
          </View>
        )}

        {/* Rows */}
        {rows.map((row, i) => {
          const isMe = row.userId === userId;
          return (
            <View
              key={row.userId}
              style={[S.row, isMe && S.rowMe, i === 0 && S.rowFirst]}
            >
              {/* Rank */}
              <Text style={[S.rankText, i === 0 && S.gold, i === 1 && S.silver, i === 2 && S.bronze]}>
                {i < 3 ? MEDAL[i] : `#${row.rank}`}
              </Text>

              {/* Name */}
              <View style={S.nameCol}>
                <Text style={[S.name, isMe && S.nameMe]} numberOfLines={1}>
                  {isMe ? "You" : row.name}
                </Text>
                {!!row.timeBonus && (
                  <Text style={S.timeBonusText}>+{row.timeBonus} speed bonus</Text>
                )}
              </View>

              {/* Score */}
              <View style={S.scoreCol}>
                <Text style={[S.score, isMe && S.scoreMe]}>{row.score}</Text>
                <Text style={S.scorePts}>pts</Text>
              </View>
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
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

  scroll:      { padding: 16 },

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
});

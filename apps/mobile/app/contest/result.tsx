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
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type LeaderRow = { userId: string; name: string; score: number; rank: number };

function parseDate(t: any): Date | null {
  if (!t) return null;
  if (typeof t.toDate === "function") return t.toDate();
  if (t.seconds) return new Date(t.seconds * 1000);
  if (typeof t === "string" && t.length > 0) return new Date(t);
  return null;
}

function getGrade(score: number, total: number) {
  const pct = total > 0 ? Math.round((score / (total * 10)) * 100) : 0;
  if (pct >= 90) return { label: "Excellent", emoji: "🌟", color: "#10b981", pct };
  if (pct >= 70) return { label: "Good",      emoji: "👍", color: "#6366f1", pct };
  if (pct >= 50) return { label: "Average",   emoji: "🙂", color: "#f59e0b", pct };
  return          { label: "Keep Practicing", emoji: "💪", color: "#ef4444", pct };
}

function ScoreRing({ score, total }: { score: number; total: number }) {
  const grade = getGrade(score, total);
  return (
    <View style={SR.wrap}>
      <LinearGradient colors={["#1e293b", "#0f172a"]} style={SR.ring}>
        <Text style={[SR.score, { color: grade.color }]}>{score}</Text>
        <Text style={SR.label}>pts</Text>
        <Text style={[SR.grade, { color: grade.color }]}>{grade.label}</Text>
      </LinearGradient>
      <Text style={SR.emoji}>{grade.emoji}</Text>
      <Text style={[SR.pct, { color: grade.color }]}>{grade.pct}%</Text>
    </View>
  );
}

const SR = StyleSheet.create({
  wrap:  { alignItems: "center", marginVertical: 8 },
  ring:  { width: 140, height: 140, borderRadius: 70, justifyContent: "center", alignItems: "center", borderWidth: 3, borderColor: "#334155" },
  score: { fontSize: 40, fontWeight: "900" },
  label: { color: "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: "600" },
  grade: { fontSize: 12, fontWeight: "800", marginTop: 4 },
  emoji: { fontSize: 28, marginTop: 12 },
  pct:   { fontSize: 18, fontWeight: "800", marginTop: 4 },
});

export default function ContestResultScreen() {
  const { contestId, score: scoreParam, total: totalParam } =
    useLocalSearchParams<{ contestId: string; score?: string; total?: string }>();
  const router = useRouter();
  const userId = auth.currentUser?.uid;

  const [contest, setContest]           = useState<any>(null);
  const [score, setScore]               = useState(parseInt(scoreParam ?? "0", 10));
  const [total, setTotal]               = useState(parseInt(totalParam ?? "0", 10));
  const [myRank, setMyRank]             = useState<number | null>(null);
  const [leaderboard, setLeaderboard]   = useState<LeaderRow[]>([]);
  const [isEnded, setIsEnded]           = useState(false);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    if (!contestId || !userId) return;
    (async () => {
      const [contestSnap, participantSnap, mySnap] = await Promise.all([
        getDoc(doc(db, "contests", contestId as string)),
        getDocs(collection(db, "contests", contestId as string, "participant")),
        getDoc(doc(db, "contests", contestId as string, "participant", userId)),
      ]);

      if (contestSnap.exists()) {
        const data = { id: contestSnap.id, ...contestSnap.data() } as any;
        setContest(data);

        const end = parseDate(data.endTime ?? data.endDate);
        setIsEnded(!!(end && end < new Date()));
      }

      // Use stored score from participant doc if available
      if (mySnap.exists()) {
        const d = mySnap.data();
        setScore(d.score ?? parseInt(scoreParam ?? "0", 10));
        setTotal(d.answers?.length ?? parseInt(totalParam ?? "0", 10));
        setMyRank(d.rank ?? null);
      }

      // Build leaderboard sorted by score DESC, then rank ASC
      const rows = participantSnap.docs
        .filter((d) => d.data().completed)
        .map((d) => ({
          userId: d.data().userId as string,
          score:  d.data().score  ?? 0,
          rank:   d.data().rank   ?? 999,
          name:   "Student",
        }))
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 10);

      // Fetch names in parallel
      const named: LeaderRow[] = await Promise.all(
        rows.map(async (r) => {
          try {
            const snap = await getDoc(doc(db, "students", r.userId));
            return { ...r, name: snap.exists() ? (snap.data()?.name ?? "Student") : "Student" };
          } catch {
            return r;
          }
        })
      );
      setLeaderboard(named);
      setLoading(false);
    })();
  }, [contestId, userId]);

  if (loading) {
    return (
      <SafeAreaView style={S.center}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={S.loadingText}>Loading results...</Text>
      </SafeAreaView>
    );
  }

  const grade = getGrade(score, total);

  return (
    <SafeAreaView style={S.container}>
      <LinearGradient colors={["#0f0c29", "#302b63", "#0f172a"]} style={S.header}>
        <Text style={S.headerTitle}>🎉 Quiz Complete!</Text>
        <Text style={S.headerSub}>{contest?.title ?? "Contest Result"}</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

        {/* Score ring — always shown */}
        <View style={S.ringCard}>
          <ScoreRing score={score} total={total} />
          <Text style={[S.gradeMsg, { color: grade.color }]}>
            {grade.emoji} {grade.label}!
          </Text>
          <View style={S.statsRow}>
            <View style={S.statBox}>
              <Text style={S.statVal}>{total}</Text>
              <Text style={S.statLabel}>Questions</Text>
            </View>
            <View style={S.statDivider} />
            <View style={S.statBox}>
              <Text style={S.statVal}>{score}</Text>
              <Text style={S.statLabel}>Points</Text>
            </View>
            <View style={S.statDivider} />
            <View style={S.statBox}>
              <Text style={S.statVal}>{grade.pct}%</Text>
              <Text style={S.statLabel}>Accuracy</Text>
            </View>
          </View>
        </View>

        {/* Contest still running — rank & prize pending */}
        {!isEnded && (
          <View style={S.pendingCard}>
            <Ionicons name="time-outline" size={28} color="#f59e0b" />
            <Text style={S.pendingTitle}>Contest Still Running</Text>
            <Text style={S.pendingMsg}>
              Your score is saved. Rank and prize pool results will be announced once the contest ends.
            </Text>
          </View>
        )}

        {/* Contest ended — show rank */}
        {isEnded && myRank !== null && (
          <View style={S.rankCard}>
            <Ionicons name="trophy" size={24} color="#f59e0b" />
            <View style={{ flex: 1 }}>
              <Text style={S.rankLabel}>Your Final Rank</Text>
              <Text style={S.rankVal}>#{myRank}</Text>
            </View>
          </View>
        )}

        {/* Contest ended — show prize pool */}
        {isEnded && !!contest?.prizePool && (
          <LinearGradient
            colors={["#92400e", "#d97706", "#fbbf24"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={S.prizeCard}
          >
            <Ionicons name="trophy" size={24} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={S.prizeLabel}>Prize Pool</Text>
              <Text style={S.prizeValue}>₹{contest.prizePool}</Text>
            </View>
            <Text style={S.prizeNote}>Winners announced by admin</Text>
          </LinearGradient>
        )}

        {/* Contest ended — leaderboard */}
        {isEnded && leaderboard.length > 0 && (
          <View style={S.leaderCard}>
            <Text style={S.leaderTitle}>🏆 Final Leaderboard</Text>
            {leaderboard.map((row, i) => {
              const isMe = row.userId === userId;
              return (
                <View key={row.userId} style={[S.leaderRow, isMe && S.leaderRowMe]}>
                  <Text style={[S.leaderRank, i === 0 && S.gold, i === 1 && S.silver, i === 2 && S.bronze]}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </Text>
                  <Text style={[S.leaderName, isMe && S.leaderNameMe]} numberOfLines={1}>
                    {isMe ? "You" : row.name}
                  </Text>
                  <Text style={S.leaderScore}>{row.score} pts</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Actions */}
        <View style={S.actions}>
          {/* Leaderboard — always visible after quiz */}
          <TouchableOpacity
            style={S.leaderBtn}
            onPress={() => router.push({ pathname: "/contest/leaderboard", params: { contestId } })}
            activeOpacity={0.85}
          >
            <Ionicons name="podium-outline" size={18} color="#a5b4fc" />
            <Text style={S.leaderBtnText}>
              {isEnded ? "View Final Leaderboard" : "View Live Standings"}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#a5b4fc" />
          </TouchableOpacity>

          <TouchableOpacity
            style={S.primaryBtn}
            onPress={() => router.replace("/(drawer)/(tabs)/vidyastar")}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#6366f1", "#4f46e5"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={S.btnGrad}
            >
              <Text style={S.primaryBtnText}>Back to Contests</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={S.secondaryBtn}
            onPress={() => router.replace("/(drawer)/(tabs)/home")}
            activeOpacity={0.85}
          >
            <Text style={S.secondaryBtnText}>Go Home</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#0f172a" },
  center:       { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a", gap: 12 },
  loadingText:  { color: "#94a3b8", fontSize: 15, fontWeight: "600" },
  header:       { paddingHorizontal: 20, paddingVertical: 24, alignItems: "center", gap: 6 },
  headerTitle:  { color: "#f1f5f9", fontSize: 26, fontWeight: "900" },
  headerSub:    { color: "#a5b4fc", fontSize: 14, fontWeight: "600", textAlign: "center" },
  scroll:       { padding: 16 },

  ringCard:     { backgroundColor: "#1e293b", borderRadius: 24, padding: 24, alignItems: "center", marginBottom: 16, gap: 10 },
  gradeMsg:     { fontSize: 20, fontWeight: "900" },
  statsRow:     { flexDirection: "row", alignItems: "center", marginTop: 4 },
  statBox:      { flex: 1, alignItems: "center", gap: 3 },
  statVal:      { color: "#f1f5f9", fontSize: 18, fontWeight: "900" },
  statLabel:    { color: "#64748b", fontSize: 11, fontWeight: "600" },
  statDivider:  { width: 1, height: 32, backgroundColor: "#334155" },

  pendingCard:  { backgroundColor: "#1e293b", borderRadius: 20, padding: 20, alignItems: "center", gap: 10, marginBottom: 16, borderWidth: 1, borderColor: "#f59e0b33" },
  pendingTitle: { color: "#fde68a", fontSize: 16, fontWeight: "800" },
  pendingMsg:   { color: "#94a3b8", fontSize: 13, textAlign: "center", lineHeight: 20 },

  rankCard:     { backgroundColor: "#1e293b", borderRadius: 20, padding: 18, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16, borderWidth: 1, borderColor: "#f59e0b55" },
  rankLabel:    { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  rankVal:      { color: "#fbbf24", fontSize: 28, fontWeight: "900" },

  prizeCard:    { borderRadius: 18, padding: 18, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  prizeLabel:   { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" },
  prizeValue:   { color: "#fff", fontSize: 22, fontWeight: "900" },
  prizeNote:    { color: "rgba(255,255,255,0.7)", fontSize: 10, textAlign: "right", maxWidth: 80 },

  leaderCard:   { backgroundColor: "#1e293b", borderRadius: 20, padding: 16, marginBottom: 16, gap: 4 },
  leaderTitle:  { color: "#f1f5f9", fontSize: 16, fontWeight: "800", marginBottom: 8 },
  leaderRow:    { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#334155", gap: 12 },
  leaderRowMe:  { backgroundColor: "rgba(99,102,241,0.1)", borderRadius: 10, paddingHorizontal: 8 },
  leaderRank:   { width: 32, color: "#94a3b8", fontWeight: "800", textAlign: "center" },
  gold:         { color: "#fbbf24" },
  silver:       { color: "#94a3b8" },
  bronze:       { color: "#d97706" },
  leaderName:   { flex: 1, color: "#cbd5e1", fontSize: 14, fontWeight: "600" },
  leaderNameMe: { color: "#818cf8", fontWeight: "800" },
  leaderScore:  { color: "#94a3b8", fontSize: 13, fontWeight: "700" },

  actions:      { gap: 12 },
  leaderBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#1e293b", borderRadius: 16, paddingVertical: 14, borderWidth: 1, borderColor: "#6366f155" },
  leaderBtnText:{ color: "#a5b4fc", fontSize: 14, fontWeight: "800", flex: 1, textAlign: "center" },
  primaryBtn:   { borderRadius: 16, overflow: "hidden" },
  btnGrad:      { paddingVertical: 16, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  secondaryBtn: { borderRadius: 16, borderWidth: 1, borderColor: "#334155", paddingVertical: 14, alignItems: "center" },
  secondaryBtnText: { color: "#94a3b8", fontSize: 15, fontWeight: "700" },
});

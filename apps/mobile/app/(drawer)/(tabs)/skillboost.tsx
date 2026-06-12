import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useStudentProfile } from "@/context/StudentProfileContext";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BOOST_CATEGORIES = [
  { id: "math",    emoji: "🔢", label: "Math",      gradient: ["#1e3a5f", "#2563eb"] as [string, string] },
  { id: "english", emoji: "📖", label: "English",   gradient: ["#4c1d95", "#7c3aed"] as [string, string] },
  { id: "science", emoji: "🔬", label: "Science",   gradient: ["#1a2e05", "#4d7c0f"] as [string, string] },
  { id: "gk",      emoji: "🌍", label: "Gen. Knowledge", gradient: ["#7c2d12", "#c2410c"] as [string, string] },
  { id: "logic",   emoji: "🧩", label: "Logic",     gradient: ["#134e4a", "#0d9488"] as [string, string] },
  { id: "vocab",   emoji: "📝", label: "Vocabulary", gradient: ["#831843", "#db2777"] as [string, string] },
];

const DAILY_CHALLENGES = [
  {
    id: "c1",
    title: "Quick Math Sprint",
    desc: "10 arithmetic questions in 2 minutes",
    emoji: "🔢",
    xp: 50,
    duration: "2 min",
    difficulty: "Easy",
    diffColor: "#10b981",
    gradient: ["#0f172a", "#1e3a5f"] as [string, string],
  },
  {
    id: "c2",
    title: "Word Power",
    desc: "Match 8 vocabulary words to their meanings",
    emoji: "📝",
    xp: 40,
    duration: "3 min",
    difficulty: "Medium",
    diffColor: "#f59e0b",
    gradient: ["#2e1065", "#4c1d95"] as [string, string],
  },
  {
    id: "c3",
    title: "Science Facts",
    desc: "True or False — 12 quick science questions",
    emoji: "🔬",
    xp: 60,
    duration: "3 min",
    difficulty: "Hard",
    diffColor: "#ef4444",
    gradient: ["#0a0a0a", "#1a2e05"] as [string, string],
  },
];

function ChallengeCard({ item, done, onPress }: { item: typeof DAILY_CHALLENGES[0]; done: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={S.challengeCardWrap}>
      <LinearGradient colors={item.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.challengeCard}>
        {done && (
          <View style={S.doneOverlay}>
            <Ionicons name="checkmark-circle" size={44} color="#10b981" />
            <Text style={S.doneText}>Completed!</Text>
          </View>
        )}
        <View style={S.challengeTop}>
          <Text style={S.challengeEmoji}>{item.emoji}</Text>
          <View style={[S.diffBadge, { backgroundColor: `${item.diffColor}25`, borderColor: item.diffColor }]}>
            <Text style={[S.diffText, { color: item.diffColor }]}>{item.difficulty}</Text>
          </View>
        </View>
        <Text style={S.challengeTitle}>{item.title}</Text>
        <Text style={S.challengeDesc}>{item.desc}</Text>
        <View style={S.challengeMeta}>
          <View style={S.metaPill}>
            <Ionicons name="time-outline" size={11} color="#94a3b8" />
            <Text style={S.metaText}>{item.duration}</Text>
          </View>
          <View style={S.metaPill}>
            <Text style={S.metaText}>⚡ +{item.xp} XP</Text>
          </View>
        </View>
        <View style={[S.startBtn, done && S.startBtnDone]}>
          <Text style={S.startBtnText}>{done ? "Redo →" : "Start →"}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function SkillBoostScreen() {
  const { colors } = useTheme();
  const { studentProfile } = useStudentProfile();
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  const name       = studentProfile?.name?.split(" ")[0] || "Student";
  const streakDays = studentProfile?.LearnFunXP ? Math.floor(studentProfile.LearnFunXP / 50) : 0;
  const todayDone  = completedIds.length;

  const handleChallenge = (id: string) => {
    if (!completedIds.includes(id)) {
      setCompletedIds((prev) => [...prev, id]);
    }
  };

  return (
    <SafeAreaView style={[S.safe, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scroll}>

        {/* ── Header ── */}
        <View style={S.header}>
          <View>
            <Text style={[S.greeting, { color: colors.textSecondary }]}>Welcome back,</Text>
            <Text style={[S.headerTitle, { color: colors.text }]}>⚡ {name}'s SkillBoost</Text>
          </View>
          <View style={[S.streakBadge, { backgroundColor: `${colors.accent}18` }]}>
            <Text style={S.streakFire}>🔥</Text>
            <Text style={[S.streakCount, { color: colors.accent }]}>{streakDays}</Text>
            <Text style={[S.streakLabel, { color: colors.textSecondary }]}>day streak</Text>
          </View>
        </View>

        {/* ── Daily progress banner ── */}
        <LinearGradient
          colors={["#1a0a2e", "#312e81", "#1e1b4b"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={S.progressBanner}
        >
          <View style={S.progressLeft}>
            <Text style={S.progressTitle}>Today's Boost Goal</Text>
            <Text style={S.progressSub}>{todayDone} of {DAILY_CHALLENGES.length} challenges done</Text>
            <View style={S.progressBar}>
              <View style={[S.progressFill, { width: `${(todayDone / DAILY_CHALLENGES.length) * 100}%` }]} />
            </View>
          </View>
          <View style={S.progressRight}>
            <Text style={S.xpEarned}>+{completedIds.reduce((acc, id) => {
              const ch = DAILY_CHALLENGES.find((c) => c.id === id);
              return acc + (ch?.xp ?? 0);
            }, 0)}</Text>
            <Text style={S.xpLabel}>XP today</Text>
          </View>
        </LinearGradient>

        {/* ── Daily Challenges ── */}
        <View style={S.sectionHeader}>
          <Text style={[S.sectionTitle, { color: colors.text }]}>🎯 Daily Challenges</Text>
          <Text style={[S.sectionSub, { color: colors.textSecondary }]}>Resets at midnight</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 16, paddingRight: 4 }}
        >
          {DAILY_CHALLENGES.map((ch) => (
            <ChallengeCard
              key={ch.id}
              item={ch}
              done={completedIds.includes(ch.id)}
              onPress={() => handleChallenge(ch.id)}
            />
          ))}
        </ScrollView>

        {/* ── Boost by Subject ── */}
        <View style={S.sectionHeader}>
          <Text style={[S.sectionTitle, { color: colors.text }]}>📚 Boost by Subject</Text>
          <Text style={[S.sectionSub, { color: colors.textSecondary }]}>Pick any topic to practice</Text>
        </View>

        <View style={S.categoryGrid}>
          {BOOST_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              activeOpacity={0.82}
              style={S.categoryCard}
              onPress={() => {}}
            >
              <LinearGradient
                colors={cat.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={S.categoryGrad}
              >
                <Text style={S.categoryEmoji}>{cat.emoji}</Text>
                <Text style={S.categoryLabel}>{cat.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Quick Boost Banner ── */}
        <TouchableOpacity activeOpacity={0.88} style={S.quickBoostWrap}>
          <LinearGradient
            colors={["#065f46", "#059669", "#10b981"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={S.quickBoost}
          >
            <View>
              <Text style={S.quickBoostTitle}>⚡ Random Boost</Text>
              <Text style={S.quickBoostSub}>Surprise challenge — 2 min, any subject</Text>
            </View>
            <View style={S.quickBoostBtn}>
              <Text style={S.quickBoostBtnText}>GO!</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Leaderboard Teaser ── */}
        <View style={[S.leaderTeaser, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[S.leaderTitle, { color: colors.text }]}>🏆 Top Boosters Today</Text>
          {["Priya S.", "Arjun M.", "Neha K."].map((n, i) => (
            <View key={n} style={[S.leaderRow, { borderBottomColor: colors.border }]}>
              <Text style={S.leaderRank}>{["🥇", "🥈", "🥉"][i]}</Text>
              <Text style={[S.leaderName, { color: colors.text }]}>{n}</Text>
              <Text style={S.leaderXP}>+{[340, 280, 210][i]} XP</Text>
            </View>
          ))}
          <TouchableOpacity
            style={[S.viewLbBtn, { borderColor: colors.border }]}
            onPress={() => router.push("/leaderboard")}
          >
            <Text style={[S.viewLbText, { color: colors.accent }]}>View Full Leaderboard →</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:   { flex: 1 },
  scroll: { paddingBottom: 16 },

  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  greeting:     { fontSize: 12, fontWeight: "500" },
  headerTitle:  { fontSize: 20, fontWeight: "900", marginTop: 2 },
  streakBadge:  { alignItems: "center", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  streakFire:   { fontSize: 20 },
  streakCount:  { fontSize: 22, fontWeight: "900" },
  streakLabel:  { fontSize: 10, fontWeight: "600" },

  progressBanner: { marginHorizontal: 16, marginVertical: 12, borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressLeft:   { flex: 1, marginRight: 12 },
  progressTitle:  { color: "#fff", fontSize: 14, fontWeight: "800", marginBottom: 2 },
  progressSub:    { color: "rgba(255,255,255,0.6)", fontSize: 11, marginBottom: 8 },
  progressBar:    { height: 8, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 6 },
  progressFill:   { height: "100%", backgroundColor: "#818cf8", borderRadius: 6 },
  progressRight:  { alignItems: "center" },
  xpEarned:      { color: "#a5b4fc", fontSize: 26, fontWeight: "900" },
  xpLabel:        { color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "600" },

  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 16, marginTop: 16, marginBottom: 10 },
  sectionTitle:  { fontSize: 16, fontWeight: "800" },
  sectionSub:    { fontSize: 11, fontWeight: "500" },

  challengeCardWrap: { marginRight: 12, width: 200, borderRadius: 18, overflow: "hidden", elevation: 6, shadowColor: "#6366f1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  challengeCard:     { padding: 16, height: 230, justifyContent: "space-between" },
  doneOverlay:       { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 18, justifyContent: "center", alignItems: "center", zIndex: 10 },
  doneText:          { color: "#10b981", fontSize: 15, fontWeight: "800", marginTop: 6 },
  challengeTop:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  challengeEmoji:    { fontSize: 28 },
  diffBadge:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  diffText:          { fontSize: 10, fontWeight: "800" },
  challengeTitle:    { color: "#fff", fontSize: 14, fontWeight: "800", lineHeight: 20 },
  challengeDesc:     { color: "rgba(255,255,255,0.6)", fontSize: 11, lineHeight: 16 },
  challengeMeta:     { flexDirection: "row", gap: 8 },
  metaPill:          { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 },
  metaText:          { color: "#94a3b8", fontSize: 10, fontWeight: "600" },
  startBtn:          { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, paddingVertical: 9, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  startBtnDone:      { backgroundColor: "rgba(16,185,129,0.25)", borderColor: "#10b981" },
  startBtnText:      { color: "#fff", fontSize: 12, fontWeight: "800" },

  categoryGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 10 },
  categoryCard: { width: "30.5%", borderRadius: 16, overflow: "hidden", elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 5 },
  categoryGrad: { padding: 14, alignItems: "center", aspectRatio: 1, justifyContent: "center" },
  categoryEmoji: { fontSize: 30, marginBottom: 6 },
  categoryLabel: { color: "#fff", fontSize: 11, fontWeight: "800", textAlign: "center" },

  quickBoostWrap: { marginHorizontal: 16, marginTop: 16, borderRadius: 18, overflow: "hidden", elevation: 5, shadowColor: "#059669", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
  quickBoost:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18 },
  quickBoostTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  quickBoostSub:  { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 },
  quickBoostBtn:  { backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  quickBoostBtnText: { color: "#059669", fontSize: 16, fontWeight: "900" },

  leaderTeaser: { marginHorizontal: 16, marginTop: 16, borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  leaderTitle:  { fontSize: 14, fontWeight: "800", padding: 14, paddingBottom: 8 },
  leaderRow:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  leaderRank:   { fontSize: 18, width: 30 },
  leaderName:   { flex: 1, fontSize: 13, fontWeight: "700" },
  leaderXP:     { color: "#818cf8", fontSize: 13, fontWeight: "800" },
  viewLbBtn:    { margin: 12, borderRadius: 10, borderWidth: 1, paddingVertical: 10, alignItems: "center" },
  viewLbText:   { fontSize: 13, fontWeight: "700" },
});

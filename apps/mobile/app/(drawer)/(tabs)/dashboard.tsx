import { useTheme } from "@/context/ThemeContext";
import { auth, db } from "@/lib/firebase";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart, LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";

import Header from "@/components/header";

const SCREEN_W = Dimensions.get("window").width;
const CHART_W  = SCREEN_W - 32;

// ─── Types ────────────────────────────────────────────────────
interface StudentProfile {
  name:        string;
  class:       string;
  school?:     string;
  profilePic?: string;
}

interface PostData {
  id:         string;
  postType?:  string;
  likes?:     number;
  views?:     number;
  comments?:  number;
  shares?:    number;
  watchTime?: number;
  createdAt?: any;
  category?:  string;
}

interface DNAResult {
  overallScore:    number;
  weekActivity:    number[];   // 7 values Sun→Sat
  weekLabels:      string[];
  totalPosts:      number;
  totalLikes:      number;
  totalViews:      number;
  totalComments:   number;
  totalShares:     number;
  avgEngagement:   number;
  consistencyPct:  number;
  photoCount:      number;
  videoCount:      number;
  strengths:       string[];
  weaknesses:      string[];
  suggestions:     string[];
}

// ─── Helpers ──────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { emoji: "🎬", label: "Upload Reel",  route: "/Createreelscreen",            colors: ["#4f46e5", "#7c3aed"] as [string, string] },
  { emoji: "🤖", label: "AI Guru",      route: "/ai-guru",                     colors: ["#0369a1", "#0ea5e9"] as [string, string] },
  { emoji: "⚔️", label: "Skill Battle", route: "/(drawer)/(tabs)/skillbattle", colors: ["#b45309", "#f97316"] as [string, string] },
  { emoji: "👛", label: "My Wallet",    route: "/vcoins/wallet",               colors: ["#065f46", "#10b981"] as [string, string] },
];

const fmtNum = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

function computeDNA(posts: PostData[]): DNAResult {
  const now    = new Date();
  const dayMs  = 86400000;
  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // 7-day window — indexed by day-of-week
  const weekActivity = Array(7).fill(0);
  const activeDays   = new Set<string>();

  let totalLikes = 0, totalViews = 0, totalComments = 0, totalShares = 0;
  let photoCount = 0, videoCount = 0;
  let scoreSum   = 0;

  posts.forEach((p) => {
    const likes    = p.likes    ?? 0;
    const views    = p.views    ?? 0;
    const comments = p.comments ?? 0;
    const shares   = p.shares   ?? 0;

    totalLikes    += likes;
    totalViews    += views;
    totalComments += comments;
    totalShares   += shares;

    if (p.postType === "photo") photoCount++;
    else if (p.postType === "video") videoCount++;

    const engScore = likes * 5 + views * 0.1 + comments * 3 + shares * 8;
    scoreSum += engScore;

    // Activity chart
    const ts = p.createdAt?.toDate?.() ?? (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : null);
    if (ts) {
      const diffDays = Math.floor((now.getTime() - ts.getTime()) / dayMs);
      if (diffDays < 7) {
        weekActivity[ts.getDay()]++;
        activeDays.add(ts.toDateString());
      }
    }
  });

  const totalPosts      = posts.length;
  const avgEngagement   = totalPosts > 0 ? Math.round(scoreSum / totalPosts) : 0;
  const consistencyPct  = Math.round((activeDays.size / 7) * 100);

  // Overall score (0–100)
  const engNorm  = Math.min(avgEngagement / 500, 1) * 40;  // 40 pts
  const conNorm  = (consistencyPct / 100) * 30;             // 30 pts
  const volNorm  = Math.min(totalPosts / 20, 1) * 20;       // 20 pts
  const viewNorm = totalViews > 0 ? Math.min(totalViews / 1000, 1) * 10 : 0; // 10 pts
  const overallScore = Math.round(engNorm + conNorm + volNorm + viewNorm);

  // Strengths
  const strengths: string[] = [];
  if (consistencyPct >= 70)  strengths.push("Consistent Poster 🔥");
  if (totalViews > 500)      strengths.push("High Reach 👁");
  if (totalLikes > 50)       strengths.push("Liked Creator ❤️");
  if (totalShares > 10)      strengths.push("Shareable Content 📤");
  if (videoCount > photoCount && videoCount > 0) strengths.push("Video Expert 🎬");
  if (photoCount > videoCount && photoCount > 0) strengths.push("Photo Storyteller 📸");
  if (strengths.length === 0) strengths.push("Keep posting to unlock strengths! 💪");

  // Weaknesses
  const weaknesses: string[] = [];
  if (consistencyPct < 40)   weaknesses.push("Low Posting Consistency");
  if (totalComments < 5)     weaknesses.push("Low Comment Engagement");
  if (totalShares < 5)       weaknesses.push("Content Not Being Shared");
  if (totalViews < 100)      weaknesses.push("Limited Reach");
  if (totalPosts < 5)        weaknesses.push("Too Few Posts");
  if (weaknesses.length === 0) weaknesses.push("Great job — no major gaps!");

  // Suggestions
  const suggestions: string[] = [];
  if (consistencyPct < 60)   suggestions.push("Post at least once every 2 days to build your audience.");
  if (totalComments < 5)     suggestions.push("Ask questions in your captions to invite comments.");
  if (totalShares < 5)       suggestions.push("Create content others want to share — tips, facts, stories.");
  if (videoCount === 0)      suggestions.push("Try uploading a short video reel — they get 3× more views.");
  if (totalViews < 200)      suggestions.push("Use trending topics in your posts to boost visibility.");
  if (suggestions.length === 0) suggestions.push("You're doing great — keep up your current strategy!");

  // Labels aligned to Sun→Sat starting from 7 days ago
  const weekLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() - (6 - i) * dayMs);
    return DAY_LABELS[d.getDay()];
  });

  // Reorder weekActivity to match last-7-days order
  const orderedActivity = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() - (6 - i) * dayMs);
    return weekActivity[d.getDay()];
  });

  return {
    overallScore, weekActivity: orderedActivity, weekLabels,
    totalPosts, totalLikes, totalViews, totalComments, totalShares,
    avgEngagement, consistencyPct, photoCount, videoCount,
    strengths, weaknesses, suggestions,
  };
}

// ─── Inline bar (no SVG needed for small bars) ────────────────
function MetricBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const { colors } = useTheme();
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>{label}</Text>
        <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>{fmtNum(value)}</Text>
      </View>
      <View style={{ height: 8, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 4 }}>
        <View style={{ width: `${pct * 100}%`, height: 8, backgroundColor: color, borderRadius: 4 }} />
      </View>
    </View>
  );
}

// ─── Score ring (pure View) ───────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const grade =
    score >= 80 ? { label: "Excellent", color: "#10b981" } :
    score >= 60 ? { label: "Good",      color: "#6366f1" } :
    score >= 40 ? { label: "Average",   color: "#f59e0b" } :
                  { label: "Needs Work",color: "#ef4444" };

  return (
    <View style={SR.wrap}>
      <LinearGradient colors={["#1e293b", "#0f172a"]} style={SR.ring}>
        <Text style={[SR.score, { color: grade.color }]}>{score}</Text>
        <Text style={SR.outOf}>/100</Text>
        <Text style={[SR.grade, { color: grade.color }]}>{grade.label}</Text>
      </LinearGradient>
    </View>
  );
}
const SR = StyleSheet.create({
  wrap:  { alignItems: "center", marginVertical: 8 },
  ring:  { width: 120, height: 120, borderRadius: 60, justifyContent: "center", alignItems: "center", borderWidth: 3, borderColor: "#334155" },
  score: { fontSize: 34, fontWeight: "900" },
  outOf: { color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: "600", marginTop: -2 },
  grade: { fontSize: 12, fontWeight: "800", marginTop: 2 },
});

const CHART_CFG = {
  backgroundColor:       "#1e293b",
  backgroundGradientFrom:"#1e293b",
  backgroundGradientTo:  "#0f172a",
  decimalPlaces:          0,
  color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
  labelColor:(opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
  style: { borderRadius: 14 },
  propsForDots:{ r: "4", strokeWidth: "2", stroke: "#6366f1" },
  barPercentage: 0.6,
};

// ─── Dashboard ────────────────────────────────────────────────
export default function Dashboard() {
  const { colors } = useTheme();

  const [student,     setStudent]     = useState<StudentProfile | null>(null);
  const [vcoins,      setVcoins]      = useState(0);
  const [loadingHero, setLoadingHero] = useState(true);
  const [dna,         setDna]         = useState<DNAResult | null>(null);
  const [loadingDna,  setLoadingDna]  = useState(true);

  // ── Hero + VCoins ────────────────────────────────────────────
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoadingHero(false); return; }
    (async () => {
      try {
        const [studentSnap, userSnap] = await Promise.all([
          getDoc(doc(db, "students", uid)),
          getDoc(doc(db, "users", uid)),
        ]);
        if (studentSnap.exists()) {
          const d = studentSnap.data();
          setStudent({
            name:       d.name       ?? "Student",
            class:      d.class !== undefined ? String(d.class) : "",
            school:     d.school     ?? "",
            profilePic: d.profilePic ?? "",
          });
        }
        if (userSnap.exists()) {
          const d = userSnap.data();
          setVcoins(d.vCoins ?? d.vCoinBalance ?? d.coins ?? 0);
        }
      } catch (e) {
        console.log("Dashboard hero:", e);
      } finally {
        setLoadingHero(false);
      }
    })();
  }, []);

  // ── DNA analysis — from own posts ───────────────────────────
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoadingDna(false); return; }
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, "posts"),
          where("userId", "==", uid)
        ));
        const posts: PostData[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setDna(computeDNA(posts));
      } catch (e) {
        console.log("DNA fetch:", e);
        setDna(computeDNA([]));
      } finally {
        setLoadingDna(false);
      }
    })();
  }, []);

  const initial = student?.name?.charAt(0)?.toUpperCase() ?? "S";
  const maxMetric = dna ? Math.max(dna.totalViews, 1) : 1;

  return (
    <SafeAreaView style={[S.container, { backgroundColor: colors.background }]}>
      <Header hideMenu />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ══════════════════════════════════════════════
            1. HERO CARD
        ══════════════════════════════════════════════ */}
        {loadingHero ? (
          <View style={S.heroLoading}><ActivityIndicator color="#6366f1" size="large" /></View>
        ) : (
          <LinearGradient
            colors={["#0f0c29", "#302b63", "#24243e"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={S.heroCard}
          >
            <View style={S.heroOrb} />
            <View style={S.heroRow}>
              {student?.profilePic ? (
                <Image source={{ uri: student.profilePic }} style={S.heroAvatar} />
              ) : (
                <LinearGradient colors={["#4f46e5", "#7c3aed"]} style={S.heroAvatarBg}>
                  <Text style={S.heroInitial}>{initial}</Text>
                </LinearGradient>
              )}
              <View style={{ flex: 1 }}>
                <Text style={S.heroHello}>Hello 👋</Text>
                <Text style={S.heroName} numberOfLines={1}>{student?.name ?? "Student"}</Text>
                {student?.class ? (
                  <Text style={S.heroSub}>
                    Class {student.class}{student.school ? `  ·  ${student.school}` : ""}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={S.statsStrip}>
              {[
                { icon: "📹", label: "Posts",   value: fmtNum(dna?.totalPosts ?? 0) },
                { icon: "🪙", label: "VCoins",  value: fmtNum(vcoins) },
                { icon: "📈", label: "Score",   value: dna ? `${dna.overallScore}` : "—" },
              ].map((s, i) => (
                <View key={i} style={[S.statItem, i < 2 && S.statBorder]}>
                  <Text style={S.statIcon}>{s.icon}</Text>
                  <Text style={S.statValue}>{s.value}</Text>
                  <Text style={S.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        )}

        {/* ══════════════════════════════════════════════
            2. QUICK ACTIONS
        ══════════════════════════════════════════════ */}
        <View style={S.sectionRow}>
          <Text style={[S.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
        </View>
        <View style={S.actionsRow}>
          {QUICK_ACTIONS.map((a) => (
            <TouchableOpacity key={a.label} style={S.actionWrap} activeOpacity={0.82} onPress={() => router.push(a.route as any)}>
              <LinearGradient colors={a.colors} style={S.actionBtn}>
                <Text style={S.actionEmoji}>{a.emoji}</Text>
              </LinearGradient>
              <Text style={[S.actionLabel, { color: colors.textSecondary }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ══════════════════════════════════════════════
            3. DNA — DAILY NOTABLE ANALYSIS
        ══════════════════════════════════════════════ */}
        <View style={[S.dnaSection, { backgroundColor: colors.card }]}>

          {/* DNA header */}
          <LinearGradient colors={["#0f0c29", "#1e1b4b"]} style={S.dnaHeader}>
            <View>
              <Text style={S.dnaTitle}>🧬 Daily Notable Analysis</Text>
              <Text style={S.dnaSub}>Your personal performance insights</Text>
            </View>
            <View style={S.dnaBadge}>
              <Text style={S.dnaBadgeText}>DNA</Text>
            </View>
          </LinearGradient>

          {loadingDna ? (
            <View style={S.dnaLoading}>
              <ActivityIndicator color="#6366f1" size="large" />
              <Text style={[S.dnaLoadingText, { color: colors.textSecondary }]}>
                Analysing your data...
              </Text>
            </View>
          ) : !dna || dna.totalPosts === 0 ? (
            <View style={S.dnaEmpty}>
              <Text style={S.dnaEmptyIcon}>📊</Text>
              <Text style={[S.dnaEmptyTitle, { color: colors.text }]}>No Data Yet</Text>
              <Text style={[S.dnaEmptyText, { color: colors.textSecondary }]}>
                Upload your first post to unlock your DNA analysis.
              </Text>
              <TouchableOpacity
                style={S.dnaEmptyBtn}
                onPress={() => router.push("/Createreelscreen")}
              >
                <Text style={S.dnaEmptyBtnText}>Upload Now →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={S.dnaBody}>

              {/* ── Overall Score ── */}
              <Text style={[S.dnaSubTitle, { color: colors.text }]}>Overall Score</Text>
              <ScoreRing score={dna.overallScore} />

              {/* Quick stats row */}
              <View style={S.quickStats}>
                {[
                  { label: "Posts",        value: dna.totalPosts,      icon: "📹" },
                  { label: "Consistency",  value: `${dna.consistencyPct}%`, icon: "🔥" },
                  { label: "Avg Score",    value: fmtNum(dna.avgEngagement), icon: "⚡" },
                ].map((q, i) => (
                  <View key={i} style={[S.quickStatCard, { backgroundColor: colors.background }]}>
                    <Text style={S.quickStatIcon}>{q.icon}</Text>
                    <Text style={[S.quickStatVal, { color: colors.text }]}>{q.value}</Text>
                    <Text style={[S.quickStatLabel, { color: colors.textSecondary }]}>{q.label}</Text>
                  </View>
                ))}
              </View>

              {/* ── 7-Day Activity ── */}
              <Text style={[S.dnaSubTitle, { color: colors.text }]}>7-Day Activity</Text>
              {dna.weekActivity.every((v) => v === 0) ? (
                <View style={[S.chartPlaceholder, { backgroundColor: colors.background }]}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>No posts in the last 7 days</Text>
                </View>
              ) : (
                <LineChart
                  data={{
                    labels:    dna.weekLabels,
                    datasets:  [{ data: dna.weekActivity.map((v) => Math.max(v, 0)) }],
                  }}
                  width={CHART_W}
                  height={180}
                  chartConfig={CHART_CFG}
                  bezier
                  style={S.chart}
                  withInnerLines={false}
                  withOuterLines={false}
                />
              )}

              {/* ── Engagement Breakdown ── */}
              <Text style={[S.dnaSubTitle, { color: colors.text }]}>Engagement Breakdown</Text>
              <View style={[S.breakdownCard, { backgroundColor: colors.background }]}>
                <MetricBar label="👁 Views"    value={dna.totalViews}    max={maxMetric} color="#6366f1" />
                <MetricBar label="❤️ Likes"    value={dna.totalLikes}    max={maxMetric} color="#ec4899" />
                <MetricBar label="💬 Comments" value={dna.totalComments} max={maxMetric} color="#f59e0b" />
                <MetricBar label="📤 Shares"   value={dna.totalShares}   max={maxMetric} color="#10b981" />
              </View>

              {/* ── Post Type Split ── */}
              {(dna.photoCount + dna.videoCount) > 0 && (
                <>
                  <Text style={[S.dnaSubTitle, { color: colors.text }]}>Content Type</Text>
                  <BarChart
                    data={{
                      labels:   ["📸 Photos", "🎬 Videos"],
                      datasets: [{ data: [dna.photoCount, dna.videoCount] }],
                    }}
                    width={CHART_W}
                    height={160}
                    chartConfig={{ ...CHART_CFG, color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})` }}
                    style={S.chart}
                    yAxisLabel=""
                    yAxisSuffix=""
                    showValuesOnTopOfBars
                    withInnerLines={false}
                  />
                </>
              )}

              {/* ── Strengths ── */}
              <Text style={[S.dnaSubTitle, { color: colors.text }]}>💪 Strengths</Text>
              <View style={S.tagGrid}>
                {dna.strengths.map((s, i) => (
                  <View key={i} style={S.strengthTag}>
                    <Text style={S.strengthTagText}>{s}</Text>
                  </View>
                ))}
              </View>

              {/* ── Weaknesses ── */}
              <Text style={[S.dnaSubTitle, { color: colors.text }]}>⚠️ Areas to Improve</Text>
              <View style={S.tagGrid}>
                {dna.weaknesses.map((w, i) => (
                  <View key={i} style={S.weaknessTag}>
                    <Text style={S.weaknessTagText}>{w}</Text>
                  </View>
                ))}
              </View>

              {/* ── Suggestions ── */}
              <Text style={[S.dnaSubTitle, { color: colors.text }]}>🚀 Suggestions</Text>
              {dna.suggestions.map((s, i) => (
                <View key={i} style={[S.suggestionCard, { backgroundColor: colors.background }]}>
                  <View style={S.suggestionDot} />
                  <Text style={[S.suggestionText, { color: colors.textSecondary }]}>{s}</Text>
                </View>
              ))}

            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const S = StyleSheet.create({
  container: { flex: 1 },

  // Hero
  heroLoading:   { height: 170, margin: 16, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  heroCard:      { margin: 16, borderRadius: 22, padding: 18, overflow: "hidden", elevation: 8, shadowColor: "#6366f1", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12 },
  heroOrb:       { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(99,102,241,0.14)", top: -60, right: -60 },
  heroRow:       { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  heroAvatar:    { width: 62, height: 62, borderRadius: 31, borderWidth: 2.5, borderColor: "#6366f1" },
  heroAvatarBg:  { width: 62, height: 62, borderRadius: 31, justifyContent: "center", alignItems: "center" },
  heroInitial:   { color: "#fff", fontSize: 26, fontWeight: "900" },
  heroHello:     { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600" },
  heroName:      { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 2 },
  heroSub:       { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "500", marginTop: 3 },
  statsStrip:    { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 14, paddingVertical: 12 },
  statItem:      { flex: 1, alignItems: "center", gap: 3 },
  statBorder:    { borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.1)" },
  statIcon:      { fontSize: 18 },
  statValue:     { color: "#fff", fontSize: 16, fontWeight: "900" },
  statLabel:     { color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: "600" },

  // Quick actions
  sectionRow:    { paddingHorizontal: 16, marginTop: 8, marginBottom: 14 },
  sectionTitle:  { fontSize: 18, fontWeight: "800" },
  actionsRow:    { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 20 },
  actionWrap:    { alignItems: "center", gap: 7 },
  actionBtn:     { width: 62, height: 62, borderRadius: 20, justifyContent: "center", alignItems: "center", elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6 },
  actionEmoji:   { fontSize: 26 },
  actionLabel:   { fontSize: 10, fontWeight: "700", textAlign: "center", maxWidth: 66 },

  // DNA section
  dnaSection:    { marginHorizontal: 16, borderRadius: 20, overflow: "hidden", marginBottom: 16, elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 8 },
  dnaHeader:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18 },
  dnaTitle:      { color: "#fff", fontSize: 17, fontWeight: "900" },
  dnaSub:        { color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "500", marginTop: 3 },
  dnaBadge:      { backgroundColor: "#6366f1", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  dnaBadgeText:  { color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 1 },

  dnaLoading:     { paddingVertical: 50, alignItems: "center", gap: 12 },
  dnaLoadingText: { fontSize: 13, fontWeight: "500" },

  dnaEmpty:       { padding: 30, alignItems: "center" },
  dnaEmptyIcon:   { fontSize: 48, marginBottom: 10 },
  dnaEmptyTitle:  { fontSize: 18, fontWeight: "800", marginBottom: 6 },
  dnaEmptyText:   { fontSize: 13, fontWeight: "500", textAlign: "center", marginBottom: 18 },
  dnaEmptyBtn:    { backgroundColor: "#6366f1", paddingHorizontal: 24, paddingVertical: 11, borderRadius: 12 },
  dnaEmptyBtnText:{ color: "#fff", fontSize: 13, fontWeight: "800" },

  dnaBody:      { padding: 16, gap: 4 },
  dnaSubTitle:  { fontSize: 15, fontWeight: "800", marginTop: 16, marginBottom: 10 },

  chart:        { borderRadius: 14, marginBottom: 4 },
  chartPlaceholder: { height: 100, borderRadius: 14, justifyContent: "center", alignItems: "center" },

  quickStats:     { flexDirection: "row", gap: 10, marginBottom: 4 },
  quickStatCard:  { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 4 },
  quickStatIcon:  { fontSize: 20 },
  quickStatVal:   { fontSize: 18, fontWeight: "900" },
  quickStatLabel: { fontSize: 10, fontWeight: "600" },

  breakdownCard: { borderRadius: 14, padding: 14, marginBottom: 4 },

  tagGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  strengthTag:  { backgroundColor: "rgba(16,185,129,0.15)", borderWidth: 1, borderColor: "rgba(16,185,129,0.35)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  strengthTagText: { color: "#10b981", fontSize: 12, fontWeight: "700" },
  weaknessTag:  { backgroundColor: "rgba(239,68,68,0.12)", borderWidth: 1, borderColor: "rgba(239,68,68,0.3)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  weaknessTagText: { color: "#ef4444", fontSize: 12, fontWeight: "700" },

  suggestionCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 12, padding: 12, marginBottom: 8 },
  suggestionDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: "#6366f1", marginTop: 4, flexShrink: 0 },
  suggestionText: { flex: 1, fontSize: 13, fontWeight: "500", lineHeight: 19 },
});

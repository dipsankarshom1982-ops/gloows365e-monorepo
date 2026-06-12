import { useEffect, useRef, useState } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useStudentProfile } from "@/context/StudentProfileContext";
import { useTheme } from "@/context/ThemeContext";
import { FREE_DAILY_LESSONS, FREE_DAILY_FOLLOWUPS } from "@/lib/aiGuru/constants";
import {
  fetchPersonalizedDashboard,
  type DashboardResponse,
} from "@/services/dashboardApi";

// ─── PulseSkeleton ────────────────────────────────────────────────────────────

function PulseSkeleton({ height = 60, borderRadius = 14, bgColor = "#1e293b", style }: {
  height?: number;
  borderRadius?: number;
  bgColor?: string;
  style?: object;
}) {
  const anim = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={[
        { height, borderRadius, backgroundColor: bgColor, marginBottom: 10 },
        { opacity: anim },
        style,
      ]}
    />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return "Good Morning";
  if (h >= 12 && h < 17) return "Good Afternoon";
  if (h >= 17 && h < 21) return "Good Evening";
  return "Good Night";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
  });
}

function relativeTime(ms: number): string {
  const diffS = Math.floor((Date.now() - ms) / 1000);
  if (diffS < 60)    return "Just now";
  if (diffS < 3600)  return `${Math.floor(diffS / 60)}m ago`;
  if (diffS < 86400) return `${Math.floor(diffS / 3600)}h ago`;
  return "Yesterday";
}

function snakeToTitle(s: string): string {
  return s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const ACTIVITY_EMOJI: Record<string, string> = {
  daily_login:      "🔑",
  lesson_complete:  "📚",
  quiz_pass:        "✅",
  chapter_complete: "🏆",
  video_watch:      "▶️",
  post_like:        "❤️",
  story_view:       "👁️",
  profile_complete: "🎉",
  first_post:       "🌟",
  referral:         "🤝",
};

const SUBJECT_COLORS: [string, string][] = [
  ["#4f46e5", "#7c3aed"],
  ["#0369a1", "#0ea5e9"],
  ["#064e3b", "#059669"],
  ["#b45309", "#f97316"],
  ["#be185d", "#ec4899"],
  ["#1e40af", "#3b82f6"],
];

function subjectGradient(subject: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  return SUBJECT_COLORS[hash % SUBJECT_COLORS.length];
}

const QUICK_ACTIONS = [
  { emoji: "🤖", label: "Ask VidyaGuru",  gradient: ["#1e1b4b", "#6366f1"] as [string,string], route: "/ai-guru/vidyaguru" },
  { emoji: "✨", label: "Generate Lesson", gradient: ["#312e81", "#4f46e5"] as [string,string], route: "/ai-guru/setup" },
  { emoji: "🧭", label: "Discover AI",    gradient: ["#064e3b", "#059669"] as [string,string], route: "/discover" },
  { emoji: "📚", label: "My Lessons",     gradient: ["#1e3a5f", "#0284c7"] as [string,string], route: "/ai-guru/my-lessons" },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AIDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { studentProfile } = useStudentProfile();
  const { colors, isDarkMode } = useTheme();

  const surfaceBg  = isDarkMode ? "#1e293b" : colors.card;
  const borderCol  = isDarkMode ? "#334155" : colors.border;
  const textMain   = isDarkMode ? "#f1f5f9" : colors.text;
  const textSec    = isDarkMode ? "#94a3b8" : colors.textSecondary;
  const textDim    = isDarkMode ? "#64748b" : colors.textSecondary;
  const backBtnBg  = isDarkMode ? "rgba(255,255,255,0.08)" : colors.card;
  const skeletonBg = isDarkMode ? "#1e293b" : "#e5e7eb";

  const [data, setData]       = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const studentName = studentProfile?.name?.split(" ")[0] ?? "Student";

  useEffect(() => {
    if (!studentProfile) return;
    (async () => {
      try {
        const result = await fetchPersonalizedDashboard({
          studentName:  studentProfile.name            ?? "Student",
          classLevel:   studentProfile.class           ?? "10",
          board:        studentProfile.board           ?? "CBSE",
          interests:    studentProfile.interests       ?? [],
          language:     studentProfile.preferredLanguage ?? "English",
          learnScore:   studentProfile.learnScore      ?? 0,
        });
        setData(result);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [!!studentProfile]);

  return (
    <View style={[S.bg, { backgroundColor: isDarkMode ? "#0a0a1a" : colors.background }]}>
      {isDarkMode && (
        <LinearGradient colors={["#0a0a1a", "#0f172a"]} style={StyleSheet.absoluteFillObject} />
      )}

      {/* Header */}
      <View style={[S.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={[S.backBtn, { backgroundColor: backBtnBg }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={textSec} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: textMain }]}>AI Dashboard</Text>
        <View style={S.headerBadge}>
          <Ionicons name="sparkles" size={12} color="#fbbf24" />
          <Text style={S.headerBadgeText}>AI</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[S.scroll, { paddingBottom: insets.bottom + 32 }]}
      >

        {/* ── Section 1: Hero Greeting ── */}
        <LinearGradient
          colors={["#1e1b4b", "#312e81"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={S.heroCard}
        >
          <View style={S.heroOrb} />
          <Text style={S.heroGreeting}>{getGreeting()} 👋</Text>
          <Text style={S.heroName}>{studentProfile?.name ?? "Student"}</Text>
          <View style={S.heroMeta}>
            <View style={S.heroBadge}>
              <Text style={S.heroBadgeText}>
                Class {studentProfile?.class ?? "—"} · {studentProfile?.board ?? "CBSE"}
              </Text>
            </View>
            <Text style={S.heroDate}>{formatDate()}</Text>
          </View>
        </LinearGradient>

        {/* ── Section 2: AI Usage Stats ── */}
        <Text style={[S.sectionTitle, { color: textMain }]}>📊 Today's AI Usage</Text>
        {loading ? (
          <View style={S.usageRow}>
            {[0, 1, 2].map((i) => <PulseSkeleton key={i} height={80} bgColor={skeletonBg} style={{ flex: 1 }} />)}
          </View>
        ) : (
          <View style={S.usageRow}>
            {[
              { icon: "✨", label: "Lessons",    used: data?.usageToday.lessonsGenerated ?? 0, max: FREE_DAILY_LESSONS },
              { icon: "💬", label: "Follow-ups", used: data?.usageToday.followUps ?? 0,        max: FREE_DAILY_FOLLOWUPS },
              { icon: "🤖", label: "VidyaGuru",  used: data?.usageToday.vidyaGuruChats ?? 0,  max: 1 },
            ].map((tile) => (
              <View key={tile.label} style={[S.usageTile, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
                <Text style={S.usageTileIcon}>{tile.icon}</Text>
                <Text style={[S.usageTileValue, { color: textMain }]}>
                  {tile.used}<Text style={[S.usageTileMax, { color: textDim }]}>/{tile.max}</Text>
                </Text>
                <Text style={[S.usageTileLabel, { color: textDim }]}>{tile.label}</Text>
                <View style={S.usageDots}>
                  {Array.from({ length: tile.max }).map((_, i) => (
                    <View key={i} style={[S.usageDot, { backgroundColor: borderCol }, i < tile.used && S.usageDotActive]} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Section 3: AI Daily Insight ── */}
        <Text style={[S.sectionTitle, { color: textMain }]}>✨ Your AI Study Tip</Text>
        {loading ? (
          <PulseSkeleton height={100} bgColor={skeletonBg} style={{ marginHorizontal: 0 }} />
        ) : (
          <View style={[S.insightCard, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
            <View style={S.insightAccent} />
            <View style={S.insightBody}>
              <Text style={[S.insightText, { color: textMain }]}>
                {error
                  ? `Keep learning every day, ${studentName}! Consistency is the key to success.`
                  : data?.aiInsight ?? "Stay consistent — every day of learning counts!"}
              </Text>
              <Text style={[S.insightFooter, { color: textDim }]}>Updates every 4 hours · Powered by Gemini</Text>
            </View>
          </View>
        )}

        {/* ── Section 4: Today's Study Plan ── */}
        <View style={S.sectionHeader}>
          <Text style={[S.sectionTitle, { color: textMain }]}>📚 Today's Study Plan</Text>
          <TouchableOpacity onPress={() => router.push("/(drawer)/(tabs)/seekho" as any)}>
            <Text style={S.viewAll}>View All →</Text>
          </TouchableOpacity>
        </View>
        {data && data.revisionDueCount > 0 && (
          <View style={S.revisionBadge}>
            <Text style={S.revisionBadgeText}>⚠️ Revision Due: {data.revisionDueCount} concepts</Text>
          </View>
        )}
        {loading ? (
          [0, 1, 2].map((i) => <PulseSkeleton key={i} height={72} bgColor={skeletonBg} />)
        ) : !data || data.studyPlan.length === 0 ? (
          <View style={[S.emptyCard, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
            <Text style={[S.emptyText, { color: textDim }]}>No courses yet — explore Seekho!</Text>
            <TouchableOpacity style={S.emptyBtn} onPress={() => router.push("/(drawer)/(tabs)/seekho" as any)}>
              <Text style={S.emptyBtnText}>Explore Seekho →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          data.studyPlan.map((item) => (
            <View key={item.courseId} style={[S.studyRow, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
              <LinearGradient colors={subjectGradient(item.subject)} style={S.studyAvatar}>
                <Text style={S.studyAvatarText}>{item.subject.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
              <View style={S.studyInfo}>
                <Text style={[S.studyChapter, { color: textMain }]} numberOfLines={1}>{item.chapterTitle}</Text>
                <Text style={[S.studySubject, { color: textDim }]}>{item.subject}</Text>
                <View style={[S.progressTrack, { backgroundColor: borderCol }]}>
                  <View style={[S.progressFill, { width: `${item.percentComplete}%` }]} />
                </View>
              </View>
              <TouchableOpacity
                style={S.continueBtn}
                onPress={() => router.push("/(drawer)/(tabs)/seekho" as any)}
              >
                <Text style={S.continueBtnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* ── Section 5: Revision Due ── */}
        {!loading && data && data.revisionDueCount > 0 && (
          <>
            <View style={S.sectionHeader}>
              <Text style={[S.sectionTitle, { color: textMain }]}>🔁 Revise Today</Text>
              <View style={S.countBadge}>
                <Text style={S.countBadgeText}>{data.revisionDueCount}</Text>
              </View>
            </View>
            <View style={S.revisionTags}>
              {data.revisionItems.map((item) => (
                <View key={item.docId} style={S.revisionTag}>
                  <Text style={S.revisionTagText}>{item.conceptTag}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={S.startRevisionBtn}
              onPress={() => router.push("/(drawer)/(tabs)/seekho" as any)}
            >
              <Text style={S.startRevisionText}>Start Revision →</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Section 6: Recent AI Lessons ── */}
        <View style={S.sectionHeader}>
          <Text style={[S.sectionTitle, { color: textMain }]}>🎓 Recent AI Lessons</Text>
          <TouchableOpacity onPress={() => router.push("/ai-guru/my-lessons" as any)}>
            <Text style={S.viewAll}>View All →</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          [0, 1, 2].map((i) => <PulseSkeleton key={i} height={68} bgColor={skeletonBg} />)
        ) : !data || data.recentLessons.length === 0 ? (
          <View style={[S.emptyCard, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
            <Text style={[S.emptyText, { color: textDim }]}>No lessons yet. Generate your first lesson!</Text>
            <TouchableOpacity style={S.emptyBtn} onPress={() => router.push("/ai-guru/setup" as any)}>
              <Text style={S.emptyBtnText}>Generate Lesson →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          data.recentLessons.map((lesson) => (
            <View key={lesson.lessonId} style={[S.lessonRow, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
              <Text style={S.lessonEmoji}>{lesson.emoji}</Text>
              <View style={S.lessonInfo}>
                <Text style={[S.lessonChapter, { color: textMain }]} numberOfLines={1}>{lesson.chapter}</Text>
                <Text style={[S.lessonSubject, { color: textDim }]}>{lesson.subject}</Text>
              </View>
              <View style={[
                S.lessonStatus,
                { backgroundColor: lesson.status === "completed" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)" },
              ]}>
                <Text style={[
                  S.lessonStatusText,
                  { color: lesson.status === "completed" ? "#10b981" : "#f59e0b" },
                ]}>
                  {lesson.status === "completed" ? "Done" : "In Progress"}
                </Text>
              </View>
              <TouchableOpacity
                style={S.continueBtn}
                onPress={() => router.push(
                  (lesson.status === "completed" ? `/ai-guru/result` : `/ai-guru/player`) as any
                )}
              >
                <Text style={S.continueBtnText}>
                  {lesson.status === "completed" ? "Review" : "Resume"}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* ── Section 7: Quick Actions ── */}
        <Text style={[S.sectionTitle, { color: textMain }]}>⚡ Quick Actions</Text>
        <View style={S.actionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={S.actionTile}
              activeOpacity={0.82}
              onPress={() => router.push(action.route as any)}
            >
              <LinearGradient colors={action.gradient} style={S.actionGradient}>
                <Text style={S.actionEmoji}>{action.emoji}</Text>
                <Text style={S.actionLabel}>{action.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Section 8: Recent Activity ── */}
        <Text style={[S.sectionTitle, { color: textMain }]}>🪙 Recent Activity</Text>
        {loading ? (
          [0, 1, 2].map((i) => <PulseSkeleton key={i} height={52} bgColor={skeletonBg} />)
        ) : !data || data.recentActivities.length === 0 ? (
          <View style={[S.emptyCard, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
            <Text style={[S.emptyText, { color: textDim }]}>No activity yet.</Text>
          </View>
        ) : (
          data.recentActivities.map((act) => (
            <View key={act.id} style={[S.activityRow, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
              <Text style={S.activityEmoji}>
                {ACTIVITY_EMOJI[act.activityId] ?? "🪙"}
              </Text>
              <View style={S.activityInfo}>
                <Text style={[S.activityLabel, { color: textMain }]}>{snakeToTitle(act.activityId)}</Text>
                <Text style={[S.activityTime, { color: textDim }]}>{relativeTime(act.createdAt)}</Text>
              </View>
              <Text style={[
                S.activityAmount,
                { color: act.type === "CREDIT" ? "#10b981" : "#ef4444" },
              ]}>
                {act.type === "CREDIT" ? "+" : "-"}{act.amount} 🪙
              </Text>
            </View>
          ))
        )}

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  bg:     { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },

  // Header
  header:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  backBtn:         { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  headerTitle:     { flex: 1, fontSize: 18, fontWeight: "900" },
  headerBadge:     { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(251,191,36,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: "#fbbf24" },
  headerBadgeText: { color: "#fbbf24", fontSize: 11, fontWeight: "900" },

  // Hero (branded gradient — keeps hardcoded colors)
  heroCard:     { borderRadius: 20, padding: 20, marginBottom: 20, overflow: "hidden", elevation: 6, shadowColor: "#6366f1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  heroOrb:      { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(99,102,241,0.18)", top: -60, right: -40 },
  heroGreeting: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600" },
  heroName:     { color: "#f1f5f9", fontSize: 26, fontWeight: "900", marginTop: 4, marginBottom: 12 },
  heroMeta:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroBadge:    { backgroundColor: "rgba(99,102,241,0.3)", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  heroBadgeText:{ color: "#a5b4fc", fontSize: 12, fontWeight: "700" },
  heroDate:     { color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: "600" },

  // Section headers
  sectionTitle:  { fontSize: 16, fontWeight: "800", marginTop: 20, marginBottom: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20, marginBottom: 10 },
  viewAll:       { color: "#6366f1", fontSize: 13, fontWeight: "700" },

  // Usage stats
  usageRow:       { flexDirection: "row", gap: 10, marginBottom: 4 },
  usageTile:      { flex: 1, borderRadius: 16, padding: 12, alignItems: "center", gap: 4, borderWidth: 1 },
  usageTileIcon:  { fontSize: 22 },
  usageTileValue: { fontSize: 20, fontWeight: "900" },
  usageTileMax:   { fontSize: 12, fontWeight: "600" },
  usageTileLabel: { fontSize: 10, fontWeight: "600" },
  usageDots:      { flexDirection: "row", gap: 4, marginTop: 2 },
  usageDot:       { width: 10, height: 10, borderRadius: 5 },
  usageDotActive: { backgroundColor: "#6366f1" },

  // AI Insight
  insightCard:   { flexDirection: "row", borderRadius: 16, padding: 16, marginBottom: 4, borderWidth: 1, gap: 12 },
  insightAccent: { width: 4, borderRadius: 2, backgroundColor: "#6366f1", flexShrink: 0 },
  insightBody:   { flex: 1, gap: 8 },
  insightText:   { fontSize: 14, lineHeight: 22, fontWeight: "500" },
  insightFooter: { fontSize: 11, fontWeight: "500" },

  // Revision badge
  revisionBadge:     { backgroundColor: "rgba(245,158,11,0.12)", borderWidth: 1, borderColor: "rgba(245,158,11,0.35)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10 },
  revisionBadgeText: { color: "#f59e0b", fontSize: 12, fontWeight: "700" },

  // Study plan rows
  studyRow:        { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 12, marginBottom: 8, gap: 10, borderWidth: 1 },
  studyAvatar:     { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  studyAvatarText: { color: "#fff", fontSize: 18, fontWeight: "900" },
  studyInfo:       { flex: 1, gap: 3 },
  studyChapter:    { fontSize: 13, fontWeight: "800" },
  studySubject:    { fontSize: 11, fontWeight: "600" },
  progressTrack:   { height: 4, borderRadius: 2, marginTop: 4, overflow: "hidden" },
  progressFill:    { height: 4, backgroundColor: "#6366f1", borderRadius: 2 },
  continueBtn:     { backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#6366f1" },
  continueBtnText: { color: "#a5b4fc", fontSize: 11, fontWeight: "700" },

  // Empty states
  emptyCard:    { borderRadius: 14, padding: 20, alignItems: "center", gap: 10, marginBottom: 8, borderWidth: 1 },
  emptyText:    { fontSize: 13, textAlign: "center" },
  emptyBtn:     { backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: "#6366f1" },
  emptyBtnText: { color: "#a5b4fc", fontSize: 13, fontWeight: "700" },

  // Revision due
  revisionTags:      { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  revisionTag:       { backgroundColor: "rgba(239,68,68,0.12)", borderWidth: 1, borderColor: "rgba(239,68,68,0.3)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  revisionTagText:   { color: "#ef4444", fontSize: 12, fontWeight: "700" },
  startRevisionBtn:  { backgroundColor: "rgba(239,68,68,0.15)", borderWidth: 1, borderColor: "rgba(239,68,68,0.35)", borderRadius: 12, paddingVertical: 12, alignItems: "center", marginBottom: 4 },
  startRevisionText: { color: "#f87171", fontSize: 14, fontWeight: "800" },
  countBadge:        { backgroundColor: "#ef4444", width: 22, height: 22, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  countBadgeText:    { color: "#fff", fontSize: 11, fontWeight: "900" },

  // Recent lessons
  lessonRow:        { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 12, marginBottom: 8, gap: 10, borderWidth: 1 },
  lessonEmoji:      { fontSize: 28, width: 36, textAlign: "center" },
  lessonInfo:       { flex: 1, gap: 3 },
  lessonChapter:    { fontSize: 13, fontWeight: "800" },
  lessonSubject:    { fontSize: 11, fontWeight: "600" },
  lessonStatus:     { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  lessonStatusText: { fontSize: 10, fontWeight: "700" },

  // Quick actions grid
  actionsGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 4 },
  actionTile:     { width: "47.5%" },
  actionGradient: { height: 88, borderRadius: 18, justifyContent: "center", alignItems: "center", gap: 6 },
  actionEmoji:    { fontSize: 28 },
  actionLabel:    { color: "#f1f5f9", fontSize: 12, fontWeight: "800", textAlign: "center" },

  // Recent activity
  activityRow:    { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 12, marginBottom: 8, gap: 10, borderWidth: 1 },
  activityEmoji:  { fontSize: 22, width: 32, textAlign: "center" },
  activityInfo:   { flex: 1 },
  activityLabel:  { fontSize: 13, fontWeight: "700" },
  activityTime:   { fontSize: 11, fontWeight: "500", marginTop: 2 },
  activityAmount: { fontSize: 13, fontWeight: "800" },
});

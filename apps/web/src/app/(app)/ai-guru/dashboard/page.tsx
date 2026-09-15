"use client";
// PATH: apps/web/src/app/(app)/ai-guru/dashboard/page.tsx
// AI Dashboard — mirror of mobile app/ai-guru/dashboard.tsx
// Hero greeting, today's AI usage, AI study tip, today's study plan,
// revision due, recent AI lessons, quick actions, recent activity.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStudentProfile } from "@gloows/shared-logic";
import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { FREE_DAILY_LESSONS, FREE_DAILY_FOLLOWUPS } from "@/lib/aiGuru/constants";
import { fetchPersonalizedDashboard, type DashboardResponse } from "@/services/dashboardApi";

const ACTIVITY_EMOJI: Record<string, string> = {
  daily_login: "🔑", lesson_complete: "📚", quiz_pass: "✅", chapter_complete: "🏆",
  video_watch: "▶️", post_like: "❤️", story_view: "👁️", profile_complete: "🎉",
  first_post: "🌟", referral: "🤝",
};

const SUBJECT_COLORS: [string, string][] = [
  ["#4f46e5", "#7c3aed"], ["#0369a1", "#0ea5e9"], ["#064e3b", "#059669"],
  ["#b45309", "#f97316"], ["#be185d", "#ec4899"], ["#1e40af", "#3b82f6"],
];

function subjectGradient(subject: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  return SUBJECT_COLORS[hash % SUBJECT_COLORS.length];
}

function getGreeting(t: (k: string, f?: string) => string): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return t("goodMorning", "Good Morning");
  if (h >= 12 && h < 17) return t("goodAfternoon", "Good Afternoon");
  if (h >= 17 && h < 21) return t("goodEvening", "Good Evening");
  return t("goodNight", "Good Night");
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function relativeTime(ms: number): string {
  const diffS = Math.floor((Date.now() - ms) / 1000);
  if (diffS < 60) return "Just now";
  if (diffS < 3600) return `${Math.floor(diffS / 60)}m ago`;
  if (diffS < 86400) return `${Math.floor(diffS / 3600)}h ago`;
  return "Yesterday";
}

function snakeToTitle(s: string): string {
  return s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function Skeleton({ height = 60, radius = 14, bg = "#1e293b" }: { height?: number; radius?: number; bg?: string }) {
  return (
    <div style={{
      height, borderRadius: radius, background: bg, marginBottom: 10,
      animation: "agpulse 1.4s ease-in-out infinite",
    }} />
  );
}

const QUICK_ACTIONS = [
  { emoji: "🎯", labelKey: "menuSkillGuruCard",  label: "Ask SkillGuru",   gradient: "linear-gradient(135deg,#1e1b4b,#6366f1)", route: "/ai-guru/skillguru" },
  { emoji: "✨", labelKey: "menuGenerateLesson",  label: "Generate Lesson",gradient: "linear-gradient(135deg,#312e81,#4f46e5)", route: "/ai-guru/setup" },
  { emoji: "🧭", labelKey: "menuDiscoverAI",      label: "Discover AI",    gradient: "linear-gradient(135deg,#064e3b,#059669)", route: "/discover" },
  { emoji: "📚", labelKey: "menuMyLessons",       label: "My Lessons",     gradient: "linear-gradient(135deg,#1e3a5f,#0284c7)", route: "/ai-guru/my-lessons" },
];

export default function AiDashboardPage() {
  const router = useRouter();
  const { t } = useAppTranslation();
  const { studentProfile } = useStudentProfile();
  const { colors, isDarkMode } = useTheme();

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const studentName = studentProfile?.name?.split(" ")[0] ?? t("student", "Student");

  // Page chrome — section headers, plain info/list cards, skeleton
  // loaders — follows the theme. The hero greeting banner and Quick
  // Actions tiles keep their own fixed colorful gradients in both
  // themes, same as the hub's feature cards — intentional, not a gap.
  const cardBg     = isDarkMode ? "#1e293b" : colors.card;
  const cardBorder = isDarkMode ? "#334155" : colors.border;
  const textPrimary = colors.text;
  const textMuted   = colors.textSecondary;
  const trackBg     = isDarkMode ? "#334155" : colors.border;

  useEffect(() => {
    if (!studentProfile) return;
    (async () => {
      try {
        const result = await fetchPersonalizedDashboard({
          studentName: studentProfile.name ?? "Student",
          classLevel: studentProfile.class ?? "10",
          board: studentProfile.board ?? "CBSE",
          interests: studentProfile.interests ?? [],
          language: studentProfile.preferredLanguage ?? "English",
          learnScore: studentProfile.learnScore ?? 0,
        });
        setData(result);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [studentProfile]);

  const usageTiles = [
    { icon: "✨", label: t("usageLessons", "Lessons"), used: data?.usageToday.lessonsGenerated ?? 0, max: FREE_DAILY_LESSONS },
    { icon: "💬", label: t("usageFollowUps", "Follow-ups"), used: data?.usageToday.followUps ?? 0, max: FREE_DAILY_FOLLOWUPS },
    { icon: "🤖", label: t("usageSkillGuru", "SkillGuru"), used: data?.usageToday.vidyaGuruChats ?? 0, max: 1 },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: isDarkMode ? "linear-gradient(180deg,#0a0a1a,#0f172a)" : colors.background, paddingBottom: 40 }}>
      <style>{`@keyframes agpulse{0%,100%{opacity:.35}50%{opacity:1}} .ag-link{cursor:pointer;text-decoration:none}.ag-link:hover{opacity:.85}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "14px 16px 8px", gap: 12, position: "sticky", top: 0, zIndex: 10, background: isDarkMode ? "rgba(10,10,26,0.92)" : "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)" }}>
        <Link href="/ai-guru" className="ag-link" style={{ width: 40, height: 40, borderRadius: 12, background: isDarkMode ? "rgba(255,255,255,0.08)" : colors.card, display: "flex", alignItems: "center", justifyContent: "center", color: textMuted, fontSize: 20, fontWeight: 900 }}>‹</Link>
        <span style={{ flex: 1, color: textPrimary, fontSize: 18, fontWeight: 900 }}>{t("aiDashboardTitle", "AI Dashboard")}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(251,191,36,0.15)", border: "1px solid #fbbf24", borderRadius: 10, padding: "4px 10px" }}>
          <span style={{ fontSize: 12 }}>✨</span>
          <span style={{ color: "#fbbf24", fontSize: 11, fontWeight: 900 }}>AI</span>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "8px 16px" }}>

        {/* ── 1. Hero greeting ── */}
        <div style={{ borderRadius: 20, padding: 20, marginBottom: 20, position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#1e1b4b,#312e81)", boxShadow: "0 4px 10px rgba(99,102,241,0.3)" }}>
          <div style={{ position: "absolute", width: 180, height: 180, borderRadius: "50%", background: "rgba(99,102,241,0.18)", top: -60, right: -40 }} />
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 600 }}>{getGreeting(t)} 👋</div>
          <div style={{ color: "#f1f5f9", fontSize: 26, fontWeight: 900, marginTop: 4, marginBottom: 12 }}>{studentProfile?.name ?? t("student", "Student")}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ background: "rgba(99,102,241,0.3)", padding: "4px 12px", borderRadius: 20 }}>
              <span style={{ color: "#a5b4fc", fontSize: 12, fontWeight: 700 }}>
                {t("classLabel", "Class")} {studentProfile?.class ?? "—"} · {studentProfile?.board ?? "CBSE"}
              </span>
            </div>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600 }}>{formatDate()}</span>
          </div>
        </div>

        {/* ── 2. Today's AI usage ── */}
        <div style={{ color: textPrimary, fontSize: 16, fontWeight: 800, margin: "20px 0 10px" }}>📊 {t("todaysAiUsage", "Today's AI Usage")}</div>
        {loading ? (
          <div style={{ display: "flex", gap: 10 }}>{[0, 1, 2].map((i) => <div key={i} style={{ flex: 1 }}><Skeleton height={80} bg={cardBg} /></div>)}</div>
        ) : (
          <div style={{ display: "flex", gap: 10, marginBottom: 4 }}>
            {usageTiles.map((tile) => (
              <div key={tile.label} style={{ flex: 1, borderRadius: 16, padding: 12, textAlign: "center", border: `1px solid ${cardBorder}`, background: cardBg }}>
                <div style={{ fontSize: 22 }}>{tile.icon}</div>
                <div style={{ color: textPrimary, fontSize: 20, fontWeight: 900 }}>{tile.used}<span style={{ color: textMuted, fontSize: 12 }}>/{tile.max}</span></div>
                <div style={{ color: textMuted, fontSize: 10, fontWeight: 600 }}>{tile.label}</div>
                <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 6 }}>
                  {Array.from({ length: tile.max }).map((_, i) => (
                    <div key={i} style={{ width: 10, height: 10, borderRadius: 5, background: i < tile.used ? "#6366f1" : trackBg }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 3. AI daily study tip ── */}
        <div style={{ color: textPrimary, fontSize: 16, fontWeight: 800, margin: "20px 0 10px" }}>✨ {t("aiStudyTip", "Your AI Study Tip")}</div>
        {loading ? <Skeleton height={100} bg={cardBg} /> : (
          <div style={{ display: "flex", gap: 12, borderRadius: 16, padding: 16, border: `1px solid ${cardBorder}`, background: cardBg }}>
            <div style={{ width: 4, borderRadius: 2, background: "#6366f1", flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ color: textPrimary, fontSize: 14, lineHeight: 1.55, fontWeight: 500 }}>
                {error ? t("aiTipFallback", `Keep learning every day, ${studentName}! Consistency is the key to success.`, { name: studentName }) : data?.aiInsight ?? t("aiTipDefault", "Stay consistent — every day of learning counts!")}
              </div>
              <div style={{ color: textMuted, fontSize: 11, fontWeight: 500 }}>{t("updatesEvery4h", "Updates every 4 hours · Powered by Gemini")}</div>
            </div>
          </div>
        )}

        {/* ── 4. Today's study plan ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "20px 0 10px" }}>
          <span style={{ color: textPrimary, fontSize: 16, fontWeight: 800 }}>📚 {t("todaysStudyPlan", "Today's Study Plan")}</span>
          <Link href="/seekho" className="ag-link" style={{ color: colors.accent, fontSize: 13, fontWeight: 700 }}>{t("viewAll", "View All →")}</Link>
        </div>
        {data && data.revisionDueCount > 0 && (
          <div style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 10, padding: "6px 12px", marginBottom: 10 }}>
            <span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 700 }}>⚠️ {t("revisionDue", `Revision Due: ${data.revisionDueCount} concepts`, { count: data.revisionDueCount })}</span>
          </div>
        )}
        {loading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} height={72} bg={cardBg} />)
        ) : !data || data.studyPlan.length === 0 ? (
          <div style={{ borderRadius: 14, padding: 20, textAlign: "center", border: `1px solid ${cardBorder}`, background: cardBg, marginBottom: 8 }}>
            <div style={{ color: textMuted, fontSize: 13, marginBottom: 10 }}>{t("noCoursesYet", "No courses yet — explore Seekho!")}</div>
            <Link href="/seekho" className="ag-link" style={{ background: "rgba(99,102,241,0.2)", border: "1px solid #6366f1", borderRadius: 10, padding: "8px 16px", color: "#a5b4fc", fontSize: 13, fontWeight: 700, display: "inline-block" }}>{t("exploreSeekho", "Explore Seekho →")}</Link>
          </div>
        ) : (
          data.studyPlan.map((item) => {
            const [g0, g1] = subjectGradient(item.subject);
            return (
              <div key={item.courseId} style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 14, padding: 12, marginBottom: 8, border: `1px solid ${cardBorder}`, background: cardBg }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, background: `linear-gradient(135deg,${g0},${g1})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "#fff", fontSize: 18, fontWeight: 900 }}>{item.subject.charAt(0).toUpperCase()}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: textPrimary, fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.chapterTitle}</div>
                  <div style={{ color: textMuted, fontSize: 11, fontWeight: 600 }}>{item.subject}</div>
                  <div style={{ height: 4, borderRadius: 2, background: trackBg, marginTop: 4, overflow: "hidden" }}>
                    <div style={{ width: `${item.percentComplete}%`, height: "100%", background: "#6366f1", borderRadius: 2 }} />
                  </div>
                </div>
                <Link href="/seekho" className="ag-link" style={{ background: "rgba(99,102,241,0.2)", border: "1px solid #6366f1", borderRadius: 10, padding: "6px 10px", color: "#a5b4fc", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{t("continueBtn2", "Continue")}</Link>
              </div>
            );
          })
        )}

        {/* ── 5. Revision due ── */}
        {!loading && data && data.revisionDueCount > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "20px 0 10px" }}>
              <span style={{ color: textPrimary, fontSize: 16, fontWeight: 800 }}>🔁 {t("reviseToday", "Revise Today")}</span>
              <div style={{ background: "#ef4444", width: 22, height: 22, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>{data.revisionDueCount}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {data.revisionItems.map((item) => (
                <div key={item.docId} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", padding: "6px 12px", borderRadius: 20 }}>
                  <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 700 }}>{item.conceptTag}</span>
                </div>
              ))}
            </div>
            <Link href="/seekho" className="ag-link" style={{ display: "block", textAlign: "center", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 12, padding: "12px 0", marginBottom: 4 }}>
              <span style={{ color: "#f87171", fontSize: 14, fontWeight: 800 }}>{t("startRevision", "Start Revision →")}</span>
            </Link>
          </>
        )}

        {/* ── 6. Recent AI lessons ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "20px 0 10px" }}>
          <span style={{ color: textPrimary, fontSize: 16, fontWeight: 800 }}>🎓 {t("recentAiLessons", "Recent AI Lessons")}</span>
          <Link href="/ai-guru/my-lessons" className="ag-link" style={{ color: colors.accent, fontSize: 13, fontWeight: 700 }}>{t("viewAll", "View All →")}</Link>
        </div>
        {loading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} height={68} bg={cardBg} />)
        ) : !data || data.recentLessons.length === 0 ? (
          <div style={{ borderRadius: 14, padding: 20, textAlign: "center", border: `1px solid ${cardBorder}`, background: cardBg, marginBottom: 8 }}>
            <div style={{ color: textMuted, fontSize: 13, marginBottom: 10 }}>{t("noLessonsYetGenerate", "No lessons yet. Generate your first lesson!")}</div>
            <Link href="/ai-guru/setup" className="ag-link" style={{ background: "rgba(99,102,241,0.2)", border: "1px solid #6366f1", borderRadius: 10, padding: "8px 16px", color: "#a5b4fc", fontSize: 13, fontWeight: 700, display: "inline-block" }}>{t("generateLessonArrow", "Generate Lesson →")}</Link>
          </div>
        ) : (
          data.recentLessons.map((lesson) => {
            const completed = lesson.status === "completed";
            return (
              <Link key={lesson.lessonId} href={completed ? `/ai-guru/player?lessonId=${lesson.lessonId}` : `/ai-guru/player?lessonId=${lesson.lessonId}`} className="ag-link"
                style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 14, padding: 12, marginBottom: 8, border: `1px solid ${cardBorder}`, background: cardBg }}>
                <span style={{ fontSize: 28, width: 36, textAlign: "center", flexShrink: 0 }}>{lesson.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: textPrimary, fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lesson.chapter}</div>
                  <div style={{ color: textMuted, fontSize: 11, fontWeight: 600 }}>{lesson.subject}</div>
                </div>
                <div style={{ padding: "4px 8px", borderRadius: 8, background: completed ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)", flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: completed ? "#10b981" : "#f59e0b" }}>
                    {completed ? t("doneLabel", "Done") : t("inProgressLabel", "In Progress")}
                  </span>
                </div>
              </Link>
            );
          })
        )}

        {/* ── 7. Quick actions ── */}
        <div style={{ color: textPrimary, fontSize: 16, fontWeight: 800, margin: "20px 0 10px" }}>⚡ {t("quickActions", "Quick Actions")}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.label} href={action.route} className="ag-link" style={{ width: "calc(50% - 6px)" }}>
              <div style={{ height: 88, borderRadius: 18, background: action.gradient, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <span style={{ fontSize: 28 }}>{action.emoji}</span>
                <span style={{ color: "#f1f5f9", fontSize: 12, fontWeight: 800, textAlign: "center" }}>{t(action.labelKey, action.label)}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* ── 8. Recent activity ── */}
        <div style={{ color: textPrimary, fontSize: 16, fontWeight: 800, margin: "20px 0 10px" }}>🪙 {t("recentActivity", "Recent Activity")}</div>
        {loading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} height={52} bg={cardBg} />)
        ) : !data || data.recentActivities.length === 0 ? (
          <div style={{ borderRadius: 14, padding: 20, textAlign: "center", border: `1px solid ${cardBorder}`, background: cardBg }}>
            <span style={{ color: textMuted, fontSize: 13 }}>{t("noActivityYet", "No activity yet.")}</span>
          </div>
        ) : (
          data.recentActivities.map((act) => (
            <div key={act.id} style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 14, padding: 12, marginBottom: 8, border: `1px solid ${cardBorder}`, background: cardBg }}>
              <span style={{ fontSize: 22, width: 32, textAlign: "center" }}>{ACTIVITY_EMOJI[act.activityId] ?? "🪙"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: textPrimary, fontSize: 13, fontWeight: 700 }}>{snakeToTitle(act.activityId)}</div>
                <div style={{ color: textMuted, fontSize: 11, fontWeight: 500, marginTop: 2 }}>{relativeTime(act.createdAt)}</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: act.type === "CREDIT" ? "#10b981" : "#ef4444" }}>
                {act.type === "CREDIT" ? "+" : "-"}{act.amount} 🪙
              </span>
            </div>
          ))
        )}

        <div style={{ height: 32 }} />
      </div>
    </div>
  );
}

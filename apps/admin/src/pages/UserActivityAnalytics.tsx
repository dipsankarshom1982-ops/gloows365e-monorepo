// PATH: apps/admin/src/pages/UserActivityAnalytics.tsx
//
// Analytics dashboard: User Activity, Watch Time, Retention
//
// Data sources (all existing Firestore collections — nothing new):
//   students          → total users, DAU proxy (lastActive), signups over time
//   posts             → watchTime (seconds), views, likes, shares per reel/post
//   short_reels       → same schema as posts for short-form content
//   subscriptions     → retention proxy: active vs churned over time
//   seekho_subscriptions → same
//   vidyaGuruSessions/{uid}/sessions/{id} → AI tutor session durations
//   skillGuruSessions/{uid}/sessions/{id} → same pattern
//
// Retention is derived as:
//   cohort week of signup → % of that cohort still active (viewed/liked/posted)
//   in subsequent weeks — uses posts.createdAt as the activity signal.

import { useEffect, useMemo, useState } from "react";
import {
  collection, collectionGroup, getDocs, query,
  orderBy, limit, Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Cell, PieChart, Pie,
} from "recharts";
import KpiCard from "../components/KpiCard";
import ChartTooltip from "../components/ChartTooltip";

// ─── helpers ────────────────────────────────────────────────────────────────

function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return null;
}

function last(n: number, unit: "day" | "week"): string[] {
  const arr: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    if (unit === "day") {
      d.setDate(d.getDate() - i);
      arr.push(d.toISOString().slice(0, 10));
    } else {
      d.setDate(d.getDate() - i * 7);
      arr.push(isoWeek(d));
    }
  }
  return arr;
}

const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9", "#ec4899"];

// ─── types ──────────────────────────────────────────────────────────────────

interface DailyActivity { date: string; signups: number; active: number; }
interface WatchRow      { date: string; totalSecs: number; avgSecs: number; views: number; }
interface RetentionRow  { week: string; [cohort: string]: string | number; }
interface ModuleRow     { module: string; watchTimeMins: number; views: number; posts: number; }

// ─── component ──────────────────────────────────────────────────────────────

export default function UserActivityAnalytics() {
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<"activity" | "watchtime" | "retention">("activity");

  // KPIs
  const [totalUsers, setTotalUsers]         = useState(0);
  const [dauEst, setDauEst]                 = useState(0);
  const [avgWatchMins, setAvgWatchMins]     = useState(0);
  const [retentionWeek1, setRetentionWeek1] = useState(0);

  // Chart data
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [watchRows, setWatchRows]         = useState<WatchRow[]>([]);
  const [retentionRows, setRetentionRows] = useState<RetentionRow[]>([]);
  const [cohortKeys, setCohortKeys]       = useState<string[]>([]);
  const [moduleRows, setModuleRows]       = useState<ModuleRow[]>([]);
  const [topUsers, setTopUsers]           = useState<{ uid: string; name: string; watchMins: number; posts: number }[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // ── 1. Students ──────────────────────────────────────────────────
        const studSnap = await getDocs(collection(db, "students"));
        setTotalUsers(studSnap.size);

        // signup date → count
        const signupByDay: Record<string, number> = {};
        // uid → signup date (for cohort retention)
        const uidSignupWeek: Record<string, string> = {};
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        let dauCount = 0;
        studSnap.docs.forEach((d) => {
          const data = d.data();
          const ts = toDate(data.createdAt);
          if (ts) {
            const key = ts.toISOString().slice(0, 10);
            signupByDay[key] = (signupByDay[key] ?? 0) + 1;
            uidSignupWeek[d.id] = isoWeek(ts);
          }
          // DAU proxy: lastActive within 24h (if field exists, fall back to createdAt)
          const lastActiveTs = toDate(data.lastActive ?? data.createdAt);
          if (lastActiveTs && lastActiveTs > sevenDaysAgo) dauCount++;
        });
        setDauEst(dauCount);

        // ── 2. Content (posts + short_reels) ────────────────────────────
        const [postsSnap, reelsSnap] = await Promise.all([
          getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(2000))),
          getDocs(query(collection(db, "short_reels"), orderBy("createdAt", "desc"), limit(2000))),
        ]);

        type ContentItem = Record<string, unknown> & { id: string; _col: string };
        const allContent: ContentItem[] = [
          ...postsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>), _col: "posts" })),
          ...reelsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>), _col: "short_reels" })),
        ];

        // Watch time by day (last 30 days)
        const last30 = last(30, "day");
        const watchByDay: Record<string, { secs: number; views: number; count: number }> = {};
        last30.forEach((d) => { watchByDay[d] = { secs: 0, views: 0, count: 0 }; });

        // Module breakdown
        const moduleMap: Record<string, { watchTimeSecs: number; views: number; posts: number }> = {};

        // uid activity map for retention (uid → set of active weeks)
        const uidActiveWeeks: Record<string, Set<string>> = {};

        // Top users by watch time
        const uidWatchSecs: Record<string, number>  = {};
        const uidPosts:     Record<string, number>  = {};
        const uidName:      Record<string, string>  = {};

        allContent.forEach((item) => {
          const ts = toDate(item.createdAt);
          const wt = Number(item.watchTime ?? 0);
          const vi = Number(item.views ?? 0);
          const uid = String(item.userId ?? item.uid ?? "");
          const mod = String(item.module ?? item.postType ?? item._col ?? "unknown");

          // day-level watch
          if (ts) {
            const dk = ts.toISOString().slice(0, 10);
            if (watchByDay[dk]) {
              watchByDay[dk].secs  += wt;
              watchByDay[dk].views += vi;
              watchByDay[dk].count += 1;
            }
            // week-level activity per user
            if (uid) {
              const wk = isoWeek(ts);
              if (!uidActiveWeeks[uid]) uidActiveWeeks[uid] = new Set();
              uidActiveWeeks[uid].add(wk);
            }
          }

          // module
          if (!moduleMap[mod]) moduleMap[mod] = { watchTimeSecs: 0, views: 0, posts: 0 };
          moduleMap[mod].watchTimeSecs += wt;
          moduleMap[mod].views         += vi;
          moduleMap[mod].posts         += 1;

          // per-user
          if (uid) {
            uidWatchSecs[uid] = (uidWatchSecs[uid] ?? 0) + wt;
            uidPosts[uid]     = (uidPosts[uid] ?? 0) + 1;
            if (!uidName[uid] && item.userName) uidName[uid] = String(item.userName);
          }
        });

        // watch rows
        const wRows: WatchRow[] = last30.map((date) => {
          const b = watchByDay[date];
          return {
            date: date.slice(5),
            totalSecs: b.secs,
            avgSecs:   b.count > 0 ? Math.round(b.secs / b.count) : 0,
            views:     b.views,
          };
        });
        setWatchRows(wRows);

        const totalWatchMins = Object.values(watchByDay).reduce((s, b) => s + b.secs, 0) / 60;
        const totalViews     = Object.values(watchByDay).reduce((s, b) => s + b.views, 0);
        setAvgWatchMins(totalViews > 0 ? Math.round((totalWatchMins / totalViews) * 10) / 10 : 0);

        // module rows
        setModuleRows(
          Object.entries(moduleMap)
            .map(([module, v]) => ({
              module,
              watchTimeMins: Math.round(v.watchTimeSecs / 60),
              views:         v.views,
              posts:         v.posts,
            }))
            .sort((a, b) => b.watchTimeMins - a.watchTimeMins)
            .slice(0, 8)
        );

        // top users
        const topU = Object.entries(uidWatchSecs)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([uid, secs]) => ({
            uid,
            name:      uidName[uid] ?? uid.slice(0, 8) + "…",
            watchMins: Math.round(secs / 60),
            posts:     uidPosts[uid] ?? 0,
          }));
        setTopUsers(topU);

        // ── 3. Daily activity chart ──────────────────────────────────────
        const activeByDay: Record<string, number> = {};
        last30.forEach((d) => { activeByDay[d] = 0; });
        allContent.forEach((item) => {
          const ts = toDate(item.createdAt);
          if (ts) {
            const dk = ts.toISOString().slice(0, 10);
            if (activeByDay[dk] !== undefined) activeByDay[dk]++;
          }
        });
        setDailyActivity(last30.map((date) => ({
          date: date.slice(5),
          signups: signupByDay[date] ?? 0,
          active:  activeByDay[date] ?? 0,
        })));

        // ── 4. Retention (cohort by signup week, last 6 cohorts) ─────────
        const last6Weeks = last(6, "week");
        // cohort = first 3 weeks shown
        const cohorts = last6Weeks.slice(0, 4); // 4 cohorts
        const offsetWeeks = ["W+0", "W+1", "W+2", "W+3", "W+4"];

        // uid → cohort week map (from signups)
        const cohortUids: Record<string, string[]> = {};
        Object.entries(uidSignupWeek).forEach(([uid, wk]) => {
          if (cohorts.includes(wk)) {
            if (!cohortUids[wk]) cohortUids[wk] = [];
            cohortUids[wk].push(uid);
          }
        });

        // week index for each isoWeek string
        const weekIndex: Record<string, number> = {};
        last6Weeks.forEach((wk, i) => { weekIndex[wk] = i; });

        const retRows: RetentionRow[] = offsetWeeks.map((offset, offsetIdx) => {
          const row: RetentionRow = { week: offset };
          cohorts.forEach((cohortWk) => {
            const uids = cohortUids[cohortWk] ?? [];
            if (uids.length === 0) { row[cohortWk] = 0; return; }
            const targetWeekIdx = (weekIndex[cohortWk] ?? 0) + offsetIdx;
            const targetWk = last6Weeks[targetWeekIdx];
            if (!targetWk) { row[cohortWk] = 0; return; }
            const active = uids.filter((uid) => uidActiveWeeks[uid]?.has(targetWk)).length;
            row[cohortWk] = Math.round((active / uids.length) * 100);
          });
          return row;
        });
        setRetentionRows(retRows);
        setCohortKeys(cohorts);

        // Week-1 retention across all cohorts
        const w1Row = retRows[1]; // W+1
        const w1Vals = cohorts.map((c) => Number(w1Row?.[c] ?? 0)).filter(Boolean);
        setRetentionWeek1(w1Vals.length ? Math.round(w1Vals.reduce((a, b) => a + b, 0) / w1Vals.length) : 0);

      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tabs = [
    { key: "activity",  label: "👥 User Activity"  },
    { key: "watchtime", label: "⏱ Watch Time"      },
    { key: "retention", label: "📊 Retention"       },
  ] as const;

  const retentionColorScale = (pct: number) => {
    if (pct >= 60) return "bg-emerald-500/80 text-white";
    if (pct >= 40) return "bg-amber-500/80 text-white";
    if (pct >= 20) return "bg-orange-500/60 text-white";
    if (pct > 0)   return "bg-red-500/50 text-white";
    return "bg-slate-800 text-slate-500";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white">🎯 User Activity Analytics</h1>
        <p className="text-slate-400 text-sm mt-1">Activity, watch time, and cohort retention — last 30 days</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Users"         value={totalUsers}      icon="👥" color="bg-indigo-500/20 text-indigo-400" />
        <KpiCard label="Active (7d)"         value={dauEst}          icon="🔥" color="bg-emerald-500/20 text-emerald-400" />
        <KpiCard label="Avg Watch (min/view)" value={avgWatchMins}   icon="⏱" color="bg-amber-500/20 text-amber-400" suffix="m" />
        <KpiCard label="Week-1 Retention"    value={retentionWeek1}  icon="📈" color="bg-purple-500/20 text-purple-400" suffix="%" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-slate-800 pb-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-bold rounded-t-xl transition-colors border-b-2 -mb-px
              ${tab === t.key
                ? "border-indigo-500 text-white bg-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-slate-400 py-16 text-center flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-600 border-t-indigo-500 rounded-full animate-spin" />
          Loading analytics…
        </div>
      )}

      {/* ── USER ACTIVITY TAB ─────────────────────────────────────────── */}
      {!loading && tab === "activity" && (
        <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

          {/* Signups + active content creations */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-bold mb-1">Daily Signups vs Active Users</h2>
            <p className="text-slate-500 text-xs mb-4">Active = content created/posted that day</p>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={dailyActivity}>
                <defs>
                  <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradSignup" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} interval={6} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                <Area type="monotone" dataKey="active"  name="Active" stroke="#6366f1" fill="url(#gradActive)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="signups" name="Signups" stroke="#10b981" fill="url(#gradSignup)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Module breakdown bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-bold mb-1">Content Activity by Module</h2>
            <p className="text-slate-500 text-xs mb-4">Posts/reels published per module</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={moduleRows} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis dataKey="module" type="category" tick={{ fill: "#94a3b8", fontSize: 11 }} width={90} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="posts" name="Posts" radius={[0, 6, 6, 0]}>
                  {moduleRows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top users table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-white font-bold">Top Users by Watch Time</h2>
              <span className="text-slate-500 text-xs">Top 10 all-time</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                  <th className="text-left p-4">#</th>
                  <th className="text-left p-4">User</th>
                  <th className="text-right p-4">Watch (min)</th>
                  <th className="text-right p-4">Posts</th>
                </tr>
              </thead>
              <tbody>
                {topUsers.map((u, i) => (
                  <tr key={u.uid} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="p-4 text-slate-500 tabular-nums">{i + 1}</td>
                    <td className="p-4 text-white font-medium">{u.name}</td>
                    <td className="p-4 text-right tabular-nums text-amber-400">{u.watchMins.toLocaleString("en-IN")}</td>
                    <td className="p-4 text-right tabular-nums text-slate-300">{u.posts.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
                {topUsers.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-500">No content data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── WATCH TIME TAB ────────────────────────────────────────────── */}
      {!loading && tab === "watchtime" && (
        <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Total watch time per day */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-white font-bold mb-1">Total Watch Time</h2>
              <p className="text-slate-500 text-xs mb-4">Cumulative seconds across all content, per day</p>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={watchRows}>
                  <defs>
                    <linearGradient id="gradWT" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} interval={6} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="totalSecs" name="Total Secs" stroke="#f59e0b" fill="url(#gradWT)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Avg watch time per view */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-white font-bold mb-1">Avg Watch / View</h2>
              <p className="text-slate-500 text-xs mb-4">Seconds watched per individual view</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={watchRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} interval={6} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="avgSecs" name="Avg Secs/View" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Watch time vs views combined */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-bold mb-1">Watch Time vs Views</h2>
            <p className="text-slate-500 text-xs mb-4">Correlation between view count and total seconds watched per day</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={watchRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} interval={6} />
                <YAxis yAxisId="left"  tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                <Bar yAxisId="left"  dataKey="totalSecs" name="Watch (secs)" fill="#f59e0b" opacity={0.8} radius={[3,3,0,0]} />
                <Bar yAxisId="right" dataKey="views"     name="Views"        fill="#6366f1" opacity={0.8} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Module watch time breakdown */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-white font-bold mb-4">Watch Time by Module</h2>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={moduleRows} cx="50%" cy="50%" outerRadius={90} dataKey="watchTimeMins"
                    nameKey="module"
                    label={({ module, percent }: { module?: string; percent?: number }) =>
                      `${module ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {moduleRows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Module table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-sm h-full">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                    <th className="text-left p-4">Module</th>
                    <th className="text-right p-4">Watch (min)</th>
                    <th className="text-right p-4">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {moduleRows.map((row, i) => (
                    <tr key={row.module} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                          <span className="text-white font-medium capitalize">{row.module}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right tabular-nums text-amber-400">{row.watchTimeMins.toLocaleString("en-IN")}</td>
                      <td className="p-4 text-right tabular-nums text-slate-300">{row.views.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── RETENTION TAB ─────────────────────────────────────────────── */}
      {!loading && tab === "retention" && (
        <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

          {/* Explanation */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl">ℹ️</span>
              <div>
                <p className="text-white font-bold text-sm mb-1">How this is calculated</p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Each cohort = users who signed up in that ISO calendar week. Retention % = how many of those
                  users posted or created content in a subsequent week (W+1, W+2…).
                  Activity signal: content published to <code className="text-indigo-300">posts</code> or <code className="text-indigo-300">short_reels</code>.
                </p>
              </div>
            </div>
          </div>

          {/* Cohort heatmap table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
            <div className="p-4 border-b border-slate-800">
              <h2 className="text-white font-bold">Cohort Retention Heatmap</h2>
              <p className="text-slate-500 text-xs mt-0.5">% of cohort still active N weeks after signup</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                  <th className="text-left p-4 w-20">Week</th>
                  {cohortKeys.map((c) => (
                    <th key={c} className="text-center p-4 min-w-[100px]">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {retentionRows.map((row) => (
                  <tr key={row.week} className="border-b border-slate-800/50">
                    <td className="p-4 text-slate-300 font-bold">{row.week}</td>
                    {cohortKeys.map((c) => {
                      const pct = Number(row[c] ?? 0);
                      return (
                        <td key={c} className="p-2 text-center">
                          <span className={`inline-block px-3 py-1.5 rounded-lg text-xs font-bold tabular-nums ${retentionColorScale(pct)}`}>
                            {pct > 0 ? `${pct}%` : "—"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {retentionRows.length === 0 && (
                  <tr><td colSpan={cohortKeys.length + 1} className="p-8 text-center text-slate-500">Not enough data for cohort analysis yet</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Retention line chart */}
          {retentionRows.length > 0 && cohortKeys.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-white font-bold mb-4">Retention Curves by Cohort</h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={retentionRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="week" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} domain={[0, 100]} unit="%" />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                  {cohortKeys.map((c, i) => (
                    <Line
                      key={c}
                      type="monotone"
                      dataKey={c}
                      name={c}
                      stroke={PALETTE[i % PALETTE.length]}
                      strokeWidth={2}
                      dot={{ r: 4, fill: PALETTE[i % PALETTE.length] }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

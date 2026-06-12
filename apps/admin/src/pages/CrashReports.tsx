// PATH: admin-web/src/pages/CrashReports.tsx
// Shows all crash reports from the mobile app in real-time.
// Filter by type, platform, version. Mark as resolved. See full stack trace.

import {
  collection, doc, getDocs, orderBy,
  query, updateDoc, where, limit, startAfter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface CrashReport {
  id:           string;
  type:         "js_error" | "unhandled_rejection" | "manual" | "render_error";
  message:      string;
  stack?:       string;
  screen?:      string;
  uid?:         string;
  appVersion:   string;
  platform:     string;
  osVersion?:   string;
  deviceModel?: string;
  timestamp:    any;
  extra?:       Record<string, any>;
  resolved:     boolean;
}

const TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  js_error:            { label: "JS Error",           color: "text-red-400 bg-red-500/15 border-red-500/40",     icon: "💥" },
  unhandled_rejection: { label: "Promise Rejection",  color: "text-orange-400 bg-orange-500/15 border-orange-500/40", icon: "⚠️" },
  render_error:        { label: "Render Error",        color: "text-pink-400 bg-pink-500/15 border-pink-500/40",  icon: "🔴" },
  manual:              { label: "Manual Report",       color: "text-blue-400 bg-blue-500/15 border-blue-500/40",  icon: "📋" },
};

function relTime(ts: any): string {
  if (!ts) return "—";
  const ms  = ts?.toMillis?.() ?? (ts?.seconds ? ts.seconds * 1000 : 0);
  if (!ms)  return "—";
  const ago = Math.floor((Date.now() - ms) / 1000);
  if (ago < 60)    return `${ago}s ago`;
  if (ago < 3600)  return `${Math.floor(ago / 60)}m ago`;
  if (ago < 86400) return `${Math.floor(ago / 3600)}h ago`;
  return new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function CrashReports() {
  const [reports,    setReports]    = useState<CrashReport[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<CrashReport | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [filterPlat, setFilterPlat] = useState("all");
  const [filterVer,  setFilterVer]  = useState("all");
  const [showResolved, setShowResolved] = useState(false);
  const [lastDoc,    setLastDoc]    = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore,    setHasMore]    = useState(true);
  const PAGE = 50;

  const load = async (reset = false) => {
    setLoading(true);
    try {
      let q = query(
        collection(db, "crashReports"),
        orderBy("timestamp", "desc"),
        limit(PAGE)
      );
      if (!reset && lastDoc) q = query(q, startAfter(lastDoc));

      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CrashReport));
      setReports((prev) => reset ? data : [...prev, ...data]);
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE);
    } catch (e: any) {
      console.error("Load crash reports:", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(true); }, []);

  const resolve = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "crashReports", id), { resolved: !current });
    setReports((p) => p.map((r) => r.id === id ? { ...r, resolved: !current } : r));
    if (selected?.id === id) setSelected((s) => s ? { ...s, resolved: !current } : s);
  };

  const filtered = reports.filter((r) => {
    if (!showResolved && r.resolved) return false;
    if (filterType !== "all" && r.type !== filterType) return false;
    if (filterPlat !== "all" && r.platform !== filterPlat) return false;
    if (filterVer  !== "all" && r.appVersion !== filterVer) return false;
    return true;
  });

  const versions  = [...new Set(reports.map((r) => r.appVersion))].sort().reverse();
  const platforms = [...new Set(reports.map((r) => r.platform))];

  const stats = {
    total:      reports.length,
    unresolved: reports.filter((r) => !r.resolved).length,
    android:    reports.filter((r) => r.platform === "android").length,
    ios:        reports.filter((r) => r.platform === "ios").length,
    today:      reports.filter((r) => {
      const ms = r.timestamp?.toMillis?.() ?? (r.timestamp?.seconds ? r.timestamp.seconds * 1000 : 0);
      return ms > Date.now() - 86400_000;
    }).length,
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">🐛 Crash Reports</h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time JS errors and render crashes from the mobile app.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Total",     value: stats.total,      color: "text-slate-300", icon: "📊" },
          { label: "Unresolved",value: stats.unresolved, color: "text-red-400",   icon: "🔴" },
          { label: "Today",     value: stats.today,      color: "text-amber-400", icon: "📅" },
          { label: "Android",   value: stats.android,    color: "text-green-400", icon: "🤖" },
          { label: "iOS",       value: stats.ios,        color: "text-blue-400",  icon: "🍎" },
        ].map((s) => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{s.icon} {s.label}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm">
          <option value="all">All Types</option>
          {Object.entries(TYPE_META).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
        <select value={filterPlat} onChange={(e) => setFilterPlat(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm">
          <option value="all">All Platforms</option>
          {platforms.map((p) => <option key={p} value={p}>{p === "android" ? "🤖" : "🍎"} {p}</option>)}
        </select>
        <select value={filterVer} onChange={(e) => setFilterVer(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm">
          <option value="all">All Versions</option>
          {versions.map((v) => <option key={v} value={v}>v{v}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer ml-2">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)}
            className="accent-indigo-500 w-4 h-4" />
          Show resolved
        </label>
        <span className="text-slate-500 text-sm ml-auto">{filtered.length} report{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="flex gap-5">
        {/* Reports list */}
        <div className="flex-1 space-y-2 min-w-0">
          {loading && reports.length === 0 && (
            <div className="text-center py-20 text-slate-400">Loading crash reports…</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-20 space-y-2">
              <p className="text-4xl">✅</p>
              <p className="text-slate-300 font-bold">No crash reports</p>
              <p className="text-slate-500 text-sm">
                {showResolved ? "No reports match your filters." : "No unresolved crashes. Good job!"}
              </p>
            </div>
          )}

          {filtered.map((report) => {
            const meta    = TYPE_META[report.type] ?? TYPE_META.js_error;
            const isActive = selected?.id === report.id;
            return (
              <motion.div
                key={report.id}
                layout
                onClick={() => setSelected(isActive ? null : report)}
                className={`border rounded-xl p-4 cursor-pointer transition-all ${
                  isActive
                    ? "border-indigo-500/60 bg-indigo-500/5"
                    : report.resolved
                    ? "border-slate-800 bg-slate-900/40 opacity-50"
                    : "border-slate-700 bg-slate-900 hover:border-slate-600"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Type badge */}
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg border shrink-0 ${meta.color}`}>
                    {meta.icon} {meta.label}
                  </span>

                  <div className="flex-1 min-w-0">
                    {/* Message */}
                    <p className="text-white text-sm font-semibold truncate">{report.message}</p>
                    {/* Meta row */}
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-slate-500 text-xs">{relTime(report.timestamp)}</span>
                      <span className="text-slate-500 text-xs">
                        {report.platform === "android" ? "🤖" : "🍎"} {report.platform} {report.osVersion}
                      </span>
                      <span className="text-slate-500 text-xs">v{report.appVersion}</span>
                      {report.screen && (
                        <span className="text-slate-500 text-xs">📍 {report.screen}</span>
                      )}
                      {report.uid && (
                        <span className="text-slate-500 text-xs font-mono">👤 {report.uid.slice(0, 8)}…</span>
                      )}
                    </div>
                  </div>

                  {/* Resolve button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); resolve(report.id, report.resolved); }}
                    className={`shrink-0 text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${
                      report.resolved
                        ? "bg-slate-700 text-slate-400 hover:bg-slate-600"
                        : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40"
                    }`}
                  >
                    {report.resolved ? "✓ Resolved" : "Mark Resolved"}
                  </button>
                </div>
              </motion.div>
            );
          })}

          {hasMore && !loading && (
            <button
              onClick={() => load(false)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-bold transition-colors"
            >
              Load More
            </button>
          )}
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-96 shrink-0 bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4 self-start sticky top-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-white font-black text-base">🔍 Crash Detail</h3>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
              </div>

              {/* Type + status */}
              <div className="flex gap-2">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${TYPE_META[selected.type]?.color}`}>
                  {TYPE_META[selected.type]?.icon} {TYPE_META[selected.type]?.label}
                </span>
                <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${
                  selected.resolved
                    ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/40"
                    : "text-red-400 bg-red-500/15 border-red-500/40"
                }`}>
                  {selected.resolved ? "✅ Resolved" : "🔴 Unresolved"}
                </span>
              </div>

              {/* Error message */}
              <div>
                <p className="text-slate-400 text-xs font-bold mb-1 uppercase tracking-wide">Error Message</p>
                <p className="text-white text-sm bg-slate-800 rounded-lg p-3 font-mono break-words">
                  {selected.message}
                </p>
              </div>

              {/* Device info */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: "Platform",  value: `${selected.platform === "android" ? "🤖" : "🍎"} ${selected.platform}` },
                  { label: "OS",        value: selected.osVersion ?? "—" },
                  { label: "App Ver",   value: `v${selected.appVersion}` },
                  { label: "Device",    value: selected.deviceModel ?? "—" },
                  { label: "Screen",    value: selected.screen ?? "—" },
                  { label: "Time",      value: relTime(selected.timestamp) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-800 rounded-lg p-2">
                    <p className="text-slate-500 text-[10px] mb-0.5">{label}</p>
                    <p className="text-slate-300 font-medium truncate">{value}</p>
                  </div>
                ))}
              </div>

              {/* User ID */}
              {selected.uid && (
                <div>
                  <p className="text-slate-400 text-xs font-bold mb-1 uppercase tracking-wide">User ID</p>
                  <p className="text-slate-300 text-xs font-mono bg-slate-800 rounded-lg p-2 break-all">
                    {selected.uid}
                  </p>
                </div>
              )}

              {/* Stack trace */}
              {selected.stack && (
                <div>
                  <p className="text-slate-400 text-xs font-bold mb-1 uppercase tracking-wide">Stack Trace</p>
                  <pre className="text-slate-400 text-[10px] bg-slate-800 rounded-lg p-3 overflow-auto max-h-64 font-mono whitespace-pre-wrap break-all">
                    {selected.stack}
                  </pre>
                </div>
              )}

              {/* Extra data */}
              {selected.extra && Object.keys(selected.extra).length > 0 && (
                <div>
                  <p className="text-slate-400 text-xs font-bold mb-1 uppercase tracking-wide">Extra Data</p>
                  <pre className="text-slate-400 text-[10px] bg-slate-800 rounded-lg p-3 overflow-auto max-h-32 font-mono">
                    {JSON.stringify(selected.extra, null, 2)}
                  </pre>
                </div>
              )}

              {/* Actions */}
              <button
                onClick={() => resolve(selected.id, selected.resolved)}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-colors ${
                  selected.resolved
                    ? "bg-slate-800 hover:bg-slate-700 text-slate-300"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                {selected.resolved ? "Mark Unresolved" : "✅ Mark as Resolved"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

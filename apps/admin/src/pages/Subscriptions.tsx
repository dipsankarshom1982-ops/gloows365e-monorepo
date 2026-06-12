import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import KpiCard from "../components/KpiCard";
import StatusBadge from "../components/StatusBadge";

interface Sub {
  id: string;
  userId?: string;
  userName?: string;
  planName?: string;
  planId?: string;
  amount?: number;
  status?: string;
  startDate?: { toDate?: () => Date } | string;
  expiresAt?: { toDate?: () => Date } | string;
  channel?: string;
  source: "main" | "seekho";
}

function toDate(v?: Sub["startDate"]): Date | null {
  if (!v) return null;
  if (typeof v === "string") return new Date(v);
  if (v.toDate) return v.toDate();
  return null;
}

export default function Subscriptions() {
  const [subs, setSubs]       = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, "subscriptions")),
      getDocs(collection(db, "seekho_subscriptions")),
    ]).then(([mainSnap, seekhoSnap]) => {
      const all: Sub[] = [
        ...mainSnap.docs.map((d) => ({ id: d.id, source: "main" as const, ...d.data() })),
        ...seekhoSnap.docs.map((d) => ({ id: d.id, source: "seekho" as const, ...d.data() })),
      ];
      setSubs(all);
      setLoading(false);
    });
  }, []);

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear  = now.getFullYear();

  const active   = subs.filter((s) => s.status === "active");
  const newMonth = subs.filter((s) => {
    const d = toDate(s.startDate);
    return d && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const totalRevenue = subs.reduce((sum, s) => sum + (s.amount ?? 0), 0);

  const filtered = subs.filter((s) => {
    const q = search.toLowerCase();
    return !q || (s.userName ?? "").toLowerCase().includes(q) || (s.userId ?? "").includes(q) || (s.planName ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">💰 Subscriptions</h1>
        <p className="text-slate-400 text-sm mt-1">All plan subscriptions across the platform</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Active Subscriptions" value={active.length}   icon="✅" color="bg-green-500/20 text-green-400" />
        <KpiCard label="New This Month"        value={newMonth.length} icon="📈" color="bg-indigo-500/20 text-indigo-400" />
        <KpiCard label="Total Revenue (₹)"      value={totalRevenue}    icon="💰" color="bg-amber-500/20 text-amber-400" />
        <KpiCard label="Total Subscriptions"   value={subs.length}     icon="📋" color="bg-purple-500/20 text-purple-400" />
      </div>

      <div className="flex gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm flex-1 focus:outline-none focus:border-indigo-500"
          placeholder="Search by user or plan…"
        />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                <th className="text-left p-4">User</th>
                <th className="text-left p-4">Plan</th>
                <th className="text-left p-4">Source</th>
                <th className="text-right p-4">Amount</th>
                <th className="text-left p-4">Started</th>
                <th className="text-left p-4">Expires</th>
                <th className="text-right p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="p-4">
                    <p className="text-white font-medium">{s.userName ?? "—"}</p>
                    <p className="text-slate-500 text-xs font-mono">{s.userId?.slice(0, 12)}…</p>
                  </td>
                  <td className="p-4 text-slate-300">{s.planName ?? s.planId ?? "—"}</td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-0.5 rounded-lg font-bold ${s.source === "main" ? "bg-indigo-500/20 text-indigo-300" : "bg-purple-500/20 text-purple-300"}`}>
                      {s.source}
                    </span>
                  </td>
                  <td className="p-4 text-right text-white tabular-nums">
                    {s.amount ? `₹${s.amount.toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="p-4 text-slate-400 text-xs">{toDate(s.startDate)?.toLocaleDateString("en-IN") ?? "—"}</td>
                  <td className="p-4 text-slate-400 text-xs">{toDate(s.expiresAt)?.toLocaleDateString("en-IN") ?? "—"}</td>
                  <td className="p-4 text-right">
                    <StatusBadge
                      label={s.status ?? "unknown"}
                      variant={s.status === "active" ? "success" : s.status === "expired" ? "error" : "default"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

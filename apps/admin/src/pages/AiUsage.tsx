import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import KpiCard from "../components/KpiCard";
import ChartTooltip from "../components/ChartTooltip";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface UserUsage { uid: string; totalCalls: number; totalTokens: number; }

export default function AiUsage() {
  const [loading, setLoading]       = useState(true);
  const [totalToday, setToday]      = useState(0);
  const [totalUsers, setUsers]      = useState(0);
  const [topUsers, setTopUsers]     = useState<UserUsage[]>([]);
  const [dailyData, setDailyData]   = useState<{ date: string; calls: number }[]>([]);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "aiGuruUsage"));
      setUsers(snap.size);

      const today = new Date().toISOString().slice(0, 10);
      let todayCalls = 0;
      const userTotals: UserUsage[] = [];
      const dateMap: Record<string, number> = {};

      await Promise.all(snap.docs.map(async (userDoc) => {
        const dailySnap = await getDocs(collection(db, "aiGuruUsage", userDoc.id, "daily"));
        let total = 0;
        dailySnap.docs.forEach((d) => {
          const data = d.data();
          const calls = data.generationCount ?? data.calls ?? 0;
          total += calls;
          dateMap[d.id] = (dateMap[d.id] ?? 0) + calls;
          if (d.id === today) todayCalls += calls;
        });
        userTotals.push({ uid: userDoc.id, totalCalls: total, totalTokens: 0 });
      }));

      setToday(todayCalls);
      setTopUsers(userTotals.sort((a, b) => b.totalCalls - a.totalCalls).slice(0, 10));

      const last30 = Array.from({ length: 30 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        return d.toISOString().slice(0, 10);
      });
      setDailyData(last30.map((date) => ({ date: date.slice(5), calls: dateMap[date] ?? 0 })));
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white">🤖 AI Guru Usage</h1>
        <p className="text-slate-400 text-sm mt-1">Monitor AI lesson generation across the platform</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Calls Today"   value={totalToday} icon="⚡" color="bg-indigo-500/20 text-indigo-400" />
        <KpiCard label="Active Users"  value={totalUsers} icon="👥" color="bg-green-500/20 text-green-400" />
        <KpiCard label="Top User Calls" value={topUsers[0]?.totalCalls ?? 0} icon="🏆" color="bg-amber-500/20 text-amber-400" />
      </div>

      {!loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-bold mb-4">Daily AI Calls (Last 30 Days)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} interval={6} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="calls" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-white font-bold">Top Users by AI Calls</h2>
        </div>
        {loading ? <div className="p-8 text-center text-slate-400">Loading…</div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                <th className="text-left p-4">#</th>
                <th className="text-left p-4">User ID</th>
                <th className="text-right p-4">Total Calls</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map((u, i) => (
                <tr key={u.uid} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="p-4 text-slate-500">{i + 1}</td>
                  <td className="p-4 font-mono text-slate-300 text-xs">{u.uid}</td>
                  <td className="p-4 text-right text-white tabular-nums font-bold">{u.totalCalls.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import KpiCard from "../components/KpiCard";
import ChartTooltip from "../components/ChartTooltip";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6"];

export default function PlatformAnalytics() {
  const [loading, setLoading]     = useState(true);
  const [totalStudents, setTotal] = useState(0);
  const [activeSubs, setActive]   = useState(0);
  const [newThisWeek, setNew]     = useState(0);
  const [planDist, setPlanDist]   = useState<{ name: string; value: number }[]>([]);
  const [growthData, setGrowthData] = useState<{ date: string; students: number }[]>([]);

  useEffect(() => {
    (async () => {
      const [studSnap, subsSnap, seekhoSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "subscriptions")),
        getDocs(collection(db, "seekho_subscriptions")),
      ]);

      setTotal(studSnap.size);

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      let newCount = 0;
      const byDate: Record<string, number> = {};

      studSnap.docs.forEach((d) => {
        const data = d.data();
        const ts = data.createdAt?.toDate?.() as Date | undefined;
        if (ts) {
          if (ts > weekAgo) newCount++;
          const key = ts.toISOString().slice(0, 10);
          byDate[key] = (byDate[key] ?? 0) + 1;
        }
      });
      setNew(newCount);

      // last 30 days cumulative growth
      const last30 = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() - (29 - i));
        return d.toISOString().slice(0, 10);
      });
      let cumulative = Math.max(0, studSnap.size - last30.reduce((s, k) => s + (byDate[k] ?? 0), 0));
      setGrowthData(last30.map((date) => {
        cumulative += byDate[date] ?? 0;
        return { date: date.slice(5), students: cumulative };
      }));

      const allSubs = [
        ...subsSnap.docs.map((d) => d.data()),
        ...seekhoSnap.docs.map((d) => d.data()),
      ];
      setActive(allSubs.filter((s) => s.status === "active").length);

      const planMap: Record<string, number> = {};
      allSubs.forEach((s) => {
        const key = String(s.planName ?? s.planId ?? "Unknown");
        planMap[key] = (planMap[key] ?? 0) + 1;
      });
      setPlanDist(Object.entries(planMap).map(([name, value]) => ({ name, value })));
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white">📈 Platform Analytics</h1>
        <p className="text-slate-400 text-sm mt-1">User growth and subscription overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Students"    value={totalStudents} icon="👥" color="bg-indigo-500/20 text-indigo-400" />
        <KpiCard label="Active Subs"       value={activeSubs}    icon="✅" color="bg-green-500/20 text-green-400" />
        <KpiCard label="New This Week"     value={newThisWeek}   icon="🆕" color="bg-amber-500/20 text-amber-400" />
        <KpiCard label="Plans Available"   value={planDist.length} icon="💎" color="bg-purple-500/20 text-purple-400" />
      </div>

      {!loading && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-bold mb-4">Student Growth (Last 30 Days)</h2>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} interval={6} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="students" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-bold mb-4">Subscriptions by Plan</h2>
            {planDist.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-slate-500">No subscription data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={planDist} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {planDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

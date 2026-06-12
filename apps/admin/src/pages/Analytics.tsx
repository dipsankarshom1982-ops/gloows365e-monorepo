import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import ChartTooltip from "../components/ChartTooltip";
import { motion } from "framer-motion";

const MODULE_COLORS = ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#0ea5e9","#ec4899"];

export default function Analytics() {
  const [moduleData, setModuleData] = useState<{ name: string; impressions: number; clicks: number }[]>([]);
  const [typeData, setTypeData]     = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    (async () => {
      const adsSnap = await getDocs(collection(db, "ads"));
      const modMap: Record<string, { impressions: number; clicks: number }> = {};
      const typeMap: Record<string, number> = {};

      await Promise.all(adsSnap.docs.map(async (adDoc) => {
        const ad = adDoc.data();
        const adType = ad.adType ?? "unknown";
        const evSnap = await getDocs(collection(db, "adAnalytics", adDoc.id, "events"));

        evSnap.docs.forEach((e) => {
          const ev  = e.data();
          const mod = ev.module ?? "unknown";
          if (!modMap[mod]) modMap[mod] = { impressions: 0, clicks: 0 };
          if (ev.event === "impression") modMap[mod].impressions++;
          if (ev.event === "click")      modMap[mod].clicks++;
          if (ev.event === "impression") typeMap[adType] = (typeMap[adType] ?? 0) + 1;
        });
      }));

      setModuleData(
        Object.entries(modMap).map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => b.impressions - a.impressions)
      );
      setTypeData(
        Object.entries(typeMap).map(([name, value]) => ({ name, value }))
      );
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-slate-400 py-12 text-center">Loading analytics...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white">📈 Analytics</h1>
        <p className="text-slate-400 text-sm mt-1">Module-wise and type-wise ad performance</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Module-wise impressions bar */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
        >
          <h2 className="text-white font-bold mb-4">Impressions by Module</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={moduleData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="impressions" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1" }} />
              <Line type="monotone" dataKey="clicks"      stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981" }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Type distribution pie */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.1 } }}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
        >
          <h2 className="text-white font-bold mb-4">Impressions by Ad Type</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={typeData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                {typeData.map((_, i) => <Cell key={i} fill={MODULE_COLORS[i % MODULE_COLORS.length]} />)}
              </Pie>
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Module table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-white font-bold">Module Performance</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
              <th className="text-left p-4">Module</th>
              <th className="text-right p-4">Impressions</th>
              <th className="text-right p-4">Clicks</th>
              <th className="text-right p-4">CTR</th>
            </tr>
          </thead>
          <tbody>
            {moduleData.map((row) => (
              <tr key={row.name} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="p-4 text-white font-medium capitalize">{row.name}</td>
                <td className="p-4 text-right tabular-nums text-slate-300">{row.impressions.toLocaleString("en-IN")}</td>
                <td className="p-4 text-right tabular-nums text-emerald-400">{row.clicks.toLocaleString("en-IN")}</td>
                <td className="p-4 text-right tabular-nums text-amber-400">
                  {row.impressions > 0 ? `${((row.clicks / row.impressions) * 100).toFixed(1)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

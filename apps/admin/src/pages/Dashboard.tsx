import { useEffect, useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion } from "framer-motion";
import KpiCard from "../components/KpiCard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import ChartTooltip from "../components/ChartTooltip";

interface AdSummary {
  id: string;
  title: string;
  adType: string;
  sponsorName: string;
  impressions: number;
  clicks: number;
  ctr: number;
  isActive: boolean;
  isApproved: boolean;
}

export default function Dashboard() {
  const [summaries, setSummaries] = useState<AdSummary[]>([]);
  const [loading, setLoading]     = useState(true);

  const totalImpressions = summaries.reduce((s, a) => s + (a.impressions ?? 0), 0);
  const totalClicks      = summaries.reduce((s, a) => s + (a.clicks ?? 0), 0);
  const avgCtr           = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const activeAds        = summaries.filter((a) => a.isActive && a.isApproved).length;
  const pendingApproval  = summaries.filter((a) => !a.isApproved).length;

  useEffect(() => {
    (async () => {
      const adsSnap = await getDocs(collection(db, "ads"));
      const results: AdSummary[] = [];

      await Promise.all(adsSnap.docs.map(async (adDoc) => {
        const ad = adDoc.data();
        const summarySnap = await getDocs(
          query(collection(db, "adAnalytics", adDoc.id, "events"))
        );

        let impressions = 0, clicks = 0;
        summarySnap.docs.forEach((e) => {
          if (e.data().event === "impression") impressions++;
          if (e.data().event === "click")      clicks++;
        });

        results.push({
          id: adDoc.id,
          title:       ad.title ?? "",
          adType:      ad.adType ?? "",
          sponsorName: ad.sponsorName ?? "",
          impressions,
          clicks,
          ctr: impressions > 0 ? clicks / impressions : 0,
          isActive:   ad.isActive   ?? false,
          isApproved: ad.isApproved ?? false,
        });
      }));

      setSummaries(results.sort((a, b) => b.impressions - a.impressions));
      setLoading(false);
    })();
  }, []);

  const chartData = summaries.slice(0, 8).map((a) => ({
    name: a.title.slice(0, 18) + (a.title.length > 18 ? "…" : ""),
    impressions: a.impressions,
    clicks: a.clicks,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white">📊 Ads Dashboard</h1>
        <p className="text-slate-400 mt-1 text-sm">Real-time performance overview</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Impressions" value={totalImpressions} icon="👁️" color="bg-indigo-500/20 text-indigo-400" />
        <KpiCard label="Total Clicks"      value={totalClicks}      icon="🖱️" color="bg-emerald-500/20 text-emerald-400" />
        <KpiCard label="Avg CTR"           value={avgCtr} format="percent" icon="📈" color="bg-amber-500/20 text-amber-400" />
        <KpiCard label="Active Ads"        value={activeAds}        icon="✅" color="bg-purple-500/20 text-purple-400" />
      </div>

      {/* Pending approval alert */}
      {pendingApproval > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3"
        >
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="text-amber-400 font-bold">{pendingApproval} ads pending approval</p>
            <p className="text-amber-400/70 text-sm">Review and approve in All Ads → set isApproved to true</p>
          </div>
        </motion.div>
      )}

      {/* Bar chart */}
      {!loading && chartData.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-bold mb-4">Top Ads by Impressions</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="impressions" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="clicks"      fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top ads table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-white font-bold">All Ads Performance</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                <th className="text-left p-4">Ad</th>
                <th className="text-left p-4">Type</th>
                <th className="text-right p-4">Impressions</th>
                <th className="text-right p-4">Clicks</th>
                <th className="text-right p-4">CTR</th>
                <th className="text-right p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((ad) => (
                <tr key={ad.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="p-4">
                    <p className="text-white font-medium truncate max-w-[200px]">{ad.title}</p>
                    <p className="text-slate-400 text-xs">{ad.sponsorName}</p>
                  </td>
                  <td className="p-4">
                    <span className="bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded-lg">{ad.adType}</span>
                  </td>
                  <td className="p-4 text-right text-white tabular-nums">{ad.impressions.toLocaleString("en-IN")}</td>
                  <td className="p-4 text-right text-emerald-400 tabular-nums">{ad.clicks.toLocaleString("en-IN")}</td>
                  <td className="p-4 text-right text-amber-400 tabular-nums">{(ad.ctr * 100).toFixed(1)}%</td>
                  <td className="p-4 text-right">
                    {!ad.isApproved
                      ? <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-lg">Pending</span>
                      : ad.isActive
                        ? <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-lg">Active</span>
                        : <span className="text-xs bg-slate-700 text-slate-400 px-2 py-1 rounded-lg">Inactive</span>
                    }
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

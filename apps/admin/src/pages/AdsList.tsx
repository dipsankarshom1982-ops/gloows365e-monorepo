import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import SafetyBadge from "../components/SafetyBadge";

interface Ad {
  id: string; title: string; adType: string; adCategory: string;
  sponsorName: string; isActive: boolean; isApproved: boolean;
  targetModules: string[]; priority: number;
}

const TYPE_COLORS: Record<string, string> = {
  feed:            "bg-indigo-500/20 text-indigo-300",
  rewarded:        "bg-amber-500/20 text-amber-300",
  sponsored_reel:  "bg-purple-500/20 text-purple-300",
  scholarship:     "bg-emerald-500/20 text-emerald-300",
};

export default function AdsList() {
  const [ads, setAds]           = useState<Ad[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filterType, setFilter] = useState("all");
  const [search, setSearch]     = useState("");

  useEffect(() => {
    getDocs(collection(db, "ads")).then((snap) => {
      setAds(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ad)));
      setLoading(false);
    });
  }, []);

  const toggle = async (adId: string, field: "isActive" | "isApproved", current: boolean) => {
    await updateDoc(doc(db, "ads", adId), { [field]: !current });
    setAds((prev) => prev.map((a) => a.id === adId ? { ...a, [field]: !current } : a));
  };

  const filtered = ads.filter((a) => {
    if (filterType !== "all" && a.adType !== filterType) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase()) &&
        !a.sponsorName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">📢 All Ads</h1>
          <p className="text-slate-400 text-sm mt-1">{ads.length} total ads</p>
        </div>
        <Link
          to="/ads/new"
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl transition-colors text-sm"
        >
          + Create Ad
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm flex-1 min-w-[200px] focus:outline-none focus:border-indigo-500"
          placeholder="Search ads..."
        />
        <select
          value={filterType} onChange={(e) => setFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none"
        >
          <option value="all">All Types</option>
          <option value="feed">Feed</option>
          <option value="rewarded">Rewarded</option>
          <option value="sponsored_reel">Sponsored Reel</option>
          <option value="scholarship">Scholarship</option>
        </select>
      </div>

      {/* Ad Cards */}
      {loading ? (
        <div className="text-center text-slate-400 py-12">Loading...</div>
      ) : (
        <AnimatePresence>
          <div className="grid gap-4">
            {filtered.map((ad, i) => (
              <motion.div
                key={ad.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: i * 0.04 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4"
              >
                {/* Type badge */}
                <span className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 ${TYPE_COLORS[ad.adType] ?? "bg-slate-700 text-slate-300"}`}>
                  {ad.adType}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{ad.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-slate-400 text-xs">{ad.sponsorName}</span>
                    <span className="text-slate-600">·</span>
                    <SafetyBadge category={ad.adCategory} title={ad.title} />
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400 text-xs">priority: {ad.priority}</span>
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => toggle(ad.id, "isApproved", ad.isApproved)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                      ad.isApproved
                        ? "bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400"
                        : "bg-red-500/20 text-red-400 hover:bg-green-500/20 hover:text-green-400"
                    }`}
                  >
                    {ad.isApproved ? "✅ Approved" : "❌ Approve"}
                  </button>
                  <button
                    onClick={() => toggle(ad.id, "isActive", ad.isActive)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                      ad.isActive
                        ? "bg-indigo-500/20 text-indigo-400 hover:bg-slate-700 hover:text-slate-400"
                        : "bg-slate-700 text-slate-400 hover:bg-indigo-500/20 hover:text-indigo-400"
                    }`}
                  >
                    {ad.isActive ? "🟢 Active" : "⚫ Inactive"}
                  </button>
                  <Link
                    to={`/ads/${ad.id}`}
                    className="text-slate-400 hover:text-white transition-colors text-sm px-2"
                  >
                    Edit →
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}

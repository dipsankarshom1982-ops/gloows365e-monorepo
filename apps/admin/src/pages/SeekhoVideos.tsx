import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import StatusBadge from "../components/StatusBadge";
import ToggleSwitch from "../components/ToggleSwitch";

interface Video {
  id: string;
  title: string;
  thumbnailUrl?: string;
  topic?: string;
  targetClass?: string[];
  durationSeconds?: number;
  isApproved: boolean;
  isFeatured?: boolean;
  createdAt?: { toDate?: () => Date };
}

export default function SeekhoVideos() {
  const [videos, setVideos]   = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("all");

  useEffect(() => {
    getDocs(collection(db, "seekhoVideos")).then((snap) => {
      setVideos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Video)));
      setLoading(false);
    });
  }, []);

  const toggle = async (id: string, field: "isApproved" | "isFeatured", current: boolean) => {
    await updateDoc(doc(db, "seekhoVideos", id), { [field]: !current });
    setVideos((prev) => prev.map((v) => v.id === id ? { ...v, [field]: !current } : v));
  };

  const filtered = videos.filter((v) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (v.title ?? "").toLowerCase().includes(q) || (v.topic ?? "").toLowerCase().includes(q);
    const matchFilter = filter === "all" || (filter === "approved" && v.isApproved) || (filter === "pending" && !v.isApproved);
    return matchSearch && matchFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">🎬 Seekho Videos</h1>
          <p className="text-slate-400 text-sm mt-1">{videos.length} video(s)</p>
        </div>
        <Link to="/seekho-videos/new" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">
          + Add Video
        </Link>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm flex-1 min-w-[200px] focus:outline-none focus:border-indigo-500"
          placeholder="Search by title or topic…"
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none"
        >
          <option value="all">All</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading…</div> : filtered.length === 0 ? <div className="p-8 text-center text-slate-400">No videos found.</div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                <th className="text-left p-4">Video</th>
                <th className="text-left p-4">Topic</th>
                <th className="text-left p-4">Class</th>
                <th className="text-right p-4">Duration</th>
                <th className="text-right p-4">Approved</th>
                <th className="text-right p-4">Featured</th>
                <th className="text-right p-4">Edit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, i) => (
                <motion.tr key={v.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-9 rounded-lg bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                        {v.thumbnailUrl ? <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-slate-600 text-lg">🎬</span>}
                      </div>
                      <p className="text-white font-medium truncate max-w-[180px]">{v.title}</p>
                    </div>
                  </td>
                  <td className="p-4 text-slate-400">{v.topic ?? "—"}</td>
                  <td className="p-4">{v.targetClass?.join(", ") ? <StatusBadge label={v.targetClass.join(", ")} /> : "—"}</td>
                  <td className="p-4 text-right text-slate-400">{v.durationSeconds ? `${Math.floor(v.durationSeconds / 60)}m` : "—"}</td>
                  <td className="p-4 text-right"><ToggleSwitch value={v.isApproved} onChange={() => toggle(v.id, "isApproved", v.isApproved)} /></td>
                  <td className="p-4 text-right"><ToggleSwitch value={!!v.isFeatured} onChange={() => toggle(v.id, "isFeatured", !!v.isFeatured)} /></td>
                  <td className="p-4 text-right"><Link to={`/seekho-videos/${v.id}`} className="text-indigo-400 hover:text-indigo-300 text-xs">Edit →</Link></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

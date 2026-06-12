import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import StatusBadge from "../components/StatusBadge";
import ToggleSwitch from "../components/ToggleSwitch";

interface Contest { id: string; title: string; startDate?: string; endDate?: string; participantCount?: number; isActive: boolean; prizePool?: number; contestType?: string; lessonStatus?: string; }

function contestStatus(c: Contest): { label: string; variant: "success" | "warning" | "error" | "default" } {
  const now = new Date();
  const start = c.startDate ? new Date(c.startDate) : null;
  const end   = c.endDate   ? new Date(c.endDate)   : null;
  if (!c.isActive) return { label: "Inactive", variant: "default" };
  if (end && end < now) return { label: "Ended", variant: "error" };
  if (start && start > now) return { label: "Upcoming", variant: "warning" };
  return { label: "Live", variant: "success" };
}

export default function Contests() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    getDocs(collection(db, "contests")).then((snap) => {
      setContests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Contest)));
      setLoading(false);
    });
  }, []);

  const toggle = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "contests", id), { isActive: !current });
    setContests((prev) => prev.map((c) => c.id === id ? { ...c, isActive: !current } : c));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-black text-white">🏁 Contests</h1><p className="text-slate-400 text-sm mt-1">{contests.length} contest(s)</p></div>
        <Link to="/contests/new" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">+ Create Contest</Link>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading…</div> : contests.length === 0 ? <div className="p-8 text-center text-slate-400">No contests yet.</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800 text-slate-400 text-xs uppercase"><th className="text-left p-4">Contest</th><th className="text-left p-4">Type</th><th className="text-left p-4">Dates</th><th className="text-right p-4">Lesson</th><th className="text-right p-4">Participants</th><th className="text-right p-4">Status</th><th className="text-right p-4">Actions</th></tr></thead>
            <tbody>
              {contests.map((c, i) => {
                const st = contestStatus(c);
                return (
                  <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="p-4"><p className="text-white font-medium">{c.title}</p>{c.prizePool ? <p className="text-amber-400 text-xs">💰 ₹{c.prizePool.toLocaleString("en-IN")}</p> : null}</td>
                    <td className="p-4"><span className="bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded-lg capitalize">{c.contestType ?? "—"}</span></td>
                    <td className="p-4 text-slate-400 text-xs">{c.startDate ? new Date(c.startDate).toLocaleDateString("en-IN") : "—"} → {c.endDate ? new Date(c.endDate).toLocaleDateString("en-IN") : "—"}</td>
                    <td className="p-4 text-right">
                      {c.lessonStatus === "completed" && <span className="text-green-400 text-xs font-bold">✅ Ready</span>}
                      {c.lessonStatus === "generating" && <span className="text-indigo-400 text-xs font-bold animate-pulse">⏳ Generating</span>}
                      {c.lessonStatus === "failed" && <span className="text-red-400 text-xs font-bold">❌ Failed</span>}
                      {(!c.lessonStatus || c.lessonStatus === "pending") && <span className="text-slate-500 text-xs">— None</span>}
                    </td>
                    <td className="p-4 text-right text-slate-300 tabular-nums">{c.participantCount ?? 0}</td>
                    <td className="p-4 text-right"><StatusBadge label={st.label} variant={st.variant} /></td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <ToggleSwitch value={c.isActive} onChange={() => toggle(c.id, c.isActive)} />
                        <Link to={`/contests/${c.id}`} className="text-indigo-400 hover:text-indigo-300 text-xs">Edit →</Link>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

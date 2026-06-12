import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import ToggleSwitch from "../components/ToggleSwitch";

interface Quiz { id: string; title: string; subject?: string; difficulty?: string; questionCount?: number; isActive: boolean; }

export default function Quizzes() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(collection(db, "quizzes")).then((snap) => {
      setQuizzes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Quiz)));
      setLoading(false);
    });
  }, []);

  const toggle = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "quizzes", id), { isActive: !current });
    setQuizzes((prev) => prev.map((q) => q.id === id ? { ...q, isActive: !current } : q));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-black text-white">🧩 Quizzes</h1><p className="text-slate-400 text-sm mt-1">{quizzes.length} quiz(zes)</p></div>
        <Link to="/quizzes/new" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">+ Create Quiz</Link>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading…</div> : quizzes.length === 0 ? <div className="p-8 text-center text-slate-400">No quizzes yet.</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800 text-slate-400 text-xs uppercase"><th className="text-left p-4">Quiz</th><th className="text-left p-4">Subject</th><th className="text-left p-4">Difficulty</th><th className="text-right p-4">Questions</th><th className="text-right p-4">Active</th><th className="text-right p-4">Actions</th></tr></thead>
            <tbody>
              {quizzes.map((q, i) => (
                <motion.tr key={q.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 text-white font-medium">{q.title}</td>
                  <td className="p-4 text-slate-400">{q.subject ?? "—"}</td>
                  <td className="p-4"><span className="bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded-lg capitalize">{q.difficulty ?? "—"}</span></td>
                  <td className="p-4 text-right text-slate-300 tabular-nums">{q.questionCount ?? "—"}</td>
                  <td className="p-4 text-right"><ToggleSwitch value={q.isActive} onChange={() => toggle(q.id, q.isActive)} /></td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link to={`/quizzes/${q.id}/questions`} className="text-slate-400 hover:text-white text-xs px-3 py-1.5 bg-slate-800 rounded-lg">Questions →</Link>
                      <Link to={`/quizzes/${q.id}`} className="text-indigo-400 hover:text-indigo-300 text-xs px-3 py-1.5 bg-indigo-500/10 rounded-lg">Edit</Link>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

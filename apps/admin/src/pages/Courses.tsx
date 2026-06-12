import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import ToggleSwitch from "../components/ToggleSwitch";

interface Course { id: string; title: string; subject?: string; targetClass?: string[]; thumbnailUrl?: string; estimatedMinutes?: number; isPublished: boolean; order?: number; }

export default function Courses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(collection(db, "seekho_courses")).then((snap) => {
      setCourses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Course)).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)));
      setLoading(false);
    });
  }, []);

  const toggle = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "seekho_courses", id), { isPublished: !current });
    setCourses((prev) => prev.map((c) => c.id === id ? { ...c, isPublished: !current } : c));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">📚 Courses</h1>
          <p className="text-slate-400 text-sm mt-1">{courses.length} course(s)</p>
        </div>
        <Link to="/courses/new" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">+ Add Course</Link>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading…</div> : courses.length === 0 ? <div className="p-8 text-center text-slate-400">No courses yet.</div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                <th className="text-left p-4">Course</th>
                <th className="text-left p-4">Subject</th>
                <th className="text-left p-4">Class</th>
                <th className="text-right p-4">Duration</th>
                <th className="text-right p-4">Published</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c, i) => (
                <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-8 rounded-lg bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                        {c.thumbnailUrl ? <img src={c.thumbnailUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-slate-600">📚</span>}
                      </div>
                      <p className="text-white font-medium">{c.title}</p>
                    </div>
                  </td>
                  <td className="p-4 text-slate-400">{c.subject ?? "—"}</td>
                  <td className="p-4 text-slate-400">{c.targetClass?.join(", ") ?? "—"}</td>
                  <td className="p-4 text-right text-slate-400">{c.estimatedMinutes ? `${c.estimatedMinutes}m` : "—"}</td>
                  <td className="p-4 text-right"><ToggleSwitch value={c.isPublished} onChange={() => toggle(c.id, c.isPublished)} /></td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link to={`/courses/${c.id}/lessons`} className="text-slate-400 hover:text-white text-xs px-3 py-1.5 bg-slate-800 rounded-lg transition-colors">Lessons →</Link>
                      <Link to={`/courses/${c.id}`} className="text-indigo-400 hover:text-indigo-300 text-xs px-3 py-1.5 bg-indigo-500/10 rounded-lg transition-colors">Edit</Link>
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

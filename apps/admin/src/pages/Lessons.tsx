import { useEffect, useState } from "react";
import { collection, getDocs, doc, addDoc, updateDoc, query, where, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import DrawerForm from "../components/DrawerForm";
import ToggleSwitch from "../components/ToggleSwitch";

interface Lesson { id: string; title: string; videoUrl?: string; durationSeconds?: number; isPublished: boolean; order: number; courseId: string; }

const EMPTY = { title: "", videoUrl: "", durationSeconds: 0, isPublished: false, order: 1 };
const inputCls = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
const labelCls = "text-slate-300 text-sm font-semibold block mb-1.5";

export default function Lessons() {
  const { courseId } = useParams<{ courseId: string }>();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing]       = useState<Lesson | null>(null);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [courseName, setCourseName] = useState("");

  useEffect(() => {
    if (!courseId) return;
    // Get course name
    import("firebase/firestore").then(({ getDoc, doc: fDoc }) => {
      getDoc(fDoc(db, "seekho_courses", courseId)).then((snap) => {
        if (snap.exists()) setCourseName(snap.data().title ?? "Course");
      });
    });

    getDocs(query(collection(db, "seekho_lessons"), where("courseId", "==", courseId), orderBy("order", "asc")))
      .then((snap) => {
        setLessons(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lesson)));
        setLoading(false);
      })
      .catch(() => {
        getDocs(query(collection(db, "seekho_lessons"), where("courseId", "==", courseId)))
          .then((snap) => {
            setLessons(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lesson)).sort((a, b) => a.order - b.order));
            setLoading(false);
          });
      });
  }, [courseId]);

  const openAdd  = () => { setEditing(null); setForm({ ...EMPTY, order: (lessons.length + 1) }); setDrawerOpen(true); };
  const openEdit = (l: Lesson) => {
    setEditing(l);
    setForm({ title: l.title, videoUrl: l.videoUrl ?? "", durationSeconds: l.durationSeconds ?? 0, isPublished: l.isPublished, order: l.order });
    setDrawerOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, courseId, durationSeconds: Number(form.durationSeconds), order: Number(form.order), updatedAt: serverTimestamp() };
      if (editing) {
        await updateDoc(doc(db, "seekho_lessons", editing.id), payload);
        const updated: Lesson = { id: editing.id, title: form.title, videoUrl: form.videoUrl, durationSeconds: Number(form.durationSeconds), isPublished: form.isPublished, order: Number(form.order), courseId: courseId! };
        setLessons((prev) => prev.map((l) => l.id === editing.id ? updated : l).sort((a, b) => a.order - b.order));
      } else {
        const ref = await addDoc(collection(db, "seekho_lessons"), { ...payload, createdAt: serverTimestamp() });
        const newLesson: Lesson = { id: ref.id, title: form.title, videoUrl: form.videoUrl, durationSeconds: Number(form.durationSeconds), isPublished: form.isPublished, order: Number(form.order), courseId: courseId! };
        setLessons((prev) => [...prev, newLesson].sort((a, b) => a.order - b.order));
      }
      setDrawerOpen(false);
    } finally { setSaving(false); }
  };

  const toggle = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "seekho_lessons", id), { isPublished: !current });
    setLessons((prev) => prev.map((l) => l.id === id ? { ...l, isPublished: !current } : l));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Link to="/courses" className="hover:text-white transition-colors">Courses</Link>
            <span>›</span>
            <span className="text-white">{courseName || "…"}</span>
          </div>
          <h1 className="text-3xl font-black text-white">📖 Lessons</h1>
          <p className="text-slate-400 text-sm mt-1">{lessons.length} lesson(s)</p>
        </div>
        <button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">+ Add Lesson</button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading…</div> : lessons.length === 0 ? <div className="p-8 text-center text-slate-400">No lessons yet.</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800 text-slate-400 text-xs uppercase"><th className="text-left p-4 w-12">#</th><th className="text-left p-4">Title</th><th className="text-right p-4">Duration</th><th className="text-right p-4">Published</th><th className="text-right p-4">Edit</th></tr></thead>
            <tbody>
              <AnimatePresence>
                {lessons.map((l, i) => (
                  <motion.tr key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.02 }}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="p-4 text-slate-500 font-mono">{l.order}</td>
                    <td className="p-4 text-white font-medium">{l.title}</td>
                    <td className="p-4 text-right text-slate-400">{l.durationSeconds ? `${Math.floor(l.durationSeconds / 60)}m` : "—"}</td>
                    <td className="p-4 text-right"><ToggleSwitch value={l.isPublished} onChange={() => toggle(l.id, l.isPublished)} /></td>
                    <td className="p-4 text-right"><button onClick={() => openEdit(l)} className="text-indigo-400 hover:text-indigo-300 text-xs">Edit</button></td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      <DrawerForm open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? "Edit Lesson" : "Add Lesson"}
        footer={
          <>
            <button onClick={save} disabled={saving || !form.title} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">{saving ? "Saving…" : "Save"}</button>
            <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-white px-4 text-sm">Cancel</button>
          </>
        }
      >
        <div><label className={labelCls}>Title *</label><input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} /></div>
        <div><label className={labelCls}>Video URL</label><input value={form.videoUrl} onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))} className={inputCls} placeholder="https://…" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Duration (s)</label><input type="number" min={0} value={form.durationSeconds} onChange={(e) => setForm((f) => ({ ...f, durationSeconds: Number(e.target.value) }))} className={inputCls} /></div>
          <div><label className={labelCls}>Order</label><input type="number" min={1} value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} className={inputCls} /></div>
        </div>
        <ToggleSwitch value={form.isPublished} onChange={(v) => setForm((f) => ({ ...f, isPublished: v }))} label="Published" />
      </DrawerForm>
    </div>
  );
}

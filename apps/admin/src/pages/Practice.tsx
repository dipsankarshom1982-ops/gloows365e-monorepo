import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion } from "framer-motion";
import DrawerForm from "../components/DrawerForm";
import ToggleSwitch from "../components/ToggleSwitch";

interface PracticeSet { id: string; title: string; courseId?: string; subject?: string; questionCount?: number; difficulty?: string; isActive: boolean; }

const EMPTY = { title: "", courseId: "", subject: "", difficulty: "medium", questionCount: 10, isActive: true };
const inputCls = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
const labelCls = "text-slate-300 text-sm font-semibold block mb-1.5";

export default function Practice() {
  const [sets, setSets]         = useState<PracticeSet[]>([]);
  const [loading, setLoading]   = useState(true);
  const [drawerOpen, setDrawer] = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    getDocs(collection(db, "seekho_practice")).then((snap) => {
      setSets(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PracticeSet)));
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "seekho_practice"), { ...form, questionCount: Number(form.questionCount), createdAt: serverTimestamp() });
      setSets((prev) => [...prev, { id: ref.id, ...form, questionCount: Number(form.questionCount) }]);
      setDrawer(false); setForm(EMPTY);
    } finally { setSaving(false); }
  };

  const toggle = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "seekho_practice", id), { isActive: !current });
    setSets((prev) => prev.map((s) => s.id === id ? { ...s, isActive: !current } : s));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">✍️ Practice Sets</h1>
          <p className="text-slate-400 text-sm mt-1">{sets.length} set(s)</p>
        </div>
        <button onClick={() => setDrawer(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">+ Add Set</button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading…</div> : sets.length === 0 ? <div className="p-8 text-center text-slate-400">No practice sets yet.</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800 text-slate-400 text-xs uppercase"><th className="text-left p-4">Title</th><th className="text-left p-4">Subject</th><th className="text-left p-4">Difficulty</th><th className="text-right p-4">Questions</th><th className="text-right p-4">Active</th></tr></thead>
            <tbody>
              {sets.map((s, i) => (
                <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 text-white font-medium">{s.title}</td>
                  <td className="p-4 text-slate-400">{s.subject ?? "—"}</td>
                  <td className="p-4"><span className="bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded-lg capitalize">{s.difficulty ?? "medium"}</span></td>
                  <td className="p-4 text-right text-slate-300 tabular-nums">{s.questionCount ?? "—"}</td>
                  <td className="p-4 text-right"><ToggleSwitch value={s.isActive} onChange={() => toggle(s.id, s.isActive)} /></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <DrawerForm open={drawerOpen} onClose={() => setDrawer(false)} title="Add Practice Set"
        footer={<><button onClick={save} disabled={saving || !form.title} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">{saving ? "Saving…" : "Save"}</button><button onClick={() => setDrawer(false)} className="text-slate-400 hover:text-white px-4 text-sm">Cancel</button></>}
      >
        <div><label className={labelCls}>Title *</label><input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} /></div>
        <div><label className={labelCls}>Subject</label><input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className={inputCls} /></div>
        <div><label className={labelCls}>Course ID <span className="text-slate-500 font-normal">(optional)</span></label><input value={form.courseId} onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))} className={inputCls} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Difficulty</label><select value={form.difficulty} onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))} className={inputCls}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
          <div><label className={labelCls}>Question Count</label><input type="number" min={1} value={form.questionCount} onChange={(e) => setForm((f) => ({ ...f, questionCount: Number(e.target.value) }))} className={inputCls} /></div>
        </div>
        <ToggleSwitch value={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label="Active" />
      </DrawerForm>
    </div>
  );
}

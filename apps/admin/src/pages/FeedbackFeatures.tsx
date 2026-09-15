import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import DrawerForm from "../components/DrawerForm";
import ToggleSwitch from "../components/ToggleSwitch";
import { db } from "../lib/firebase";

// The admin-configurable list of features students can star-rate on the
// Feedback & Ratings screen (Settings → Feedback & Ratings, web + mobile).
// Deliberately a separate collection from `appModules` (the 5 bottom-tab
// modules) — this list is broader (can include LearnFun, Daily Streak
// Quiz, Starboard, etc.) and serves a different purpose.

interface Feature {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  order: number;
  isEnabled: boolean;
}

const EMPTY = { name: "", icon: "", description: "", order: 1, isEnabled: true };

const inputCls = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
const labelCls = "text-slate-300 text-sm font-semibold block mb-1.5";

export default function FeedbackFeatures() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading]   = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing]       = useState<Feature | null>(null);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);

  const load = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "feedbackFeatures"));
    setFeatures(
      snap.docs.map((d) => ({ id: d.id, ...d.data() } as Feature))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ ...EMPTY, order: features.length + 1 }); setDrawerOpen(true); };
  const openEdit = (f: Feature) => {
    setEditing(f);
    setForm({ name: f.name, icon: f.icon ?? "", description: f.description ?? "", order: f.order, isEnabled: f.isEnabled });
    setDrawerOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await updateDoc(doc(db, "feedbackFeatures", editing.id), { ...form, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, "feedbackFeatures"), { ...form, createdAt: serverTimestamp() });
      }
      setDrawerOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "feedbackFeatures", id), { isEnabled: !current });
    setFeatures((prev) => prev.map((f) => f.id === id ? { ...f, isEnabled: !current } : f));
  };

  const remove = async (f: Feature) => {
    if (!confirm(`Delete "${f.name}"? Past ratings for it will still count in Feedback analytics, just labeled "(deleted feature)".`)) return;
    await deleteDoc(doc(db, "feedbackFeatures", f.id));
    setFeatures((prev) => prev.filter((x) => x.id !== f.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">⭐ Feedback Features</h1>
          <p className="text-slate-400 text-sm mt-1">{features.length} feature(s) · shown on the student Feedback &amp; Ratings screen</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/feedback" className="text-indigo-400 hover:text-indigo-300 text-sm font-semibold">View Submissions →</Link>
          <button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">
            + Add Feature
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : features.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No features yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                <th className="text-left p-4">Feature</th>
                <th className="text-right p-4">Order</th>
                <th className="text-right p-4">Status</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <motion.tr key={f.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{f.icon || "⭐"}</span>
                      <div>
                        <p className="text-white font-medium">{f.name}</p>
                        {f.description && <p className="text-slate-500 text-xs">{f.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right text-slate-400">{f.order}</td>
                  <td className="p-4 text-right"><ToggleSwitch value={f.isEnabled} onChange={() => toggle(f.id, f.isEnabled)} /></td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(f)} className="text-slate-400 hover:text-white text-xs px-3 py-1.5 bg-slate-800 rounded-lg transition-colors">Edit</button>
                      <button onClick={() => remove(f)} className="text-red-400 hover:text-red-300 text-xs px-3 py-1.5 bg-red-500/10 rounded-lg transition-colors">Delete</button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <DrawerForm
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? "Edit Feature" : "Add Feature"}
        footer={
          <>
            <button onClick={save} disabled={saving || !form.name} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-white px-4 text-sm">Cancel</button>
          </>
        }
      >
        <div>
          <label className={labelCls}>Name *</label>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. AI Guru" />
        </div>
        <div>
          <label className={labelCls}>Icon <span className="text-slate-500 font-normal">(emoji, optional)</span></label>
          <input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} className={inputCls} placeholder="🤖" />
        </div>
        <div>
          <label className={labelCls}>Description <span className="text-slate-500 font-normal">(optional, shown under the name)</span></label>
          <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} placeholder="Personal AI-powered study companion" />
        </div>
        <div>
          <label className={labelCls}>Display Order</label>
          <input type="number" min={1} value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} className={inputCls} />
        </div>
        <ToggleSwitch value={form.isEnabled} onChange={(v) => setForm((f) => ({ ...f, isEnabled: v }))} label="Enabled — shown to students" />
      </DrawerForm>
    </div>
  );
}

import { addDoc, collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import DrawerForm from "../components/DrawerForm";
import MediaUpload from "../components/MediaUpload";
import ToggleSwitch from "../components/ToggleSwitch";
import { db } from "../lib/firebase";

type Tab = "badges" | "stars";
interface Item { id: string; title: string; description?: string; iconUrl?: string; criteria?: string; isActive: boolean; }

const inputCls = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
const labelCls = "text-slate-300 text-sm font-semibold block mb-1.5";
const EMPTY = { title: "", description: "", iconUrl: "", criteria: "", isActive: true };

export default function BadgesAndStars() {
  const [tab, setTab]         = useState<Tab>("badges");
  const [badges, setBadges]   = useState<Item[]>([]);
  const [stars, setStars]     = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, "LearnFunBadges")),
      getDocs(collection(db, "shikshaStars")),
    ]).then(([bSnap, sSnap]) => {
      setBadges(bSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Item)));
      setStars(sSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Item)));
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const col = tab === "badges" ? "LearnFunBadges" : "shikshaStars";
    try {
      const ref = await addDoc(collection(db, col), { ...form, createdAt: serverTimestamp() });
      const newItem = { id: ref.id, ...form };
      if (tab === "badges") setBadges((p) => [...p, newItem]);
      else setStars((p) => [...p, newItem]);
      setDrawerOpen(false); setForm(EMPTY);
    } finally { setSaving(false); }
  };

  const toggle = async (id: string, current: boolean) => {
    const col = tab === "badges" ? "LearnFunBadges" : "shikshaStars";
    await updateDoc(doc(db, col, id), { isActive: !current });
    const setter = tab === "badges" ? setBadges : setStars;
    setter((prev) => prev.map((i) => i.id === id ? { ...i, isActive: !current } : i));
  };

  const items = tab === "badges" ? badges : stars;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-black text-white">🏆 Badges & Stars</h1></div>
        <button onClick={() => setDrawerOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">
          + Add {tab === "badges" ? "Badge" : "Star"}
        </button>
      </div>

      <div className="flex gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl w-fit">
        {(["badges", "stars"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors capitalize ${tab === t ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}>
            {t === "badges" ? "🏅 Badges" : "⭐ Shiksha Stars"}
          </button>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading…</div> : items.length === 0 ? <div className="p-8 text-center text-slate-400">No {tab} yet.</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800 text-slate-400 text-xs uppercase"><th className="text-left p-4">Item</th><th className="text-left p-4">Criteria</th><th className="text-right p-4">Active</th></tr></thead>
            <tbody>
              {items.map((item, i) => (
                <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {item.iconUrl ? <img src={item.iconUrl} alt="" className="w-8 h-8 rounded-lg object-cover" /> : <span className="text-2xl">{tab === "badges" ? "🏅" : "⭐"}</span>}
                      <div>
                        <p className="text-white font-medium">{item.title}</p>
                        {item.description && <p className="text-slate-400 text-xs">{item.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-slate-400 text-xs">{item.criteria ?? "—"}</td>
                  <td className="p-4 text-right"><ToggleSwitch value={item.isActive} onChange={() => toggle(item.id, item.isActive)} /></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <DrawerForm open={drawerOpen} onClose={() => setDrawerOpen(false)} title={`Add ${tab === "badges" ? "Badge" : "Shiksha Star"}`}
        footer={<><button onClick={save} disabled={saving || !form.title} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm">{saving ? "Saving…" : "Save"}</button><button onClick={() => setDrawerOpen(false)} className="text-slate-400 px-4 text-sm">Cancel</button></>}
      >
        <div><label className={labelCls}>Title *</label><input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} /></div>
        <div><label className={labelCls}>Description</label><input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} /></div>
        <MediaUpload
          label="Icon Image"
          storagePath="badges"
          value={form.iconUrl}
          onChange={(url) => setForm((f) => ({ ...f, iconUrl: url }))}
          placeholder="https://… or upload below"
        />
        <div><label className={labelCls}>Criteria / Condition</label><input value={form.criteria} onChange={(e) => setForm((f) => ({ ...f, criteria: e.target.value }))} className={inputCls} placeholder="e.g. Complete 5 quizzes" /></div>
        <ToggleSwitch value={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label="Active" />
      </DrawerForm>
    </div>
  );
}
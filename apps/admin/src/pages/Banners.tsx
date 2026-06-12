import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import DrawerForm from "../components/DrawerForm";
import MediaUpload from "../components/MediaUpload";
import ToggleSwitch from "../components/ToggleSwitch";
import { db } from "../lib/firebase";

interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  targetScreen?: string;
  ctaUrl?: string;
  order: number;
  isActive: boolean;
}

const EMPTY = { title: "", imageUrl: "", targetScreen: "", ctaUrl: "", order: 1, isActive: true };

const inputCls = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
const labelCls = "text-slate-300 text-sm font-semibold block mb-1.5";

export default function Banners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing]       = useState<Banner | null>(null);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    getDocs(collection(db, "banners")).then((snap) => {
      setBanners(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Banner))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      );
      setLoading(false);
    });
  }, []);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setDrawerOpen(true); };
  const openEdit = (b: Banner) => {
    setEditing(b);
    setForm({ title: b.title, imageUrl: b.imageUrl, targetScreen: b.targetScreen ?? "", ctaUrl: b.ctaUrl ?? "", order: b.order, isActive: b.isActive });
    setDrawerOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await updateDoc(doc(db, "banners", editing.id), { ...form, updatedAt: serverTimestamp() });
        setBanners((prev) => prev.map((b) => b.id === editing.id ? { ...b, ...form } : b));
      } else {
        const ref = await addDoc(collection(db, "banners"), { ...form, createdAt: serverTimestamp() });
        setBanners((prev) => [...prev, { id: ref.id, ...form }]);
      }
      setDrawerOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "banners", id), { isActive: !current });
    setBanners((prev) => prev.map((b) => b.id === id ? { ...b, isActive: !current } : b));
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    await deleteDoc(doc(db, "banners", id));
    setBanners((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">🎯 Banners</h1>
          <p className="text-slate-400 text-sm mt-1">{banners.length} banner(s)</p>
        </div>
        <button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">
          + Add Banner
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : banners.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No banners yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                <th className="text-left p-4">Banner</th>
                <th className="text-left p-4">Target Screen</th>
                <th className="text-right p-4">Order</th>
                <th className="text-right p-4">Status</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((b, i) => (
                <motion.tr
                  key={b.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-10 rounded-lg bg-slate-800 overflow-hidden shrink-0">
                        {b.imageUrl
                          ? <img src={b.imageUrl} alt={b.title} className="w-full h-full object-cover" />
                          : <span className="flex items-center justify-center h-full text-slate-600">🖼️</span>
                        }
                      </div>
                      <p className="text-white font-medium">{b.title}</p>
                    </div>
                  </td>
                  <td className="p-4 text-slate-400">{b.targetScreen || "—"}</td>
                  <td className="p-4 text-right text-slate-400">{b.order}</td>
                  <td className="p-4 text-right">
                    <ToggleSwitch value={b.isActive} onChange={() => toggle(b.id, b.isActive)} />
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(b)} className="text-slate-400 hover:text-white text-xs px-3 py-1.5 bg-slate-800 rounded-lg transition-colors">Edit</button>
                      <button onClick={() => remove(b.id)} className="text-red-400 hover:text-red-300 text-xs px-3 py-1.5 bg-red-500/10 rounded-lg transition-colors">Delete</button>
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
        title={editing ? "Edit Banner" : "Add Banner"}
        footer={
          <>
            <button onClick={save} disabled={saving || !form.title || !form.imageUrl} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-white px-4 text-sm">Cancel</button>
          </>
        }
      >
        <div>
          <label className={labelCls}>Title *</label>
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="Banner headline" />
        </div>
        <MediaUpload
          label="Banner Image *"
          storagePath="banners"
          value={form.imageUrl}
          onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
          placeholder="https://… or upload below"
        />
        <div>
          <label className={labelCls}>Target Screen</label>
          <input value={form.targetScreen} onChange={(e) => setForm((f) => ({ ...f, targetScreen: e.target.value }))} className={inputCls} placeholder="/ai-guru, /seekho, etc." />
        </div>
        <div>
          <label className={labelCls}>CTA URL</label>
          <input value={form.ctaUrl} onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))} className={inputCls} placeholder="https://…" />
        </div>
        <div>
          <label className={labelCls}>Display Order</label>
          <input type="number" min={1} value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} className={inputCls} />
        </div>
        <ToggleSwitch value={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label="Active" />
      </DrawerForm>
    </div>
  );
}
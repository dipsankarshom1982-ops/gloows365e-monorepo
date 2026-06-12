import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import DrawerForm from "../components/DrawerForm";
import MediaUpload from "../components/MediaUpload";
import ToggleSwitch from "../components/ToggleSwitch";
import { db } from "../lib/firebase";

interface Partner {
  id: string;
  name: string;
  logoUrl: string;
  website?: string;
  partnerType?: string;
  isActive: boolean;
}

const EMPTY = { name: "", logoUrl: "", website: "", partnerType: "sponsor", isActive: true };
const inputCls = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
const labelCls = "text-slate-300 text-sm font-semibold block mb-1.5";

export default function Partners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading]   = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing]       = useState<Partner | null>(null);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    getDocs(collection(db, "partners")).then((snap) => {
      setPartners(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Partner)));
      setLoading(false);
    });
  }, []);

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setDrawerOpen(true); };
  const openEdit = (p: Partner) => {
    setEditing(p);
    setForm({ name: p.name, logoUrl: p.logoUrl, website: p.website ?? "", partnerType: p.partnerType ?? "sponsor", isActive: p.isActive });
    setDrawerOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await updateDoc(doc(db, "partners", editing.id), { ...form, updatedAt: serverTimestamp() });
        setPartners((prev) => prev.map((p) => p.id === editing.id ? { ...p, ...form } : p));
      } else {
        const ref = await addDoc(collection(db, "partners"), { ...form, createdAt: serverTimestamp() });
        setPartners((prev) => [...prev, { id: ref.id, ...form }]);
      }
      setDrawerOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "partners", id), { isActive: !current });
    setPartners((prev) => prev.map((p) => p.id === id ? { ...p, isActive: !current } : p));
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this partner?")) return;
    await deleteDoc(doc(db, "partners", id));
    setPartners((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">🤝 Partners</h1>
          <p className="text-slate-400 text-sm mt-1">{partners.length} partner(s)</p>
        </div>
        <button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">
          + Add Partner
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : partners.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No partners yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                <th className="text-left p-4">Partner</th>
                <th className="text-left p-4">Type</th>
                <th className="text-left p-4">Website</th>
                <th className="text-right p-4">Active</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p, i) => (
                <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                        {p.logoUrl ? <img src={p.logoUrl} alt={p.name} className="w-full h-full object-contain p-1" /> : <span className="text-slate-600">🤝</span>}
                      </div>
                      <p className="text-white font-medium">{p.name}</p>
                    </div>
                  </td>
                  <td className="p-4"><span className="bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded-lg capitalize">{p.partnerType ?? "—"}</span></td>
                  <td className="p-4"><a href={p.website} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline text-xs">{p.website || "—"}</a></td>
                  <td className="p-4 text-right"><ToggleSwitch value={p.isActive} onChange={() => toggle(p.id, p.isActive)} /></td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(p)} className="text-slate-400 hover:text-white text-xs px-3 py-1.5 bg-slate-800 rounded-lg transition-colors">Edit</button>
                      <button onClick={() => remove(p.id)} className="text-red-400 hover:text-red-300 text-xs px-3 py-1.5 bg-red-500/10 rounded-lg transition-colors">Delete</button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <DrawerForm open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? "Edit Partner" : "Add Partner"}
        footer={
          <>
            <button onClick={save} disabled={saving || !form.name} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-white px-4 text-sm">Cancel</button>
          </>
        }
      >
        <div><label className={labelCls}>Name *</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Partner name" /></div>
        <MediaUpload
          label="Partner Logo"
          storagePath="partners/logos"
          value={form.logoUrl}
          onChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
          placeholder="https://… or upload below"
        />
        <div><label className={labelCls}>Website</label><input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} className={inputCls} placeholder="https://…" /></div>
        <div>
          <label className={labelCls}>Partner Type</label>
          <select value={form.partnerType} onChange={(e) => setForm((f) => ({ ...f, partnerType: e.target.value }))} className={inputCls}>
            <option value="sponsor">Sponsor</option>
            <option value="content">Content</option>
            <option value="technology">Technology</option>
            <option value="ngo">NGO</option>
          </select>
        </div>
        <ToggleSwitch value={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label="Active" />
      </DrawerForm>
    </div>
  );
}
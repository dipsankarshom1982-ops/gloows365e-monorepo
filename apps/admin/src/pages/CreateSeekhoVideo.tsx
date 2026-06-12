import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion } from "framer-motion";
import ToggleSwitch from "../components/ToggleSwitch";

const ALL_CLASSES = ["6","7","8","9","10","11","12","all"];
const EMPTY = { title: "", description: "", videoUrl: "", thumbnailUrl: "", topic: "", targetClass: ["all"] as string[], durationSeconds: 0, isApproved: false, isFeatured: false, order: 0 };

export default function CreateSeekhoVideo() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit   = !!id && id !== "new";
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    getDoc(doc(db, "seekhoVideos", id!)).then((snap) => {
      if (snap.exists()) setForm({ ...EMPTY, ...snap.data() } as typeof EMPTY);
    });
  }, [id, isEdit]);

  const set = (field: string, value: unknown) => setForm((p) => ({ ...p, [field]: value }));
  const toggleClass = (c: string) => setForm((p) => ({
    ...p,
    targetClass: p.targetClass.includes(c) ? p.targetClass.filter((v) => v !== c) : [...p.targetClass, c],
  }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, durationSeconds: Number(form.durationSeconds), order: Number(form.order), updatedAt: serverTimestamp() };
      if (isEdit) {
        await updateDoc(doc(db, "seekhoVideos", id!), payload);
      } else {
        await addDoc(collection(db, "seekhoVideos"), { ...payload, createdAt: serverTimestamp() });
      }
      setSuccess(true);
      setTimeout(() => navigate("/seekho-videos"), 1200);
    } finally { setSaving(false); }
  };

  const inputCls = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
  const labelCls = "text-slate-300 text-sm font-semibold block mb-2";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">{isEdit ? "✏️ Edit Seekho Video" : "🎬 Add Seekho Video"}</h1>
      </div>
      {success && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-green-500/15 border border-green-500/30 rounded-xl p-4 text-green-400 font-semibold">✅ Saved! Redirecting…</motion.div>}
      <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div><label className={labelCls}>Title *</label><input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} required /></div>
        <div><label className={labelCls}>Description</label><textarea value={form.description} onChange={(e) => set("description", e.target.value)} className={`${inputCls} resize-none h-20`} /></div>
        <div><label className={labelCls}>Cloudflare Stream Video URL *</label><input value={form.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} className={inputCls} required placeholder="https://…" /></div>
        <div><label className={labelCls}>Thumbnail URL</label><input value={form.thumbnailUrl} onChange={(e) => set("thumbnailUrl", e.target.value)} className={inputCls} placeholder="https://…" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls}>Topic</label><input value={form.topic} onChange={(e) => set("topic", e.target.value)} className={inputCls} placeholder="e.g. Algebra, Grammar" /></div>
          <div><label className={labelCls}>Duration (seconds)</label><input type="number" min={0} value={form.durationSeconds} onChange={(e) => set("durationSeconds", e.target.value)} className={inputCls} /></div>
        </div>
        <div>
          <label className={labelCls}>Target Class</label>
          <div className="flex flex-wrap gap-2">
            {ALL_CLASSES.map((c) => (
              <button key={c} type="button" onClick={() => toggleClass(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${form.targetClass.includes(c) ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
              >{c}</button>
            ))}
          </div>
        </div>
        <div><label className={labelCls}>Display Order</label><input type="number" min={0} value={form.order} onChange={(e) => set("order", e.target.value)} className={inputCls} /></div>
        <div className="flex gap-6">
          <ToggleSwitch value={form.isApproved} onChange={(v) => set("isApproved", v)} label="Approved" />
          <ToggleSwitch value={form.isFeatured} onChange={(v) => set("isFeatured", v)} label="Featured" />
        </div>
        <button type="submit" disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors">
          {saving ? "Saving…" : isEdit ? "Update Video" : "Create Video"}
        </button>
      </form>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion } from "framer-motion";
import ToggleSwitch from "../components/ToggleSwitch";

const BOARDS = ["CBSE","ICSE","State Board","Other"];
const EMPTY = { title: "", description: "", videoUrl: "", thumbnailUrl: "", subject: "", board: "CBSE", chapter: "", targetClass: [] as string[], durationSeconds: 0, isApproved: false };

export default function CreateKnowledgeVideo() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit   = !!id && id !== "new";
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    getDoc(doc(db, "knowledgeVideos", id!)).then((snap) => {
      if (snap.exists()) setForm({ ...EMPTY, ...snap.data() } as typeof EMPTY);
    });
  }, [id, isEdit]);

  const set = (field: string, value: unknown) => setForm((p) => ({ ...p, [field]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, durationSeconds: Number(form.durationSeconds), updatedAt: serverTimestamp() };
      if (isEdit) { await updateDoc(doc(db, "knowledgeVideos", id!), payload); }
      else { await addDoc(collection(db, "knowledgeVideos"), { ...payload, createdAt: serverTimestamp() }); }
      setSuccess(true);
      setTimeout(() => navigate("/knowledge-videos"), 1200);
    } finally { setSaving(false); }
  };

  const inputCls = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
  const labelCls = "text-slate-300 text-sm font-semibold block mb-2";

  return (
    <div className="max-w-3xl space-y-6">
      <div><h1 className="text-3xl font-black text-white">{isEdit ? "✏️ Edit Knowledge Video" : "🧠 Add Knowledge Video"}</h1></div>
      {success && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-green-500/15 border border-green-500/30 rounded-xl p-4 text-green-400 font-semibold">✅ Saved! Redirecting…</motion.div>}
      <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div><label className={labelCls}>Title *</label><input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} required /></div>
        <div><label className={labelCls}>Description</label><textarea value={form.description} onChange={(e) => set("description", e.target.value)} className={`${inputCls} resize-none h-20`} /></div>
        <div><label className={labelCls}>Cloudflare Stream Video URL *</label><input value={form.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} className={inputCls} required /></div>
        <div><label className={labelCls}>Thumbnail URL</label><input value={form.thumbnailUrl} onChange={(e) => set("thumbnailUrl", e.target.value)} className={inputCls} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls}>Subject *</label><input value={form.subject} onChange={(e) => set("subject", e.target.value)} className={inputCls} required placeholder="e.g. Mathematics" /></div>
          <div><label className={labelCls}>Board</label><select value={form.board} onChange={(e) => set("board", e.target.value)} className={inputCls}>{BOARDS.map((b) => <option key={b}>{b}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls}>Chapter</label><input value={form.chapter} onChange={(e) => set("chapter", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Duration (seconds)</label><input type="number" min={0} value={form.durationSeconds} onChange={(e) => set("durationSeconds", e.target.value)} className={inputCls} /></div>
        </div>
        <ToggleSwitch value={form.isApproved} onChange={(v) => set("isApproved", v)} label="Approved" />
        <button type="submit" disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors">
          {saving ? "Saving…" : isEdit ? "Update Video" : "Create Video"}
        </button>
      </form>
    </div>
  );
}

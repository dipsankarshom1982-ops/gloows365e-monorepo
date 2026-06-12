import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion } from "framer-motion";
import ToggleSwitch from "../components/ToggleSwitch";

const ALL_CLASSES = ["6","7","8","9","10","11","12","all"];
const EMPTY = { title: "", description: "", subject: "", difficulty: "medium", targetClass: ["all"] as string[], timeLimit: 30, isActive: false };

export default function CreateQuiz() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit   = !!id && id !== "new";
  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    getDoc(doc(db, "quizzes", id!)).then((snap) => {
      if (snap.exists()) setForm({ ...EMPTY, ...snap.data() } as typeof EMPTY);
    });
  }, [id, isEdit]);

  const set = (field: string, value: unknown) => setForm((p) => ({ ...p, [field]: value }));
  const toggleClass = (c: string) => setForm((p) => ({ ...p, targetClass: p.targetClass.includes(c) ? p.targetClass.filter((v) => v !== c) : [...p.targetClass, c] }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, timeLimit: Number(form.timeLimit), updatedAt: serverTimestamp() };
      if (isEdit) { await updateDoc(doc(db, "quizzes", id!), payload); }
      else { await addDoc(collection(db, "quizzes"), { ...payload, questionCount: 0, createdAt: serverTimestamp() }); }
      setSuccess(true);
      setTimeout(() => navigate("/quizzes"), 1200);
    } finally { setSaving(false); }
  };

  const inputCls = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
  const labelCls = "text-slate-300 text-sm font-semibold block mb-2";

  return (
    <div className="max-w-3xl space-y-6">
      <div><h1 className="text-3xl font-black text-white">{isEdit ? "✏️ Edit Quiz" : "🧩 Create Quiz"}</h1></div>
      {success && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-green-500/15 border border-green-500/30 rounded-xl p-4 text-green-400 font-semibold">✅ Saved!</motion.div>}
      <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div><label className={labelCls}>Title *</label><input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} required /></div>
        <div><label className={labelCls}>Description</label><textarea value={form.description} onChange={(e) => set("description", e.target.value)} className={`${inputCls} resize-none h-20`} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls}>Subject</label><input value={form.subject} onChange={(e) => set("subject", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Difficulty</label><select value={form.difficulty} onChange={(e) => set("difficulty", e.target.value)} className={inputCls}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
        </div>
        <div><label className={labelCls}>Time Limit (minutes)</label><input type="number" min={1} value={form.timeLimit} onChange={(e) => set("timeLimit", e.target.value)} className={inputCls} /></div>
        <div>
          <label className={labelCls}>Target Class</label>
          <div className="flex flex-wrap gap-2">
            {ALL_CLASSES.map((c) => (<button key={c} type="button" onClick={() => toggleClass(c)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${form.targetClass.includes(c) ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>{c}</button>))}
          </div>
        </div>
        <ToggleSwitch value={form.isActive} onChange={(v) => set("isActive", v)} label="Active" />
        <button type="submit" disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors">{saving ? "Saving…" : isEdit ? "Update Quiz" : "Create Quiz"}</button>
      </form>
    </div>
  );
}

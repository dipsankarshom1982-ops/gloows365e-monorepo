import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { parseClassLevel, SUPPORTED_CLASS_LEVEL_STRINGS } from "../lib/educationConfig";
import { motion } from "framer-motion";
import ToggleSwitch from "../components/ToggleSwitch";

// seekho_courses is read by the mobile app and Cloud Functions with
// where("class", "==", <number>) plus board, ordered by chapterNumber (see
// apps/mobile/lib/seekho/types.ts's SeekhoCourse). This form used to write a
// different shape (targetClass[] with no class/board/chapterNumber), so the
// documents it created could never appear for any student. It now writes the
// reader's shape; `class` is the source of truth and `targetClass` is only
// kept in step ([class]) for anything that still displays it.
const BOARDS = ["CBSE", "ICSE", "State"];
const SUBJECTS = ["Mathematics", "Science", "Social Science", "English"];

const EMPTY = {
  classLevel: "", board: "", subject: "", chapterNumber: 1, chapterTitle: "", description: "",
  totalLessons: 0, isFree: false, thumbnailUrl: "", estimatedMinutes: 0, order: 0, tags: "", isPublished: false,
};

export default function CreateCourse() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit   = !!id && id !== "new";
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!isEdit) return;
    getDoc(doc(db, "seekho_courses", id!)).then((snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      // Documents from the old form have only targetClass; pick up a single
      // class from it, otherwise leave blank so the admin must choose.
      const legacyClass = Array.isArray(d.targetClass) && d.targetClass.length === 1 ? parseClassLevel(d.targetClass[0]) : null;
      const cls = parseClassLevel(d.class) ?? legacyClass;
      setForm({
        ...EMPTY,
        classLevel: cls === null ? "" : String(cls),
        board: d.board ?? "",
        subject: d.subject ?? "",
        chapterNumber: d.chapterNumber ?? 1,
        chapterTitle: d.chapterTitle ?? d.title ?? "",
        description: d.description ?? "",
        totalLessons: d.totalLessons ?? 0,
        isFree: !!d.isFree,
        thumbnailUrl: d.thumbnailUrl ?? "",
        estimatedMinutes: d.estimatedMinutes ?? 0,
        order: d.order ?? 0,
        tags: (d.tags ?? []).join(", "),
        isPublished: d.isPublished !== false,
      });
    });
  }, [id, isEdit]);

  const set = (field: string, value: unknown) => setForm((p) => ({ ...p, [field]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const cls = parseClassLevel(form.classLevel);
    const chapterNumber = Number(form.chapterNumber);
    if (cls === null) return setError("Choose a class.");
    if (!form.board) return setError("Choose a board.");
    if (!form.subject) return setError("Choose a subject.");
    if (!Number.isInteger(chapterNumber) || chapterNumber < 1) return setError("Chapter number must be a whole number, 1 or more.");

    setSaving(true);
    try {
      const chapterTitle = form.chapterTitle.trim();
      const payload = {
        class: cls,
        board: form.board,
        subject: form.subject,
        chapterNumber,
        chapterTitle,
        title: chapterTitle,
        description: form.description,
        totalLessons: Number(form.totalLessons),
        isFree: form.isFree,
        thumbnailUrl: form.thumbnailUrl,
        isPublished: form.isPublished,
        targetClass: [String(cls)],
        tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
        estimatedMinutes: Number(form.estimatedMinutes),
        order: Number(form.order),
        updatedAt: serverTimestamp(),
      };
      if (isEdit) { await updateDoc(doc(db, "seekho_courses", id!), payload); }
      else { await addDoc(collection(db, "seekho_courses"), { ...payload, createdAt: serverTimestamp() }); }
      setSuccess(true);
      setTimeout(() => navigate("/courses"), 1200);
    } finally { setSaving(false); }
  };

  const inputCls = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
  const labelCls = "text-slate-300 text-sm font-semibold block mb-2";
  const subjectOptions = [...new Set([...SUBJECTS, ...(form.subject ? [form.subject] : [])])];

  return (
    <div className="max-w-3xl space-y-6">
      <div><h1 className="text-3xl font-black text-white">{isEdit ? "✏️ Edit Chapter" : "📚 Add Chapter"}</h1></div>
      {success && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-green-500/15 border border-green-500/30 rounded-xl p-4 text-green-400 font-semibold">✅ Saved!</motion.div>}
      {error && <div className="bg-red-500/15 border border-red-500/30 rounded-xl p-4 text-red-400 font-semibold">{error}</div>}
      <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Class *</label>
            <select value={form.classLevel} onChange={(e) => set("classLevel", e.target.value)} className={inputCls} required>
              <option value="">Select…</option>
              {SUPPORTED_CLASS_LEVEL_STRINGS.map((c) => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Board *</label>
            <select value={form.board} onChange={(e) => set("board", e.target.value)} className={inputCls} required>
              <option value="">Select…</option>
              {[...new Set([...BOARDS, ...(form.board ? [form.board] : [])])].map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Subject *</label>
            <select value={form.subject} onChange={(e) => set("subject", e.target.value)} className={inputCls} required>
              <option value="">Select…</option>
              {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div><label className={labelCls}>Chapter No. *</label><input type="number" min={1} value={form.chapterNumber} onChange={(e) => set("chapterNumber", e.target.value)} className={inputCls} required /></div>
          <div className="col-span-3"><label className={labelCls}>Chapter Title *</label><input value={form.chapterTitle} onChange={(e) => set("chapterTitle", e.target.value)} className={inputCls} required /></div>
        </div>
        <div><label className={labelCls}>Description</label><textarea value={form.description} onChange={(e) => set("description", e.target.value)} className={`${inputCls} resize-none h-20`} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls}>Total Lessons</label><input type="number" min={0} value={form.totalLessons} onChange={(e) => set("totalLessons", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Estimated Minutes</label><input type="number" min={0} value={form.estimatedMinutes} onChange={(e) => set("estimatedMinutes", e.target.value)} className={inputCls} /></div>
        </div>
        <div><label className={labelCls}>Thumbnail URL</label><input value={form.thumbnailUrl} onChange={(e) => set("thumbnailUrl", e.target.value)} className={inputCls} placeholder="https://…" /></div>
        <div><label className={labelCls}>Tags <span className="text-slate-500 font-normal">(comma-separated)</span></label><input value={form.tags} onChange={(e) => set("tags", e.target.value)} className={inputCls} placeholder="math, algebra, cbse" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls}>Display Order</label><input type="number" min={0} value={form.order} onChange={(e) => set("order", e.target.value)} className={inputCls} /></div>
        </div>
        <ToggleSwitch value={form.isFree} onChange={(v) => set("isFree", v)} label="Free chapter" />
        <ToggleSwitch value={form.isPublished} onChange={(v) => set("isPublished", v)} label="Published" />
        <button type="submit" disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors">
          {saving ? "Saving…" : isEdit ? "Update Chapter" : "Create Chapter"}
        </button>
      </form>
    </div>
  );
}

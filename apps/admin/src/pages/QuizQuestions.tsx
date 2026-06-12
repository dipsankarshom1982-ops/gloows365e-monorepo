import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, doc, deleteDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

interface Question { id: string; question: string; options: string[]; correctAnswerIndex: number; explanation?: string; difficulty?: string; }

const EMPTY_Q = { question: "", options: ["", "", "", ""], correctAnswerIndex: 0, explanation: "", difficulty: "medium" };
const inputCls = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
const labelCls = "text-slate-300 text-sm font-semibold block mb-1.5";

export default function QuizQuestions() {
  const { quizId } = useParams<{ quizId: string }>();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading]     = useState(true);
  const [quizTitle, setQuizTitle] = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_Q);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    if (!quizId) return;
    getDoc(doc(db, "quizzes", quizId)).then((snap) => {
      if (snap.exists()) setQuizTitle(snap.data().title ?? "Quiz");
    });
    getDocs(collection(db, "quizzes", quizId, "questions")).then((snap) => {
      setQuestions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Question)));
      setLoading(false);
    });
  }, [quizId]);

  const setOpt = (i: number, val: string) => setForm((f) => {
    const opts = [...f.options];
    opts[i] = val;
    return { ...f, options: opts };
  });

  const save = async () => {
    if (!form.question || form.options.some((o) => !o)) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "quizzes", quizId!, "questions"), {
        ...form, correctAnswerIndex: Number(form.correctAnswerIndex), createdAt: serverTimestamp(),
      });
      setQuestions((prev) => [...prev, { id: ref.id, ...form, correctAnswerIndex: Number(form.correctAnswerIndex) }]);
      setForm(EMPTY_Q);
      setShowForm(false);
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    await deleteDoc(doc(db, "quizzes", quizId!, "questions", id));
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Link to="/quizzes" className="hover:text-white transition-colors">Quizzes</Link>
            <span>›</span>
            <span className="text-white">{quizTitle || "…"}</span>
          </div>
          <h1 className="text-3xl font-black text-white">❓ Questions <span className="text-slate-500 text-xl">({questions.length})</span></h1>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">
          {showForm ? "Cancel" : "+ Add Question"}
        </button>
      </div>

      {/* Add question inline form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4"
          >
            <h2 className="text-white font-bold">New Question</h2>
            <div><label className={labelCls}>Question *</label><textarea value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} className={`${inputCls} resize-none h-20`} /></div>
            <div className="space-y-2">
              <label className={labelCls}>Options (select the correct one)</label>
              {form.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-3">
                  <button type="button" onClick={() => setForm((f) => ({ ...f, correctAnswerIndex: i }))}
                    className={`w-7 h-7 rounded-full border-2 shrink-0 transition-colors ${form.correctAnswerIndex === i ? "border-green-400 bg-green-400" : "border-slate-600 hover:border-slate-400"}`}
                  />
                  <input value={opt} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Option ${i + 1}`} className={inputCls} />
                </div>
              ))}
            </div>
            <div><label className={labelCls}>Explanation</label><input value={form.explanation} onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))} className={inputCls} /></div>
            <div className="flex gap-3">
              <button onClick={save} disabled={saving || !form.question} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-6 py-2 rounded-xl text-sm transition-colors">{saving ? "Saving…" : "Add Question"}</button>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white text-sm px-4">Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Questions list */}
      {loading ? <div className="text-center text-slate-400 py-16">Loading…</div> : questions.length === 0 && !showForm ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">No questions yet. Add your first question above.</div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {questions.map((q, i) => (
              <motion.div key={q.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-slate-500 text-xs mb-1">Q{i + 1}</p>
                    <p className="text-white font-medium">{q.question}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {q.options.map((opt, oi) => (
                        <div key={oi} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${oi === q.correctAnswerIndex ? "bg-green-500/20 text-green-400" : "bg-slate-800 text-slate-400"}`}>
                          <span className="font-bold">{String.fromCharCode(65 + oi)}.</span> {opt}
                        </div>
                      ))}
                    </div>
                    {q.explanation && <p className="text-slate-500 text-xs mt-2">💡 {q.explanation}</p>}
                  </div>
                  <button onClick={() => remove(q.id)} className="text-red-400 hover:text-red-300 text-xs shrink-0">✕</button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

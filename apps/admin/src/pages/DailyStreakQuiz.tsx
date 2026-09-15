// PATH: apps/admin/src/pages/DailyStreakQuiz.tsx
//
// Daily Streak Quiz — admin page.
//   Tab 1 "Questions": full CRUD over dailyStreakQuizQuestions (add, edit,
//     delete, class/language/subject, publish date, active status,
//     explanation, preview).
//   Tab 2 "Analytics": daily participation, correct-answer %, completion
//     rates, V-Coins distributed, active streak users — read from
//     studentDailyStreakProgress (rollups) + its days/ subcollection.
//
// Mirrors the patterns already used by Practice.tsx (DrawerForm CRUD),
// QuizQuestions.tsx (question bank with correct-option picker), and
// Dashboard.tsx / Analytics.tsx (KpiCard + recharts dashboards).

import { useEffect, useMemo, useState } from "react";
import {
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, collectionGroup,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import DrawerForm from "../components/DrawerForm";
import ToggleSwitch from "../components/ToggleSwitch";
import StatusBadge from "../components/StatusBadge";
import KpiCard from "../components/KpiCard";
import ChartTooltip from "../components/ChartTooltip";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Question {
  id: string;
  class: number;
  language: string;
  subject: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: "A" | "B" | "C" | "D";
  explanation: string;
  publishDate: string;
  status: "active" | "inactive";
  createdBy?: string;
  createdAt?: any;
}

interface DayRecord {
  studentId: string;
  date: string;
  isCorrect: boolean;
  vCoinsEarned: number;
  xpEarned: number;
}

const CLASSES = [6, 7, 8, 9, 10, 11, 12];
const LANGUAGES = [
  "English", "Hindi", "Assamese", "Bengali", "Bodo", "Dogri", "Gujarati",
  "Kannada", "Kashmiri", "Konkani", "Maithili", "Malayalam", "Manipuri",
  "Marathi", "Nepali", "Odia", "Punjabi", "Sanskrit", "Santali", "Sindhi",
  "Tamil", "Telugu", "Urdu",
];
const SUBJECTS = ["General Knowledge", "Mathematics", "Science", "English", "Social Science", "Current Affairs", "Logical Reasoning"];

const EMPTY_Q = {
  class: 8,
  language: "English",
  subject: "General Knowledge",
  question: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctOption: "A" as "A" | "B" | "C" | "D",
  explanation: "",
  publishDate: new Date().toISOString().slice(0, 10),
  status: "active" as "active" | "inactive",
};

const inputCls = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
const labelCls = "text-slate-300 text-sm font-semibold block mb-1.5";

export default function DailyStreakQuiz() {
  const [tab, setTab] = useState<"questions" | "analytics">("questions");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">🔥 Daily Streak Quiz</h1>
          <p className="text-slate-400 text-sm mt-1">Manage daily questions and track engagement</p>
        </div>
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1">
          <button
            onClick={() => setTab("questions")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${tab === "questions" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            ❓ Questions
          </button>
          <button
            onClick={() => setTab("analytics")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${tab === "analytics" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            📊 Analytics
          </button>
        </div>
      </div>

      {tab === "questions" ? <QuestionsTab /> : <AnalyticsTab />}
    </div>
  );
}

// ═══════════════════════════ QUESTIONS TAB ═══════════════════════════════

function QuestionsTab() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading]     = useState(true);
  const [drawerOpen, setDrawer]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]           = useState(EMPTY_Q);
  const [saving, setSaving]       = useState(false);
  const [previewing, setPreviewing] = useState<Question | null>(null);

  // Filters
  const [filterClass, setFilterClass]       = useState<string>("all");
  const [filterLanguage, setFilterLanguage] = useState<string>("all");
  const [filterStatus, setFilterStatus]     = useState<string>("all");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "dailyStreakQuizQuestions"), orderBy("publishDate", "desc")));
      setQuestions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Question)));
    } catch {
      // orderBy may need an index the first time — fall back unsorted
      const snap = await getDocs(collection(db, "dailyStreakQuizQuestions"));
      setQuestions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Question)));
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => questions.filter((q) =>
    (filterClass === "all" || String(q.class) === filterClass) &&
    (filterLanguage === "all" || q.language === filterLanguage) &&
    (filterStatus === "all" || q.status === filterStatus)
  ), [questions, filterClass, filterLanguage, filterStatus]);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_Q);
    setDrawer(true);
  };

  const openEdit = (q: Question) => {
    setEditingId(q.id);
    setForm({
      class: q.class, language: q.language, subject: q.subject,
      question: q.question, optionA: q.optionA, optionB: q.optionB,
      optionC: q.optionC, optionD: q.optionD, correctOption: q.correctOption,
      explanation: q.explanation, publishDate: q.publishDate, status: q.status,
    });
    setDrawer(true);
  };

  const isValid = form.question.trim() && form.optionA.trim() && form.optionB.trim() &&
    form.optionC.trim() && form.optionD.trim() && form.publishDate;

  const save = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "dailyStreakQuizQuestions", editingId), {
          ...form, class: Number(form.class), updatedAt: serverTimestamp(),
        });
        setQuestions((prev) => prev.map((q) => q.id === editingId ? { ...q, ...form, class: Number(form.class) } : q));
      } else {
        const ref = await addDoc(collection(db, "dailyStreakQuizQuestions"), {
          ...form, class: Number(form.class),
          createdBy: user?.uid ?? "admin",
          createdAt: serverTimestamp(),
        });
        setQuestions((prev) => [{ id: ref.id, ...form, class: Number(form.class) }, ...prev]);
      }
      setDrawer(false);
      setForm(EMPTY_Q);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this question permanently?")) return;
    await deleteDoc(doc(db, "dailyStreakQuizQuestions", id));
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const toggleStatus = async (q: Question) => {
    const next = q.status === "active" ? "inactive" : "active";
    await updateDoc(doc(db, "dailyStreakQuizQuestions", q.id), { status: next });
    setQuestions((prev) => prev.map((p) => p.id === q.id ? { ...p, status: next } : p));
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm">
            <option value="all">All Classes</option>
            {CLASSES.map((c) => <option key={c} value={c}>Class {c}</option>)}
          </select>
          <select value={filterLanguage} onChange={(e) => setFilterLanguage(e.target.value)} className="bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm">
            <option value="all">All Languages</option>
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">
          + Add Question
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No questions match these filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                <th className="text-left p-4">Question</th>
                <th className="text-left p-4">Class</th>
                <th className="text-left p-4">Language</th>
                <th className="text-left p-4">Subject</th>
                <th className="text-left p-4">Publish Date</th>
                <th className="text-right p-4">Active</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q, i) => (
                <motion.tr key={q.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="p-4 text-white font-medium max-w-[280px] truncate">{q.question}</td>
                  <td className="p-4 text-slate-300">Class {q.class}</td>
                  <td className="p-4 text-slate-300">{q.language}</td>
                  <td className="p-4 text-slate-300">{q.subject}</td>
                  <td className="p-4 text-slate-300 tabular-nums">{q.publishDate}</td>
                  <td className="p-4 text-right"><ToggleSwitch value={q.status === "active"} onChange={() => toggleStatus(q)} /></td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-3 text-xs">
                      <button onClick={() => setPreviewing(q)} className="text-indigo-400 hover:text-indigo-300">Preview</button>
                      <button onClick={() => openEdit(q)} className="text-slate-300 hover:text-white">Edit</button>
                      <button onClick={() => remove(q.id)} className="text-red-400 hover:text-red-300">Delete</button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit drawer */}
      <DrawerForm
        open={drawerOpen}
        onClose={() => setDrawer(false)}
        title={editingId ? "Edit Question" : "Add Question"}
        width="lg"
        footer={
          <>
            <button onClick={save} disabled={saving || !isValid}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
              {saving ? "Saving…" : editingId ? "Save Changes" : "Add Question"}
            </button>
            <button onClick={() => setDrawer(false)} className="text-slate-400 hover:text-white px-4 text-sm">Cancel</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Class</label>
            <select value={form.class} onChange={(e) => setForm((f) => ({ ...f, class: Number(e.target.value) }))} className={inputCls}>
              {CLASSES.map((c) => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Subject</label>
            <select value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className={inputCls}>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <p className="text-slate-500 text-xs -mt-2">
          Write the question in English — Gemini automatically translates it into each student's
          preferred language the first time someone in that language sees it, same as VidyaStar lessons.
        </p>

        <div>
          <label className={labelCls}>Question *</label>
          <textarea value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} className={`${inputCls} resize-none h-20`} />
        </div>

        <div className="space-y-2">
          <label className={labelCls}>Options (select the correct one) *</label>
          {(["A", "B", "C", "D"] as const).map((letter) => (
            <div key={letter} className="flex items-center gap-3">
              <button type="button" onClick={() => setForm((f) => ({ ...f, correctOption: letter }))}
                className={`w-8 h-8 rounded-lg border-2 shrink-0 flex items-center justify-center text-xs font-bold transition-colors ${form.correctOption === letter ? "border-green-400 bg-green-400 text-slate-950" : "border-slate-600 text-slate-400 hover:border-slate-400"}`}
              >
                {letter}
              </button>
              <input
                value={form[`option${letter}` as "optionA"]}
                onChange={(e) => setForm((f) => ({ ...f, [`option${letter}`]: e.target.value }))}
                placeholder={`Option ${letter}`}
                className={inputCls}
              />
            </div>
          ))}
          <p className="text-slate-500 text-xs">Tap the letter badge to mark the correct option.</p>
        </div>

        <div>
          <label className={labelCls}>Explanation</label>
          <textarea value={form.explanation} onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))} className={`${inputCls} resize-none h-16`} placeholder="Shown to the student after they answer, win or lose." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Publish Date *</label>
            <input type="date" value={form.publishDate} onChange={(e) => setForm((f) => ({ ...f, publishDate: e.target.value }))} className={inputCls} />
          </div>
          <div className="flex items-end pb-2.5">
            <ToggleSwitch value={form.status === "active"} onChange={(v) => setForm((f) => ({ ...f, status: v ? "active" : "inactive" }))} label="Active" />
          </div>
        </div>
      </DrawerForm>

      {/* Preview modal */}
      <AnimatePresence>
        {previewing && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPreviewing(null)} />
            <motion.div
              className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-indigo-400 text-xs font-bold uppercase">{previewing.subject}</span>
                <button onClick={() => setPreviewing(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>
              <p className="text-white font-semibold mb-4">{previewing.question}</p>
              <div className="space-y-2">
                {(["A", "B", "C", "D"] as const).map((letter) => (
                  <div key={letter} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${letter === previewing.correctOption ? "bg-green-500/15 border border-green-500/40 text-green-300" : "bg-slate-800 border border-slate-700 text-slate-300"}`}>
                    <span className="font-bold w-5">{letter}</span>
                    <span>{previewing[`option${letter}` as "optionA"]}</span>
                    {letter === previewing.correctOption && <span className="ml-auto text-xs">✓ Correct</span>}
                  </div>
                ))}
              </div>
              {previewing.explanation && (
                <p className="text-slate-400 text-xs mt-4">💡 {previewing.explanation}</p>
              )}
              <div className="flex gap-2 mt-4 text-xs text-slate-500">
                <span>Class {previewing.class}</span>·<span>{previewing.language}</span>·<span>{previewing.publishDate}</span>
                <StatusBadge label={previewing.status} variant={previewing.status === "active" ? "success" : "default"} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════ ANALYTICS TAB ═══════════════════════════════

function AnalyticsTab() {
  const [loading, setLoading] = useState(true);
  const [days, setDays]       = useState<DayRecord[]>([]);
  const [activeStreakUsers, setActiveStreakUsers] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        // Flatten all studentDailyStreakProgress/*/days/* via a collection
        // group query — avoids fetching every student doc just to list ids.
        const snap = await getDocs(collectionGroup(db, "days"));
        const records: DayRecord[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            studentId: d.ref.parent.parent?.id ?? "unknown",
            date: data.date,
            isCorrect: !!data.isCorrect,
            vCoinsEarned: data.vCoinsEarned ?? 0,
            xpEarned: data.xpEarned ?? 0,
          };
        });
        setDays(records);

        const progressSnap = await getDocs(collection(db, "studentDailyStreakProgress"));
        const activeCount = progressSnap.docs.filter((d) => (d.data().weeklyProgress ?? 0) > 0).length;
        setActiveStreakUsers(activeCount);
      } catch (e) {
        console.error("[DailyStreakQuiz analytics] load error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalSubmissions   = days.length;
  const totalCorrect       = days.filter((d) => d.isCorrect).length;
  const correctPct         = totalSubmissions > 0 ? totalCorrect / totalSubmissions : 0;
  const totalVCoins        = days.reduce((s, d) => s + d.vCoinsEarned, 0);

  // Participation by day (last 14 days present in the data)
  const byDate = useMemo(() => {
    const map: Record<string, { date: string; submissions: number; correct: number }> = {};
    days.forEach((d) => {
      if (!map[d.date]) map[d.date] = { date: d.date, submissions: 0, correct: 0 };
      map[d.date].submissions += 1;
      if (d.isCorrect) map[d.date].correct += 1;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  }, [days]);

  // Distinct students who ever submitted at least once = "completion" base
  const distinctStudents = useMemo(() => new Set(days.map((d) => d.studentId)).size, [days]);
  const avgCompletionRate = distinctStudents > 0 ? totalSubmissions / (distinctStudents * Math.max(byDate.length, 1)) : 0;

  if (loading) return <div className="text-slate-400 py-12 text-center">Loading analytics…</div>;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Participation" value={totalSubmissions} icon="🙋" color="bg-indigo-500/20 text-indigo-400" />
        <KpiCard label="Correct Answer %"    value={correctPct} format="percent" icon="✅" color="bg-emerald-500/20 text-emerald-400" />
        <KpiCard label="V-Coins Distributed" value={totalVCoins} icon="🪙" color="bg-amber-500/20 text-amber-400" />
        <KpiCard label="Active Streak Users" value={activeStreakUsers} icon="🔥" color="bg-orange-500/20 text-orange-400" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-bold mb-4">Daily Participation (last 14 days)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byDate}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="submissions" name="Submissions" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="correct" name="Correct" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.1 } }} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-bold mb-4">Correct Answer Trend</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={byDate.map((d) => ({ date: d.date, pct: d.submissions > 0 ? Math.round((d.correct / d.submissions) * 100) : 0 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="pct" name="Correct %" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b" }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-white font-bold mb-2">Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-400">Average Completion Rate</p>
            <p className="text-white font-bold text-lg tabular-nums">{(avgCompletionRate * 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-slate-400">Weekly Completion Rate</p>
            <p className="text-white font-bold text-lg tabular-nums">
              {distinctStudents > 0 ? `${Math.round((activeStreakUsers / distinctStudents) * 100)}%` : "—"}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Unique Students Participated</p>
            <p className="text-white font-bold text-lg tabular-nums">{distinctStudents}</p>
          </div>
        </div>
        <p className="text-slate-500 text-xs mt-4">
          "Weekly Completion Rate" = students currently mid-streak (weeklyProgress &gt; 0) ÷ all students who have ever submitted at least once.
        </p>
      </div>
    </div>
  );
}

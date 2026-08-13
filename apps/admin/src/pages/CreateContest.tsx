import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ToggleSwitch from "../components/ToggleSwitch";
import { db } from "../lib/firebase";

const ALL_CLASSES = ["6","7","8","9","10","11","12","all"];
const TYPES = ["quiz","essay","project","skill_battle"];

// Period key helpers
const pad = (n: number) => String(n).padStart(2, "0");
function getWeekNumber(d: Date) {
  const oneJan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
}
const buildPeriodKey = (type: string, d = new Date()) => {
  if (type === "daily")   return `daily_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  if (type === "weekly")  return `weekly_${d.getFullYear()}-W${pad(getWeekNumber(d))}`;
  if (type === "monthly") return `monthly_${d.getFullYear()}-${pad(d.getMonth()+1)}`;
  return `yearly_${d.getFullYear()}`;
};

const EMPTY = {
  title: "", description: "", rules: "", contestType: "quiz",
  startDate: "", endDate: "",
  totalSpots: 100,
  targetClass: ["all"] as string[], isActive: false,
  periodType: "monthly", periodKey: buildPeriodKey("monthly"),
  // V-Coins entry fee: what a student redeems from their V-Coins balance to
  // join this contest. This is the ONLY entry fee mechanism — no real-money
  // entry fee exists anywhere in VidyaStar. 0 = free to join.
  vCoinEntryFee: 0,
  // Sponsored contests waive the V-Coins fee entirely, regardless of
  // vCoinEntryFee — toggle this instead of zeroing the fee so the intended
  // cost is preserved if sponsorship ever lapses.
  isSponsored: false,
  sponsorName: "",
};

export default function CreateContest() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = !!id && id !== "new";

  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(isEdit ? id! : null);

  useEffect(() => {
    if (!isEdit) return;
    getDoc(doc(db, "contests", id!)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setForm({ ...EMPTY, ...data } as typeof EMPTY);
    });
  }, [id, isEdit]);

  const set = (field: string, value: unknown) => setForm((p) => ({ ...p, [field]: value }));
  const toggleClass = (c: string) =>
    setForm((p) => ({
      ...p,
      targetClass: p.targetClass.includes(c)
        ? p.targetClass.filter((v) => v !== c)
        : [...p.targetClass, c],
    }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    setSaving(true);
    try {
      const payload = {
        ...form,
        totalSpots: Number(form.totalSpots),
        vCoinEntryFee: Number(form.vCoinEntryFee),
        updatedAt: serverTimestamp(),
      };
      let newId = savedId;
      if (isEdit) {
        await updateDoc(doc(db, "contests", id!), payload);
        newId = id!;
      } else {
        const ref = await addDoc(collection(db, "contests"), {
          ...payload,
          participantCount: 0,
          joinedCount: 0,
          createdAt: serverTimestamp(),
        });
        newId = ref.id;
        setSavedId(newId);
      }
      setSuccess(true);
      if (!isEdit) {
        setTimeout(() => navigate(`/contests/${newId}`), 800);
      }
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
  const labelCls = "text-slate-300 text-sm font-semibold block mb-2";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">
          {isEdit ? "✏️ Edit Contest" : "🏁 Create Contest"}
        </h1>
      </div>

      {success && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-green-500/15 border border-green-500/30 rounded-xl p-4 text-green-400 font-semibold">
          ✅ Saved!
        </motion.div>
      )}

      <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div><label className={labelCls}>Title *</label><input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} required /></div>
        <div><label className={labelCls}>Description <span className="text-indigo-400">(English — AI translates and generates each student's lesson in their own preferred language)</span></label><textarea value={form.description} onChange={(e) => set("description", e.target.value)} className={`${inputCls} resize-none h-28`} placeholder="Describe the topic students will learn — e.g. 'Photosynthesis in plants, Class 8 Science'" /></div>
        <div><label className={labelCls}>Rules</label><textarea value={form.rules} onChange={(e) => set("rules", e.target.value)} className={`${inputCls} resize-none h-20`} /></div>

        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls}>Contest Type</label><select value={form.contestType} onChange={(e) => set("contestType", e.target.value)} className={inputCls}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className={labelCls}>Total Spots</label><input type="number" min={1} value={form.totalSpots} onChange={(e) => set("totalSpots", e.target.value)} className={inputCls} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls}>Start Date</label><input type="datetime-local" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>End Date</label><input type="datetime-local" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} className={inputCls} /></div>
        </div>
        <div>
          <label className={labelCls}>Period Type <span className="text-slate-500 font-normal">(for VidyaStar leaderboard)</span></label>
          <select value={form.periodType} onChange={(e) => { set("periodType", e.target.value); set("periodKey", buildPeriodKey(e.target.value)); }} className={inputCls}>
            {["daily","weekly","monthly","yearly"].map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Period Key <span className="text-indigo-400 text-xs">(auto-filled · links to VidyaStar prize config)</span></label>
          <input value={form.periodKey} onChange={(e) => set("periodKey", e.target.value)} className={inputCls} />
        </div>

        {/* ── V-Coins entry fee & sponsorship ────────────────────────────── */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-sm">🪙 V-Coins Entry Fee</p>
              <p className="text-slate-400 text-xs mt-0.5">
                Students redeem this many V-Coins from their balance to join. If their balance is too low, the app
                nudges them to earn more (watch reels/videos, Daily Streak Quiz, Skill Battle) instead of blocking them outright.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <label className={labelCls}>V-Coins Required — 0 = Free</label>
              <input
                type="number" min={0} value={form.vCoinEntryFee}
                onChange={(e) => set("vCoinEntryFee", e.target.value)}
                disabled={form.isSponsored}
                className={`${inputCls} ${form.isSponsored ? "opacity-50 cursor-not-allowed" : ""}`}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer pb-3">
              <input
                type="checkbox" checked={form.isSponsored}
                onChange={(e) => set("isSponsored", e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
              <span className="text-slate-200 text-sm font-bold">🎉 Sponsored — free entry, no V-Coins required</span>
            </label>
          </div>
          {form.isSponsored && (
            <div>
              <label className={labelCls}>Sponsor Name <span className="text-slate-500 font-normal">(shown on the contest card, e.g. "Sponsored by NCERT")</span></label>
              <input
                value={form.sponsorName} onChange={(e) => set("sponsorName", e.target.value)}
                placeholder="e.g. Byju's, NCERT, District Education Board"
                className={inputCls}
              />
            </div>
          )}
          {!form.isSponsored && Number(form.vCoinEntryFee) === 0 && (
            <p className="text-emerald-400 text-xs font-bold">✅ Free contest — no V-Coins needed to join</p>
          )}
        </div>

        <div>
          <label className={labelCls}>Target Class</label>
          <div className="flex flex-wrap gap-2">
            {ALL_CLASSES.map((c) => (
              <button key={c} type="button" onClick={() => toggleClass(c)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${form.targetClass.includes(c) ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>{c}</button>
            ))}
          </div>
        </div>
        <ToggleSwitch value={form.isActive} onChange={(v) => set("isActive", v)} label="Active (visible to students)" />
        <button type="submit" disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors">
          {saving ? "Saving…" : isEdit ? "Update Contest" : "Create Contest"}
        </button>
      </form>

      {/* ── AI Lesson info ── */}
      {savedId && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-black text-lg">🤖 AI Lesson & Banner</h2>
          <p className="text-slate-400 text-sm mt-1">
            No generation step needed here — Gemini generates each student's lesson and banner automatically,
            in their own preferred language, the first time they open this contest. Every language is generated
            once and cached, so only the very first student in each language waits for it.
          </p>
        </div>
      )}
    </div>
  );
}
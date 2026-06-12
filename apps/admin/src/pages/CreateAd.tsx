import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MediaUpload from "../components/MediaUpload";
import SafetyBadge from "../components/SafetyBadge";
import { db } from "../lib/firebase";

const AD_TYPES    = ["feed", "rewarded", "sponsored_reel", "scholarship"];
const AD_CATS     = ["education", "scholarship", "exam", "course", "skill", "olympiad"];
const ALL_MODULES = ["home","aiGuru","seekho","skillBoost","skillBattle","vidyaStar","learnFun","all"];
const ALL_CLASSES = ["6","7","8","9","10","11","12","all"];

const EMPTY = {
  adType: "feed", title: "", description: "", imageUrl: "", videoUrl: "", ctaText: "Learn More",
  ctaUrl: "", ctaRoute: "", sponsorName: "", adCategory: "education",
  targetModules: ["home"], targetClass: ["all"], targetInterests: [] as string[],
  isActive: false, isApproved: false, priority: 5,
  rewardCoins: 0, watchDuration: 15,
};

export default function CreateAd() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit   = !!id && id !== "new";

  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    getDoc(doc(db, "ads", id!)).then((snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setForm({
        ...EMPTY,
        ...d,
        rewardCoins:   d.reward?.coins ?? 0,
        watchDuration: d.reward?.watchDurationSeconds ?? 15,
      } as typeof EMPTY);
    });
  }, [id, isEdit]);

  const set = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const toggleArr = (field: "targetModules" | "targetClass", val: string) => {
    setForm((p) => {
      const arr = p[field] as string[];
      return { ...p, [field]: arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val] };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        adType: form.adType, title: form.title, description: form.description,
        imageUrl: form.imageUrl, videoUrl: form.videoUrl || null,
        ctaText: form.ctaText, ctaUrl: form.ctaUrl || null, ctaRoute: form.ctaRoute || null,
        sponsorName: form.sponsorName, adCategory: form.adCategory,
        targetModules: form.targetModules, targetClass: form.targetClass,
        targetInterests: form.targetInterests,
        isActive: form.isActive, isApproved: form.isApproved,
        priority: Number(form.priority),
        reward: form.adType === "rewarded"
          ? { coins: Number(form.rewardCoins), watchDurationSeconds: Number(form.watchDuration) }
          : null,
        updatedAt: serverTimestamp(),
      };

      if (isEdit) {
        await updateDoc(doc(db, "ads", id!), payload);
      } else {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "ads"), payload);
      }
      setSuccess(true);
      setTimeout(() => navigate("/ads"), 1200);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
  const labelCls = "text-slate-300 text-sm font-semibold block mb-2";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">{isEdit ? "✏️ Edit Ad" : "➕ Create Ad"}</h1>
        <p className="text-slate-400 text-sm mt-1">All ads start unapproved. Approve in All Ads after review.</p>
      </div>

      {success && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-green-500/15 border border-green-500/30 rounded-xl p-4 text-green-400 font-semibold">
          ✅ Saved! Redirecting...
        </motion.div>
      )}

      <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        {/* Type + Category */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Ad Type *</label>
            <select value={form.adType} onChange={(e) => set("adType", e.target.value)} className={inputCls} required>
              {AD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Category * <SafetyBadge category={form.adCategory} title={form.title} /></label>
            <select value={form.adCategory} onChange={(e) => set("adCategory", e.target.value)} className={inputCls} required>
              {AD_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Title + Sponsor */}
        <div>
          <label className={labelCls}>Ad Title *</label>
          <input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} required placeholder="Compelling headline for students" />
        </div>
        <div>
          <label className={labelCls}>Sponsor Name *</label>
          <input value={form.sponsorName} onChange={(e) => set("sponsorName", e.target.value)} className={inputCls} required placeholder="e.g. CodeVidya Academy" />
        </div>

        {/* Description */}
        <div>
          <label className={labelCls}>Description</label>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} className={`${inputCls} resize-none h-20`} placeholder="Brief description shown in expanded view" />
        </div>

        {/* Image */}
        <MediaUpload
          label="Ad Image *"
          storagePath="ads/images"
          value={form.imageUrl}
          onChange={(url) => set("imageUrl", url)}
          placeholder="https://… or upload below"
        />
        {(form.adType === "rewarded" || form.adType === "sponsored_reel") && (
          <MediaUpload
            mode="video"
            label="Cloudflare Stream Video"
            storagePath="ads/videos"
            value={form.videoUrl}
            onChange={(url) => set("videoUrl", url)}
            placeholder="https://… or upload via Cloudflare below"
          />
        )}

        {/* CTA */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>CTA Text *</label>
            <input value={form.ctaText} onChange={(e) => set("ctaText", e.target.value)} className={inputCls} required placeholder="Learn More" />
          </div>
          <div>
            <label className={labelCls}>Priority (1–20)</label>
            <input type="number" min={1} max={20} value={form.priority} onChange={(e) => set("priority", e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>External CTA URL</label>
            <input value={form.ctaUrl} onChange={(e) => set("ctaUrl", e.target.value)} className={inputCls} placeholder="https://..." />
          </div>
          <div>
            <label className={labelCls}>Internal Route (Expo)</label>
            <input value={form.ctaRoute} onChange={(e) => set("ctaRoute", e.target.value)} className={inputCls} placeholder="/ai-guru" />
          </div>
        </div>

        {/* Rewarded ad fields */}
        {form.adType === "rewarded" && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-4">
            <p className="text-amber-400 font-bold text-sm">🎁 Rewarded Ad Settings</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>V-Coins Reward</label>
                <input type="number" min={1} max={50} value={form.rewardCoins} onChange={(e) => set("rewardCoins", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Watch Duration (seconds)</label>
                <select value={form.watchDuration} onChange={(e) => set("watchDuration", e.target.value)} className={inputCls}>
                  <option value={15}>15 seconds</option>
                  <option value={30}>30 seconds</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Target Modules */}
        <div>
          <label className={labelCls}>Target Modules</label>
          <div className="flex flex-wrap gap-2">
            {ALL_MODULES.map((m) => (
              <button key={m} type="button"
                onClick={() => toggleArr("targetModules", m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  form.targetModules.includes(m)
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >{m}</button>
            ))}
          </div>
        </div>

        {/* Target Class */}
        <div>
          <label className={labelCls}>Target Class</label>
          <div className="flex flex-wrap gap-2">
            {ALL_CLASSES.map((c) => (
              <button key={c} type="button"
                onClick={() => toggleArr("targetClass", c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  form.targetClass.includes(c)
                    ? "bg-purple-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >{c}</button>
            ))}
          </div>
        </div>

        {/* Active toggle (not approve — that's in AdsList) */}
        <div className="flex items-center gap-3">
          <button type="button"
            onClick={() => set("isActive", !form.isActive)}
            className={`relative w-12 h-6 rounded-full transition-colors ${form.isActive ? "bg-indigo-600" : "bg-slate-700"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-6" : ""}`} />
          </button>
          <span className="text-slate-300 text-sm font-medium">Set Active on Save</span>
        </div>

        {/* Submit */}
        <button type="submit" disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors"
        >
          {saving ? "Saving..." : isEdit ? "Update Ad" : "Create Ad"}
        </button>
      </form>
    </div>
  );
}
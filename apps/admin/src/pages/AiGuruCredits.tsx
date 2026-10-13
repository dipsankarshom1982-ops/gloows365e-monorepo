// PATH: admin-web/src/pages/AiGuruCredits.tsx
// Admin config for AI Guru's pay-as-you-go credit system — coexists with
// SubscriptionPlans.tsx, doesn't replace it. Modeled directly on that page's
// CRUD conventions (DrawerForm + ToggleSwitch + GRADIENT_PRESETS + the same
// inputCls/labelCls string constants), not on Subscriptions.tsx (that one's
// read-only).
//
// Three sections:
//   1. Global settings (aiGuruCreditConfig/settings) — costPerAction is the
//      "tune the flat per-action cost later" knob the backend already
//      supports (functions/src/aiGuruCreditDebit.ts's getCreditCostPerAction).
//   2. Credit pack CRUD (aiGuruCreditPacks) — unlike SubscriptionPlans.tsx
//      (add + toggle only), this supports edit too: a pricing typo here is
//      real money, not just a display glitch.
//   3. KPI row sourced from aiGuruCreditOrders where status == "paid".

import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import DrawerForm from "../components/DrawerForm";
import KpiCard from "../components/KpiCard";
import ToggleSwitch from "../components/ToggleSwitch";
import { db } from "../lib/firebase";

interface CreditPack {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  credits: number;
  bonusCredits: number;
  pricePaise: number;
  gradient: [string, string];
  highlight: boolean;
  isActive: boolean;
  order: number;
}

const GRADIENT_PRESETS: { label: string; value: [string, string] }[] = [
  { label: "Indigo",  value: ["#4f46e5", "#7c3aed"] },
  { label: "Blue",    value: ["#2563eb", "#06b6d4"] },
  { label: "Green",   value: ["#059669", "#10b981"] },
  { label: "Orange",  value: ["#ea580c", "#f59e0b"] },
  { label: "Pink",    value: ["#db2777", "#9333ea"] },
  { label: "Teal",    value: ["#0d9488", "#2563eb"] },
];

const EMPTY_PACK = {
  name: "", emoji: "🎫", description: "",
  credits: 10, bonusCredits: 0, priceRupees: 49,
  gradient: 0, highlight: false, isActive: true, order: 0,
};

const inputCls = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
const labelCls = "text-slate-300 text-sm font-semibold block mb-1.5";

export default function AiGuruCredits() {
  const [packs, setPacks]       = useState<CreditPack[]>([]);
  const [loading, setLoading]   = useState(true);
  const [drawer, setDrawer]     = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]         = useState(EMPTY_PACK);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  const [costPerAction, setCostPerAction] = useState(1);
  const [creditsEnabled, setCreditsEnabled] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved]   = useState(false);

  const [kpi, setKpi] = useState({ packsSold: 0, revenuePaise: 0, creditsOutstanding: 0 });

  useEffect(() => {
    getDocs(collection(db, "aiGuruCreditPacks")).then((snap) => {
      setPacks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CreditPack)));
      setLoading(false);
    });

    getDoc(doc(db, "aiGuruCreditConfig", "settings")).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (typeof d.costPerAction === "number") setCostPerAction(d.costPerAction);
        if (typeof d.enabled === "boolean") setCreditsEnabled(d.enabled);
      }
    });

    getDocs(query(collection(db, "aiGuruCreditOrders"), where("status", "==", "paid"))).then((snap) => {
      let revenuePaise = 0;
      let creditsSold  = 0;
      snap.docs.forEach((d) => {
        const data = d.data();
        revenuePaise += Number(data.amountPaise) || 0;
        creditsSold  += Number(data.credits) || 0;
      });
      setKpi({ packsSold: snap.size, revenuePaise, creditsOutstanding: creditsSold });
    }).catch(() => {
      // Composite index missing / permission issue — KPIs just show zeros
      // rather than breaking the page, same fallback spirit as
      // AppConfigContext's plans listener elsewhere in this app.
    });
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_PACK);
    setError("");
    setDrawer(true);
  };

  const openEdit = (p: CreditPack) => {
    setEditingId(p.id);
    const gradientIdx = GRADIENT_PRESETS.findIndex(
      (g) => g.value[0] === p.gradient?.[0] && g.value[1] === p.gradient?.[1]
    );
    setForm({
      name: p.name, emoji: p.emoji, description: p.description ?? "",
      credits: p.credits, bonusCredits: p.bonusCredits ?? 0,
      priceRupees: Math.round((p.pricePaise ?? 0) / 100),
      gradient: gradientIdx >= 0 ? gradientIdx : 0,
      highlight: p.highlight, isActive: p.isActive, order: p.order,
    });
    setError("");
    setDrawer(true);
  };

  const savePack = async () => {
    setSaving(true); setError("");
    try {
      const gradient = GRADIENT_PRESETS[form.gradient as number]?.value ?? GRADIENT_PRESETS[0].value;
      const data = {
        name:         form.name,
        emoji:        form.emoji || "🎫",
        description:  form.description,
        credits:      Number(form.credits),
        bonusCredits: Number(form.bonusCredits) || 0,
        // Written once, here, as paise — everything downstream (Cloud
        // Function order creation, mobile/web display) reads pricePaise
        // directly rather than re-deriving it from a rupee value, so
        // there's exactly one place this conversion happens.
        pricePaise:   Math.round(Number(form.priceRupees) * 100),
        gradient,
        highlight:    form.highlight,
        isActive:     form.isActive,
        order:        Number(form.order),
        updatedAt:    serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, "aiGuruCreditPacks", editingId), data);
        setPacks((prev) => prev.map((p) => (p.id === editingId ? { ...p, ...data } : p)));
      } else {
        const ref = await addDoc(collection(db, "aiGuruCreditPacks"), {
          ...data, createdAt: serverTimestamp(),
        });
        setPacks((prev) => [...prev, { id: ref.id, ...data }]);
      }
      setDrawer(false);
      setForm(EMPTY_PACK);
      setEditingId(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "aiGuruCreditPacks", id), { isActive: !current });
    setPacks((prev) => prev.map((p) => (p.id === id ? { ...p, isActive: !current } : p)));
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    try {
      await setDoc(doc(db, "aiGuruCreditConfig", "settings"), {
        costPerAction: Number(costPerAction) || 1,
        enabled: creditsEnabled,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">🎫 AI Guru Credits</h1>
          <p className="text-slate-400 text-sm mt-1">Pay-as-you-go, alongside subscriptions — {packs.length} pack(s)</p>
        </div>
        <button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors">
          + Add Pack
        </button>
      </div>

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Packs Sold"           value={kpi.packsSold}                        icon="🛒" color="bg-indigo-500/20 text-indigo-400" />
        <KpiCard label="Revenue (₹)"          value={Math.round(kpi.revenuePaise / 100)}   icon="💰" color="bg-amber-500/20 text-amber-400" />
        <KpiCard label="Credits Sold (total)" value={kpi.creditsOutstanding}                icon="⚡" color="bg-purple-500/20 text-purple-400" />
      </div>

      {/* Global settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <p className="text-white font-bold">⚙️ Global Settings</p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className={labelCls}>Cost per action (credits)</label>
            <input
              type="number" min={1} value={costPerAction}
              onChange={(e) => setCostPerAction(Number(e.target.value))}
              className={`${inputCls} w-40`}
            />
          </div>
          <ToggleSwitch value={creditsEnabled} onChange={setCreditsEnabled} label="Credit system enabled" />
          <button
            onClick={saveSettings} disabled={settingsSaving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            {settingsSaving ? "Saving…" : settingsSaved ? "✓ Saved" : "Save Settings"}
          </button>
        </div>
        <p className="text-slate-500 text-xs">
          Every AI Guru action (Ask AI Guru, PhotoSolve, Exam Simulator, Voice Tutor, SkillGuru chat, lesson
          generation/follow-up) costs the same flat amount once a student exceeds today's free daily limit for
          that feature. Turning the system off makes every gate fall back to the old "come back tomorrow" message.
        </p>
      </div>

      {/* Pack grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 text-center text-slate-400 py-16">Loading…</div>
        ) : packs.length === 0 ? (
          <div className="col-span-3 text-center text-slate-500 py-16">
            No credit packs yet. Click <strong className="text-white">+ Add Pack</strong> to create one.
          </div>
        ) : (
          packs.map((p, i) => {
            const totalCredits = p.credits + (p.bonusCredits ?? 0);
            const rupees = (p.pricePaise ?? 0) / 100;
            const perCredit = totalCredits > 0 ? (rupees / totalCredits).toFixed(2) : "—";
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xl">{p.emoji || "🎫"}</span>
                      <p className="text-white font-bold">{p.name}</p>
                      {p.highlight && (
                        <span className="text-xs font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">BEST VALUE</span>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">order {p.order} · ₹{perCredit}/credit</p>
                    {p.description && <p className="text-slate-400 text-xs mt-0.5">{p.description}</p>}
                  </div>
                  <ToggleSwitch value={p.isActive} onChange={() => toggleActive(p.id, p.isActive)} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-slate-800 rounded-lg p-2">
                    <p className="text-white font-black text-sm">
                      {p.credits}{p.bonusCredits > 0 && <span className="text-emerald-400"> +{p.bonusCredits}</span>}
                    </p>
                    <p className="text-slate-500 text-xs">credits</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-2">
                    <p className="text-white font-black text-sm">₹{rupees.toLocaleString("en-IN")}</p>
                    <p className="text-slate-500 text-xs">price</p>
                  </div>
                </div>

                <div
                  className="h-1.5 rounded-full"
                  style={{ background: `linear-gradient(to right, ${p.gradient?.[0] ?? "#4f46e5"}, ${p.gradient?.[1] ?? "#7c3aed"})` }}
                />

                <button
                  onClick={() => openEdit(p)}
                  className="w-full text-center text-indigo-400 hover:text-indigo-300 text-xs font-semibold py-1.5"
                >
                  ✏️ Edit
                </button>
              </motion.div>
            );
          })
        )}
      </div>

      {/* ── Add/Edit Pack Drawer ── */}
      <DrawerForm
        open={drawer} onClose={() => setDrawer(false)} title={editingId ? "Edit Credit Pack" : "Add Credit Pack"}
        footer={
          <>
            <button onClick={savePack} disabled={saving || !form.name}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
              {saving ? "Saving…" : editingId ? "Save Changes" : "Create Pack"}
            </button>
            <button onClick={() => setDrawer(false)} className="text-slate-400 hover:text-white px-4 text-sm">Cancel</button>
          </>
        }
      >
        {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Pack Name *</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. Starter Pack" />
          </div>
          <div>
            <label className={labelCls}>Emoji</label>
            <input value={form.emoji} onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))} className={inputCls} placeholder="🎫" />
          </div>
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} placeholder="Good for a few days of questions" />
        </div>

        <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700 space-y-3">
          <p className="text-slate-300 text-xs font-bold uppercase tracking-wider">Credits & Price</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Credits</label>
              <input type="number" min={1} value={form.credits} onChange={(e) => setForm((f) => ({ ...f, credits: Number(e.target.value) }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Bonus credits</label>
              <input type="number" min={0} value={form.bonusCredits} onChange={(e) => setForm((f) => ({ ...f, bonusCredits: Number(e.target.value) }))} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>Price (₹)</label>
              <input type="number" min={1} value={form.priceRupees} onChange={(e) => setForm((f) => ({ ...f, priceRupees: Number(e.target.value) }))} className={inputCls} />
            </div>
          </div>
          <p className="text-slate-500 text-xs">
            {form.credits + (Number(form.bonusCredits) || 0)} total credits for ₹{form.priceRupees || 0}
            {" "}(₹{(form.credits + (Number(form.bonusCredits) || 0)) > 0
              ? (Number(form.priceRupees) / (form.credits + (Number(form.bonusCredits) || 0))).toFixed(2)
              : "—"}/credit)
          </p>
        </div>

        <div>
          <label className={labelCls}>Sort Order</label>
          <input type="number" min={0} value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} className={inputCls} placeholder="0 = first" />
        </div>

        <div>
          <label className={labelCls}>Card Gradient</label>
          <div className="grid grid-cols-3 gap-2">
            {GRADIENT_PRESETS.map((g, idx) => (
              <button key={idx} type="button"
                onClick={() => setForm((f) => ({ ...f, gradient: idx }))}
                className={`h-10 rounded-xl border-2 transition-all ${form.gradient === idx ? "border-white scale-105" : "border-transparent"}`}
                style={{ background: `linear-gradient(to right, ${g.value[0]}, ${g.value[1]})` }}
                title={g.label}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <ToggleSwitch value={form.highlight} onChange={(v) => setForm((f) => ({ ...f, highlight: v }))} label="Best Value badge" />
          <ToggleSwitch value={form.isActive}  onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}  label="Active" />
        </div>
      </DrawerForm>
    </div>
  );
}

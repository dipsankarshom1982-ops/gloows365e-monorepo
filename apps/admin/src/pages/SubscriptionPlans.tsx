/**
 * admin-web/src/pages/SubscriptionPlans.tsx — FIXED
 *
 * ROOT CAUSE OF "plan not working":
 *
 * The old form saved: { name, description, price, durationDays, features, isActive }
 * The app reads:      { monthlyPrice, annualPrice, annualMonthly, features, gradient,
 *                       highlight, isActive, order, module, emoji }
 *
 * Fields didn't match at all, so:
 *   1. AppConfigContext query has orderBy("order") → Firestore error if field missing
 *      → plansReady never set true → configLoading stays true → spinner forever
 *   2. aiGuruPlans filter (p.module === "aiGuru") → always [] → "Coming Soon" shown
 *   3. Plan cards showed ₹0 prices (monthlyPrice/annualPrice were undefined)
 *
 * FIXES:
 *   - Form now saves ALL fields the app's SubscriptionPlan type expects
 *   - module selector: aiGuru / seekho / discover
 *   - emoji picker, gradient presets, highlight toggle
 *   - monthlyPrice, annualPrice, annualMonthly (separate fields)
 *   - order field for correct sorting
 *   - Display table updated to show the correct fields
 */

import { addDoc, collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import DrawerForm from "../components/DrawerForm";
import StatusBadge from "../components/StatusBadge";
import ToggleSwitch from "../components/ToggleSwitch";
import { db, functions } from "../lib/firebase";

interface Plan {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  module: string;
  monthlyPrice: number;
  annualPrice: number;
  annualMonthly: number;
  features: string[];
  gradient: [string, string];
  highlight: boolean;
  isActive: boolean;
  isCombo?: boolean;
  order: number;
  discountPercent?: number;
}

const createComboPlanFn = httpsCallable<
  { name: string; description: string; planIds: string[]; price: number; durationDays: number; discountPercent: number },
  { planId: string }
>(functions, "createComboPlan");

const GRADIENT_PRESETS: { label: string; value: [string, string] }[] = [
  { label: "Indigo",  value: ["#4f46e5", "#7c3aed"] },
  { label: "Blue",    value: ["#2563eb", "#06b6d4"] },
  { label: "Green",   value: ["#059669", "#10b981"] },
  { label: "Orange",  value: ["#ea580c", "#f59e0b"] },
  { label: "Pink",    value: ["#db2777", "#9333ea"] },
  { label: "Teal",    value: ["#0d9488", "#2563eb"] },
];

const MODULE_OPTIONS = [
  { value: "aiGuru",   label: "🤖 AI Guru" },
  { value: "seekho",   label: "📚 Seekho" },
  { value: "discover", label: "🔍 Discover" },
];

const EMPTY_PLAN = {
  name: "", emoji: "✨", description: "", module: "aiGuru",
  monthlyPrice: 0, annualPrice: 0, annualMonthly: 0,
  features: "", gradient: 0, highlight: false, isActive: true, order: 0,
};

const COMBO_EMPTY = { name: "", description: "", planIds: "", price: 0, durationDays: 30, discountPercent: 0 };

const inputCls  = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
const labelCls  = "text-slate-300 text-sm font-semibold block mb-1.5";
const selectCls = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors";

export default function SubscriptionPlans() {
  const [plans, setPlans]             = useState<Plan[]>([]);
  const [loading, setLoading]         = useState(true);
  const [planDrawer, setPlanDrawer]   = useState(false);
  const [comboDrawer, setComboDrawer] = useState(false);
  const [form, setForm]               = useState(EMPTY_PLAN);
  const [comboForm, setComboForm]     = useState(COMBO_EMPTY);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  useEffect(() => {
    getDocs(collection(db, "subscriptionPlans")).then((snap) => {
      setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Plan)));
      setLoading(false);
    });
  }, []);

  const savePlan = async () => {
    setSaving(true); setError("");
    try {
      const gradient = GRADIENT_PRESETS[form.gradient as number]?.value ?? GRADIENT_PRESETS[0].value;
      const data = {
        name:          form.name,
        emoji:         form.emoji || "✨",
        description:   form.description,
        module:        form.module,
        // Prices — these are what the app reads
        monthlyPrice:  Number(form.monthlyPrice),
        annualPrice:   Number(form.annualPrice),
        annualMonthly: Number(form.annualMonthly),
        // Features array — app renders plan.features.map(...)
        features:      form.features.split("\n").map((s) => s.trim()).filter(Boolean),
        // Gradient — app uses plan.gradient as LinearGradient colors
        gradient,
        // Highlight — shows "⭐ Most Popular" badge and auto-selects on open
        highlight:     form.highlight,
        isActive:      form.isActive,
        isCombo:       false,
        // order — required by AppConfigContext orderBy("order") query
        order:         Number(form.order),
        updatedAt:     serverTimestamp(),
      };
      const ref = await addDoc(collection(db, "subscriptionPlans"), {
        ...data, createdAt: serverTimestamp(),
      });
      setPlans((prev) => [...prev, { id: ref.id, ...data }]);
      setPlanDrawer(false);
      setForm(EMPTY_PLAN);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveCombo = async () => {
    setSaving(true); setError("");
    try {
      const result = await createComboPlanFn({
        name:            comboForm.name,
        description:     comboForm.description,
        planIds:         comboForm.planIds.split(",").map((s) => s.trim()).filter(Boolean),
        price:           comboForm.price,
        durationDays:    comboForm.durationDays,
        discountPercent: comboForm.discountPercent,
      });
      setPlans((prev) => [...prev, {
        id: result.data.planId, name: comboForm.name, description: comboForm.description,
        emoji: "🔗", module: "aiGuru",
        monthlyPrice: comboForm.price, annualPrice: comboForm.price, annualMonthly: comboForm.price,
        features: [], gradient: GRADIENT_PRESETS[0].value,
        highlight: false, isActive: true, isCombo: true,
        order: 99, discountPercent: comboForm.discountPercent,
      }]);
      setComboDrawer(false);
      setComboForm(COMBO_EMPTY);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "subscriptionPlans", id), { isActive: !current });
    setPlans((prev) => prev.map((p) => p.id === id ? { ...p, isActive: !current } : p));
  };

  const moduleLabel = (m: string) => MODULE_OPTIONS.find((o) => o.value === m)?.label ?? m;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">💎 Subscription Plans</h1>
          <p className="text-slate-400 text-sm mt-1">{plans.length} plan(s)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setComboDrawer(true)} className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors">
            🔗 Combo Plan
          </button>
          <button onClick={() => setPlanDrawer(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors">
            + Add Plan
          </button>
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 text-center text-slate-400 py-16">Loading…</div>
        ) : plans.length === 0 ? (
          <div className="col-span-3 text-center text-slate-500 py-16">
            No plans yet. Click <strong className="text-white">+ Add Plan</strong> to create one.
          </div>
        ) : (
          plans.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl">{p.emoji || "✨"}</span>
                    <p className="text-white font-bold">{p.name}</p>
                    {p.isCombo    && <StatusBadge label="COMBO"    variant="warning" />}
                    {p.highlight  && <StatusBadge label="POPULAR"  variant="success" />}
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5">{moduleLabel(p.module)} · order {p.order}</p>
                  {p.description && <p className="text-slate-400 text-xs mt-0.5">{p.description}</p>}
                </div>
                <ToggleSwitch value={p.isActive} onChange={() => toggle(p.id, p.isActive)} />
              </div>

              {/* Prices */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-800 rounded-lg p-2">
                  <p className="text-white font-black text-sm">₹{p.monthlyPrice?.toLocaleString("en-IN") ?? "—"}</p>
                  <p className="text-slate-500 text-xs">monthly</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-2">
                  <p className="text-white font-black text-sm">₹{p.annualPrice?.toLocaleString("en-IN") ?? "—"}</p>
                  <p className="text-slate-500 text-xs">annual</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-2">
                  <p className="text-white font-black text-sm">₹{p.annualMonthly?.toLocaleString("en-IN") ?? "—"}</p>
                  <p className="text-slate-500 text-xs">/mo billed yr</p>
                </div>
              </div>

              {/* Gradient preview */}
              <div
                className="h-1.5 rounded-full"
                style={{ background: `linear-gradient(to right, ${p.gradient?.[0] ?? "#4f46e5"}, ${p.gradient?.[1] ?? "#7c3aed"})` }}
              />

              {/* Features */}
              {p.features?.length > 0 && (
                <ul className="space-y-1">
                  {p.features.slice(0, 3).map((f) => (
                    <li key={f} className="text-slate-400 text-xs flex items-center gap-1.5">
                      <span className="text-green-400">✓</span>{f}
                    </li>
                  ))}
                  {p.features.length > 3 && <li className="text-slate-500 text-xs">+{p.features.length - 3} more</li>}
                </ul>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* ── Add Plan Drawer ── */}
      <DrawerForm
        open={planDrawer} onClose={() => setPlanDrawer(false)} title="Add Subscription Plan"
        footer={
          <>
            <button onClick={savePlan} disabled={saving || !form.name}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
              {saving ? "Saving…" : "Save Plan"}
            </button>
            <button onClick={() => setPlanDrawer(false)} className="text-slate-400 hover:text-white px-4 text-sm">Cancel</button>
          </>
        }
      >
        {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Plan Name *</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. AI Guru Pro" />
          </div>
          <div>
            <label className={labelCls}>Emoji</label>
            <input value={form.emoji} onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))} className={inputCls} placeholder="✨" />
          </div>
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Module *</label>
            <select value={form.module} onChange={(e) => setForm((f) => ({ ...f, module: e.target.value }))} className={selectCls}>
              {MODULE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Sort Order</label>
            <input type="number" min={0} value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} className={inputCls} placeholder="0 = first" />
          </div>
        </div>

        <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700 space-y-1">
          <p className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">Pricing</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Monthly (₹)</label>
              <input type="number" min={0} value={form.monthlyPrice} onChange={(e) => setForm((f) => ({ ...f, monthlyPrice: Number(e.target.value) }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Annual Total (₹)</label>
              <input type="number" min={0} value={form.annualPrice} onChange={(e) => setForm((f) => ({ ...f, annualPrice: Number(e.target.value) }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Annual ÷12 (₹/mo)</label>
              <input type="number" min={0} value={form.annualMonthly} onChange={(e) => setForm((f) => ({ ...f, annualMonthly: Number(e.target.value) }))} className={inputCls} placeholder="= annual/12" />
            </div>
          </div>
          <p className="text-slate-500 text-xs">annualMonthly = what users see as ₹X/mo when billed yearly</p>
        </div>

        <div>
          <label className={labelCls}>Features <span className="text-slate-500 font-normal">(one per line)</span></label>
          <textarea value={form.features} onChange={(e) => setForm((f) => ({ ...f, features: e.target.value }))} className={`${inputCls} resize-none h-28`} placeholder={"Unlimited AI lessons\nAll 22 Indian languages\nPersonalised study plan"} />
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
          <ToggleSwitch value={form.highlight} onChange={(v) => setForm((f) => ({ ...f, highlight: v }))} label="⭐ Most Popular badge" />
          <ToggleSwitch value={form.isActive}  onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}  label="Active" />
        </div>
      </DrawerForm>

      {/* ── Combo Plan Drawer ── */}
      <DrawerForm
        open={comboDrawer} onClose={() => setComboDrawer(false)} title="Create Combo Plan"
        footer={
          <>
            <button onClick={saveCombo} disabled={saving || !comboForm.name || !comboForm.planIds}
              className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
              {saving ? "Creating…" : "Create Combo"}
            </button>
            <button onClick={() => setComboDrawer(false)} className="text-slate-400 hover:text-white px-4 text-sm">Cancel</button>
          </>
        }
      >
        {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</p>}
        <div><label className={labelCls}>Combo Name *</label><input value={comboForm.name} onChange={(e) => setComboForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} /></div>
        <div><label className={labelCls}>Description</label><input value={comboForm.description} onChange={(e) => setComboForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} /></div>
        <div>
          <label className={labelCls}>Plan IDs to Bundle <span className="text-slate-500 font-normal">(comma-separated Firestore doc IDs)</span></label>
          <input value={comboForm.planIds} onChange={(e) => setComboForm((f) => ({ ...f, planIds: e.target.value }))} className={inputCls} placeholder="abc123, def456" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Combo Price (₹)</label><input type="number" min={0} value={comboForm.price} onChange={(e) => setComboForm((f) => ({ ...f, price: Number(e.target.value) }))} className={inputCls} /></div>
          <div><label className={labelCls}>Duration (days)</label><input type="number" min={1} value={comboForm.durationDays} onChange={(e) => setComboForm((f) => ({ ...f, durationDays: Number(e.target.value) }))} className={inputCls} /></div>
        </div>
        <div><label className={labelCls}>Discount %</label><input type="number" min={0} max={100} value={comboForm.discountPercent} onChange={(e) => setComboForm((f) => ({ ...f, discountPercent: Number(e.target.value) }))} className={inputCls} /></div>
      </DrawerForm>
    </div>
  );
}
import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import { motion } from "framer-motion";
import DrawerForm from "../components/DrawerForm";
import StatusBadge from "../components/StatusBadge";
import ToggleSwitch from "../components/ToggleSwitch";

interface Coupon {
  id: string;
  code: string;
  discountType: "percent" | "flat";
  discountValue: number;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  isActive: boolean;
  planIds?: string[];
  createdAt?: string;
}

const createCouponFn = httpsCallable<
  { code?: string; discountType: string; discountValue: number; maxUses: number; expiresAt: string; planIds?: string[] },
  { couponId: string; code: string }
>(functions, "createCoupon");

const EMPTY: { code: string; discountType: "percent" | "flat"; discountValue: number; maxUses: number; expiresAt: string; planIds: string } = { code: "", discountType: "percent", discountValue: 10, maxUses: 100, expiresAt: "", planIds: "" };
const inputCls = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
const labelCls = "text-slate-300 text-sm font-semibold block mb-1.5";

export default function Coupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");

  useEffect(() => {
    getDocs(collection(db, "coupons")).then((snap) => {
      setCoupons(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Coupon)));
      setLoading(false);
    });
  }, []);

  const handleCreate = async () => {
    setSaving(true); setError("");
    try {
      const result = await createCouponFn({
        code: form.code || undefined,
        discountType: form.discountType,
        discountValue: form.discountValue,
        maxUses: form.maxUses,
        expiresAt: form.expiresAt,
        planIds: form.planIds ? form.planIds.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      });
      setCoupons((prev) => [...prev, {
        id: result.data.couponId,
        code: result.data.code,
        discountType: form.discountType,
        discountValue: form.discountValue,
        maxUses: form.maxUses,
        usedCount: 0,
        expiresAt: form.expiresAt,
        isActive: true,
      }]);
      setDrawerOpen(false);
      setForm(EMPTY);
    } catch (e: any) {
      setError(e.message ?? "Failed to create coupon.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "coupons", id), { isActive: !current });
    setCoupons((prev) => prev.map((c) => c.id === id ? { ...c, isActive: !current } : c));
  };

  const isExpired = (expiresAt: string) => expiresAt && new Date(expiresAt) < new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">🎟️ Coupons</h1>
          <p className="text-slate-400 text-sm mt-1">{coupons.length} coupon(s)</p>
        </div>
        <button onClick={() => { setDrawerOpen(true); setError(""); }} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">
          + Create Coupon
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : coupons.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No coupons yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                <th className="text-left p-4">Code</th>
                <th className="text-left p-4">Discount</th>
                <th className="text-left p-4">Usage</th>
                <th className="text-left p-4">Expires</th>
                <th className="text-right p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c, i) => (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="p-4">
                    <span className="font-mono font-bold text-indigo-400">{c.code}</span>
                  </td>
                  <td className="p-4 text-white">
                    {c.discountType === "percent" ? `${c.discountValue}%` : `₹${c.discountValue}`}
                    <span className="text-slate-500 text-xs ml-1">({c.discountType})</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 max-w-[80px] h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, (c.usedCount / c.maxUses) * 100)}%` }} />
                      </div>
                      <span className="text-slate-400 text-xs tabular-nums">{c.usedCount}/{c.maxUses}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    {c.expiresAt ? (
                      <span className={isExpired(c.expiresAt) ? "text-red-400" : "text-slate-300"}>
                        {new Date(c.expiresAt).toLocaleDateString("en-IN")}
                      </span>
                    ) : <span className="text-slate-500">Never</span>}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isExpired(c.expiresAt) && <StatusBadge label="Expired" variant="error" />}
                      <ToggleSwitch value={c.isActive} onChange={() => toggleActive(c.id, c.isActive)} />
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <DrawerForm
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Create Coupon"
        footer={
          <>
            <button onClick={handleCreate} disabled={saving || !form.expiresAt} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
              {saving ? "Creating…" : "Create Coupon"}
            </button>
            <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-white px-4 text-sm">Cancel</button>
          </>
        }
      >
        {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</p>}
        <div>
          <label className={labelCls}>Coupon Code <span className="text-slate-500 font-normal">(leave blank to auto-generate)</span></label>
          <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} className={inputCls} placeholder="e.g. VIDYA20" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Discount Type</label>
            <select value={form.discountType} onChange={(e) => { const v = e.target.value as "percent" | "flat"; setForm((f) => ({ ...f, discountType: v })); }} className={inputCls}>
              <option value="percent">Percent (%)</option>
              <option value="flat">Flat (₹)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Value</label>
            <input type="number" min={1} value={form.discountValue} onChange={(e) => setForm((f) => ({ ...f, discountValue: Number(e.target.value) }))} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Max Uses</label>
          <input type="number" min={1} value={form.maxUses} onChange={(e) => setForm((f) => ({ ...f, maxUses: Number(e.target.value) }))} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Expires At *</label>
          <input type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Restrict to Plan IDs <span className="text-slate-500 font-normal">(comma-separated, optional)</span></label>
          <input value={form.planIds} onChange={(e) => setForm((f) => ({ ...f, planIds: e.target.value }))} className={inputCls} placeholder="plan_basic, plan_pro" />
        </div>
      </DrawerForm>
    </div>
  );
}

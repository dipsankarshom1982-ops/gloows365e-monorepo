// PATH: apps/admin/src/pages/PayoutSettings.tsx
// ShikshaHub Phase 5 operational feature — admin screen for
// payoutConfig/settings (commission %, minimum payout, enabled toggle).
// Unlike AiGuruCredits.tsx's older costPerAction settings block (which
// writes aiGuruCreditConfig/settings directly via a client setDoc), this
// goes through functions/src/tutorPayouts.ts's updatePayoutConfig
// callable — payoutConfig/{docId} has `allow write: if false` in
// firestore.rules, so this is the only way the doc is ever changed, and
// every value is server-validated and stamped with updatedAt/updatedBy.
// Reading it stays a direct client getDoc (read is open to any
// authenticated user in firestore.rules — apps/tutor's and
// apps/tutor-mobile's payouts screens read the same doc the same way).

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";

interface PayoutConfig {
  commissionPercent?: number;
  minimumPayoutAmount?: number;
  enabled?: boolean;
  updatedAt?: { toDate?: () => Date };
  updatedBy?: string;
}

const DEFAULT_COMMISSION_PERCENT = 10;
const DEFAULT_MINIMUM_PAYOUT = 100;

const updatePayoutConfigFn = httpsCallable<
  { commissionPercent: number; minimumPayoutAmount: number; enabled: boolean },
  { commissionPercent: number; minimumPayoutAmount: number; enabled: boolean }
>(functions, "updatePayoutConfig");

const inputCls = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
const labelCls = "text-slate-300 text-sm font-semibold block mb-1.5";

function fmtDate(ts?: { toDate?: () => Date }): string {
  const d = ts?.toDate?.();
  return d ? d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
}

export default function PayoutSettings() {
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<PayoutConfig>({});

  const [commissionPercent, setCommissionPercent] = useState(DEFAULT_COMMISSION_PERCENT);
  const [minimumPayoutAmount, setMinimumPayoutAmount] = useState(DEFAULT_MINIMUM_PAYOUT);
  const [enabled, setEnabled] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "payoutConfig", "settings"));
      const data = snap.exists() ? (snap.data() as PayoutConfig) : {};
      setCurrent(data);
      setCommissionPercent(typeof data.commissionPercent === "number" ? data.commissionPercent : DEFAULT_COMMISSION_PERCENT);
      setMinimumPayoutAmount(typeof data.minimumPayoutAmount === "number" ? data.minimumPayoutAmount : DEFAULT_MINIMUM_PAYOUT);
      setEnabled(data.enabled !== false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const dirty =
    commissionPercent !== (current.commissionPercent ?? DEFAULT_COMMISSION_PERCENT) ||
    minimumPayoutAmount !== (current.minimumPayoutAmount ?? DEFAULT_MINIMUM_PAYOUT) ||
    enabled !== (current.enabled !== false);

  async function save() {
    if (!window.confirm(
      `Save payout settings?\n\nCommission: ${commissionPercent}%\nMinimum payout: ₹${minimumPayoutAmount}\nPayouts: ${enabled ? "Enabled" : "Disabled"}\n\nThis takes effect immediately for new payout requests.`
    )) return;

    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await updatePayoutConfigFn({ commissionPercent, minimumPayoutAmount, enabled });
      await load(); // re-read so "Last updated" reflects the real server-stamped updatedAt/updatedBy
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.message ?? "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">⚙️ Payout Settings</h1>
        <p className="text-slate-400 text-sm mt-1">
          Platform commission and minimum withdrawal amount for tutor Instant Help earnings payouts.
          Changes only affect new payout requests — in-flight and past requests keep their own snapshotted rate.
        </p>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-16">Loading…</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 max-w-lg">
          <div>
            <label className={labelCls}>Platform commission (%)</label>
            <input
              type="number" min={0} max={100} step={0.5}
              value={commissionPercent}
              onChange={(e) => setCommissionPercent(Number(e.target.value))}
              className={inputCls}
            />
            <p className="text-slate-500 text-xs mt-1">0–100. Deducted from the requested amount, not added on top.</p>
          </div>

          <div>
            <label className={labelCls}>Minimum payout amount (₹)</label>
            <input
              type="number" min={0} step={1}
              value={minimumPayoutAmount}
              onChange={(e) => setMinimumPayoutAmount(Math.round(Number(e.target.value)))}
              className={inputCls}
            />
            <p className="text-slate-500 text-xs mt-1">Non-negative whole number.</p>
          </div>

          <div className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3">
            <div>
              <p className="text-white font-semibold text-sm">Payouts enabled</p>
              <p className="text-slate-500 text-xs mt-0.5">Turning this off blocks new payout requests platform-wide.</p>
            </div>
            <button
              onClick={() => setEnabled((v) => !v)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition-colors ${
                enabled ? "bg-success/20 text-success" : "bg-slate-700 text-slate-400"
              }`}
            >
              {enabled ? "🟢 Enabled" : "⚪ Disabled"}
            </button>
          </div>

          {error && <p className="text-red-400 text-xs font-semibold">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && <span className="text-green-400 text-sm font-semibold">✓ Saved</span>}
            {!dirty && !saved && <span className="text-slate-500 text-xs">No unsaved changes</span>}
          </div>

          <div className="border-t border-slate-800 pt-3 text-xs text-slate-500">
            Last updated: {fmtDate(current.updatedAt)}
            {current.updatedBy && <> · by <span className="font-mono">{current.updatedBy.slice(0, 14)}…</span></>}
          </div>
        </div>
      )}
    </div>
  );
}

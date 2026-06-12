// ─────────────────────────────────────────────────────────────────────────────
// FILE: admin-web/src/pages/Referrals.tsx  (NEW FILE)
// PATH: admin-web/src/pages/Referrals.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface MilestoneReward {
  every:     number;
  giftLabel: string;
  giftType:  "badge" | "subscription_days" | "coins";
  giftValue: number;
}

interface ReferralConfig {
  referrerCoins:  number;
  refereeCoins:   number;
  giftEnabled:    boolean;
  giftLabel:      string;
  giftImageUrl:   string;
  triggerEvent:   "signup" | "first_login" | "first_quiz";
  maxReferrals:   number;
  isActive:       boolean;
  milestones:     MilestoneReward[];
}

interface TopReferrer {
  uid:                 string;
  referralCode:        string;
  referralCount:       number;
  referralCoinsEarned: number;
}

const DEFAULT_CONFIG: ReferralConfig = {
  referrerCoins: 50,
  refereeCoins:  30,
  giftEnabled:   false,
  giftLabel:     "",
  giftImageUrl:  "",
  triggerEvent:  "signup",
  maxReferrals:  0,
  isActive:      true,
  milestones:    [],
};

export default function Referrals() {
  const [config,     setConfig]     = useState<ReferralConfig>(DEFAULT_CONFIG);
  const [topRefs,    setTopRefs]    = useState<TopReferrer[]>([]);
  const [stats,      setStats]      = useState({ total: 0, thisMonth: 0, coinsGiven: 0 });
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [newMilestone, setNewMilestone] = useState<Partial<MilestoneReward>>({ every: 5, giftType: "coins", giftValue: 100, giftLabel: "" });

  // ─── Load config + stats ──────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        // Config
        const configSnap = await getDoc(doc(db, "appConfig", "referralConfig"));
        if (configSnap.exists()) {
          setConfig({ ...DEFAULT_CONFIG, ...(configSnap.data() as Partial<ReferralConfig>) });
        }

        // Stats: count referrals
        const allSnap = await getDocs(collection(db, "referrals"));
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        let thisMonth = 0;
        let coinsGiven = 0;
        allSnap.docs.forEach((d) => {
          const data = d.data();
          const ts: Timestamp = data.createdAt;
          if (ts?.toDate && ts.toDate() > monthStart) thisMonth++;
          coinsGiven += (data.referrerCoinsGiven ?? 0) + (data.refereeCoinsGiven ?? 0);
        });
        setStats({ total: allSnap.size, thisMonth, coinsGiven });

        // Top referrers
        try {
          const fn = httpsCallable<void, TopReferrer[]>(functions, "getReferralLeaderboard");
          const { data } = await fn();
          setTopRefs(data ?? []);
        } catch { /* leaderboard is optional */ }

      } catch (err) {
        console.error("Failed to load referral data:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ─── Save config ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "appConfig", "referralConfig"), config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert("Save failed: " + (err as any).message);
    } finally {
      setSaving(false);
    }
  };

  const addMilestone = () => {
    if (!newMilestone.giftLabel || !newMilestone.every) return;
    setConfig((prev) => ({
      ...prev,
      milestones: [...(prev.milestones ?? []), newMilestone as MilestoneReward],
    }));
    setNewMilestone({ every: 5, giftType: "coins", giftValue: 100, giftLabel: "" });
  };

  const removeMilestone = (idx: number) => {
    setConfig((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((_, i) => i !== idx),
    }));
  };

  if (loading) {
    return (
      <div className="p-8 text-slate-400 text-sm">Loading referral config…</div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">🎁 Referral System</h1>
          <p className="text-slate-400 text-sm mt-1">Control coins, gifts, and referral rules</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : saved ? "✓ Saved!" : "Save Changes"}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total referrals", value: stats.total, color: "text-indigo-400" },
          { label: "This month",      value: stats.thisMonth, color: "text-green-400" },
          { label: "VCoins given",    value: stats.coinsGiven, color: "text-amber-400" },
        ].map((s) => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value.toLocaleString()}</p>
            <p className="text-slate-400 text-sm mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Program toggle */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="text-white font-semibold">Referral Program Active</p>
          <p className="text-slate-400 text-xs mt-1">Turn off to pause all new referrals instantly</p>
        </div>
        <button
          onClick={() => setConfig((p) => ({ ...p, isActive: !p.isActive }))}
          className={`relative w-12 h-6 rounded-full transition-colors ${config.isActive ? "bg-indigo-600" : "bg-slate-700"}`}
        >
          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${config.isActive ? "left-7" : "left-1"}`} />
        </button>
      </div>

      {/* Coins config */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-white font-bold text-lg">💰 Coin Rewards</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-slate-400 text-xs block mb-2">Coins for referrer (student who shares)</label>
            <input
              type="number" min={0} max={9999}
              value={config.referrerCoins}
              onChange={(e) => setConfig((p) => ({ ...p, referrerCoins: Number(e.target.value) }))}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-slate-400 text-xs block mb-2">Welcome coins for new student (referee)</label>
            <input
              type="number" min={0} max={9999}
              value={config.refereeCoins}
              onChange={(e) => setConfig((p) => ({ ...p, refereeCoins: Number(e.target.value) }))}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
        <div>
          <label className="text-slate-400 text-xs block mb-2">Max referrals per student (0 = unlimited)</label>
          <input
            type="number" min={0}
            value={config.maxReferrals}
            onChange={(e) => setConfig((p) => ({ ...p, maxReferrals: Number(e.target.value) }))}
            className="w-48 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="text-slate-400 text-xs block mb-2">Reward trigger event</label>
          <select
            value={config.triggerEvent}
            onChange={(e) => setConfig((p) => ({ ...p, triggerEvent: e.target.value as any }))}
            className="bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 text-sm focus:outline-none"
          >
            <option value="signup">On signup (immediate)</option>
            <option value="first_login">After first login</option>
            <option value="first_quiz">After completing first quiz</option>
          </select>
        </div>
      </div>

      {/* Gift config */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">🎀 Gift Reward</h2>
          <button
            onClick={() => setConfig((p) => ({ ...p, giftEnabled: !p.giftEnabled }))}
            className={`relative w-12 h-6 rounded-full transition-colors ${config.giftEnabled ? "bg-indigo-600" : "bg-slate-700"}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${config.giftEnabled ? "left-7" : "left-1"}`} />
          </button>
        </div>
        <p className="text-slate-400 text-xs">If enabled, the new student also receives a non-coin gift (e.g. AI Guru trial)</p>
        {config.giftEnabled && (
          <div>
            <label className="text-slate-400 text-xs block mb-2">Gift label (shown to students)</label>
            <input
              type="text"
              placeholder="e.g. 7-day AI Guru Free Trial"
              value={config.giftLabel}
              onChange={(e) => setConfig((p) => ({ ...p, giftLabel: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}
      </div>

      {/* Milestone rewards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-white font-bold text-lg">🏆 Milestone Rewards</h2>
        <p className="text-slate-400 text-xs">Give bonus rewards when a student reaches N referrals (e.g. every 5th referral = 100 extra coins)</p>

        {/* Existing milestones */}
        {(config.milestones ?? []).length === 0 && (
          <p className="text-slate-500 text-sm">No milestones configured.</p>
        )}
        {(config.milestones ?? []).map((m, i) => (
          <div key={i} className="flex items-center gap-3 bg-slate-800/50 rounded-xl p-3">
            <span className="text-slate-300 text-sm flex-1">
              Every <strong className="text-white">{m.every}</strong> referrals → {m.giftLabel}
              {m.giftType === "coins" && <span className="text-amber-400"> (+{m.giftValue} coins)</span>}
            </span>
            <button onClick={() => removeMilestone(i)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
          </div>
        ))}

        {/* Add new milestone */}
        <div className="border border-slate-700 rounded-xl p-4 space-y-3">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Add milestone</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs block mb-1">Every N referrals</label>
              <input
                type="number" min={1}
                value={newMilestone.every ?? ""}
                onChange={(e) => setNewMilestone((p) => ({ ...p, every: Number(e.target.value) }))}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1">Gift label</label>
              <input
                type="text"
                placeholder="e.g. Super Referrer Badge"
                value={newMilestone.giftLabel ?? ""}
                onChange={(e) => setNewMilestone((p) => ({ ...p, giftLabel: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1">Gift type</label>
              <select
                value={newMilestone.giftType ?? "coins"}
                onChange={(e) => setNewMilestone((p) => ({ ...p, giftType: e.target.value as any }))}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none"
              >
                <option value="coins">Extra VCoins</option>
                <option value="subscription_days">Subscription days</option>
                <option value="badge">Badge</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1">Value (coins / days)</label>
              <input
                type="number" min={0}
                value={newMilestone.giftValue ?? ""}
                onChange={(e) => setNewMilestone((p) => ({ ...p, giftValue: Number(e.target.value) }))}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <button
            onClick={addMilestone}
            disabled={!newMilestone.giftLabel || !newMilestone.every}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            + Add Milestone
          </button>
        </div>
      </div>

      {/* Top referrers leaderboard */}
      {topRefs.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-white font-bold">🥇 Top Referrers</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                <th className="text-left p-4">Rank</th>
                <th className="text-left p-4">User ID</th>
                <th className="text-left p-4">Code</th>
                <th className="text-right p-4">Referrals</th>
                <th className="text-right p-4">Coins Earned</th>
              </tr>
            </thead>
            <tbody>
              {topRefs.map((r, i) => (
                <tr key={r.uid} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="p-4 text-slate-400">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</td>
                  <td className="p-4 font-mono text-indigo-400 text-xs">{r.uid.slice(0, 12)}…</td>
                  <td className="p-4 font-mono text-purple-400 font-bold">{r.referralCode}</td>
                  <td className="p-4 text-right text-white font-semibold">{r.referralCount}</td>
                  <td className="p-4 text-right text-amber-400 font-semibold">{r.referralCoinsEarned.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Save button (bottom) */}
      <div className="flex justify-end pb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : saved ? "✓ Changes saved!" : "Save All Changes"}
        </button>
      </div>
    </div>
  );
}

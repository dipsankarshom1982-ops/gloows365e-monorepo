// PATH: admin-web/src/pages/VCoinRules.tsx
//
// FIX (schema mismatch): this page previously read/wrote `coins` on
// arbitrary documents under vCoinRules — but apps/web & apps/mobile's
// vCoinsService.ts actually reads `rewardAmount` and `dailyLimit` on
// documents keyed by source constant (e.g. vCoinRules/REEL_WATCH_REWARD,
// see utils/formatVCoins.ts's VCOIN_SOURCES). Different field names, and
// this page had no concept of which document IDs the service expects —
// so editing a coin value here never actually changed what students earned.
//
// Rebuilt against VCOIN_SOURCES directly: every known source always shows
// a row (even if Firestore has no doc for it yet, i.e. it's currently
// running on the service's hardcoded defaults), and editing rewardAmount /
// dailyLimit / isActive here now writes the exact fields the service reads.
//
// FIX (product decision — "V-Coins can not be earned from AI Guru, it's a
// subscription-based model"): removed AI_GURU_MONTHLY_BONUS/
// AI_GURU_YEARLY_BONUS. They were listed here alongside every other real,
// working source, implying subscribing paid V-Coins back out — but nothing
// anywhere (mobile, web, or the server-side subscription handler) ever
// actually called the code that would have credited it.

import { useEffect, useState } from "react";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import ToggleSwitch from "../components/ToggleSwitch";

// Mirrors apps/web & apps/mobile's utils/formatVCoins.ts — keep in sync by
// hand for now (no shared package between admin and the two app sources).
const VCOIN_SOURCES = {
  APP_TIME_REWARD:                  "APP_TIME_REWARD",
  REEL_WATCH_REWARD:                "REEL_WATCH_REWARD",
  VIDEO_WATCH_REWARD:                "VIDEO_WATCH_REWARD",
  STORY_WATCH_REWARD:                "STORY_WATCH_REWARD",
  SKILLBATTLE_WINNER_REWARD:         "SKILLBATTLE_WINNER_REWARD",
  SKILLBATTLE_RUNNER_UP_REWARD:      "SKILLBATTLE_RUNNER_UP_REWARD",
  SKILLBATTLE_PARTICIPATION_REWARD:  "SKILLBATTLE_PARTICIPATION_REWARD",
  ADMIN_FAIR_USE_REWARD:             "ADMIN_FAIR_USE_REWARD",
  VIDYASTAR_CONTEST_ENTRY:           "VIDYASTAR_CONTEST_ENTRY",
  COURSE_DISCOUNT_REDEEM:            "COURSE_DISCOUNT_REDEEM",
  REFERRAL_REWARD:                   "REFERRAL_REWARD",
  REFEREE_JOIN_BONUS:                "REFEREE_JOIN_BONUS",
} as const;

// Same defaults as vCoinsService.ts's DEFAULT_REWARD_AMOUNTS /
// DEFAULT_DAILY_LIMITS — shown here so admin sees the actual value in
// effect even before a Firestore doc exists for a given source. Keep
// these two files' defaults in sync by hand.
const DEFAULT_REWARD_AMOUNTS: Record<string, number> = {
  REEL_WATCH_REWARD:                1,
  VIDEO_WATCH_REWARD:                1,
  STORY_WATCH_REWARD:                1,
  VIDYASTAR_CONTEST_ENTRY:           50,
};

const DEFAULT_DAILY_LIMITS: Record<string, number> = {
  APP_TIME_REWARD:                   20,
  REEL_WATCH_REWARD:                 30,
  VIDEO_WATCH_REWARD:                50,
  STORY_WATCH_REWARD:                20,
  SKILLBATTLE_WINNER_REWARD:         100,
  SKILLBATTLE_RUNNER_UP_REWARD:      100,
  SKILLBATTLE_PARTICIPATION_REWARD:  50,
  ADMIN_FAIR_USE_REWARD:             9999,
  VIDYASTAR_CONTEST_ENTRY:           9999,
  COURSE_DISCOUNT_REDEEM:            9999,
};

// The only source that's conceptually a spend (redeeming coins for a
// discount) rather than an earn action — there's no `type` field in the
// actual schema the service reads, so this is just a display-grouping
// decision, not data read from Firestore.
const SPEND_SOURCES = new Set<string>(["COURSE_DISCOUNT_REDEEM"]);

const SOURCE_DESCRIPTIONS: Record<string, string> = {
  APP_TIME_REWARD:                  "Time spent in the app, per session",
  REEL_WATCH_REWARD:                "Watching a short reel (admin or student-posted)",
  VIDEO_WATCH_REWARD:                "Watching a full lesson/knowledge video",
  STORY_WATCH_REWARD:                "Viewing a story",
  SKILLBATTLE_WINNER_REWARD:        "Winning a Skill Battle",
  SKILLBATTLE_RUNNER_UP_REWARD:      "Runner-up in a Skill Battle",
  SKILLBATTLE_PARTICIPATION_REWARD: "Participating in a Skill Battle",
  ADMIN_FAIR_USE_REWARD:            "Manual admin grant (fair-use adjustment)",
  VIDYASTAR_CONTEST_ENTRY:          "Completing a VidyaStar contest quiz",
  COURSE_DISCOUNT_REDEEM:           "Redeeming coins for a course discount",
  REFERRAL_REWARD:                  "Referring a new student who joins",
  REFEREE_JOIN_BONUS:               "Joining via someone else's referral",
};

interface VCoinRule {
  source:       string;   // Firestore doc ID — must equal the VCOIN_SOURCES value
  rewardAmount: number;
  dailyLimit:   number;
  isActive:     boolean;
  description:  string;
  // True if no Firestore doc exists yet for this source — the service is
  // currently running on its own hardcoded defaults, not these editable
  // values, until the first save here creates the doc.
  isDefault:    boolean;
}

type EditField = "rewardAmount" | "dailyLimit";

export default function VCoinRules() {
  const [rules, setRules]     = useState<VCoinRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<string | null>(null);
  const [editing, setEditing] = useState<{ source: string; field: EditField } | null>(null);
  const [editValue, setEditValue] = useState(0);

  useEffect(() => {
    getDocs(collection(db, "vCoinRules")).then((snap) => {
      const existing = new Map(snap.docs.map((d) => [d.id, d.data()]));

      // Every known source gets a row, whether or not Firestore has a doc
      // for it yet — an admin needs to see (and be able to change) the
      // value that's actually in effect right now, including the
      // service's hardcoded fallback.
      const allSources = Object.values(VCOIN_SOURCES);
      const merged: VCoinRule[] = allSources.map((source) => {
        const data = existing.get(source);
        return {
          source,
          rewardAmount: data?.rewardAmount ?? DEFAULT_REWARD_AMOUNTS[source] ?? 0,
          dailyLimit:   data?.dailyLimit   ?? DEFAULT_DAILY_LIMITS[source]   ?? 9999,
          isActive:     data?.isActive     ?? true,
          description:  data?.description  ?? SOURCE_DESCRIPTIONS[source] ?? "",
          isDefault:    !data,
        };
      });
      setRules(merged);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const startEdit = (source: string, field: EditField, current: number) => {
    setEditing({ source, field });
    setEditValue(current);
  };

  // Writes with set(..., {merge:true}) rather than updateDoc — the doc may
  // not exist yet for sources still running on hardcoded defaults
  // (isDefault: true), and updateDoc throws if the doc is missing.
  const saveEdit = async () => {
    if (!editing) return;
    const { source, field } = editing;
    setSaving(source);
    try {
      const rule = rules.find((r) => r.source === source);
      if (!rule) return;
      await setDoc(doc(db, "vCoinRules", source), {
        source,
        rewardAmount: field === "rewardAmount" ? editValue : rule.rewardAmount,
        dailyLimit:   field === "dailyLimit"   ? editValue : rule.dailyLimit,
        isActive:     rule.isActive,
        description:  rule.description,
      }, { merge: true });
      setRules((prev) => prev.map((r) =>
        r.source === source ? { ...r, [field]: editValue, isDefault: false } : r
      ));
      setEditing(null);
    } catch (err: any) {
      alert("Save failed: " + (err?.message ?? "Check Firestore rules are deployed."));
    } finally {
      setSaving(null);
    }
  };

  const toggleActive = async (rule: VCoinRule) => {
    setSaving(rule.source);
    try {
      await setDoc(doc(db, "vCoinRules", rule.source), {
        source:       rule.source,
        rewardAmount: rule.rewardAmount,
        dailyLimit:   rule.dailyLimit,
        isActive:     !rule.isActive,
        description:  rule.description,
      }, { merge: true });
      setRules((prev) => prev.map((r) =>
        r.source === rule.source ? { ...r, isActive: !r.isActive, isDefault: false } : r
      ));
    } catch (err: any) {
      alert("Save failed: " + (err?.message ?? "Check Firestore rules are deployed."));
    } finally {
      setSaving(null);
    }
  };

  const earnRules  = rules.filter((r) => !SPEND_SOURCES.has(r.source));
  const spendRules = rules.filter((r) =>  SPEND_SOURCES.has(r.source));

  // Editable numeric cell shared by both rewardAmount and dailyLimit
  // columns — same inline-edit interaction, different field.
  const EditableCoinCell = ({ rule, field }: { rule: VCoinRule; field: EditField }) => {
    const isEditing = editing?.source === rule.source && editing?.field === field;
    const value = rule[field];
    if (isEditing) {
      return (
        <div className="flex items-center justify-end gap-2">
          <input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(Number(e.target.value))}
            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(null); }}
            className="w-20 bg-slate-800 border border-indigo-500 text-white rounded-lg px-2 py-1 text-xs text-right focus:outline-none"
            autoFocus
          />
          <button onClick={saveEdit} disabled={saving === rule.source} className="text-green-400 hover:text-green-300 text-xs disabled:opacity-50">✓</button>
          <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
        </div>
      );
    }
    return (
      <button
        onClick={() => startEdit(rule.source, field, value)}
        className="text-white font-bold tabular-nums hover:text-indigo-400 transition-colors"
        title="Click to edit"
      >
        🪙 {value}
      </button>
    );
  };

  const RuleTable = ({ items, title }: { items: VCoinRule[]; title: string }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-white font-bold">{title}</h2>
      </div>
      {items.length === 0 ? (
        <div className="p-6 text-center text-slate-400 text-sm">No rules configured.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
              <th className="text-left p-4">Source</th>
              <th className="text-left p-4">Description</th>
              <th className="text-right p-4">Per Action</th>
              <th className="text-right p-4">Daily Cap</th>
              <th className="text-right p-4">Active</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.source} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-indigo-400 text-xs">{r.source}</span>
                    {r.isDefault && (
                      <span
                        className="text-[10px] bg-slate-700 text-slate-400 font-bold px-1.5 py-0.5 rounded"
                        title="No Firestore doc yet — this is the app's hardcoded fallback value. Editing it will create the doc."
                      >
                        DEFAULT
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-4 text-slate-400">{r.description || "—"}</td>
                <td className="p-4 text-right"><EditableCoinCell rule={r} field="rewardAmount" /></td>
                <td className="p-4 text-right"><EditableCoinCell rule={r} field="dailyLimit" /></td>
                <td className="p-4 text-right">
                  <ToggleSwitch value={r.isActive} onChange={() => toggleActive(r)} disabled={saving === r.source} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  if (loading) return <div className="text-center text-slate-400 py-16">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">🪙 V-Coin Rules</h1>
        <p className="text-slate-400 text-sm mt-1">
          Configure how V-Coins are earned and spent. Click "Per Action" or "Daily Cap" to edit.
        </p>
        <p className="text-slate-500 text-xs mt-1">
          Rows marked <span className="bg-slate-700 text-slate-400 font-bold px-1 rounded">DEFAULT</span> have no saved rule yet — the app is using its built-in fallback value, shown here. Saving any edit creates the rule.
        </p>
      </div>
      <RuleTable items={earnRules}  title="🟢 Earn Rules" />
      <RuleTable items={spendRules} title="🔴 Spend Rules" />
    </div>
  );
}

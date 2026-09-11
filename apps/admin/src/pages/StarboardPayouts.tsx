// PATH: apps/admin/src/pages/StarboardPayouts.tsx
// Admin screen to pay out VidyaStar Starboard prizes.
//
// Automatic point reset at period boundaries (midnight/week-end/month-end/
// year-end) happens elsewhere (app/backend side, outside this screen) —
// this page only handles the payout half: admin picks the prize
// configuration for the period that's ending (from the existing
// VidyastarConfig screen), reviews current standings, and pays out
// qualifying students before the points reset wipes them.
//
// Data:
//   - Reads vidyastarConfig/{periodKey} — the EXISTING prize-tier config
//     screen (VidyastarConfig.tsx) already lets admin define rank-range
//     prize rows (rankMin/rankMax/prizeType/prizeValue) per specific
//     period instance. This screen reuses that config rather than
//     duplicating a second prize-tier editor.
//   - Reads leaderboard/{tab}/entries — same collection Starboard itself
//     reads, now unified across mobile + web.
//
// SECURITY/RELIABILITY FIX (launch audit, Phase 1 Task 4) — this screen
// used to write the VCoins ledger entry directly from the browser via a
// writeBatch, which firestore.rules has always denied (`allow create,
// update, delete: if false` on users/{uid}/vCoinTransactions — correctly,
// every other VCoins credit path goes through a Cloud Function). Because
// Firestore batches are atomic, the whole payout failed every single time
// — no student could ever actually be paid. Payout logic now lives in
// functions/src/starboardPayouts.ts's processStarboardPayout, which also
// re-derives each student's rank server-side (this screen no longer sends
// a trusted rank/prize value, only the userIds an admin selected) and
// enforces real idempotency (one prize per student per period, not just
// per payout-label) — see that file's header comment for the full case.
import { useEffect, useState } from "react";
import {
  collection, getDocs,
  orderBy, query, where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";

type PeriodType = "daily" | "weekly" | "monthly" | "yearly";
type PrizeType  = "gift_voucher" | "physical" | "vcoin";
const PERIOD_TYPES: PeriodType[] = ["daily", "weekly", "monthly", "yearly"];
const ALL_CLASSES = ["all", "6", "7", "8", "9", "10", "11", "12"];

interface PrizeRow {
  rankMin: number; rankMax: number;
  prizeType: PrizeType; prizeValue: string;
  medalEmoji: string; badge: string;
}

interface VidyastarConfigDoc {
  id: string;
  period: PeriodType;
  periodKey: string;
  prizeRows: PrizeRow[];
}

interface Entry {
  userId: string;
  name: string;
  points: number;
  class?: string;
  state?: string;
  rank: number;
  lastPayoutLabel?: string;
  lastPayoutAt?: any;
}

function prizeRowForRank(rows: PrizeRow[], rank: number): PrizeRow | null {
  return rows.find((r) => rank >= r.rankMin && rank <= r.rankMax) ?? null;
}

export default function StarboardPayouts() {
  const [periodType, setPeriodType] = useState<PeriodType>("weekly");
  const [classFilter, setClassFilter] = useState("all");
  const [configs, setConfigs] = useState<VidyastarConfigDoc[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");
  const [configsLoading, setConfigsLoading] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [payoutLabel, setPayoutLabel] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    (async () => {
      setConfigsLoading(true);
      try {
        const snap = await getDocs(collection(db, "vidyastarConfig"));
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as VidyastarConfigDoc));
        const matching = all
          .filter((c) => c.period === periodType)
          .sort((a, b) => b.periodKey.localeCompare(a.periodKey));
        setConfigs(matching);
        setSelectedConfigId(matching[0]?.id ?? "");
      } finally {
        setConfigsLoading(false);
      }
    })();
  }, [periodType]);

  const activeConfig = configs.find((c) => c.id === selectedConfigId) ?? null;

  const loadEntries = async () => {
    setLoading(true);
    try {
      const q = classFilter === "all"
        ? query(collection(db, "leaderboard", periodType, "entries"), orderBy("points", "desc"))
        : query(collection(db, "leaderboard", periodType, "entries"), where("class", "==", classFilter), orderBy("points", "desc"));
      const snap = await getDocs(q);
      const ranked = snap.docs.map((d, i) => ({
        userId: d.id,
        rank: i + 1,
        ...d.data(),
      } as Entry));
      setEntries(ranked.slice(0, 100));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEntries(); setSelected(new Set()); }, [periodType, classFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSelect = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const selectAllEligible = () => {
    if (!activeConfig) return;
    const eligible = entries.filter((e) => prizeRowForRank(activeConfig.prizeRows, e.rank));
    setSelected(new Set(eligible.map((e) => e.userId)));
  };

  const payoutSelected = async () => {
    if (!activeConfig) { alert("Select a prize config for this period first (configure one in VidyaStar Config if none exists)."); return; }
    if (selected.size === 0) { alert("Select at least one student to pay out."); return; }
    if (!payoutLabel.trim()) { alert(`Enter a payout label so this batch can be tracked. Try: "${activeConfig.periodKey}"`); return; }

    const targets = entries.filter((e) => selected.has(e.userId));
    const vcoinTargets = targets.filter((e) => prizeRowForRank(activeConfig.prizeRows, e.rank)?.prizeType === "vcoin");
    const nonVcoinTargets = targets.length - vcoinTargets.length;

    // The server now enforces one prize per student per period regardless
    // of label (see starboardPayouts.ts) — an already-paid student is
    // reported back as "already_paid" and safely skipped, so there's
    // nothing left here for a confirm-and-override dialog to do.
    const confirmMsg = nonVcoinTargets > 0
      ? `${vcoinTargets.length} student(s) will get VCoins credited automatically. ${nonVcoinTargets} have a gift_voucher/physical prize — those are NOT auto-fulfilled here and need manual delivery (same as the Surprise Gift flow). Continue?`
      : `Credit VCoins to ${vcoinTargets.length} student(s) for "${payoutLabel.trim()}"?`;
    if (!window.confirm(confirmMsg)) return;

    setPaying(true);
    try {
      const processPayout = httpsCallable<
        { configId: string; classFilter: string; payoutLabel: string; userIds: string[] },
        { results: Array<{ userId: string; status: string; detail?: string; amount?: number }>; paidCount: number; totalRequested: number }
      >(functions, "processStarboardPayout");

      const { data } = await processPayout({
        configId: activeConfig.id,
        classFilter,
        payoutLabel: payoutLabel.trim(),
        userIds: targets.map((e) => e.userId),
      });

      await loadEntries();
      setSelected(new Set());

      const alreadyPaid = data.results.filter((r) => r.status === "already_paid").length;
      const notEligible = data.results.filter((r) => r.status === "not_eligible" || r.status === "not_found").length;
      const errored      = data.results.filter((r) => r.status === "error").length;

      const lines = [`✅ Paid ${data.paidCount} of ${data.totalRequested} student(s).`];
      if (alreadyPaid) lines.push(`⏭️ ${alreadyPaid} already had a prize for ${activeConfig.periodKey} — skipped.`);
      if (notEligible) lines.push(`⚠️ ${notEligible} were no longer eligible (standings changed since this list loaded).`);
      if (errored) {
        lines.push(`❌ ${errored} failed — see details below:`);
        data.results.filter((r) => r.status === "error").forEach((r) => lines.push(`   ${r.userId}: ${r.detail}`));
      }
      alert(lines.join("\n"));
    } catch (err: any) {
      alert(`Payout failed: ${err.message ?? "Unknown error"}`);
    } finally {
      setPaying(false);
    }
  };

  const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">🏆 Starboard Payouts</h1>
        <p className="text-slate-400 text-sm mt-1">
          Review current standings and pay prizes to top-ranked students, using prize tiers
          configured in VidyaStar Config. Point reset at period end is handled automatically
          elsewhere — this screen only pays out.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap items-end">
        <div>
          <label className="block text-slate-400 text-xs font-semibold mb-1">Period</label>
          <select
            value={periodType}
            onChange={(e) => setPeriodType(e.target.value as PeriodType)}
            className="bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
          >
            {PERIOD_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-slate-400 text-xs font-semibold mb-1">Class</label>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
          >
            {ALL_CLASSES.map((c) => <option key={c} value={c}>{c === "all" ? "All Classes" : `Class ${c}`}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="block text-slate-400 text-xs font-semibold mb-1">
            Prize Config <span className="text-slate-600">(set these in VidyaStar Config)</span>
          </label>
          <select
            value={selectedConfigId}
            onChange={(e) => setSelectedConfigId(e.target.value)}
            disabled={configsLoading || configs.length === 0}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
          >
            {configs.length === 0
              ? <option value="">No configs found for this period type</option>
              : configs.map((c) => <option key={c.id} value={c.id}>{c.periodKey} ({c.prizeRows?.length ?? 0} prize rows)</option>)
            }
          </select>
        </div>
        <button
          onClick={loadEntries}
          className="text-slate-400 hover:text-white text-xs border border-slate-700 rounded-lg px-3 py-2.5 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {!activeConfig && !configsLoading && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-amber-400 text-sm">
          No prize config found for {periodType} contests. Create one in <strong>⭐ VidyaStar Config</strong> first —
          payouts read rank-tier prizes from there.
        </div>
      )}

      {activeConfig && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-bold text-lg mb-3">🎁 Prize Tiers — {activeConfig.periodKey}</h2>
          <div className="flex flex-wrap gap-2">
            {activeConfig.prizeRows.map((row, i) => (
              <div key={i} className="bg-slate-800 rounded-xl px-3 py-2 flex items-center gap-2">
                <span>{row.medalEmoji}</span>
                <span className="text-slate-300 text-xs font-semibold">
                  Rank {row.rankMin}{row.rankMax !== row.rankMin ? `–${row.rankMax}` : ""}
                </span>
                <span className="text-white text-xs font-bold">
                  {row.prizeType === "vcoin" ? `🪙 ${row.prizeValue}` : row.prizeValue}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-bold text-lg">💸 Pay Out Selected</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-slate-400 text-xs font-semibold mb-1">
              Payout Label <span className="text-slate-600">(tracks this batch — try the period key)</span>
            </label>
            <input
              type="text"
              value={payoutLabel}
              onChange={(e) => setPayoutLabel(e.target.value)}
              placeholder={activeConfig?.periodKey ?? "e.g. weekly_2026-W25"}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            onClick={selectAllEligible}
            disabled={!activeConfig}
            className="text-slate-400 hover:text-white text-xs border border-slate-700 rounded-lg px-3 py-2 transition-colors disabled:opacity-40"
          >
            Select All Eligible
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-slate-400 hover:text-white text-xs border border-slate-700 rounded-lg px-3 py-2 transition-colors"
          >
            Clear Selection
          </button>
          <button
            onClick={payoutSelected}
            disabled={paying || selected.size === 0 || !activeConfig}
            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl px-5 py-2 text-sm font-bold transition-colors"
          >
            {paying ? "Processing…" : `Pay ${selected.size} Selected`}
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-white font-bold">
            {periodType.charAt(0).toUpperCase() + periodType.slice(1)} Standings
            {classFilter !== "all" ? ` · Class ${classFilter}` : ""}
          </h2>
          <span className="text-slate-400 text-xs">{entries.length} entries</span>
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-16">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-center text-slate-400 py-16">No data for this period{classFilter !== "all" ? " and class" : ""}.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                  <th className="text-center p-4 w-10"></th>
                  <th className="text-left p-4">Rank</th>
                  <th className="text-left p-4">Student</th>
                  <th className="text-left p-4">Class</th>
                  <th className="text-right p-4">Points</th>
                  <th className="text-right p-4">Prize</th>
                  <th className="text-center p-4">Last Payout</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const row = activeConfig ? prizeRowForRank(activeConfig.prizeRows, e.rank) : null;
                  return (
                    <tr key={e.userId} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(e.userId)}
                          onChange={() => toggleSelect(e.userId)}
                          disabled={!row}
                          className="w-4 h-4 rounded accent-amber-500"
                        />
                      </td>
                      <td className="p-4">
                        <span className="text-lg">{MEDALS[e.rank] ?? <span className="text-slate-400 font-bold tabular-nums">#{e.rank}</span>}</span>
                      </td>
                      <td className="p-4">
                        <div className="text-white font-medium">{e.name ?? "—"}</div>
                        <div className="text-slate-500 text-xs font-mono">{e.userId.slice(0, 12)}…</div>
                      </td>
                      <td className="p-4 text-slate-300">{e.class ? `Class ${e.class}` : "—"}</td>
                      <td className="p-4 text-right text-white font-bold tabular-nums">{e.points}</td>
                      <td className="p-4 text-right">
                        {row ? (
                          <span className="text-amber-400 font-bold">
                            {row.prizeType === "vcoin" ? `🪙 ${row.prizeValue}` : row.prizeValue}
                          </span>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="p-4 text-center text-xs">
                        {e.lastPayoutLabel ? (
                          <span className="text-green-400">✓ {e.lastPayoutLabel}</span>
                        ) : (
                          <span className="text-slate-600">Not paid</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

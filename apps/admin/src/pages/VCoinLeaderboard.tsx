// PATH: admin-web/src/pages/VCoinLeaderboard.tsx
// New admin page:
//  • Shows top 100 users ranked by vCoinsYear_{currentYear}
//  • Year selector to view historical rankings
//  • Assign surprise gifts to specific users or top-N users
//  • View gift claim status and delivery address

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";

interface RankEntry {
  uid:        string;
  name:       string;
  school:     string;
  class:      string;
  district:   string;
  state:      string;
  profilePic: string;
  yearCoins:  number;
  rank:       number;
  gift?: {
    available:       boolean;
    claimed:         boolean;
    giftDescription: string;
    deliveryAddress?: any;
    claimedAt?:       any;
  };
}

const CURRENT_YEAR = new Date().getFullYear();

export default function VCoinLeaderboard() {
  const [year, setYear]           = useState(CURRENT_YEAR);
  const [entries, setEntries]     = useState<RankEntry[]>([]);
  const [loading, setLoading]     = useState(false);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [giftDesc, setGiftDesc]   = useState("");
  const [bulkN, setBulkN]         = useState(10);
  const [saving, setSaving]       = useState(false);
  const [viewAddr, setViewAddr]   = useState<RankEntry | null>(null);

  const yearField = `vCoinsYear_${year}`;

  useEffect(() => { fetchLeaderboard(); }, [year]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const q    = query(collection(db, "users"), orderBy(yearField, "desc"), limit(100));
      const snap = await getDocs(q);
      const list: RankEntry[] = snap.docs.map((d, i) => ({
        uid:        d.id,
        name:       d.data().name       || "—",
        school:     d.data().school     || "—",
        class:      d.data().class      || "—",
        district:   d.data().location?.district || "—",
        state:      d.data().location?.state    || "—",
        profilePic: d.data().profilePic || "",
        yearCoins:  d.data()[yearField] ?? 0,
        rank:       i + 1,
        gift:       d.data().surpriseGift,
      }));
      setEntries(list);
    } finally {
      setLoading(false);
    }
  };

  // Assign gift to a single user
  const assignGiftToUser = async (uid: string) => {
    if (!giftDesc.trim()) { alert("Please enter a gift description."); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", uid), {
        surpriseGift: {
          available:       true,
          year,
          claimed:         false,
          giftDescription: giftDesc.trim(),
        },
      });
      await fetchLeaderboard();
      setSelectedUid(null);
      setGiftDesc("");
    } finally {
      setSaving(false);
    }
  };

  // Assign gift to top N users in bulk
  const assignGiftBulk = async () => {
    if (!giftDesc.trim()) { alert("Please enter a gift description."); return; }
    if (!window.confirm(`Assign gift to top ${bulkN} users?`)) return;
    setSaving(true);
    try {
      const targets = entries.slice(0, bulkN);
      await Promise.all(targets.map((e) =>
        updateDoc(doc(db, "users", e.uid), {
          surpriseGift: {
            available:       true,
            year,
            claimed:         false,
            giftDescription: giftDesc.trim(),
          },
        })
      ));
      await fetchLeaderboard();
      setGiftDesc("");
    } finally {
      setSaving(false);
    }
  };

  // Revoke gift
  const revokeGift = async (uid: string) => {
    if (!window.confirm("Revoke this gift?")) return;
    await updateDoc(doc(db, "users", uid), {
      "surpriseGift.available": false,
    });
    await fetchLeaderboard();
  };

  const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
  const availableYears = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">🏆 V-Coins Leaderboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Top 100 users ranked by V-Coins earned. Assign surprise gifts and track claims.
          </p>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
        >
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* ── Bulk Gift Assignment ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-bold text-lg">🎁 Assign Surprise Gift</h2>
        <p className="text-slate-400 text-sm">
          Assign a gift to top-N users or select individual users in the table below.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-slate-400 text-xs font-semibold mb-1">Gift Description</label>
            <input
              type="text"
              value={giftDesc}
              onChange={(e) => setGiftDesc(e.target.value)}
              placeholder="e.g. Amazon Gift Card ₹500"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1">Top N Users</label>
            <input
              type="number"
              value={bulkN}
              min={1}
              max={100}
              onChange={(e) => setBulkN(Number(e.target.value))}
              className="w-24 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            onClick={assignGiftBulk}
            disabled={saving}
            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl px-5 py-2 text-sm font-bold transition-colors"
          >
            {saving ? "Assigning…" : `Assign to Top ${bulkN}`}
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total in Top 100", value: entries.length },
          { label: "Gifts Assigned",   value: entries.filter((e) => e.gift?.available).length },
          { label: "Gifts Claimed",    value: entries.filter((e) => e.gift?.claimed).length },
        ].map((s) => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
            <div className="text-2xl font-black text-white">{s.value}</div>
            <div className="text-slate-400 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-white font-bold">
            Top 100 · {year} Rankings
          </h2>
          <button
            onClick={fetchLeaderboard}
            className="text-slate-400 hover:text-white text-xs border border-slate-700 rounded-lg px-3 py-1.5 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-16">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-center text-slate-400 py-16">
            No data for {year}. Rankings appear as users earn V-Coins.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                  <th className="text-left p-4">Rank</th>
                  <th className="text-left p-4">Student</th>
                  <th className="text-left p-4">Location</th>
                  <th className="text-right p-4">V-Coins</th>
                  <th className="text-center p-4">Gift</th>
                  <th className="text-center p-4">Status</th>
                  <th className="text-center p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr
                    key={e.uid}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    {/* Rank */}
                    <td className="p-4">
                      <span className="text-lg">
                        {MEDALS[e.rank] ?? (
                          <span className="text-slate-400 font-bold tabular-nums">#{e.rank}</span>
                        )}
                      </span>
                    </td>

                    {/* Student */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={e.profilePic || `https://i.pravatar.cc/40?u=${e.uid}`}
                          className="w-9 h-9 rounded-full object-cover"
                          alt=""
                        />
                        <div>
                          <div className="text-white font-semibold">{e.name}</div>
                          <div className="text-slate-400 text-xs">{e.school} · Class {e.class}</div>
                        </div>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="p-4 text-slate-400 text-xs">
                      {e.district}, {e.state}
                    </td>

                    {/* V-Coins */}
                    <td className="p-4 text-right">
                      <span className="text-white font-bold tabular-nums">
                        🪙 {e.yearCoins.toLocaleString()}
                      </span>
                    </td>

                    {/* Gift description */}
                    <td className="p-4 text-center text-xs text-slate-400">
                      {e.gift?.available
                        ? e.gift.giftDescription || "—"
                        : "—"}
                    </td>

                    {/* Status */}
                    <td className="p-4 text-center">
                      {e.gift?.available && e.gift?.claimed ? (
                        <span className="inline-flex items-center gap-1 bg-green-500/10 text-green-400 text-xs font-bold px-2 py-1 rounded-full">
                          ✓ Claimed
                        </span>
                      ) : e.gift?.available ? (
                        <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 text-xs font-bold px-2 py-1 rounded-full">
                          ⏳ Pending
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        {/* Assign gift inline */}
                        {!e.gift?.available ? (
                          selectedUid === e.uid ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={giftDesc}
                                onChange={(ev) => setGiftDesc(ev.target.value)}
                                onKeyDown={(ev) => { if (ev.key === "Enter") assignGiftToUser(e.uid); if (ev.key === "Escape") setSelectedUid(null); }}
                                placeholder="Gift description"
                                className="w-40 bg-slate-800 border border-amber-500 text-white rounded-lg px-2 py-1 text-xs focus:outline-none"
                                autoFocus
                              />
                              <button
                                onClick={() => assignGiftToUser(e.uid)}
                                disabled={saving}
                                className="text-green-400 hover:text-green-300 text-xs"
                              >✓</button>
                              <button
                                onClick={() => setSelectedUid(null)}
                                className="text-slate-400 hover:text-white text-xs"
                              >✕</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setSelectedUid(e.uid); setGiftDesc(""); }}
                              className="text-amber-400 hover:text-amber-300 text-xs border border-amber-600 rounded-lg px-2 py-1 transition-colors"
                            >
                              🎁 Assign Gift
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => revokeGift(e.uid)}
                            className="text-red-400 hover:text-red-300 text-xs border border-red-800 rounded-lg px-2 py-1 transition-colors"
                          >
                            Revoke
                          </button>
                        )}

                        {/* View address (if claimed) */}
                        {e.gift?.claimed && e.gift?.deliveryAddress && (
                          <button
                            onClick={() => setViewAddr(e)}
                            className="text-indigo-400 hover:text-indigo-300 text-xs border border-indigo-800 rounded-lg px-2 py-1 transition-colors"
                          >
                            📦 Address
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Address Modal ── */}
      {viewAddr && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setViewAddr(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">📦 Delivery Address</h3>
              <button
                onClick={() => setViewAddr(null)}
                className="text-slate-400 hover:text-white"
              >✕</button>
            </div>

            <div className="mb-3">
              <div className="text-slate-400 text-xs font-semibold mb-1">Recipient</div>
              <div className="text-white font-semibold">{viewAddr.name}</div>
              <div className="text-slate-400 text-sm">{viewAddr.gift?.giftDescription}</div>
            </div>

            {viewAddr.gift?.deliveryAddress && (
              <div className="bg-slate-800 rounded-xl p-4 space-y-1 text-sm">
                <div className="text-white font-semibold">{viewAddr.gift.deliveryAddress.fullName}</div>
                <div className="text-slate-300">{viewAddr.gift.deliveryAddress.phone}</div>
                <div className="text-slate-300">{viewAddr.gift.deliveryAddress.addressLine1}</div>
                {viewAddr.gift.deliveryAddress.addressLine2 && (
                  <div className="text-slate-300">{viewAddr.gift.deliveryAddress.addressLine2}</div>
                )}
                <div className="text-slate-300">
                  {viewAddr.gift.deliveryAddress.city}, {viewAddr.gift.deliveryAddress.pincode}
                </div>
                <div className="text-slate-300">{viewAddr.gift.deliveryAddress.state}</div>
              </div>
            )}

            <button
              onClick={() => {
                if (!viewAddr.gift?.deliveryAddress) return;
                const a = viewAddr.gift.deliveryAddress;
                const text = `${a.fullName}\n${a.phone}\n${a.addressLine1}\n${a.addressLine2 || ""}\n${a.city}, ${a.pincode}\n${a.state}`;
                navigator.clipboard.writeText(text);
              }}
              className="mt-4 w-full bg-slate-800 hover:bg-slate-700 text-white rounded-xl py-2 text-sm font-semibold transition-colors"
            >
              Copy Address
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

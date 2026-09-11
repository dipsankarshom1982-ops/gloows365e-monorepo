"use client";

// PATH: apps/web/src/app/(app)/starboard/page.tsx
// Mirrors mobile app/starboard.tsx
// India leaderboard: daily / weekly / monthly / yearly tabs
// Podium, prize structure, sticky "You" bar, prize-eligible badge

import { useEffect, useState, useRef } from "react";
import { getAuth } from "firebase/auth";
import {
  getFirestore, collection, doc, getDoc, query,
  orderBy, limit, onSnapshot, where,
} from "firebase/firestore";
import { useStudentProfile } from "@gloows/shared-logic";

// ─── Types ────────────────────────────────────────────────────
interface LeaderboardEntry {
  userId: string;
  name:   string;
  points: number;
  rank:   number;
  trend?: "up" | "down" | "same";
  state?: string;
  class?: string | number;
}

type Tab = "daily" | "weekly" | "monthly" | "yearly";
const TABS: Tab[] = ["daily", "weekly", "monthly", "yearly"];

// ─── Prize structure — real admin-configured prizes only ─────
// Used to show a hardcoded, illustrative PRIZES table here, disconnected
// from what admin actually set up in VidyaStar Config. Bug report — "will
// show only admin set prizes from vidyastar config". Now reads the real
// vidyastarConfig/{periodKey}.prizeRows doc for whichever period the
// currently-selected tab is in right now — periodKey format mirrors
// admin's own VidyastarConfig.tsx buildPeriodKey() exactly, so this always
// resolves to the same doc admin edits.
type PrizeType = "gift_voucher" | "physical" | "vcoin";
interface PrizeRow { rankMin: number; rankMax: number; prizeType: PrizeType; prizeValue: string; medalEmoji: string; badge: string; }

const pad = (n: number) => String(n).padStart(2, "0");
function getWeekNumber(d: Date): number {
  const oneJan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
}
function currentPeriodKey(type: Tab): string {
  const d = new Date();
  if (type === "daily")   return `daily_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (type === "weekly")  return `weekly_${d.getFullYear()}-W${pad(getWeekNumber(d))}`;
  if (type === "monthly") return `monthly_${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  return `yearly_${d.getFullYear()}`;
}

function formatPrizeReward(row: PrizeRow): string {
  return row.prizeType === "vcoin" ? `${row.prizeValue} V-Coins` : row.prizeValue;
}
function formatPrizeRankLabel(row: PrizeRow): string {
  const { rankMin, rankMax } = row;
  if (rankMin === 1 && rankMax === 1) return "1st Place";
  if (rankMin === 2 && rankMax === 2) return "2nd Place";
  if (rankMin === 3 && rankMax === 3) return "3rd Place";
  if (rankMin === rankMax) return `Rank ${rankMin}`;
  if (rankMin === 1) return `Top ${rankMax}`;
  return `Rank ${rankMin}-${rankMax}`;
}
const REWARD_COLORS = ["#fbbf24", "#94a3b8", "#d97706"]; // gold/silver/bronze for the top 3 rows, indigo after

// Same rank→prize matching admin's Starboard Payouts screen uses
// (prizeRowForRank in apps/admin/src/pages/StarboardPayouts.tsx) — this is
// what actually determines which row a given rank gets paid, so a student's
// "what am I winning" view has to match it exactly rather than just
// checking rank <= 100.
function prizeRowForRank(rows: PrizeRow[], rank: number): PrizeRow | null {
  return rows.find((r) => rank >= r.rankMin && rank <= r.rankMax) ?? null;
}

// null = still loading, [] = admin hasn't configured this period yet.
function usePeriodPrizes(tab: Tab): PrizeRow[] | null {
  const [prizeRows, setPrizeRows] = useState<PrizeRow[] | null>(null);
  useEffect(() => {
    setPrizeRows(null);
    getDoc(doc(getFirestore(), "vidyastarConfig", currentPeriodKey(tab)))
      .then((snap) => {
        const rows = (snap.exists() ? (snap.data().prizeRows ?? []) : []) as PrizeRow[];
        setPrizeRows([...rows].sort((a, b) => a.rankMin - b.rankMin));
      })
      .catch(() => setPrizeRows([]));
  }, [tab]);
  return prizeRows;
}

// ─── Firestore listener (mirrors mobile lib/listenLeaderboard.ts +
// lib/rankUtils.ts) ─────────────────────────────────────────────
// FIX: this previously set `rank` from snapshot order but never computed
// `trend` — Firestore documents don't carry a trend field (nothing writes
// one server-side; see submitContestQuiz.ts), so the Trend column always
// showed "—" on web. Mobile's listenLeaderboard.ts computes trend
// client-side by comparing each new snapshot's ranks against the previous
// one. Ported that same comparison here, via a ref scoped to this hook
// instance (mobile uses a module-level variable, safe there since one app
// instance = one user; a ref is the correct web equivalent).
//
// FIX: class filtering must happen in the query itself, not after —
// otherwise the limit(100) would apply to the all-class ranking first,
// potentially excluding a student's class-mates who rank highly within
// their class but outside the global top 100.
function useLeaderboard(tab: Tab, userClass: string | null) {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  // Previous ranks, keyed by userId — reset whenever the tab changes, since
  // daily/weekly/monthly/yearly are independent rankings and comparing
  // across them would produce meaningless trend values.
  const prevRanksRef = useRef<Record<string, number>>({});

  useEffect(() => {
    prevRanksRef.current = {};
  }, [tab]);

  useEffect(() => {
    const db   = getFirestore();
    const col  = collection(db, "leaderboard", tab, "entries");
    const q    = userClass
      ? query(col, where("class", "==", userClass), orderBy("points", "desc"), limit(100))
      : query(col, orderBy("points", "desc"), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      const prevRanks = prevRanksRef.current;
      const entries = snap.docs.map((d, i) => {
        const userId  = d.id;
        const newRank = i + 1;
        const oldRank = prevRanks[userId];
        const trend: LeaderboardEntry["trend"] =
          !oldRank ? "same" : newRank < oldRank ? "up" : newRank > oldRank ? "down" : "same";
        return { ...d.data(), userId, rank: newRank, trend } as LeaderboardEntry;
      });

      const nextRanks: Record<string, number> = {};
      entries.forEach((e) => { nextRanks[e.userId] = e.rank; });
      prevRanksRef.current = nextRanks;

      setData(entries);
    }, (err) => {
      // Without this, a query failure (e.g. a missing composite index for
      // the class-scoped where+orderBy) silently left `data` at its
      // initial [] — the screen just showed "No data yet for this
      // period" with no trace of why. Logging it doesn't fix the query,
      // but it stops the next version of this bug from being invisible.
      console.warn("Starboard leaderboard query failed:", err);
    });
    return () => unsub();
  }, [tab, userClass]);

  return data;
}

// ─── Main ─────────────────────────────────────────────────────
export default function StarboardPage() {
  const [tab,        setTab]        = useState<Tab>("weekly");
  const [showPrizes, setShowPrizes] = useState(false);
  const { studentProfile } = useStudentProfile();

  // Class-scoped ranking: a Class 7 student sees rank among Class 7
  // students all-India, not the mixed all-class leaderboard.
  const userClass = studentProfile?.class != null ? String(studentProfile.class) : null;

  const data = useLeaderboard(tab, userClass);
  const uid  = getAuth().currentUser?.uid ?? "";

  const podium  = data.slice(0, 3);
  const rest    = data.slice(3);
  const myIndex = data.findIndex((u) => u.userId === uid);
  const myData  = myIndex >= 0 ? data[myIndex] : null;
  const pointsGap = myIndex > 0 ? (data[myIndex - 1]?.points ?? 0) - (myData?.points ?? 0) : 0;
  const prizeRows = usePeriodPrizes(tab);
  const isPrizeTab = tab === "monthly" || tab === "yearly";
  const myPrizeRow = isPrizeTab && myData && prizeRows ? prizeRowForRank(prizeRows, myData.rank) : null;

  return (
    <div style={{ paddingBottom: myData ? 80 : 32, minHeight: "100dvh", background: "var(--bg)" }}>

      {/* ── Tab bar ── */}
      <div style={{
        display: "flex", gap: 6, padding: "10px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        overflowX: "auto",
      }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => { setTab(t); setShowPrizes(false); }} style={{
            flex: "1 1 0", padding: "8px 4px", borderRadius: 20,
            border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
            background: tab === t ? "#4f46e5" : "#1e293b",
            color: tab === t ? "#fff" : "#64748b",
            minWidth: 70,
          }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── India banner ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        margin: "10px 12px 6px",
        background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: 10, padding: "7px 12px",
      }}>
        <span style={{ color: "#818cf8", fontSize: 11, fontWeight: 700 }}>
          {userClass
            ? `🇮🇳 India Top 100 · Class ${userClass} — Vouchers & prizes for monthly & yearly`
            : "🇮🇳 India Top 100 — Vouchers & prizes for monthly & yearly"}
        </span>
      </div>

      {/* ── Your stats card ── */}
      <div style={{
        margin: "4px 12px 12px",
        background: "linear-gradient(135deg, #1e1b4b, #312e81, #1e1b4b)",
        borderRadius: 22, padding: 18,
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#a5b4fc", fontSize: 11, fontWeight: 700, marginBottom: 2 }}>Your Score</div>
          <div style={{ color: "#fff", fontSize: 34, fontWeight: 900, lineHeight: 1.1 }}>
            {myData?.points ?? "—"}
          </div>
          <div style={{ color: "#6366f1", fontSize: 12, fontWeight: 700, marginTop: 4 }}>
            {myData?.name ?? studentProfile?.name ?? "You"}
          </div>
          {!myData && (
            <div style={{ color: "#818cf8", fontSize: 11, fontWeight: 600, marginTop: 6 }}>
              Complete a VidyaStar contest to get on the board!
            </div>
          )}
          {myPrizeRow && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6, marginTop: 8,
              background: "rgba(251,191,36,0.15)", borderRadius: 10, padding: "6px 10px",
              alignSelf: "flex-start",
            }}>
              <span style={{ fontSize: 14 }}>{myPrizeRow.medalEmoji || "🎁"}</span>
              <span style={{ color: "#fbbf24", fontSize: 11, fontWeight: 800 }}>
                You&apos;re winning: {formatPrizeReward(myPrizeRow)}
              </span>
            </div>
          )}
        </div>
        <div style={{ width: 1, height: 60, background: "rgba(255,255,255,0.1)" }} />
        <div style={{ display: "flex", gap: 16 }}>
          {[
            { val: myData ? `#${myData.rank}` : "—", lbl: "India Rank" },
            { val: !myData ? "—" : pointsGap > 0 ? `+${pointsGap}` : "🔝", lbl: !myData ? "Not ranked" : pointsGap > 0 ? "pts to next" : "Top rank" },
            { val: myData?.trend === "up" ? "▲" : myData?.trend === "down" ? "▼" : "—", lbl: "Trend" },
          ].map(({ val, lbl }) => (
            <div key={lbl} style={{ textAlign: "center" }}>
              <div style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 900 }}>{val}</div>
              <div style={{ color: "#64748b", fontSize: 9, fontWeight: 700, marginTop: 2 }}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Prizes toggle ── */}
      <div style={{ margin: "0 12px 6px" }}>
        <button onClick={() => setShowPrizes((v) => !v)} style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 18px", borderRadius: 16, border: "none", cursor: "pointer",
          background: "linear-gradient(90deg, #92400e, #d97706)",
          color: "#fff", fontSize: 14, fontWeight: 800,
        }}>
          <span>🎁 Prizes this {tab}</span>
          <span>{showPrizes ? "▲" : "▼"}</span>
        </button>
        {showPrizes && (
          <div style={{
            background: "#1e293b", borderRadius: 16, padding: 14,
            marginTop: 4, display: "flex", flexDirection: "column", gap: 8,
          }}>
            <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800 }}>🇮🇳 India Rankings</div>
            {prizeRows === null ? (
              <div style={{ color: "#64748b", fontSize: 12 }}>Loading prizes…</div>
            ) : prizeRows.length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 12 }}>No prizes configured for this period yet.</div>
            ) : (
              prizeRows.map((row, i) => {
                const isMine = !!myData && myData.rank >= row.rankMin && myData.rank <= row.rankMax;
                return (
                  <div key={`${row.rankMin}-${row.rankMax}`} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: isMine ? "rgba(99,102,241,0.15)" : "transparent",
                    borderRadius: 10, padding: isMine ? "6px 8px" : 0,
                  }}>
                    <span style={{ fontSize: 22, width: 30 }}>{row.medalEmoji || "⭐"}</span>
                    <span style={{ flex: 1, color: "#cbd5e1", fontSize: 13, fontWeight: 700 }}>{formatPrizeRankLabel(row)}</span>
                    {isMine && (
                      <span style={{ color: "#818cf8", fontSize: 10, fontWeight: 800, background: "rgba(99,102,241,0.2)", borderRadius: 6, padding: "2px 6px" }}>
                        YOU
                      </span>
                    )}
                    <span style={{ color: REWARD_COLORS[i] ?? "#6366f1", fontSize: 14, fontWeight: 900 }}>{formatPrizeReward(row)}</span>
                  </div>
                );
              })
            )}
            <div style={{ color: "#475569", fontSize: 10 }}>* V-Coins credited within 48 hrs of period end; vouchers & physical prizes delivered separately</div>
          </div>
        )}
      </div>

      {/* ── Podium ── */}
      {podium.length > 0 && (
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "flex-end",
          margin: "12px 12px 8px", gap: 6,
        }}>
          {[podium[1], podium[0], podium[2]].map((u, i) => {
            if (!u) return <div key={i} style={{ flex: 1 }} />;
            const medals = ["🥈", "🥇", "🥉"];
            const heights = [90, 120, 75];
            const colors  = ["#94a3b8", "#fbbf24", "#d97706"];
            return (
              <div key={u.userId} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontSize: 24 }}>{medals[i]}</div>
                <div style={{ color: "#e2e8f0", fontSize: 11, fontWeight: 700, textAlign: "center", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                  {u.name}
                </div>
                <div style={{ color: "#94a3b8", fontSize: 10, marginBottom: 6 }}>{u.points} pts</div>
                <div style={{
                  width: "100%", height: heights[i], borderRadius: 12,
                  background: "linear-gradient(180deg, #1e293b, #0f172a)",
                  borderTop: `3px solid ${colors[i]}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ color: colors[i], fontSize: 18, fontWeight: 900 }}>#{[2, 1, 3][i]}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Rankings list ── */}
      <div style={{ padding: "4px 0" }}>
        <div style={{ color: "#475569", fontSize: 12, fontWeight: 800, padding: "0 16px 6px", letterSpacing: 1 }}>
          {userClass ? `ALL INDIA · CLASS ${userClass} RANKINGS` : "ALL INDIA RANKINGS"}
        </div>

        {data.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 0", gap: 10 }}>
            <span style={{ fontSize: 48, opacity: 0.3 }}>🏆</span>
            <div style={{ color: "#374151", fontSize: 15, fontWeight: 600 }}>No data yet for this period</div>
          </div>
        ) : (
          rest.map((item) => {
            const isMe = item.userId === uid;
            const isPrizeEligible = isPrizeTab && item.rank <= 100;
            return (
              <div key={item.userId} style={{
                display: "flex", alignItems: "center",
                padding: "12px 16px",
                borderBottom: "1px solid #1e293b",
                background: isMe ? "rgba(99,102,241,0.08)" : "transparent",
              }}>
                <div style={{ width: 44, color: isMe ? "#818cf8" : "#64748b", fontWeight: 800, fontSize: 13 }}>
                  #{item.rank}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: isMe ? "#818cf8" : "#e2e8f0", fontSize: 14, fontWeight: isMe ? 800 : 600 }}>
                    {isMe ? "You" : item.name}
                  </div>
                  {(item.state || item.class) && (
                    <div style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>
                      {[item.state, item.class ? `Class ${item.class}` : null].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                {isPrizeEligible && <span style={{ fontSize: 14, marginRight: 6 }}>🎁</span>}
                <div style={{ color: isMe ? "#818cf8" : "#94a3b8", fontSize: 13, fontWeight: 700, marginRight: 8 }}>
                  {item.points} pts
                </div>
                <div style={{ width: 20, color: "#475569", textAlign: "center", fontSize: 12 }}>
                  {item.trend === "up" ? "▲" : item.trend === "down" ? "▼" : "—"}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Sticky "You" bar ── */}
      {myData && (
        <div style={{
          position: "fixed", bottom: 64, left: 0, right: 0,
          background: "#312e81", borderTop: "1px solid #4f46e5",
          display: "flex", alignItems: "center",
          padding: "12px 20px", gap: 12, zIndex: 50,
        }}>
          <span style={{ color: "#a5b4fc", fontSize: 18, fontWeight: 900 }}>#{myData.rank}</span>
          <span style={{ flex: 1, color: "#e2e8f0", fontSize: 14, fontWeight: 700 }}>
            You · {myData.points} pts
          </span>
          {myPrizeRow && (
            <span style={{ color: "#fbbf24", fontSize: 12, fontWeight: 800 }}>🎁 {formatPrizeReward(myPrizeRow)}</span>
          )}
          {pointsGap > 0 && myData.rank > 100 && (
            <span style={{ color: "#818cf8", fontSize: 12, fontWeight: 600 }}>{pointsGap} pts to #{myData.rank - 1}</span>
          )}
        </div>
      )}
    </div>
  );
}
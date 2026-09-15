"use client";

// PATH: apps/web/src/app/(app)/wallet/page.tsx
// V-Coins Wallet — mirrors mobile app/vcoins/wallet.tsx exactly
// Two tabs: Wallet (balance · earn sources · tx history) · Leaderboard (top 10 → top 100)

import { useState, useEffect, Fragment } from "react";
import { useVCoins } from "@/hooks/useVCoins";
import { useStudentProfile } from "@gloows/shared-logic";
import {
  getFirestore, collection, getDocs, limit, orderBy, query,
  where, getCountFromServer, doc, getDoc,
} from "firebase/firestore";
import type { VCoinTransaction } from "@/hooks/useVCoins";

// ─── Constants ────────────────────────────────────────────────
type FilterTab = "ALL" | "EARNED" | "SPENT" | "PENDING";
type MainTab   = "wallet" | "leaderboard";

const currentYear = new Date().getFullYear();
const YEAR_FIELD  = `vCoinsYear_${currentYear}`;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "ALL",     label: "All" },
  { key: "EARNED",  label: "Earned" },
  { key: "SPENT",   label: "Spent" },
  { key: "PENDING", label: "Pending" },
];

const EARN_SOURCES = [
  { emoji: "⏱️", label: "Learning Time",  bg: "#EDE9FE", color: "#7C3AED" },
  { emoji: "▶️", label: "Watch Reels",    bg: "#FEF3C7", color: "#D97706" },
  { emoji: "🎥", label: "Watch Videos",   bg: "#DBEAFE", color: "#2563EB" },
  // FIX (product decision — "V-Coins can not be earned from AI Guru, it's a
  // subscription-based model"): swapped the AI Guru card for VidyaStar —
  // mirrors apps/mobile/app/vcoins/wallet.tsx's same fix.
  { emoji: "⭐", label: "VidyaStar",      bg: "#EEF2FF", color: "#4F46E5" },
  { emoji: "⚔️", label: "SkillBattle",   bg: "#FEF9C3", color: "#CA8A04" },
];

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

interface RankEntry {
  uid: string; name: string; school: string;
  profilePic: string; yearCoins: number; rank: number;
}

// ─── Helpers ──────────────────────────────────────────────────

// FIX (bug report — "v-coins leaderboard needs student name"): this
// leaderboard ranks by users/{uid}'s vCoinsYear_* field (that's the only
// place VCoins totals live), but name/school/profilePic are NOT reliable
// fields on users/{uid} — per StudentProfileContext, those are canonical
// on students/{uid}. Reading them off the users doc silently fell back to
// "Student" for virtually everyone. Fetch the matching students/{uid} doc
// for each ranked entry and overlay its name/school/profilePic. Mirrors
// the same fix on mobile's app/vcoins/wallet.tsx.
async function hydrateWithStudentProfiles<T extends { uid: string; name: string; school: string; profilePic: string }>(
  entries: T[],
  fallbackName: string
): Promise<T[]> {
  const db = getFirestore();
  const studentSnaps = await Promise.all(
    entries.map((e) => getDoc(doc(db, "students", e.uid)).catch(() => null))
  );
  return entries.map((e, i) => {
    const sd = studentSnaps[i]?.exists() ? studentSnaps[i]!.data() : null;
    return {
      ...e,
      name:       sd?.name || fallbackName,
      school:     sd?.school || "",
      profilePic: sd?.profilePic || "",
    };
  });
}

function fmt(n: number) { return n.toLocaleString("en-IN"); }

function txColor(type: string, status: string) {
  if (status === "PENDING") return "#F59E0B";
  if (status === "FAILED")  return "#9CA3AF";
  return type === "CREDIT" ? "#10b981" : "#f87171";
}

function txDate(ts: { toDate?: () => Date } | null): string {
  const d = ts?.toDate?.();
  if (!d) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Main Tab Button ──────────────────────────────────────────
function MainTabBtn({ active, label, emoji, onClick }: {
  active: boolean; label: string; emoji: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: "9px 0", borderRadius: 10, border: "none", cursor: "pointer",
        background: active ? "#7C3AED" : "rgba(124,58,237,0.08)",
        transition: "background 0.15s",
      }}
    >
      <span style={{ fontSize: 15 }}>{emoji}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: active ? "#fff" : "#7C3AED" }}>{label}</span>
    </button>
  );
}

// ─── Filter Tab ───────────────────────────────────────────────
function FilterTabBtn({ active, label, onClick }: {
  active: boolean; label: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
        background: active ? "#7C3AED" : "var(--bg-card)",
        color: active ? "#fff" : "var(--text-muted)",
        fontSize: 13, fontWeight: 600, transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

// ─── Transaction Row ──────────────────────────────────────────
function TxRow({ tx }: { tx: VCoinTransaction }) {
  const color  = txColor(tx.type, tx.status);
  const prefix = tx.type === "CREDIT" ? "+" : "−";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 16px", background: "var(--bg-card)",
      borderBottom: "1px solid var(--border)",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 22, flexShrink: 0,
        background: tx.type === "CREDIT" ? "#F0FDF4" : "#FFF1F2",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20,
      }}>
        {tx.type === "CREDIT" ? "🪙" : "💸"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {tx.description}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{txDate(tx.createdAt)}</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color }}>{prefix}{fmt(tx.amount)}</div>
        <div style={{
          fontSize: 10, fontWeight: 700,
          color, background: color + "18",
          borderRadius: 10, padding: "2px 7px", marginTop: 3, display: "inline-block",
        }}>
          {tx.status}
        </div>
      </div>
    </div>
  );
}

// ─── Rank Row ─────────────────────────────────────────────────
function RankRow({ entry, isMe }: { entry: RankEntry; isMe: boolean }) {
  const medal = MEDALS[entry.rank];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 16px", background: isMe ? "rgba(124,58,237,0.08)" : "var(--bg-card)",
      borderBottom: "1px solid var(--border)",
      borderLeft: isMe ? "3px solid #7C3AED" : "3px solid transparent",
    }}>
      <div style={{ width: 36, textAlign: "center", flexShrink: 0 }}>
        {medal
          ? <span style={{ fontSize: 22 }}>{medal}</span>
          : <span style={{ fontSize: 14, fontWeight: 700, color: isMe ? "#7C3AED" : "var(--text-muted)" }}>#{entry.rank}</span>
        }
      </div>
      <img
        src={entry.profilePic || `https://i.pravatar.cc/80?u=${entry.uid}`}
        alt=""
        style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: isMe ? "#7C3AED" : "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {entry.name}{isMe ? " (You)" : ""}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {entry.school}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: isMe ? "#7C3AED" : "#374151" }}>
          🪙 {fmt(entry.yearCoins)}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function WalletPage() {
  const { balance, lifetimeEarned, lifetimeSpent, thisMonthEarned, transactions, loading } = useVCoins();
  const { user } = useStudentProfile();

  const [mainTab,    setMainTab]    = useState<MainTab>("wallet");
  const [filterTab,  setFilterTab]  = useState<FilterTab>("ALL");

  // Leaderboard state
  const [topEntries,   setTopEntries]   = useState<RankEntry[]>([]);
  const [extEntries,   setExtEntries]   = useState<RankEntry[]>([]);
  const [myEntry,      setMyEntry]      = useState<RankEntry | null>(null);
  const [rankLoading,  setRankLoading]  = useState(false);
  const [showMore,     setShowMore]     = useState(false);
  const [moreLoading,  setMoreLoading]  = useState(false);

  // Fetch top 10 when leaderboard tab opens
  useEffect(() => {
    if (mainTab !== "leaderboard") return;
    if (topEntries.length > 0) return;
    fetchTop10();
  }, [mainTab]);

  const fetchTop10 = async () => {
    setRankLoading(true);
    try {
      const db   = getFirestore();
      const snap = await getDocs(query(
        collection(db, "users"),
        orderBy(YEAR_FIELD, "desc"),
        limit(10),
      ));
      const uid     = user?.uid;
      const rawEntries: RankEntry[] = snap.docs.map((d, i) => ({
        uid:       d.id,
        name:      "Student",
        school:    "",
        profilePic: "",
        yearCoins: d.data()[YEAR_FIELD] ?? 0,
        rank:      i + 1,
      }));
      const entries = await hydrateWithStudentProfiles(rawEntries, "Student");
      setTopEntries(entries);
      const inTop = entries.find((e) => e.uid === uid);
      if (inTop) { setMyEntry(inTop); } else { fetchMyRank(); }
    } finally {
      setRankLoading(false);
    }
  };

  const fetchMyRank = async () => {
    const uid = user?.uid;
    if (!uid) return;
    try {
      const db       = getFirestore();
      const snap     = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) return;
      const myCoins  = snap.data()[YEAR_FIELD] ?? 0;
      const countSnap = await getCountFromServer(
        query(collection(db, "users"), where(YEAR_FIELD, ">", myCoins))
      );
      const [hydrated] = await hydrateWithStudentProfiles(
        [{ uid, name: "You", school: "", profilePic: "", yearCoins: myCoins, rank: countSnap.data().count + 1 }],
        "You"
      );
      setMyEntry(hydrated);
    } catch (e) { console.warn("fetchMyRank error", e); }
  };

  const handleSeeMore = async () => {
    if (extEntries.length > 0) { setShowMore(true); return; }
    setMoreLoading(true);
    try {
      const db   = getFirestore();
      const snap = await getDocs(query(
        collection(db, "users"),
        orderBy(YEAR_FIELD, "desc"),
        limit(100),
      ));
      const uid  = user?.uid;
      const rawAll: RankEntry[] = snap.docs.map((d, i) => ({
        uid:       d.id,
        name:      "Student",
        school:    "",
        profilePic: "",
        yearCoins: d.data()[YEAR_FIELD] ?? 0,
        rank:      i + 1,
      }));
      const all = await hydrateWithStudentProfiles(rawAll, "Student");
      setExtEntries(all);
      const inList = all.find((e) => e.uid === uid);
      if (inList) setMyEntry(inList);
      setShowMore(true);
    } finally { setMoreLoading(false); }
  };

  const filteredTx = transactions.filter((tx) => {
    if (filterTab === "ALL")     return true;
    if (filterTab === "EARNED")  return tx.type === "CREDIT" && tx.status === "SUCCESS";
    if (filterTab === "SPENT")   return tx.type === "DEBIT";
    if (filterTab === "PENDING") return tx.status === "PENDING";
    return true;
  });

  const displayedEntries = showMore ? extEntries : topEntries;

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
      <div style={{ width: 36, height: 36, border: "3px solid rgba(124,58,237,0.25)", borderTop: "3px solid #7C3AED", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 80 }}>

      {/* ── Main tab switcher ── */}
      <div style={{ display: "flex", gap: 8, padding: "12px 16px", background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
        <MainTabBtn active={mainTab === "wallet"}      label="Wallet"      emoji="💰" onClick={() => setMainTab("wallet")} />
        <MainTabBtn active={mainTab === "leaderboard"} label="Leaderboard" emoji="🏆" onClick={() => setMainTab("leaderboard")} />
      </div>

      {/* ══════════════ WALLET TAB ══════════════ */}
      {mainTab === "wallet" && (
        <div>
          {/* Balance card */}
          <div style={{
            margin: 16, borderRadius: 20, padding: 24,
            background: "linear-gradient(135deg, #7C3AED, #F59E0B)",
          }}>
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600 }}>V-Coins Balance</div>
            <div style={{ color: "#fff", fontSize: 40, fontWeight: 800, marginTop: 4, marginBottom: 20 }}>
              🪙 {fmt(balance ?? 0)}
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              {[
                { label: "Total Earned", value: lifetimeEarned },
                { label: "Total Spent",  value: lifetimeSpent },
                { label: "This Month",   value: thisMonthEarned },
              ].map((s, i, arr) => (
                // FIX (console warning — "each child in a list should have a
                // unique key prop"): key was on the inner <div>, but .map()
                // needs the key on the element it directly returns each
                // iteration — which was this fragment. A bare <>...</>
                // fragment can't carry props (including key) at all, so the
                // key never reached React. Same fix as home/page.tsx's
                // ReferralCard: explicit <Fragment key={...}> instead.
                <Fragment key={s.label}>
                  <div style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{fmt(s.value)}</div>
                    <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 2 }}>{s.label}</div>
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.25)" }} />
                  )}
                </Fragment>
              ))}
            </div>
          </div>

          {/* Earn sources */}
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", padding: "0 16px 10px" }}>Earn V-Coins</div>
          <div style={{ display: "flex", gap: 10, padding: "0 16px 16px", overflowX: "auto" }}>
            {EARN_SOURCES.map((src) => (
              <div key={src.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <div style={{ width: 52, height: 52, borderRadius: 26, background: src.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                  {src.emoji}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", textAlign: "center", maxWidth: 64 }}>{src.label}</div>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", padding: "0 16px 10px" }}>Transaction History</div>
          <div style={{ display: "flex", gap: 8, padding: "0 16px 12px" }}>
            {FILTER_TABS.map((tab) => (
              <FilterTabBtn key={tab.key} active={filterTab === tab.key} label={tab.label} onClick={() => setFilterTab(tab.key)} />
            ))}
          </div>

          {/* Transactions */}
          <div style={{ background: "var(--bg-card)" }}>
            {filteredTx.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 16px" }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>💰</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>No transactions yet</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Start watching videos and learning to earn V-Coins!</div>
              </div>
            ) : filteredTx.map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </div>
        </div>
      )}

      {/* ══════════════ LEADERBOARD TAB ══════════════ */}
      {mainTab === "leaderboard" && (
        <div>
          {/* Header */}
          <div style={{
            margin: 16, borderRadius: 20, padding: 24, textAlign: "center",
            background: "linear-gradient(135deg, #1e1b4b, #7C3AED)",
          }}>
            <div style={{ color: "#fff", fontSize: 20, fontWeight: 800 }}>🏆 V-Coins Leaderboard</div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 4 }}>
              {currentYear} Rankings · Updated Daily
            </div>
          </div>

          {/* My rank card (if not in visible list) */}
          {myEntry && !displayedEntries.find((e) => e.uid === user?.uid) && (
            <div style={{
              margin: "0 16px 8px", borderRadius: 14, padding: 14,
              background: "rgba(124,58,237,0.12)", border: "2px solid #7C3AED",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ color: "#7C3AED", fontSize: 12, fontWeight: 700 }}>Your Rank</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: "#7C3AED", fontSize: 22, fontWeight: 800 }}>#{myEntry.rank}</span>
                <span style={{ color: "var(--text)", fontSize: 14, fontWeight: 700 }}>🪙 {fmt(myEntry.yearCoins)}</span>
              </div>
            </div>
          )}

          {rankLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <div style={{ width: 36, height: 36, border: "3px solid rgba(124,58,237,0.25)", borderTop: "3px solid #7C3AED", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : (
            <div style={{ background: "var(--bg-card)" }}>
              {displayedEntries.map((entry) => (
                <RankRow key={entry.uid} entry={entry} isMe={entry.uid === user?.uid} />
              ))}

              {/* See More / Show Less */}
              {!showMore && topEntries.length >= 10 && (
                <button
                  onClick={handleSeeMore}
                  disabled={moreLoading}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    width: "calc(100% - 32px)", margin: 16, padding: "12px 0",
                    borderRadius: 14, border: "none", cursor: "pointer",
                    background: "rgba(124,58,237,0.12)", color: "#7C3AED",
                    fontSize: 14, fontWeight: 700,
                  }}
                >
                  {moreLoading
                    ? <div style={{ width: 18, height: 18, border: "2px solid rgba(124,58,237,0.3)", borderTop: "2px solid #7C3AED", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    : "▼ See Top 100"
                  }
                </button>
              )}

              {showMore && (
                <button
                  onClick={() => setShowMore(false)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    width: "calc(100% - 32px)", margin: 16, padding: "12px 0",
                    borderRadius: 14, border: "none", cursor: "pointer",
                    background: "rgba(124,58,237,0.12)", color: "#7C3AED",
                    fontSize: 14, fontWeight: 700,
                  }}
                >
                  ▲ Show Less
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
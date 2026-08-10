"use client";

// PATH: apps/web/src/app/contest/leaderboard/page.tsx
// Mirrors mobile app/contest/leaderboard.tsx — full ranked list, live vs
// final badge, top-3 medals, refresh button instead of pull-to-refresh.

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGuard from "@/components/layout/AuthGuard";
import { auth, db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

// NOTE: `name` must be read straight off the participant doc, not fetched
// separately from students/{uid} — firestore.rules locks students/{uid}
// reads to that student's own uid, so a per-row fetch of another
// participant's doc is always denied and silently falls back to "Student"
// for everyone but the viewer. joinVidyastarContest (Admin SDK) already
// denormalizes name onto the participant doc at join time for exactly
// this reason — see functions/src/vidyastarContest.ts.

function parseDate(t: any): Date | null {
  if (!t) return null;
  if (typeof t.toDate === "function") return t.toDate();
  if (t.seconds) return new Date(t.seconds * 1000);
  if (typeof t === "string" && t.length > 0) return new Date(t);
  return null;
}

type Row = { userId: string; name: string; score: number; timeBonus: number; rank: number };

const MEDAL = ["🥇", "🥈", "🥉"];

function ContestLeaderboardContent() {
  const searchParams = useSearchParams();
  const contestId = searchParams.get("contestId") ?? "";
  const router = useRouter();
  const userId = auth.currentUser?.uid;

  const [contest, setContest] = useState<any>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [isEnded, setIsEnded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!contestId) return;

    const [contestSnap, participantSnap] = await Promise.all([
      getDoc(doc(db, "contests", contestId)),
      getDocs(collection(db, "contests", contestId, "participant")),
    ]);

    if (contestSnap.exists()) {
      const data = { id: contestSnap.id, ...contestSnap.data() } as any;
      setContest(data);
      const end = parseDate(data.endTime ?? data.endDate);
      setIsEnded(!!(end && end < new Date()));
    }

    const completed = participantSnap.docs
      .filter((d) => d.data().completed)
      .map((d) => ({
        userId:    d.data().userId as string,
        name:      d.data().name      ?? "Student",
        score:     d.data().score     ?? 0,
        timeBonus: d.data().timeBonus ?? 0,
        rank:      d.data().rank      ?? 999,
      }))
      .sort((a, b) => a.rank - b.rank);

    // The viewing student's own row always leads the list — regardless of
    // their actual rank — followed by everyone else in rank order (mirrors
    // mobile's contest/leaderboard.tsx fix). Still capped at 50 rows total
    // (self + up to 49 others) to match the previous "top 50" limit.
    const uid = auth.currentUser?.uid;
    const selfRow = completed.find((r) => r.userId === uid);
    const others  = completed.filter((r) => r.userId !== uid).slice(0, selfRow ? 49 : 50);

    setRows(selfRow ? [selfRow, ...others] : others);
  }, [contestId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, border: "3px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "clb-spin 0.8s linear infinite" }} />
        <span style={{ color: "#94a3b8", fontSize: 15, fontWeight: 600 }}>Loading leaderboard...</span>
        <style>{`@keyframes clb-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#0f172a" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: 14, gap: 10, background: "linear-gradient(90deg, #0f0c29, #302b63)" }}>
        <button onClick={() => router.back()} style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "#fff", fontSize: 20 }}>
          ←
        </button>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
          <span style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 800, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
            {contest?.title ?? "Leaderboard"}
          </span>
          {isEnded ? (
            <span style={{ background: "rgba(251,191,36,0.15)", borderRadius: 10, padding: "4px 10px", color: "#fbbf24", fontSize: 11, fontWeight: 800 }}>🏆 Final Results</span>
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.15)", borderRadius: 10, padding: "4px 10px" }}>
              <span style={{ width: 7, height: 7, borderRadius: 4, background: "#ef4444" }} />
              <span style={{ color: "#fca5a5", fontSize: 11, fontWeight: 800 }}>Live Standings</span>
            </span>
          )}
        </div>
        <button onClick={onRefresh} disabled={refreshing} style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: refreshing ? "default" : "pointer", color: "#a5b4fc", fontSize: 18, opacity: refreshing ? 0.5 : 1 }}>
          ↻
        </button>
      </div>

      <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>
        {/* Live disclaimer */}
        {!isEnded && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#1e293b", borderRadius: 12, padding: 12, marginBottom: 16 }}>
            <span style={{ color: "#94a3b8", fontSize: 14 }}>ℹ️</span>
            <span style={{ color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>Rankings update as more students complete the quiz</span>
          </div>
        )}

        {/* Empty state */}
        {rows.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 0", gap: 10 }}>
            <span style={{ fontSize: 48 }}>📊</span>
            <span style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 800 }}>No scores yet</span>
            <span style={{ color: "#64748b", fontSize: 14 }}>Be the first to complete the quiz!</span>
          </div>
        )}

        {/* Rows — "You" is always first (see load()'s selfRow pinning
            above); medal/gold styling below keys off each row's actual
            rank, not its position in the list, so a pinned "You" row
            outside the top 3 doesn't get shown as if ranked #1. */}
        {rows.map((row) => {
          const isMe = row.userId === userId;
          const isRankOne = row.rank === 1;
          const rowBg = isMe ? "#1e1b4b" : isRankOne ? "#1c1506" : "#1e293b";
          const rowBorder = isMe ? "#6366f1" : isRankOne ? "rgba(245,158,11,0.33)" : "#334155";
          return (
            <div key={row.userId} style={{
              display: "flex", alignItems: "center", gap: 12, background: rowBg,
              borderRadius: 16, padding: 14, marginBottom: 10,
              border: `1px solid ${rowBorder}`,
            }}>
              <span style={{ width: 36, fontSize: 20, textAlign: "center", fontWeight: 800, color: row.rank === 1 ? "#fbbf24" : row.rank === 2 ? "#94a3b8" : row.rank === 3 ? "#d97706" : "#94a3b8" }}>
                {row.rank <= 3 ? MEDAL[row.rank - 1] : `#${row.rank}`}
              </span>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ color: isMe ? "#818cf8" : "#cbd5e1", fontSize: 15, fontWeight: isMe ? 900 : 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {isMe ? "You" : row.name}
                </span>
                {!!row.timeBonus && <span style={{ color: "#10b981", fontSize: 11, fontWeight: 600 }}>+{row.timeBonus} speed bonus</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                <span style={{ color: isMe ? "#a5b4fc" : "#f1f5f9", fontSize: 20, fontWeight: 900 }}>{row.score}</span>
                <span style={{ color: "#475569", fontSize: 10, fontWeight: 600 }}>pts</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ContestLeaderboardPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<div style={{ minHeight: "100dvh", background: "#0f172a" }} />}>
        <ContestLeaderboardContent />
      </Suspense>
    </AuthGuard>
  );
}

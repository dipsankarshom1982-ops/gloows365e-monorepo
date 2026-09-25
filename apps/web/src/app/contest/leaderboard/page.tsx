"use client";

// PATH: apps/web/src/app/contest/leaderboard/page.tsx
// Mirrors mobile app/contest/leaderboard.tsx.
//
// VidyaStar Phase 2 — rewritten to use a bounded, ordered, paginated
// Firestore query (lib/contestLeaderboard.ts) instead of reading every
// participant and sorting client-side by a batch-rewritten `rank` field.
// See that file and functions/src/contestLeaderboard.ts for the full
// architecture.
//
// UX change this necessitates: the old screen force-pinned "You" to the
// very first row of page 1 regardless of actual rank — with real cursor
// pagination that's no longer possible (it would either duplicate a real
// entry or desync the "Load More" cursor). Instead, "Your Position" is now
// a dedicated, always-visible card above the list; the list itself shows
// the real, unmodified page-by-page order, and highlights your own row
// wherever it naturally falls once you've loaded that far.

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGuard from "@/components/layout/AuthGuard";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, QueryDocumentSnapshot } from "firebase/firestore";
import {
  fetchFinalizedLeaderboardPage,
  fetchLeaderboardPage,
  fetchMyLiveRank,
  LEADERBOARD_PAGE_SIZE,
  type LeaderboardRow,
} from "@/lib/contestLeaderboard";

function parseDate(t: any): Date | null {
  if (!t) return null;
  if (typeof t.toDate === "function") return t.toDate();
  if (t.seconds) return new Date(t.seconds * 1000);
  if (typeof t === "string" && t.length > 0) return new Date(t);
  return null;
}

const MEDAL = ["🥇", "🥈", "🥉"];

type MyPositionState =
  | { kind: "not_participated" }
  | { kind: "pending" }
  | { kind: "ranked"; rank: number; isFinal: boolean; score: number };

function ContestLeaderboardContent() {
  const searchParams = useSearchParams();
  const contestId = searchParams.get("contestId") ?? "";
  const router = useRouter();
  const userId = auth.currentUser?.uid;

  const [contest, setContest]         = useState<any>(null);
  const [rows, setRows]               = useState<LeaderboardRow[]>([]);
  const [cursor, setCursor]           = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore]         = useState(false);
  const [isEnded, setIsEnded]         = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const [myPosition, setMyPosition]   = useState<MyPositionState>({ kind: "pending" });
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);

  const load = useCallback(async () => {
    if (!contestId) return;

    const [contestSnap, mySnap] = await Promise.all([
      getDoc(doc(db, "contests", contestId)),
      userId ? getDoc(doc(db, "contests", contestId, "participant", userId)) : Promise.resolve(null),
    ]);

    let finalized = false;
    if (contestSnap.exists()) {
      const data = { id: contestSnap.id, ...contestSnap.data() } as any;
      setContest(data);
      const end = parseDate(data.endTime ?? data.endDate);
      setIsEnded(!!(end && end < new Date()));
      finalized = data.leaderboardFinalized === true;
      setIsFinalized(finalized);
    }

    const page = finalized
      ? await fetchFinalizedLeaderboardPage(contestId)
      : await fetchLeaderboardPage(contestId);
    setRows(page.rows);
    setCursor(page.cursor);
    setHasMore(page.hasMore);

    if (!mySnap || !mySnap.exists()) {
      setMyPosition({ kind: "not_participated" });
    } else {
      const my = mySnap.data();
      if (!my.completed) {
        setMyPosition({ kind: "pending" });
      } else if (typeof my.finalRank === "number") {
        setMyPosition({ kind: "ranked", rank: my.finalRank, isFinal: true, score: my.score ?? 0 });
      } else if (typeof my.rank === "number") {
        setMyPosition({ kind: "ranked", rank: my.rank, isFinal: !!finalized, score: my.score ?? 0 });
      } else {
        try {
          const liveRank = await fetchMyLiveRank(contestId, my.score ?? 0, my.correctAnswers ?? 0);
          setMyPosition({ kind: "ranked", rank: liveRank, isFinal: false, score: my.score ?? 0 });
        } catch {
          setMyPosition({ kind: "ranked", rank: 0, isFinal: false, score: my.score ?? 0 });
        }
      }
    }
  }, [contestId, userId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (!contestId || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = isFinalized
        ? await fetchFinalizedLeaderboardPage(contestId, cursor)
        : await fetchLeaderboardPage(contestId, cursor);
      setRows((prev) => [...prev, ...page.rows]);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } finally {
      setLoadingMore(false);
    }
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
          {isFinalized ? (
            <span style={{ background: "rgba(251,191,36,0.15)", borderRadius: 10, padding: "4px 10px", color: "#fbbf24", fontSize: 11, fontWeight: 800 }}>🏆 Final Results</span>
          ) : isEnded ? (
            <span style={{ background: "rgba(148,163,184,0.15)", borderRadius: 10, padding: "4px 10px", color: "#cbd5e1", fontSize: 11, fontWeight: 800 }}>⏳ Finalizing…</span>
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
        {/* Your Position — always resolved independently of the loaded
            page, never shows a false "not ranked" just because you're
            outside it. */}
        {myPosition.kind === "ranked" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#1e1b4b", borderRadius: 16, padding: 14, marginBottom: 16, border: "1px solid rgba(99,102,241,0.33)" }}>
            <span style={{ fontSize: 20 }}>👤</span>
            <span style={{ color: "#a5b4fc", fontSize: 13, fontWeight: 700, flex: 1 }}>Your Position</span>
            <span style={{ color: "#fbbf24", fontSize: 20, fontWeight: 900 }}>{myPosition.rank > 0 ? `#${myPosition.rank}` : "—"}</span>
            <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700 }}>{myPosition.score} pts</span>
            {!myPosition.isFinal && <span style={{ color: "#818cf8", fontSize: 10, fontWeight: 700 }}>Live estimate</span>}
          </div>
        )}
        {myPosition.kind === "pending" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#1e293b", borderRadius: 16, padding: 12, marginBottom: 16 }}>
            <span>⏳</span>
            <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>Complete the quiz to see your position</span>
          </div>
        )}

        {/* Live/finalizing disclaimer */}
        {!isFinalized && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#1e293b", borderRadius: 12, padding: 12, marginBottom: 16 }}>
            <span style={{ color: "#94a3b8", fontSize: 14 }}>ℹ️</span>
            <span style={{ color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>
              {isEnded ? "Final ranks are being calculated — check back shortly." : "Rankings update as more students complete the quiz"}
            </span>
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

        {rows.map((row, index) => {
          const isMe = row.userId === userId;
          const rank = (isFinalized ? row.finalRank : row.rank) ?? index + 1;
          const isRankOne = rank === 1;
          const rowBg = isMe ? "#1e1b4b" : isRankOne ? "#1c1506" : "#1e293b";
          const rowBorder = isMe ? "#6366f1" : isRankOne ? "rgba(245,158,11,0.33)" : "#334155";
          return (
            <div key={row.userId} style={{
              display: "flex", alignItems: "center", gap: 12, background: rowBg,
              borderRadius: 16, padding: 14, marginBottom: 10,
              border: `1px solid ${rowBorder}`,
            }}>
              <span style={{ width: 36, fontSize: 20, textAlign: "center", fontWeight: 800, color: rank === 1 ? "#fbbf24" : rank === 2 ? "#94a3b8" : rank === 3 ? "#d97706" : "#94a3b8" }}>
                {rank <= 3 ? MEDAL[rank - 1] : `#${rank}`}
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

        {hasMore && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              padding: "14px", marginTop: 4, background: "#1e293b", borderRadius: 14,
              border: "1px solid #334155", color: "#a5b4fc", fontSize: 14, fontWeight: 800,
              cursor: loadingMore ? "default" : "pointer",
            }}
          >
            {loadingMore ? "Loading…" : `Load More (${LEADERBOARD_PAGE_SIZE} more)`}
          </button>
        )}
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

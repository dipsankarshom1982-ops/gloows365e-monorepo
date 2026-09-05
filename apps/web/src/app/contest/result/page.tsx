"use client";

// PATH: apps/web/src/app/contest/result/page.tsx
// Mirrors mobile app/contest/result.tsx — score ring, rank/prize shown only
// once the contest has ended, live leaderboard preview otherwise.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGuard from "@/components/layout/AuthGuard";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  fetchFinalizedLeaderboardPage,
  fetchLeaderboardPage,
  fetchMyLiveRank,
} from "@/lib/contestLeaderboard";

type LeaderRow = { userId: string; name: string; score: number; rank: number };

// Prizes live only in VidyaStar Config (vidyastarConfig/{periodKey}.prizeRows)
// — Create Contest's old free-text Prize field was removed since it
// duplicated this. The winner's prize is the row covering their final rank.
type PrizeType = "gift_voucher" | "physical" | "vcoin";
interface PrizeRow { rankMin: number; rankMax: number; prizeType: PrizeType; prizeValue: string; medalEmoji: string; badge: string; }

function formatPrize(row: PrizeRow): string {
  return row.prizeType === "vcoin" ? `${row.prizeValue} V-Coins` : row.prizeValue;
}
function prizeForRank(rows: PrizeRow[] | undefined, rank: number): PrizeRow | null {
  return rows?.find((r) => rank >= r.rankMin && rank <= r.rankMax) ?? null;
}

function parseDate(t: any): Date | null {
  if (!t) return null;
  if (typeof t.toDate === "function") return t.toDate();
  if (t.seconds) return new Date(t.seconds * 1000);
  if (typeof t === "string" && t.length > 0) return new Date(t);
  return null;
}

function getGrade(score: number, total: number) {
  const pct = total > 0 ? Math.round((score / (total * 10)) * 100) : 0;
  if (pct >= 90) return { label: "Excellent", emoji: "🌟", color: "#10b981", pct };
  if (pct >= 70) return { label: "Good", emoji: "👍", color: "#6366f1", pct };
  if (pct >= 50) return { label: "Average", emoji: "🙂", color: "#f59e0b", pct };
  return { label: "Keep Practicing", emoji: "💪", color: "#ef4444", pct };
}

function ScoreRing({ score, total }: { score: number; total: number }) {
  const grade = getGrade(score, total);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBlock: 8 }}>
      <div style={{
        width: 140, height: 140, borderRadius: 70, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", border: "3px solid #334155",
        background: "linear-gradient(180deg, #1e293b, #0f172a)",
      }}>
        <span style={{ fontSize: 40, fontWeight: 900, color: grade.color }}>{score}</span>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: 600 }}>pts</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: grade.color, marginTop: 4 }}>{grade.label}</span>
      </div>
      <span style={{ fontSize: 28, marginTop: 12 }}>{grade.emoji}</span>
      <span style={{ fontSize: 18, fontWeight: 800, color: grade.color, marginTop: 4 }}>{grade.pct}%</span>
    </div>
  );
}

function ContestResultContent() {
  const searchParams = useSearchParams();
  const contestId = searchParams.get("contestId") ?? "";
  const scoreParam = searchParams.get("score");
  const totalParam = searchParams.get("total");
  const router = useRouter();
  const userId = auth.currentUser?.uid;

  const [contest, setContest] = useState<any>(null);
  const [score, setScore] = useState(parseInt(scoreParam ?? "0", 10));
  const [total, setTotal] = useState(parseInt(totalParam ?? "0", 10));
  const [myRank, setMyRank] = useState<number | null>(null);
  const [prize, setPrize] = useState<PrizeRow | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [isEnded, setIsEnded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contestId || !userId) return;
    (async () => {
      const [contestSnap, mySnap] = await Promise.all([
        getDoc(doc(db, "contests", contestId)),
        getDoc(doc(db, "contests", contestId, "participant", userId)),
      ]);

      let periodKey: string | undefined;
      let finalized = false;
      if (contestSnap.exists()) {
        const data = { id: contestSnap.id, ...contestSnap.data() } as any;
        setContest(data);
        periodKey = data.periodKey;
        finalized = data.leaderboardFinalized === true;
        const end = parseDate(data.endTime ?? data.endDate);
        setIsEnded(!!(end && end < new Date()));
      }

      // Rank resolution mirrors contest/leaderboard/page.tsx's three-way
      // branch: authoritative finalRank once finalized, legacy `rank` for
      // historical (pre-Phase-2) contests, otherwise a live count-
      // aggregation estimate — never derived from page membership.
      let rank: number | null = null;
      if (mySnap.exists()) {
        const d = mySnap.data();
        const myScore = d.score ?? parseInt(scoreParam ?? "0", 10);
        setScore(myScore);
        setTotal(d.answers?.length ?? parseInt(totalParam ?? "0", 10));
        if (typeof d.finalRank === "number") {
          rank = d.finalRank;
        } else if (typeof d.rank === "number") {
          rank = d.rank;
        } else if (d.completed) {
          try {
            rank = await fetchMyLiveRank(contestId, myScore, d.correctAnswers ?? 0);
          } catch { /* live estimate is non-critical */ }
        }
        setMyRank(rank);
      }

      // Best-effort — a failure here (rules, network) must never block the
      // score/leaderboard below from rendering.
      if (periodKey && rank !== null) {
        try {
          const configSnap = await getDoc(doc(db, "vidyastarConfig", periodKey));
          if (configSnap.exists()) {
            setPrize(prizeForRank(configSnap.data().prizeRows as PrizeRow[], rank));
          }
        } catch { /* prize teaser is non-critical */ }
      }

      // Top-10 preview — a single bounded page (ordered query), not a
      // full-collection read. `name` comes straight off the participant
      // doc — no more per-row students/{uid} fetch (denied by
      // firestore.rules for every row but the viewer's own anyway).
      const page = finalized
        ? await fetchFinalizedLeaderboardPage(contestId, null, 10)
        : await fetchLeaderboardPage(contestId, null, 10);
      setLeaderboard(
        page.rows.map((r, i) => ({
          userId: r.userId,
          name: r.name,
          score: r.score,
          rank: (finalized ? r.finalRank : r.rank) ?? i + 1,
        }))
      );
      setLoading(false);
    })();
  }, [contestId, userId, scoreParam, totalParam]);

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, border: "3px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "cr-spin 0.8s linear infinite" }} />
        <span style={{ color: "#94a3b8", fontSize: 15, fontWeight: 600 }}>Loading results...</span>
        <style>{`@keyframes cr-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const grade = getGrade(score, total);

  return (
    <div style={{ minHeight: "100dvh", background: "#0f172a" }}>
      <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #0f0c29, #302b63, #0f172a)" }}>
        <span style={{ color: "#f1f5f9", fontSize: 26, fontWeight: 900 }}>🎉 Quiz Complete!</span>
        <span style={{ color: "#a5b4fc", fontSize: 14, fontWeight: 600, textAlign: "center" }}>{contest?.title ?? "Contest Result"}</span>
      </div>

      <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>

        {/* Score ring */}
        <div style={{ background: "#1e293b", borderRadius: 24, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16, gap: 10 }}>
          <ScoreRing score={score} total={total} />
          <span style={{ fontSize: 20, fontWeight: 900, color: grade.color }}>{grade.emoji} {grade.label}!</span>
          <div style={{ display: "flex", alignItems: "center", marginTop: 4, width: "100%" }}>
            {[
              { val: total, label: "Questions" },
              { val: score, label: "Points" },
              { val: `${grade.pct}%`, label: "Accuracy" },
            ].map((s, i) => (
              <div key={s.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, borderLeft: i > 0 ? "1px solid #334155" : "none" }}>
                <span style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 900 }}>{s.val}</span>
                <span style={{ color: "#64748b", fontSize: 11, fontWeight: 600 }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Still running */}
        {!isEnded && (
          <div style={{ background: "#1e293b", borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 16, border: "1px solid rgba(245,158,11,0.2)" }}>
            <span style={{ fontSize: 28 }}>⏰</span>
            <span style={{ color: "#fde68a", fontSize: 16, fontWeight: 800 }}>Contest Still Running</span>
            <span style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", lineHeight: 1.6 }}>
              Your score is saved. Rank and prize pool results will be announced once the contest ends.
            </span>
          </div>
        )}

        {/* Rank */}
        {isEnded && myRank !== null && (
          <div style={{ background: "#1e293b", borderRadius: 20, padding: 18, display: "flex", alignItems: "center", gap: 14, marginBottom: 16, border: "1px solid rgba(245,158,11,0.33)" }}>
            <span style={{ fontSize: 24 }}>🏆</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>Your Final Rank</div>
              <div style={{ color: "#fbbf24", fontSize: 28, fontWeight: 900 }}>#{myRank}</div>
            </div>
          </div>
        )}

        {/* Prize (voucher/physical — never cash) */}
        {isEnded && !!prize && (
          <div style={{ borderRadius: 18, padding: 18, display: "flex", alignItems: "center", gap: 12, marginBottom: 16, background: "linear-gradient(90deg, #92400e, #d97706, #fbbf24)" }}>
            <span style={{ fontSize: 24 }}>🏆</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 600 }}>Prize</div>
              <div style={{ color: "#fff", fontSize: 22, fontWeight: 900 }}>{formatPrize(prize)}</div>
            </div>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, textAlign: "right", maxWidth: 80 }}>Winners announced by admin</span>
          </div>
        )}

        {/* Leaderboard preview */}
        {isEnded && leaderboard.length > 0 && (
          <div style={{ background: "#1e293b", borderRadius: 20, padding: 16, marginBottom: 16 }}>
            <div style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>🏆 Final Leaderboard</div>
            {leaderboard.map((row, i) => {
              const isMe = row.userId === userId;
              return (
                <div key={row.userId} style={{
                  display: "flex", alignItems: "center", gap: 12, paddingBlock: 10,
                  borderBottom: "1px solid #334155",
                  background: isMe ? "rgba(99,102,241,0.1)" : "transparent",
                  borderRadius: isMe ? 10 : 0, paddingInline: isMe ? 8 : 0,
                }}>
                  <span style={{ width: 32, textAlign: "center", fontWeight: 800, color: i === 0 ? "#fbbf24" : i === 1 ? "#94a3b8" : i === 2 ? "#d97706" : "#94a3b8" }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span>
                  <span style={{ flex: 1, color: isMe ? "#818cf8" : "#cbd5e1", fontSize: 14, fontWeight: isMe ? 800 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {isMe ? "You" : row.name}
                  </span>
                  <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>{row.score} pts</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            onClick={() => router.push(isEnded ? "/starboard" : `/contest/leaderboard?contestId=${contestId}`)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: "#1e293b", borderRadius: 16, padding: "14px 0",
              border: "1px solid rgba(99,102,241,0.33)", cursor: "pointer",
            }}
          >
            <span style={{ color: "#a5b4fc" }}>🏅</span>
            <span style={{ color: "#a5b4fc", fontSize: 14, fontWeight: 800 }}>
              {isEnded ? "View Leaderboard" : "View Live Standings"}
            </span>
          </button>

          <button
            onClick={() => router.push("/vidyastar")}
            style={{ borderRadius: 16, border: "none", padding: "16px 0", background: "linear-gradient(90deg, #6366f1, #4f46e5)", color: "#fff", fontSize: 16, fontWeight: 900, cursor: "pointer" }}
          >
            Back to Contests
          </button>

          <button
            onClick={() => router.push("/home")}
            style={{ borderRadius: 16, border: "1px solid #334155", padding: "14px 0", background: "transparent", color: "#94a3b8", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContestResultPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<div style={{ minHeight: "100dvh", background: "#0f172a" }} />}>
        <ContestResultContent />
      </Suspense>
    </AuthGuard>
  );
}

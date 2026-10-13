"use client";

// PATH: apps/web/src/app/(app)/leaderboard/page.tsx
// India / State / District / Local rank tabs
// Reads from leaderboard/{scope}/entries (same Firestore path as mobile)

import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import {
  getFirestore, collection, query,
  orderBy, limit, onSnapshot,
} from "firebase/firestore";
import { useStudentProfile } from "@gloows/shared-logic";

interface LeaderboardEntry {
  userId:  string;
  name:    string;
  points:  number;
  rank:    number;
  trend?:  "up" | "down" | "same";
  state?:  string;
  district?: string;
  class?:  string | number;
}

type Scope = "india" | "state" | "district" | "local";
const SCOPES: { key: Scope; label: string; emoji: string }[] = [
  { key: "india",    label: "India",    emoji: "🇮🇳" },
  { key: "state",    label: "State",    emoji: "🗺️" },
  { key: "district", label: "District", emoji: "📍" },
  { key: "local",    label: "Local",    emoji: "🏘️" },
];

function useLeaderboard(scope: Scope) {
  const [data, setData] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const db = getFirestore();
    const col = collection(db, "leaderboard", scope, "entries");
    const q = query(col, orderBy("points", "desc"), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      setData(snap.docs.map((d, i) => ({ userId: d.id, rank: i + 1, ...d.data() } as LeaderboardEntry)));
    }, () => {});
    return () => unsub();
  }, [scope]);

  return data;
}

export default function LeaderboardPage() {
  const [scope, setScope] = useState<Scope>("india");
  const data = useLeaderboard(scope);
  const uid  = getAuth().currentUser?.uid ?? "";
  const { studentProfile } = useStudentProfile();

  const podium    = data.slice(0, 3);
  const rest      = data.slice(3);
  const myIndex   = data.findIndex((u) => u.userId === uid);
  const myData    = myIndex >= 0 ? data[myIndex] : null;
  const pointsGap = myIndex > 0 ? (data[myIndex - 1]?.points ?? 0) - (myData?.points ?? 0) : 0;

  return (
    <div style={{ paddingBottom: myData ? 80 : 32, minHeight: "100dvh", background: "var(--bg)" }}>

      {/* ── Scope tabs ── */}
      <div style={{
        display: "flex", gap: 6, padding: "10px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        overflowX: "auto",
      }}>
        {SCOPES.map(({ key, label, emoji }) => (
          <button key={key} onClick={() => setScope(key)} style={{
            flex: "1 1 0", padding: "8px 4px", borderRadius: 20,
            border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
            background: scope === key ? "#6366f1" : "#1e293b",
            color: scope === key ? "#fff" : "#64748b",
            minWidth: 70, whiteSpace: "nowrap",
          }}>
            {emoji} {label}
          </button>
        ))}
      </div>

      {/* ── Context pill ── */}
      {studentProfile && (
        <div style={{
          margin: "10px 12px 6px",
          background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
          borderRadius: 10, padding: "7px 12px",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ color: "#818cf8", fontSize: 11, fontWeight: 700 }}>
            📍 {studentProfile.name} · {studentProfile.location?.district ?? "—"} · {studentProfile.location?.state ?? "—"}
          </span>
        </div>
      )}

      {/* ── Your stats card ── */}
      <div style={{
        margin: "6px 12px 12px",
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
            {studentProfile?.name ?? "Student"}
          </div>
        </div>
        <div style={{ width: 1, height: 60, background: "rgba(255,255,255,0.1)" }} />
        <div style={{ display: "flex", gap: 16 }}>
          {[
            { val: myData ? `#${myData.rank}` : "—",      lbl: `${SCOPES.find(s => s.key === scope)?.label} Rank` },
            { val: pointsGap > 0 ? `+${pointsGap}` : "🔝", lbl: pointsGap > 0 ? "pts to next" : "Top rank" },
            { val: myData?.trend === "up" ? "▲" : myData?.trend === "down" ? "▼" : "—", lbl: "Trend" },
          ].map(({ val, lbl }) => (
            <div key={lbl} style={{ textAlign: "center" }}>
              <div style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 900 }}>{val}</div>
              <div style={{ color: "#64748b", fontSize: 9, fontWeight: 700, marginTop: 2 }}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Podium ── */}
      {podium.length > 0 && (
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "flex-end",
          margin: "0 12px 16px", gap: 6,
        }}>
          {[podium[1], podium[0], podium[2]].map((u, i) => {
            if (!u) return <div key={i} style={{ flex: 1 }} />;
            const medals  = ["🥈", "🥇", "🥉"];
            const heights = [90, 120, 75];
            const clrs    = ["#94a3b8", "#fbbf24", "#d97706"];
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
                  borderTop: `3px solid ${clrs[i]}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ color: clrs[i], fontSize: 18, fontWeight: 900 }}>#{[2, 1, 3][i]}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Rankings list ── */}
      <div style={{ color: "#475569", fontSize: 12, fontWeight: 800, padding: "0 16px 6px", letterSpacing: 1 }}>
        TOP 100 RANKINGS
      </div>

      {data.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 0", gap: 10 }}>
          <span style={{ fontSize: 48, opacity: 0.3 }}>🏆</span>
          <div style={{ color: "#374151", fontSize: 15, fontWeight: 600 }}>No data yet</div>
        </div>
      ) : (
        rest.map((item) => {
          const isMe = item.userId === uid;
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
          {pointsGap > 0 && (
            <span style={{ color: "#818cf8", fontSize: 12, fontWeight: 600 }}>{pointsGap} pts to #{myData.rank - 1}</span>
          )}
        </div>
      )}
    </div>
  );
}
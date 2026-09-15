"use client";

// PATH: apps/web/src/app/(app)/skillboard/page.tsx
// Mirrors mobile app/skillboard.tsx
// SkillBoard = per-skill leaderboard based on Skill Battle performance

import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import {
  getFirestore, collection, query,
  orderBy, limit, onSnapshot, getDocs,
} from "firebase/firestore";
import { useStudentProfile } from "@gloows/shared-logic";

interface SkillEntry {
  userId: string;
  name:   string;
  score:  number;
  rank:   number;
  class?: string | number;
  state?: string;
}

const SKILL_CATEGORIES = [
  { key: "all",     label: "All Skills",    emoji: "⊞" },
  { key: "science", label: "Science",       emoji: "🔬" },
  { key: "math",    label: "Mathematics",   emoji: "📐" },
  { key: "english", label: "English",       emoji: "📝" },
  { key: "gk",      label: "General K.",    emoji: "🌍" },
  { key: "coding",  label: "Coding",        emoji: "💻" },
];

function useSkillboard(skill: string) {
  const [data,    setData]    = useState<SkillEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db  = getFirestore();
    const col = skill === "all"
      ? collection(db, "skillboard", "global", "entries")
      : collection(db, "skillboard", skill, "entries");
    const q   = query(col, orderBy("score", "desc"), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      setData(snap.docs.map((d, i) => ({ userId: d.id, rank: i + 1, ...d.data() } as SkillEntry)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [skill]);

  return { data, loading };
}

export default function SkillboardPage() {
  const [skill, setSkill] = useState("all");
  const { data, loading } = useSkillboard(skill);
  const { studentProfile } = useStudentProfile();
  const uid     = getAuth().currentUser?.uid ?? "";
  const podium  = data.slice(0, 3);
  const rest    = data.slice(3);
  const myData  = data.find((e) => e.userId === uid);

  return (
    <div style={{ paddingBottom: myData ? 80 : 32 }}>

      {/* ── Header ── */}
      <div style={{ padding: "12px 16px 4px" }}>
        <h2 style={{ color: "var(--text)", fontWeight: 900, fontSize: 22, margin: 0 }}>🏅 SkillBoard</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>
          Skill Battle performance rankings
        </p>
      </div>

      {/* ── Skill tabs ── */}
      <div style={{
        display: "flex", gap: 6, padding: "8px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        overflowX: "auto",
      }}>
        {SKILL_CATEGORIES.map(({ key, label, emoji }) => (
          <button key={key} onClick={() => setSkill(key)} style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "7px 12px", borderRadius: 20, border: "none",
            background: skill === key ? "#6366f1" : "rgba(255,255,255,0.05)",
            color: skill === key ? "#fff" : "var(--text-muted)",
            fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
          }}>
            <span>{emoji}</span><span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── Your stats ── */}
      {myData && (
        <div style={{
          margin: "10px 12px",
          background: "linear-gradient(135deg, #1e1b4b, #312e81)",
          borderRadius: 16, padding: "14px 16px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div>
            <div style={{ color: "#a5b4fc", fontSize: 11, fontWeight: 700 }}>Your Rank</div>
            <div style={{ color: "#fff", fontSize: 28, fontWeight: 900 }}>#{myData.rank}</div>
          </div>
          <div style={{ width: 1, height: 40, background: "rgba(255,255,255,0.1)" }} />
          <div>
            <div style={{ color: "#a5b4fc", fontSize: 11, fontWeight: 700 }}>Score</div>
            <div style={{ color: "#fff", fontSize: 24, fontWeight: 900 }}>{myData.score}</div>
          </div>
        </div>
      )}

      {/* ── Podium ── */}
      {!loading && podium.length > 0 && (
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "flex-end",
          margin: "10px 12px 14px", gap: 6,
        }}>
          {[podium[1], podium[0], podium[2]].map((u, i) => {
            if (!u) return <div key={i} style={{ flex: 1 }} />;
            const medals  = ["🥈", "🥇", "🥉"];
            const heights = [90, 120, 75];
            const clrs    = ["#94a3b8", "#fbbf24", "#d97706"];
            return (
              <div key={u.userId} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontSize: 24 }}>{medals[i]}</div>
                <div style={{ color: "#e2e8f0", fontSize: 10, fontWeight: 700, textAlign: "center", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                  {u.name}
                </div>
                <div style={{ color: "#94a3b8", fontSize: 10, marginBottom: 4 }}>{u.score} pts</div>
                <div style={{
                  width: "100%", height: heights[i], borderRadius: 10,
                  background: "linear-gradient(180deg, #1e293b, #0f172a)",
                  borderTop: `3px solid ${clrs[i]}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ color: clrs[i], fontSize: 16, fontWeight: 900 }}>#{[2, 1, 3][i]}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Rankings ── */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <div style={{ width: 28, height: 28, border: "3px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : data.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 0", gap: 10 }}>
          <span style={{ fontSize: 44, opacity: 0.3 }}>🏅</span>
          <div style={{ color: "#374151", fontSize: 15, fontWeight: 600 }}>No data yet for this skill</div>
        </div>
      ) : (
        <>
          <div style={{ color: "#475569", fontSize: 12, fontWeight: 800, padding: "4px 16px 6px", letterSpacing: 1 }}>
            TOP RANKINGS
          </div>
          {rest.map((item) => {
            const isMe = item.userId === uid;
            return (
              <div key={item.userId} style={{
                display: "flex", alignItems: "center", padding: "12px 16px",
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
                <div style={{ color: isMe ? "#818cf8" : "#94a3b8", fontSize: 13, fontWeight: 700 }}>
                  {item.score} pts
                </div>
              </div>
            );
          })}
        </>
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
            You · {myData.score} pts
          </span>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
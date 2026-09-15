"use client";

// PATH: apps/web/src/app/(app)/learnfun/page.tsx
// Mirrors mobile app/(drawer)/(tabs)/learnFun.tsx
// Skill Worlds grid, Daily Mission card, Boss Battle, Badge showcase, Coming Soon games

import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";

// ─── Types (mirrors mobile lib/learnfun/types.ts) ─────────────
interface SkillWorld {
  id:             string;
  title:          string;
  emoji:          string;
  description:    string;
  color:          string;
  gradientColors: [string, string];
  missions:       number;
  difficulty:     "easy" | "medium" | "hard";
}

interface LearnFunGame {
  id:              string;
  title:           string;
  emoji:           string;
  skill:           string;
  durationMinutes: number;
  difficulty:      "easy" | "medium" | "hard" | "boss";
  gradientColors:  [string, string];
  type:            string;
}

// ─── Static data (mirrors mobile lib/learnfun/constants.ts) ───
const SKILL_WORLDS: SkillWorld[] = [
  { id: "financial", title: "Financial Wisdom", emoji: "💰", description: "Master budgeting & smart money habits", color: "#10B981", gradientColors: ["#064E3B", "#10B981"], missions: 5, difficulty: "medium" },
  { id: "digital",   title: "Digital Safety",   emoji: "🛡️", description: "Stay safe online & protect your privacy", color: "#6366F1", gradientColors: ["#1E1B4B", "#6366F1"], missions: 4, difficulty: "easy" },
  { id: "career",    title: "Career Quest",      emoji: "🚀", description: "Explore careers & set your goals", color: "#F59E0B", gradientColors: ["#78350F", "#F59E0B"], missions: 6, difficulty: "hard" },
  { id: "time",      title: "Time Mastery",      emoji: "⏰", description: "Plan better & beat procrastination", color: "#EC4899", gradientColors: ["#500724", "#EC4899"], missions: 4, difficulty: "easy" },
  { id: "choice",    title: "Life Choices",      emoji: "🎯", description: "Navigate real-life decisions wisely", color: "#8B5CF6", gradientColors: ["#2E1065", "#8B5CF6"], missions: 5, difficulty: "medium" },
  { id: "boss",      title: "Boss Battle",       emoji: "⚡", description: "Weekly challenge — face the boss!", color: "#EF4444", gradientColors: ["#450A0A", "#EF4444"], missions: 1, difficulty: "hard" },
];

const GAMES: LearnFunGame[] = [
  { id: "budget",         title: "Budget Simulator",   emoji: "💸", skill: "Financial Literacy",   durationMinutes: 10, difficulty: "medium", gradientColors: ["#064E3B", "#10B981"],  type: "budget_simulator" },
  { id: "digital_safety", title: "Digital Safety Quiz", emoji: "🛡️", skill: "Online Safety",       durationMinutes: 8,  difficulty: "easy",   gradientColors: ["#1E1B4B", "#6366F1"],  type: "digital_safety"   },
  { id: "choice_story",   title: "Life Choices",        emoji: "🎭", skill: "Decision Making",     durationMinutes: 12, difficulty: "medium", gradientColors: ["#2E1065", "#7C3AED"],  type: "choice_story"     },
  { id: "career_goal",    title: "Career Explorer",     emoji: "🚀", skill: "Career Planning",     durationMinutes: 15, difficulty: "hard",   gradientColors: ["#78350F", "#F59E0B"],  type: "career_goal"      },
  { id: "time_planner",   title: "Time Planner",        emoji: "⏰", skill: "Time Management",     durationMinutes: 8,  difficulty: "easy",   gradientColors: ["#500724", "#EC4899"],  type: "time_planner"     },
  { id: "boss_battle",    title: "Boss Battle",         emoji: "⚡", skill: "Weekly Challenge",    durationMinutes: 20, difficulty: "boss",   gradientColors: ["#450A0A", "#EF4444"],  type: "boss_battle"      },
];

function getDifficultyColor(d: string) {
  return d === "easy" ? "#10B981" : d === "medium" ? "#F59E0B" : d === "hard" ? "#EF4444" : "#8B5CF6";
}

function getDaysUntilFriday() {
  const today = new Date().getDay();
  const diff  = (5 - today + 7) % 7;
  return diff === 0 ? 7 : diff;
}

// ─── Hook ─────────────────────────────────────────────────────
function useLearnFun() {
  const [xp,    setXp]    = useState(0);
  const [coins, setCoins] = useState(0);
  const [level, setLevel] = useState(1);

  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;
    const db = getFirestore();
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setXp(d.LearnFunXP ?? 0);
        setCoins(d.LearnFunCoins ?? 0);
        setLevel(Math.floor((d.LearnFunXP ?? 0) / 100) + 1);
      }
    }, () => {});
    return () => unsub();
  }, []);

  return { xp, coins, level };
}

// ─── Main ─────────────────────────────────────────────────────
export default function LearnFunPage() {
  const { xp, coins, level } = useLearnFun();
  const daysUntilFriday = getDaysUntilFriday();
  const xpProgress = xp % 100;

  return (
    <div style={{ paddingBottom: 40 }}>

      {/* ── XP / Coin Bar ── */}
      <div style={{
        margin: "10px 14px",
        background: "linear-gradient(135deg, #1e1b4b, #312e81)",
        borderRadius: 18, padding: "12px 16px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: "#a5b4fc", fontSize: 12, fontWeight: 700 }}>Level {level}</span>
            <span style={{ color: "#a5b4fc", fontSize: 12, fontWeight: 700 }}>{xpProgress}/100 XP</span>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ width: `${xpProgress}%`, height: "100%", background: "linear-gradient(90deg, #6366f1, #a78bfa)", borderRadius: 6 }} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.1)", borderRadius: 20, padding: "6px 10px" }}>
          <span>🪙</span>
          <span style={{ color: "#fbbf24", fontSize: 14, fontWeight: 800 }}>{coins}</span>
        </div>
      </div>

      {/* ── Daily Mission card ── */}
      <div style={{ margin: "0 14px 14px" }}>
        <div style={{
          background: "linear-gradient(135deg, #1a1a2e, #2d2d4e)",
          borderRadius: 18, padding: 16,
          border: "1.5px solid rgba(99,102,241,0.3)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 20 }}>🎯</span>
            <span style={{ color: "#fff", fontSize: 15, fontWeight: 800 }}>Daily Mission</span>
            <div style={{ flex: 1 }} />
            <div style={{ background: "rgba(99,102,241,0.2)", borderRadius: 20, padding: "3px 8px" }}>
              <span style={{ color: "#818cf8", fontSize: 10, fontWeight: 700 }}>TODAY</span>
            </div>
          </div>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, marginBottom: 12 }}>
            Complete any Life Skill game to earn bonus XP and coins today!
          </div>
          <button style={{
            width: "100%", padding: "11px 0", borderRadius: 12, border: "none",
            background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
            color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer",
          }}>
            🚀 Start Mission
          </button>
        </div>
      </div>

      {/* ── Boss Battle banner ── */}
      <div style={{ margin: "0 14px 16px" }}>
        <div style={{
          background: "linear-gradient(135deg, #450A0A, #991B1B)",
          borderRadius: 18, padding: 16,
          border: "1.5px solid rgba(239,68,68,0.4)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ fontSize: 36 }}>⚡</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontSize: 15, fontWeight: 900 }}>Boss Battle</div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 }}>
              Weekly challenge · Resets in {daysUntilFriday} day{daysUntilFriday !== 1 ? "s" : ""}
            </div>
          </div>
          <button style={{
            background: "#EF4444", border: "none", borderRadius: 10,
            padding: "9px 14px", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer",
          }}>
            Fight!
          </button>
        </div>
      </div>

      {/* ── Skill Worlds ── */}
      <div style={{ padding: "0 14px 6px", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>
        Skill Worlds
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "0 14px", marginBottom: 20 }}>
        {SKILL_WORLDS.map((world) => (
          <div key={world.id} style={{
            background: `linear-gradient(135deg, ${world.gradientColors[0]}, ${world.gradientColors[1]})`,
            borderRadius: 18, padding: 14,
            display: "flex", flexDirection: "column", gap: 6,
            border: "1px solid rgba(255,255,255,0.08)",
            cursor: "pointer",
          }}>
            <div style={{ fontSize: 28 }}>{world.emoji}</div>
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 800, lineHeight: 1.3 }}>{world.title}</div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, lineHeight: 1.4 }}>{world.description}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <div style={{ padding: "2px 7px", borderRadius: 20, background: `${getDifficultyColor(world.difficulty)}25`, fontSize: 9, fontWeight: 700, color: getDifficultyColor(world.difficulty) }}>
                {world.difficulty.toUpperCase()}
              </div>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 9 }}>{world.missions} missions</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── All Games ── */}
      <div style={{ padding: "0 14px 6px", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>
        All Games
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 14px" }}>
        {GAMES.map((game) => (
          <div key={game.id} style={{
            display: "flex", gap: 0, borderRadius: 16, overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "#1a1a2e", cursor: "pointer",
          }}>
            {/* Left gradient */}
            <div style={{
              width: 80, flexShrink: 0,
              background: `linear-gradient(135deg, ${game.gradientColors[0]}, ${game.gradientColors[1]})`,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              padding: 12, gap: 6,
            }}>
              <div style={{ fontSize: 30 }}>{game.emoji}</div>
              <div style={{ padding: "2px 6px", borderRadius: 20, background: `${getDifficultyColor(game.difficulty)}30`, fontSize: 8, fontWeight: 700, color: getDifficultyColor(game.difficulty) }}>
                {game.difficulty.toUpperCase()}
              </div>
            </div>
            {/* Body */}
            <div style={{ flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ color: "#fff", fontSize: 14, fontWeight: 800, lineHeight: 1.3 }}>{game.title}</div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 }}>{game.skill}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>⏱ {game.durationMinutes} min</span>
                <button style={{
                  background: "#6366f1", border: "none", borderRadius: 8,
                  padding: "6px 12px", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  Play ▶
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
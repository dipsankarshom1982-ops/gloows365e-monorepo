"use client";

// PATH: apps/web/src/app/(app)/challenge/page.tsx
// Challenge tab — navigation-only grouping of existing gamified modules.
// No new business logic; every card routes to an already-built page.
// Mirrors apps/mobile/app/(drawer)/(tabs)/challenge.tsx.

import { useRouter } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";

const MODULES = [
  { id: "vidyastar",   label: "VidyaStar",            emoji: "⭐", href: "/vidyastar" },
  { id: "dsq",         label: "Daily Streak Quiz",     emoji: "🔥", href: "/daily-streak-quiz" },
  { id: "skillbattle", label: "SkillBattle",           emoji: "🏆", href: "/battle" },
  // Leaderboard (V-Coins) → existing Wallet page, which already has its
  // own "Leaderboard" tab ranking by vCoinsYear_* (wallet/page.tsx:5).
  // The generic /leaderboard page is a different, points-based India
  // leaderboard unrelated to V-Coins — not the right destination here.
  { id: "leaderboard", label: "Leaderboard (V-Coins)", emoji: "🥇", href: "/wallet" },
  { id: "starboard",   label: "Starboard",             emoji: "✨", href: "/starboard" },
  { id: "skillboard",  label: "SkillBoard",            emoji: "🎖️", href: "/skillboard" },
];

export default function ChallengePage() {
  const { isDarkMode, colors } = useTheme();
  const router = useRouter();

  const surfaceBg = isDarkMode ? "#1e293b" : "#f8fafc";
  const borderCol = isDarkMode ? "#334155" : "#e2e8f0";
  const textMain  = isDarkMode ? "#f1f5f9" : "#1e293b";
  const accent    = isDarkMode ? "#38bdf8" : "#3b82f6";

  return (
    <div style={{ background: colors.background, minHeight: "100vh", paddingBottom: 80 }}>
      <div style={{ padding: "16px 20px 4px" }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: accent, marginBottom: 4 }}>🎯 Challenge</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: textMain, opacity: 0.7 }}>Every gamified module in one place</div>
      </div>

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {MODULES.map((m) => (
          <div
            key={m.id}
            onClick={() => router.push(m.href)}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "14px 16px", borderRadius: 16,
              border: `1px solid ${borderCol}`, background: surfaceBg,
              cursor: "pointer",
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: accent + "1a",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22,
            }}>
              {m.emoji}
            </div>
            <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: textMain }}>{m.label}</div>
            <span style={{ color: textMain, opacity: 0.5 }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

// PATH: apps/web/src/app/(app)/learn/page.tsx
// Learn tab — navigation-only grouping of existing learning modules.
// No new business logic; every card routes to an already-built page.
// Mirrors apps/mobile/app/(drawer)/(tabs)/learn.tsx.
//
// CourseHub is listed in the nav spec but doesn't exist anywhere in this
// codebase (confirmed via repo-wide search) — omitted rather than invented.

import { useRouter } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { useAppConfig } from "@/context/AppConfigContext";

const MODULES = [
  { id: "ai-guru",      label: "AI Guru",       emoji: "🎓", href: "/ai-guru" },
  { id: "shikshahub",   label: "ShikshaHub",    emoji: "🏅", href: "/shikshahub" },
  { id: "knowledgehub", label: "Knowledge Hub", emoji: "💡", href: "/knowledge-hub" },
  { id: "seekho",       label: "Seekho",        emoji: "📖", href: "/seekho" },
  { id: "skillboost",   label: "SkillBoost",    emoji: "⚡", href: "/skillboost" },
  { id: "learnfun",     label: "Learn Fun",     emoji: "🎮", href: "/learnfun" },
];

export default function LearnPage() {
  const { isDarkMode, colors } = useTheme();
  const router = useRouter();
  const { modules } = useAppConfig();

  // Admin > App Structure module toggle: a module with no appModules doc
  // stays visible; only an explicit isEnabled:false hides it. Same rule as
  // apps/mobile's learn.tsx (ids are shared with the appModules doc ids).
  const visibleModules = MODULES.filter((m) => modules.find((am) => am.id === m.id)?.isEnabled !== false);

  const surfaceBg = isDarkMode ? "#1e293b" : "#f8fafc";
  const borderCol = isDarkMode ? "#334155" : "#e2e8f0";
  const textMain  = isDarkMode ? "#f1f5f9" : "#1e293b";
  const accent    = isDarkMode ? "#38bdf8" : "#3b82f6";

  return (
    <div style={{ background: colors.background, minHeight: "100vh", paddingBottom: 80 }}>
      <div style={{ padding: "16px 20px 4px" }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: accent, marginBottom: 4 }}>📚 Learn</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: textMain, opacity: 0.7 }}>Every learning module in one place</div>
      </div>

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {visibleModules.map((m) => (
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

"use client";
// PATH: apps/web/src/components/aiGuru/ProgressXpBar.tsx
// Web mirror of apps/mobile/components/aiGuru/ProgressXpBar.tsx

import { useEffect, useState } from "react";

interface Props {
  xp: number;
  maxXp?: number;
  label?: string;
}

export default function ProgressXpBar({ xp, maxXp = 100, label = "XP" }: Props) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const target = Math.min((xp / maxXp) * 100, 100);
    const t = setTimeout(() => setPct(target), 30);
    return () => clearTimeout(t);
  }, [xp, maxXp]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#a5b4fc", fontSize: 12, fontWeight: 700 }}>⚡ {label}</span>
        <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 600 }}>{xp} / {maxXp}</span>
      </div>
      <div style={{ height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "#6366f1", borderRadius: 6, transition: "width 0.8s ease" }} />
      </div>
    </div>
  );
}

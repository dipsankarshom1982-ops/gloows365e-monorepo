"use client";
// PATH: apps/web/src/components/aiGuru/SceneCard.tsx
// Web mirror of apps/mobile/components/aiGuru/SceneCard.tsx

import { useState } from "react";
import { Scene } from "@/lib/aiGuru/types";

const VISUAL_ICONS: Record<string, string> = {
  animation: "🎬", diagram: "📊", code: "💻",
  table: "📋", story: "📖", practical: "🔧",
};

interface Props {
  scene: Scene;
  totalScenes: number;
  onExplainAgain: () => void;
  onSimplify: () => void;
  onExample: () => void;
  onTranslate: () => void;
}

export default function SceneCard({
  scene, totalScenes,
  onExplainAgain, onSimplify, onExample, onTranslate,
}: Props) {
  const [checkRevealed, setCheckRevealed] = useState(false);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);

  const handleOption = (i: number) => {
    if (checkRevealed) return;
    setSelectedOpt(i);
    setCheckRevealed(true);
  };

  const isCorrect = selectedOpt === scene.checkQuestion.correctAnswerIndex;
  const LABELS = ["A", "B", "C", "D"];

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <style>{`.sc-btn{cursor:pointer;border:none;background:none}.sc-btn:hover{opacity:.88}`}</style>

      {/* Scene header */}
      <div style={{ borderRadius: 20, padding: 18, margin: 16, marginBottom: 12, background: "linear-gradient(135deg,#1e1b4b,#312e81)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ background: "rgba(99,102,241,0.3)", padding: "4px 10px", borderRadius: 10 }}>
            <span style={{ color: "#a5b4fc", fontSize: 11, fontWeight: 800 }}>Scene {scene.sceneNumber} / {totalScenes}</span>
          </div>
          <span style={{ fontSize: 24 }}>{VISUAL_ICONS[scene.visualType] ?? "📚"}</span>
        </div>
        <div style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 900, marginBottom: 6 }}>{scene.sceneTitle}</div>
        <div style={{ color: "#94a3b8", fontSize: 12, fontStyle: "italic" }}>{scene.visualDescription}</div>
      </div>

      {/* Narration */}
      <div style={{ marginInline: 16, background: "#1e293b", borderRadius: 16, padding: 16, marginBottom: 12 }}>
        <div style={{ color: "#6366f1", fontSize: 11, fontWeight: 800, marginBottom: 6 }}>🧑‍🏫 AI Guru Says</div>
        <div style={{ color: "#e2e8f0", fontSize: 15, lineHeight: 1.6 }}>{scene.narration}</div>
      </div>

      {/* Key concept */}
      {scene.keyConcept ? (
        <div style={{ paddingInline: 16, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 10, borderRadius: 12, background: "#1e3a5f" }}>
            <span style={{ fontSize: 16 }}>💡</span>
            <span style={{ color: "#93c5fd", fontSize: 13, fontWeight: 700, flex: 1 }}>{scene.keyConcept}</span>
          </div>
        </div>
      ) : null}

      {/* Example */}
      {scene.example ? (
        <div style={{ marginInline: 16, background: "#132027", borderRadius: 14, padding: 14, borderLeft: "3px solid #06b6d4", marginBottom: 10 }}>
          <div style={{ color: "#06b6d4", fontSize: 11, fontWeight: 800, marginBottom: 4 }}>📌 Real Example</div>
          <div style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.4 }}>{scene.example}</div>
        </div>
      ) : null}

      {/* Student action */}
      {scene.studentAction ? (
        <div style={{ marginInline: 16, background: "#1a2a1a", borderRadius: 14, padding: 14, borderLeft: "3px solid #10b981", marginBottom: 12 }}>
          <div style={{ color: "#10b981", fontSize: 11, fontWeight: 800, marginBottom: 4 }}>✋ Your Turn</div>
          <div style={{ color: "#cbd5e1", fontSize: 14 }}>{scene.studentAction}</div>
        </div>
      ) : null}

      {/* Check question */}
      <div style={{ marginInline: 16, background: "#1e293b", borderRadius: 18, padding: 16, marginBottom: 12 }}>
        <div style={{ color: "#fbbf24", fontSize: 11, fontWeight: 800, marginBottom: 8 }}>🎯 Quick Check</div>
        <div style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700, marginBottom: 12, lineHeight: 1.45 }}>{scene.checkQuestion.question}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {scene.checkQuestion.options.map((opt, i) => {
            const isThis = selectedOpt === i;
            const isRight = checkRevealed && i === scene.checkQuestion.correctAnswerIndex;
            const isWrong = checkRevealed && isThis && !isRight;
            return (
              <button
                key={i}
                className="sc-btn"
                onClick={() => handleOption(i)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                  background: isRight ? "#052e16" : isWrong ? "#450a0a" : "#334155",
                  borderRadius: 12, padding: 12,
                  border: `1px solid ${isRight ? "#10b981" : isWrong ? "#ef4444" : "transparent"}`,
                }}
              >
                <span style={{ width: 24, height: 24, background: "#475569", borderRadius: 6, textAlign: "center", lineHeight: "24px", color: "#a5b4fc", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{LABELS[i]}</span>
                <span style={{ flex: 1, color: "#cbd5e1", fontSize: 14 }}>{opt}</span>
                {isRight && <span style={{ color: "#10b981" }}>✓</span>}
                {isWrong && <span style={{ color: "#ef4444" }}>✕</span>}
              </button>
            );
          })}
        </div>
        {checkRevealed && (
          <div style={{ marginTop: 12, borderRadius: 10, border: `1px solid ${isCorrect ? "#10b981" : "#ef4444"}`, padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4, color: isCorrect ? "#10b981" : "#ef4444" }}>
              {isCorrect ? "✅ Correct!" : "❌ Not quite"}
            </div>
            <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.4 }}>{scene.checkQuestion.explanation}</div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingInline: 16, marginBottom: 4 }}>
        {[
          { label: "Explain Again", icon: "🔄", fn: onExplainAgain },
          { label: "Simpler", icon: "💡", fn: onSimplify },
          { label: "Example", icon: "🌍", fn: onExample },
          { label: "Translate", icon: "🗣️", fn: onTranslate },
        ].map((btn) => (
          <button key={btn.label} className="sc-btn" onClick={btn.fn} style={{ display: "flex", alignItems: "center", gap: 5, background: "#1e293b", borderRadius: 10, padding: "8px 12px" }}>
            <span style={{ fontSize: 13 }}>{btn.icon}</span>
            <span style={{ color: "#a5b4fc", fontSize: 12, fontWeight: 700 }}>{btn.label}</span>
          </button>
        ))}
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}

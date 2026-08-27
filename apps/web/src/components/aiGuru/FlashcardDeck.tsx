"use client";
// PATH: apps/web/src/components/aiGuru/FlashcardDeck.tsx
// Web mirror of apps/mobile/components/aiGuru/FlashcardDeck.tsx

import { useState } from "react";
import { Flashcard } from "@/lib/aiGuru/types";

interface Props {
  flashcards: Flashcard[];
}

export default function FlashcardDeck({ flashcards }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card = flashcards[currentIdx];

  const goNext = () => {
    if (currentIdx >= flashcards.length - 1) return;
    setFlipped(false);
    setCurrentIdx((i) => i + 1);
  };

  const goPrev = () => {
    if (currentIdx <= 0) return;
    setFlipped(false);
    setCurrentIdx((i) => i - 1);
  };

  if (!card) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, paddingTop: 8, paddingBottom: 8 }}>
      <style>{`.fc-btn{cursor:pointer;border:none;background:none}.fc-btn:disabled{cursor:default;opacity:.4}`}</style>
      <span style={{ color: "#475569", fontSize: 12 }}>Tap card to flip</span>

      <div
        onClick={() => setFlipped((f) => !f)}
        style={{ width: 300, height: 180, perspective: 1000, cursor: "pointer" }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transition: "transform 0.5s",
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front */}
          <div
            style={{
              position: "absolute", inset: 0, borderRadius: 20, padding: 24,
              backfaceVisibility: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
              background: "#1e1b4b", border: "2px solid #4f46e5",
            }}
          >
            <span style={{ position: "absolute", top: 14, left: 16, color: "#475569", fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>TERM</span>
            <span style={{ color: "#a5b4fc", fontSize: 20, fontWeight: 900, textAlign: "center" }}>{card.front}</span>
          </div>
          {/* Back */}
          <div
            style={{
              position: "absolute", inset: 0, borderRadius: 20, padding: 24,
              backfaceVisibility: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
              background: "#0f2a1a", border: "2px solid #10b981",
              transform: "rotateY(180deg)",
            }}
          >
            <span style={{ position: "absolute", top: 14, left: 16, color: "#475569", fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>MEANING</span>
            <span style={{ color: "#6ee7b7", fontSize: 15, fontWeight: 600, textAlign: "center", lineHeight: 1.45 }}>{card.back}</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button className="fc-btn" disabled={currentIdx === 0} onClick={goPrev} style={{ width: 44, height: 44, background: "#1e293b", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: currentIdx === 0 ? "#374151" : "#6366f1", fontSize: 18 }}>‹</button>

        <div style={{ display: "flex", gap: 4 }}>
          {flashcards.map((_, i) => (
            <div key={i} style={{ width: i === currentIdx ? 18 : 6, height: 6, borderRadius: 3, background: i === currentIdx ? "#6366f1" : "#334155", transition: "width 0.2s" }} />
          ))}
        </div>

        <button className="fc-btn" disabled={currentIdx === flashcards.length - 1} onClick={goNext} style={{ width: 44, height: 44, background: "#1e293b", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: currentIdx === flashcards.length - 1 ? "#374151" : "#6366f1", fontSize: 18 }}>›</button>
      </div>

      <span style={{ color: "#475569", fontSize: 12, fontWeight: 600 }}>{currentIdx + 1} / {flashcards.length}</span>
    </div>
  );
}

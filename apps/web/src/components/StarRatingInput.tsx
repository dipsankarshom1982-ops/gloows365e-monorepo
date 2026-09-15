"use client";

// PATH: apps/web/src/components/StarRatingInput.tsx
// Reusable tappable 5-star input — pure controlled component, no Firestore
// knowledge, so it's reusable wherever a rating needs collecting (currently
// just the Feedback & Ratings screen, but built generic enough for e.g. a
// future contextual "rate this" popup too).

import { useState } from "react";

interface Props {
  value: number;               // 0-5, 0 = unrated
  onChange: (v: number) => void;
  size?: number;                // px, default 28
  color?: string;                // filled star color
  emptyColor?: string;           // outline star color
  disabled?: boolean;
  label?: string;                 // optional visible/aria label above the stars
}

function Star({ filled, size, color, emptyColor }: { filled: boolean; size: number; color: string; emptyColor: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
        fill={filled ? color : "none"}
        stroke={filled ? color : emptyColor}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function StarRatingInput({
  value, onChange, size = 28, color = "#f59e0b", emptyColor = "var(--border)", disabled, label,
}: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value;

  return (
    <div>
      {label && <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>}
      <div style={{ display: "flex", gap: 4 }} onMouseLeave={() => setHovered(null)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            aria-label={`Rate ${i} star${i > 1 ? "s" : ""}`}
            onClick={() => onChange(i)}
            onMouseEnter={() => setHovered(i)}
            style={{
              background: "none", border: "none", padding: 2,
              cursor: disabled ? "default" : "pointer",
              opacity: disabled ? 0.5 : 1,
              lineHeight: 0,
            }}
          >
            <Star filled={i <= display} size={size} color={color} emptyColor={emptyColor} />
          </button>
        ))}
      </div>
    </div>
  );
}

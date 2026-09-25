"use client";

// PATH: apps/web/src/app/(app)/shikshahub/AdvancedFiltersPanel.tsx
// Web ShikshaHub polish pass — desktop-appropriate adaptation of
// apps/mobile/components/shikshahub/AdvancedFiltersSheet.tsx.
//
// Self-review fix: an earlier version of this file only controlled Sort,
// despite being called "Advanced Filters" — a real naming/functionality
// mismatch flagged on review. It now mirrors mobile's sheet properly:
// Sort By / Price / Rating / Experience together in one panel. The
// quick-filter chips on the main page still exist as fast one-tap entry
// points for the single most common value in each group (Online Now,
// 4★+) — same "quick access + complete control" split mobile itself uses
// (its own chip row has quick entries AND this same full sheet) — but no
// longer spell out every band as its own always-visible chip, which was
// denser than mobile's actual reference row and read more like a filter
// dashboard than a marketplace.
//
// A small anchored dropdown (not a bottom sheet — not a native desktop
// pattern), closes on outside click or Escape. Selecting a value does NOT
// auto-close the panel (unlike Sort, which is a single mutually-exclusive
// choice) so a visitor can set Price and Rating in one open.

import { useEffect, useRef } from "react";

export type SortMode = "name" | "rating" | "experience" | "priceLow" | "priceHigh";
export type PriceBand = "under500" | "500to1000" | "1000plus";

// The "name" key is an internal implementation detail (name-alphabetical
// is literally what this sort does) — labeled "Recommended" to match
// mobile's own default-sort terminology exactly, since this page's
// results header already says "Recommended Tutors" above the grid.
export const SORT_LABELS: Record<SortMode, string> = {
  name: "Recommended",
  rating: "Top Rated",
  experience: "Most Experienced",
  priceLow: "Lowest Price",
  priceHigh: "Highest Price",
};

const SORT_OPTIONS: SortMode[] = ["name", "rating", "experience", "priceLow", "priceHigh"];
const PRICE_OPTIONS: { key: PriceBand | null; label: string }[] = [
  { key: null, label: "Any price" },
  { key: "under500", label: "Under ₹500" },
  { key: "500to1000", label: "₹500–₹1,000" },
  { key: "1000plus", label: "₹1,000+" },
];
const RATING_OPTIONS: { key: number | null; label: string }[] = [
  { key: null, label: "Any rating" },
  { key: 4, label: "4★ & above" },
  { key: 3, label: "3★ & above" },
];
const EXPERIENCE_OPTIONS: { key: number | null; label: string }[] = [
  { key: null, label: "Any experience" },
  { key: 1, label: "1+ years" },
  { key: 3, label: "3+ years" },
  { key: 5, label: "5+ years" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  priceBand: PriceBand | null;
  onPriceBandChange: (band: PriceBand | null) => void;
  minRating: number | null;
  onMinRatingChange: (rating: number | null) => void;
  minExperience: number | null;
  onMinExperienceChange: (years: number | null) => void;
  onClearAll: () => void;
}

export default function AdvancedFiltersPanel({
  open, onClose,
  sortMode, onSortChange,
  priceBand, onPriceBandChange,
  minRating, onMinRatingChange,
  minExperience, onMinExperienceChange,
  onClearAll,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Filters and sort"
      style={{
        position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 40,
        width: 260, maxHeight: "min(70vh, 520px)", overflowY: "auto",
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 14, padding: 14, boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
      }}
    >
      <Group title="Sort by">
        {SORT_OPTIONS.map((mode) => (
          <OptionButton key={mode} active={mode === sortMode} onClick={() => onSortChange(mode)}>
            {SORT_LABELS[mode]}
          </OptionButton>
        ))}
      </Group>

      <Group title="Price">
        {PRICE_OPTIONS.map((opt) => (
          <OptionButton key={String(opt.key)} active={opt.key === priceBand} onClick={() => onPriceBandChange(opt.key)}>
            {opt.label}
          </OptionButton>
        ))}
      </Group>

      <Group title="Rating">
        {RATING_OPTIONS.map((opt) => (
          <OptionButton key={String(opt.key)} active={opt.key === minRating} onClick={() => onMinRatingChange(opt.key)}>
            {opt.label}
          </OptionButton>
        ))}
      </Group>

      <Group title="Experience" last>
        {EXPERIENCE_OPTIONS.map((opt) => (
          <OptionButton key={String(opt.key)} active={opt.key === minExperience} onClick={() => onMinExperienceChange(opt.key)}>
            {opt.label}
          </OptionButton>
        ))}
      </Group>

      <button
        onClick={onClearAll}
        style={{
          width: "100%", marginTop: 4, border: "1px solid var(--border)", borderRadius: 10,
          padding: "8px 0", background: "transparent", color: "var(--text-muted)",
          fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}
      >
        Clear All
      </button>
    </div>
  );
}

function Group({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 12 : 14, paddingBottom: last ? 0 : 12, borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--text-muted)", letterSpacing: 0.4, marginBottom: 6, textTransform: "uppercase" }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{children}</div>
    </div>
  );
}

function OptionButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left", border: "none", borderRadius: 8, padding: "7px 10px",
        background: active ? "rgba(20,184,166,0.14)" : "transparent",
        color: active ? "#0d9488" : "var(--text)",
        fontSize: 12.5, fontWeight: active ? 800 : 600, cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

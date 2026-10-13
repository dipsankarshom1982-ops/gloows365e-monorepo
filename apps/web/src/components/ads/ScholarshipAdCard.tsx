// PATH: apps/web/src/components/ads/ScholarshipAdCard.tsx
"use client";

// Port of mobile's components/ads/ScholarshipAdCard.tsx. Same gradient
// banner design (title + sponsor on the left, deadline countdown + CTA on
// the right) — rebuilt with web's inline-style convention instead of
// React Native StyleSheet/LinearGradient.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { recordClick, recordImpression } from "@/services/adService";
import type { Ad } from "@/lib/ads/types";

interface Props {
  ad: Ad;
  module: string;
  classLevel?: string;
  style?: React.CSSProperties;
}

function daysUntil(endDate: any): number | null {
  if (!endDate) return null;
  const ms = (endDate.toMillis?.() ?? new Date(endDate).getTime()) - Date.now();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export default function ScholarshipAdCard({ ad, module, classLevel = "all", style }: Props) {
  const router = useRouter();
  const impressionFired = useRef(false);

  useEffect(() => {
    if (!impressionFired.current) {
      impressionFired.current = true;
      recordImpression(ad.id, module, classLevel);
    }
  }, [ad.id, module, classLevel]);

  const days = daysUntil(ad.endDate);

  const handlePress = async () => {
    await recordClick(ad.id, module);
    if (ad.ctaRoute) router.push(ad.ctaRoute);
    else if (ad.ctaUrl) window.open(ad.ctaUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div style={{ marginInline: 16, marginBlock: 8, ...style }}>
      <div
        onClick={handlePress}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handlePress(); } }}
        style={{
          borderRadius: 16, padding: 16, minHeight: 90,
          display: "flex", alignItems: "center", gap: 12,
          background: "linear-gradient(90deg, #78350f, #d97706, #fbbf24)",
          cursor: "pointer",
        }}
      >
        {/* Left content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 11 }}>🎓</span>
            <span style={{ color: "#fff", fontSize: 10, fontWeight: 700, opacity: 0.9 }}>Scholarship</span>
          </div>
          <div style={{
            color: "#fff", fontSize: 14, fontWeight: 900, lineHeight: "19px",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {ad.title}
          </div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ad.sponsorName}
          </div>
        </div>

        {/* Right: deadline + CTA */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {days !== null && (
            <div style={{ background: "rgba(0,0,0,0.25)", borderRadius: 10, padding: "6px 10px", textAlign: "center" }}>
              <div style={{ color: "#fff", fontSize: 18, fontWeight: 900 }}>{days}</div>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 9, fontWeight: 600 }}>days left</div>
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handlePress(); }}
            style={{ background: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer" }}
          >
            <span style={{ color: "#92400e", fontSize: 12, fontWeight: 800 }}>{ad.ctaText || "Apply →"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

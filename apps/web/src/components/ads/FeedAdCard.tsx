// PATH: apps/web/src/components/ads/FeedAdCard.tsx
"use client";

// Port of mobile's components/ads/FeedAdCard.tsx. Same visual design
// (background image, bottom scrim, "Sponsored"/"Scholarship" badge,
// sponsor name + title, CTA pill) — rebuilt with web's inline-style
// convention (matches HomeAdsCarousel in app/(app)/home/page.tsx) instead
// of React Native StyleSheet. Navigation: router.push for ctaRoute,
// window.open for ctaUrl (mirrors mobile's router.push / Linking.openURL).

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

export default function FeedAdCard({ ad, module, classLevel = "all", style }: Props) {
  const router = useRouter();
  const impressionFired = useRef(false);

  // Fire impression on first render
  useEffect(() => {
    if (!impressionFired.current) {
      impressionFired.current = true;
      recordImpression(ad.id, module, classLevel);
    }
  }, [ad.id, module, classLevel]);

  const handlePress = async () => {
    await recordClick(ad.id, module);
    if (ad.ctaRoute) {
      router.push(ad.ctaRoute);
    } else if (ad.ctaUrl) {
      window.open(ad.ctaUrl, "_blank", "noopener,noreferrer");
    }
  };

  const hasCta = !!(ad.ctaRoute || ad.ctaUrl);

  return (
    <div style={{ marginInline: 16, marginBlock: 10, ...style }}>
      <div
        onClick={handlePress}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handlePress(); } }}
        style={{
          height: 190, borderRadius: 18, overflow: "hidden",
          position: "relative", cursor: "pointer",
        }}
      >
        <img
          src={ad.imageUrl || "https://via.placeholder.com/400x200?text=Ad"}
          alt={ad.title || "Ad"}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120, background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.82))" }} />

        {/* Top: Sponsored/Scholarship badge */}
        <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "rgba(0,0,0,0.55)",
            padding: "3px 8px", borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.18)",
          }}>
            <span style={{ fontSize: 10 }}>✨</span>
            <span style={{ color: "#fbbf24", fontSize: 10, fontWeight: 700 }}>
              {ad.adCategory === "scholarship" ? "Scholarship" : "Sponsored"}
            </span>
          </div>
        </div>

        {/* Bottom: ad info + CTA */}
        <div style={{ position: "absolute", bottom: 14, left: 14, right: 14, display: "flex", alignItems: "flex-end", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: 500, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ad.sponsorName}
            </div>
            <div style={{
              color: "#fff", fontSize: 14, fontWeight: 800, lineHeight: "20px",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {ad.title}
            </div>
          </div>

          {hasCta && (
            <div style={{ background: "#fff", padding: "8px 14px", borderRadius: 10, flexShrink: 0 }}>
              <span style={{ color: "#1e1b4b", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>
                {ad.ctaText || "Learn More"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

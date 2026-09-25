"use client";

// PATH: apps/web/src/components/BannerCarousel.tsx
// Renders admin-uploaded banners (Banners.tsx in the admin panel) targeted
// at a specific screen. Mirrors mobile components/BannerCarousel.tsx and
// the styling of this app's own home/page.tsx HomeAdsCarousel, but reads
// from the `banners` collection (previously write-only — nothing ever
// rendered it) instead of `homeAds`.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type BannerScreen = "home" | "vidyastar" | "skillbattle";

interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  targetScreen?: string;
  ctaUrl?: string;
  order: number;
  isActive: boolean;
}

export default function BannerCarousel({ screen }: { screen: BannerScreen }) {
  const router = useRouter();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentDot, setCurrentDot] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idxRef = useRef(0);

  useEffect(() => {
    getDocs(collection(db, "banners")).then((snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Banner)
        .filter((b) => b.isActive && (b.targetScreen === screen || b.targetScreen === "all"))
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
      setBanners(data);
    }).catch(() => setBanners([]));
  }, [screen]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      const next = (idxRef.current + 1) % banners.length;
      idxRef.current = next;
      setCurrentDot(next);
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ left: next * (scrollRef.current.offsetWidth + 12), behavior: "smooth" });
      }
    }, 3500);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) return null;

  // No separate internal/external field on a banner (just one ctaUrl) — a
  // leading "/" is treated as an in-app route, anything else opens in a
  // new tab, same convention as the ads carousel's actionType split.
  const handleClick = (b: Banner) => {
    if (!b.ctaUrl) return;
    if (b.ctaUrl.startsWith("/")) router.push(b.ctaUrl);
    else window.open(b.ctaUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div style={{ marginBlock: 10 }}>
      <div
        ref={scrollRef}
        style={{ overflowX: "auto", scrollSnapType: "x mandatory", display: "flex", gap: 12, padding: "0 16px" }}
        onScroll={(e) => {
          const el = e.currentTarget;
          const idx = Math.round(el.scrollLeft / (el.offsetWidth + 12));
          idxRef.current = idx;
          setCurrentDot(idx);
        }}
      >
        {banners.map((b) => {
          const isClickable = !!b.ctaUrl;
          return (
            <div
              key={b.id}
              onClick={isClickable ? () => handleClick(b) : undefined}
              role={isClickable ? "button" : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(b); } } : undefined}
              style={{
                flexShrink: 0, width: "calc(100vw - 64px)", maxWidth: 500,
                height: 150, borderRadius: 16, overflow: "hidden",
                position: "relative", scrollSnapAlign: "start",
                cursor: isClickable ? "pointer" : "default",
              }}
            >
              <img src={b.imageUrl} alt={b.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          );
        })}
      </div>
      {banners.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 10 }}>
          {banners.map((_, i) => (
            <div key={i} style={{
              height: 6, borderRadius: 3,
              width: i === currentDot ? 16 : 6,
              background: i === currentDot ? "#6366f1" : "var(--border)",
              transition: "width 0.3s",
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

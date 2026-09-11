"use client";

// PATH: apps/web/src/app/(app)/glostore/product/page.tsx
// Specific-item landing page: /glostore/product?productId={id}. This used
// to live at glostore/[productId]/page.tsx (a dynamic path segment), but
// next.config.ts sets `output: "export"` for Firebase Hosting (no server),
// which requires generateStaticParams() to enumerate every possible
// productId at build time — impossible for an admin-managed, always-growing
// product catalog. This page fetches everything client-side after
// hydration anyway (see the useEffect below), so — matching the same
// query-string pattern already used by contest/lesson, contest/result,
// contest/leaderboard elsewhere in this app for the same reason — it reads
// productId from the query string instead of a dynamic path segment,
// which needs no build-time enumeration at all.
// Mirrors apps/mobile/app/glostore/[productId].tsx (mobile has a real
// native router and isn't affected by this).

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppTranslation } from "@/context/LanguageContext";
import { discountPct, fetchProductById, recordProductClick, recordProductView, type GloStoreProduct } from "@/lib/glostore";

const PLATFORM_META: Record<string, { label: string; color: string; icon: string }> = {
  amazon:   { label: "Amazon India", color: "#f59e0b", icon: "🛒" },
  flipkart: { label: "Flipkart",     color: "#2563eb", icon: "🛍️" },
  other:    { label: "Store",        color: "#64748b", icon: "🔗" },
};

function GloStoreProductContent() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("productId") ?? "";
  const router = useRouter();
  const { t } = useAppTranslation();
  const [product, setProduct] = useState<GloStoreProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!productId) return;
    fetchProductById(productId)
      .then((p) => {
        if (p) { setProduct(p); recordProductView(productId); } // fire-and-forget
        else setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [productId]);

  const handleBuyNow = () => {
    if (!product?.affiliateUrl) return;
    recordProductClick(product.id); // fire-and-forget
    window.open(product.affiliateUrl, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)" }}>Loading…</div>;
  }

  if (notFound || !product) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <div style={{ fontSize: 40 }}>🤔</div>
        <div style={{ marginTop: 8, color: "var(--text-muted)", fontSize: 14, fontWeight: 600 }}>
          {t("gloStoreProductGone", "This item isn't available anymore.")}
        </div>
        <button
          onClick={() => router.replace("/glostore")}
          style={{ marginTop: 12, background: "#f59e0b", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
        >
          {t("browseGloStore", "Browse GloStore")}
        </button>
      </div>
    );
  }

  const disc = discountPct(product.originalPrice, product.salePrice);
  const platform = PLATFORM_META[product.platform] ?? PLATFORM_META.other;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 100 }}>
      {/* Image */}
      <div style={{ position: "relative", height: 320, background: product.imageUrl ? `url(${product.imageUrl}) center/cover` : "linear-gradient(135deg, #92400e, #f59e0b)" }}>
        <button
          onClick={() => router.back()}
          style={{ position: "absolute", top: 14, left: 16, width: 38, height: 38, borderRadius: 19, background: "rgba(0,0,0,0.45)", border: "none", color: "#fff", fontSize: 18, cursor: "pointer" }}
        >
          ‹
        </button>
        {disc > 0 && (
          <span style={{ position: "absolute", top: 14, right: 16, background: "#dc2626", borderRadius: 10, padding: "5px 10px", color: "#fff", fontSize: 12, fontWeight: 800 }}>
            {disc}% OFF
          </span>
        )}
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            display: "flex", alignItems: "center", gap: 5, borderRadius: 20, padding: "5px 10px",
            background: `${platform.color}22`, border: `1px solid ${platform.color}66`, color: platform.color, fontSize: 11, fontWeight: 800,
          }}>
            {platform.icon} {platform.label}
          </span>
          {!!product.badge && (
            <span style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 20, padding: "5px 10px", color: "#f59e0b", fontSize: 11, fontWeight: 800 }}>
              {product.badge}
            </span>
          )}
        </div>

        <div style={{ fontSize: 22, fontWeight: 900, lineHeight: "29px", color: "var(--text)" }}>{product.title}</div>

        {product.rating > 0 && (
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            ⭐ {product.rating.toFixed(1)} · {product.reviewCount} {t("reviews", "reviews")}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#22c55e", fontSize: 28, fontWeight: 900 }}>₹{product.salePrice}</span>
          {product.originalPrice > product.salePrice && (
            <span style={{ fontSize: 16, fontWeight: 600, textDecoration: "line-through", opacity: 0.55, color: "var(--text)" }}>₹{product.originalPrice}</span>
          )}
        </div>

        {!!product.description && (
          <div style={{ fontSize: 13, lineHeight: "20px", fontWeight: 500, color: "var(--text-muted)" }}>{product.description}</div>
        )}

        {(product.targetClass?.length || product.targetSubject) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {!!product.targetClass?.length && product.targetClass[0] !== "all" && (
              <span style={{ fontSize: 11, fontWeight: 700, border: "1px solid var(--border)", borderRadius: 20, padding: "5px 10px", color: "var(--text-muted)" }}>
                📚 Class {product.targetClass.join(", ")}
              </span>
            )}
            {!!product.targetSubject && (
              <span style={{ fontSize: 11, fontWeight: 700, border: "1px solid var(--border)", borderRadius: 20, padding: "5px 10px", color: "var(--text-muted)" }}>
                {product.targetSubject}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Sticky Buy Now CTA */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: 16, background: "var(--bg)", borderTop: "1px solid var(--border)" }}>
        <button
          onClick={handleBuyNow}
          style={{
            width: "100%", maxWidth: 640, margin: "0 auto", display: "block", border: "none", borderRadius: 16,
            padding: "16px 0", cursor: "pointer",
            background: "linear-gradient(90deg, #92400e, #d97706, #f59e0b)",
            color: "#fff", fontSize: 15, fontWeight: 900, letterSpacing: 0.3,
          }}
        >
          {t("buyNowOn", "Buy Now on")} {platform.label} →
        </button>
      </div>
    </div>
  );
}

export default function GloStoreProductPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)" }}>Loading…</div>}>
      <GloStoreProductContent />
    </Suspense>
  );
}

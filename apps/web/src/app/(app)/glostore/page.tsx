"use client";

// PATH: apps/web/src/app/(app)/glostore/page.tsx
// GloStore home — e-commerce style, category-wise sections (like Amazon/
// Flipkart's home page) instead of one big filterable grid. Mirrors
// apps/mobile/app/glostore/index.tsx. "See All" on a section drills into
// this same route filtered to just that category (?category=books), reusing
// the grid view below for that.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppTranslation } from "@/context/LanguageContext";
import {
  CATEGORY_META,
  discountPct,
  fetchAllProducts,
  fetchProductsGroupedByCategory,
  type GloStoreCategory,
  type GloStoreCategorySection,
  type GloStoreProduct,
} from "@/lib/glostore";

export default function GloStorePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--bg)" }} />}>
      <GloStoreInner />
    </Suspense>
  );
}

function GloStoreInner() {
  const params = useSearchParams();
  const category = params.get("category") as GloStoreCategory | null;
  return category ? <CategoryGrid category={category} /> : <StoreHome />;
}

// ─── Home — category sections ────────────────────────────────────────────────

function StoreHome() {
  const router = useRouter();
  const { t } = useAppTranslation();
  const [sections, setSections] = useState<GloStoreCategorySection[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetchProductsGroupedByCategory().then(setSections).finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Hero showBack={false} />
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading…</div>
      ) : sections.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <div style={{ fontSize: 40 }}>📦</div>
          <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>
            {t("gloStoreEmpty", "No products here yet — check back soon!")}
          </div>
        </div>
      ) : (
        <div style={{ paddingBottom: 40 }}>
          {sections.map((section) => (
            <div key={section.category} style={{ marginTop: 22 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", marginBottom: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text)" }}>{section.emoji} {section.label}</span>
                <button
                  onClick={() => router.push(`/glostore?category=${section.category}`)}
                  style={{ display: "flex", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", color: "#f59e0b", fontSize: 12, fontWeight: 700 }}
                >
                  See All ›
                </button>
              </div>
              <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px" }}>
                {section.products.slice(0, 10).map((p) => (
                  <CompactCard key={p.id} product={p} onClick={() => router.push(`/glostore/product?productId=${p.id}`)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Category drill-down — filtered grid (unchanged from before) ────────────

function CategoryGrid({ category }: { category: GloStoreCategory }) {
  const router = useRouter();
  const { t } = useAppTranslation();
  const [products, setProducts] = useState<GloStoreProduct[]>([]);
  const [loading, setLoading]   = useState(true);

  const meta = CATEGORY_META.find((c) => c.value === category);

  useEffect(() => {
    fetchAllProducts().then(setProducts).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => products.filter((p) => p.category === category), [products, category]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Hero showBack title={meta ? `${meta.emoji} ${meta.label}` : "GloStore"} />
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <div style={{ fontSize: 40 }}>📦</div>
          <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>
            {t("gloStoreEmpty", "No products here yet — check back soon!")}
          </div>
        </div>
      ) : (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 14, padding: "16px 16px 40px",
        }}>
          {filtered.map((p) => <ProductCard key={p.id} product={p} onClick={() => router.push(`/glostore/product?productId=${p.id}`)} />)}
        </div>
      )}
    </div>
  );
}

// ─── Shared hero ──────────────────────────────────────────────────────────────

function Hero({ showBack, title }: { showBack: boolean; title?: string }) {
  const router = useRouter();
  return (
    <div style={{
      background: "linear-gradient(135deg, #92400e, #d97706, #f59e0b)",
      padding: "16px 20px 26px", borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {showBack ? (
          <button
            onClick={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 18, background: "rgba(255,255,255,0.2)", border: "none", cursor: "pointer", color: "#fff", fontSize: 18 }}
          >
            ‹
          </button>
        ) : <div style={{ width: 36 }} />}
        <div style={{ background: "rgba(255,255,255,0.22)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 20, padding: "4px 10px" }}>
          <span style={{ color: "#fff", fontSize: 11, fontWeight: 800 }}>⭐ Admin Picked</span>
        </div>
      </div>
      {title ? (
        <div style={{ color: "#fff", fontSize: 26, fontWeight: 900, marginTop: 14 }}>{title}</div>
      ) : (
        <>
          <div style={{ fontSize: 40, marginTop: 10 }}>🛍️</div>
          <div style={{ color: "#fff", fontSize: 26, fontWeight: 900, marginTop: 2 }}>GloStore</div>
          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 600, marginTop: 4, maxWidth: 420 }}>
            Books, stationery & study essentials — handpicked for you
          </div>
        </>
      )}
    </div>
  );
}

// ─── Compact horizontal card (category sections) ─────────────────────────────

function CompactCard({ product, onClick }: { product: GloStoreProduct; onClick: () => void }) {
  const disc = discountPct(product.originalPrice, product.salePrice);
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0, width: 128, textAlign: "left", cursor: "pointer", border: "1px solid var(--border)",
        borderRadius: 14, overflow: "hidden", background: "var(--bg-card)", padding: 0,
      }}
    >
      <div style={{ position: "relative", height: 100, background: product.imageUrl ? `url(${product.imageUrl}) center/cover` : "rgba(148,163,184,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {!product.imageUrl && <span style={{ fontSize: 24 }}>📦</span>}
        {disc > 0 && (
          <span style={{ position: "absolute", top: 8, left: 8, background: "#dc2626", borderRadius: 8, padding: "3px 6px", color: "#fff", fontSize: 10, fontWeight: 800 }}>
            {disc}% OFF
          </span>
        )}
      </div>
      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", lineHeight: "15px" }}>{product.title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#22c55e", fontSize: 14, fontWeight: 900 }}>₹{product.salePrice}</span>
          {product.originalPrice > product.salePrice && (
            <span style={{ fontSize: 10, fontWeight: 600, textDecoration: "line-through", opacity: 0.6, color: "var(--text)" }}>₹{product.originalPrice}</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Grid card (category drill-down) ─────────────────────────────────────────

function ProductCard({ product, onClick }: { product: GloStoreProduct; onClick: () => void }) {
  const disc = discountPct(product.originalPrice, product.salePrice);
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left", cursor: "pointer", border: "1px solid var(--border)",
        borderRadius: 16, overflow: "hidden", background: "var(--bg-card)", padding: 0,
      }}
    >
      <div style={{ position: "relative", height: 120, background: product.imageUrl ? `url(${product.imageUrl}) center/cover` : "rgba(148,163,184,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {!product.imageUrl && <span style={{ fontSize: 30 }}>📦</span>}
        {disc > 0 && (
          <span style={{ position: "absolute", top: 8, left: 8, background: "#dc2626", borderRadius: 8, padding: "3px 6px", color: "#fff", fontSize: 10, fontWeight: 800 }}>
            {disc}% OFF
          </span>
        )}
      </div>
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 4 }}>
        {!!product.badge && <span style={{ color: "#f59e0b", fontSize: 10, fontWeight: 800 }}>{product.badge}</span>}
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", lineHeight: "17px" }}>{product.title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#22c55e", fontSize: 15, fontWeight: 900 }}>₹{product.salePrice}</span>
          {product.originalPrice > product.salePrice && (
            <span style={{ fontSize: 11, fontWeight: 600, textDecoration: "line-through", opacity: 0.6, color: "var(--text)" }}>₹{product.originalPrice}</span>
          )}
        </div>
        {product.rating > 0 && (
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)" }}>
            ⭐ {product.rating.toFixed(1)} {product.reviewCount ? `(${product.reviewCount})` : ""}
          </span>
        )}
      </div>
    </button>
  );
}

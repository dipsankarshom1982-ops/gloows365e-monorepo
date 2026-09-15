// PATH: apps/web/src/lib/glostore/index.ts
// GloStore — affiliate products feature. Mirrors apps/mobile/lib/glostore.
// Reads from the "affiliateProducts" Firestore collection that the admin
// panel's "Affiliate Products" page writes to.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  limit as fbLimit,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

export type GloStorePlatform = "amazon" | "flipkart" | "other";
export type GloStoreCategory =
  | "books" | "stationery" | "electronics" | "courses" | "kits" | "uniforms" | "other";

export interface GloStoreProduct {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  originalPrice: number;
  salePrice: number;
  platform: GloStorePlatform;
  affiliateUrl: string;
  category: GloStoreCategory;
  targetClass: string[];
  targetSubject: string;
  badge: string;
  isActive: boolean;
  isFeatured: boolean;
  rating: number;
  reviewCount: number;
  homeOrder?: number;
  views?: number;
  clicks?: number;
}

// Fixed display order for category sections on the GloStore home page —
// mirrors admin's CATEGORIES list in AffiliateProducts.tsx.
export const CATEGORY_META: { value: GloStoreCategory; label: string; emoji: string }[] = [
  { value: "books",       label: "Books",       emoji: "📚" },
  { value: "stationery",  label: "Stationery",  emoji: "✏️" },
  { value: "electronics", label: "Electronics", emoji: "💻" },
  { value: "courses",     label: "Courses",     emoji: "🎓" },
  { value: "kits",        label: "Kits",        emoji: "🔬" },
  { value: "uniforms",    label: "Uniforms",    emoji: "🎒" },
  { value: "other",       label: "Other",       emoji: "📦" },
];

export interface GloStoreCategorySection {
  category: GloStoreCategory;
  label: string;
  emoji: string;
  products: GloStoreProduct[];
}

const COLLECTION = "affiliateProducts";

// Home page only ever shows this many flash cards — kept in sync with the
// cap the admin panel enforces when toggling "Feature on Home".
export const MAX_HOME_FEATURED = 20;

function fromDoc(d: any): GloStoreProduct {
  const data = d.data();
  return {
    id: d.id,
    title: data.title ?? "",
    description: data.description ?? "",
    imageUrl: data.imageUrl ?? "",
    originalPrice: data.originalPrice ?? 0,
    salePrice: data.salePrice ?? 0,
    platform: data.platform ?? "other",
    affiliateUrl: data.affiliateUrl ?? "",
    category: data.category ?? "other",
    targetClass: data.targetClass ?? ["all"],
    targetSubject: data.targetSubject ?? "",
    badge: data.badge ?? "",
    isActive: !!data.isActive,
    isFeatured: !!data.isFeatured,
    rating: data.rating ?? 0,
    reviewCount: data.reviewCount ?? 0,
    homeOrder: data.homeOrder,
    views: data.views ?? 0,
    clicks: data.clicks ?? 0,
  };
}

/** Up to MAX_HOME_FEATURED admin-featured products, for the home flash-card strip. */
export async function fetchFeaturedProducts(
  max: number = MAX_HOME_FEATURED
): Promise<GloStoreProduct[]> {
  const db = getFirestore();
  try {
    const snap = await getDocs(
      query(
        collection(db, COLLECTION),
        where("isActive", "==", true),
        where("isFeatured", "==", true),
        orderBy("homeOrder", "asc"),
        fbLimit(max)
      )
    );
    return snap.docs.map(fromDoc);
  } catch {
    // Falls back if some older docs don't have homeOrder set yet
    // (orderBy on a missing field excludes those docs in Firestore).
    const snap = await getDocs(
      query(
        collection(db, COLLECTION),
        where("isActive", "==", true),
        where("isFeatured", "==", true),
        fbLimit(max)
      )
    );
    return snap.docs.map(fromDoc);
  }
}

/** Every active product, for the full GloStore page. */
export async function fetchAllProducts(): Promise<GloStoreProduct[]> {
  const db = getFirestore();
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where("isActive", "==", true),
      orderBy("createdAt", "desc")
    )
  );
  return snap.docs.map(fromDoc);
}

/**
 * Every active product, grouped into category sections (in CATEGORY_META
 * order) for the e-commerce-style GloStore home page — categories with no
 * active products are omitted rather than shown empty.
 */
export async function fetchProductsGroupedByCategory(): Promise<GloStoreCategorySection[]> {
  const products = await fetchAllProducts();
  return CATEGORY_META
    .map((meta) => ({
      category: meta.value,
      label: meta.label,
      emoji: meta.emoji,
      products: products.filter((p) => p.category === meta.value),
    }))
    .filter((section) => section.products.length > 0);
}

export async function fetchProductById(id: string): Promise<GloStoreProduct | null> {
  const db = getFirestore();
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return fromDoc(snap);
}

/** Non-blocking click counter — best-effort, never throws to the caller. */
export async function recordProductClick(id: string): Promise<void> {
  try {
    const db = getFirestore();
    await updateDoc(doc(db, COLLECTION, id), { clicks: increment(1) });
  } catch {
    /* non-blocking */
  }
}

/**
 * Non-blocking view counter — fired when a student opens a product's detail
 * page, distinct from recordProductClick (which fires on "Buy Now"). Having
 * both gives admin a views→clicks funnel instead of just a raw click count.
 */
export async function recordProductView(id: string): Promise<void> {
  try {
    const db = getFirestore();
    await updateDoc(doc(db, COLLECTION, id), { views: increment(1) });
  } catch {
    /* non-blocking */
  }
}

export function discountPct(orig: number, sale: number): number {
  return orig > 0 && sale < orig ? Math.round(((orig - sale) / orig) * 100) : 0;
}

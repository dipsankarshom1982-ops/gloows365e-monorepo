// PATH: admin-web/src/pages/AffiliateProducts.tsx
// Affiliate Program — admin adds books & educational products with Amazon/Flipkart links.
// Students see these in the app as "Buy Now" cards. Admin earns affiliate commission.
// Firestore collection: affiliateProducts

import {
  addDoc, collection, deleteDoc, doc,
  getDocs, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import MediaUpload from "../components/MediaUpload";
import { db } from "../lib/firebase";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Platform = "amazon" | "flipkart" | "other";
type Category = "books" | "stationery" | "electronics" | "courses" | "kits" | "uniforms" | "other";

interface Product {
  id:           string;
  title:        string;
  description:  string;
  imageUrl:     string;
  originalPrice: number;
  salePrice:    number;
  platform:     Platform;
  affiliateUrl: string;
  category:     Category;
  targetClass:  string[];
  targetSubject:string;
  badge:        string;       // "Bestseller", "New", "Recommended", etc.
  isActive:     boolean;
  isFeatured:   boolean;
  rating:       number;
  reviewCount:  number;
  createdAt:    any;
}

const PLATFORMS: { value: Platform; label: string; color: string; icon: string }[] = [
  { value: "amazon",   label: "Amazon India",  color: "bg-orange-500/20 text-orange-300 border-orange-500/40",  icon: "🛒" },
  { value: "flipkart", label: "Flipkart",       color: "bg-blue-500/20 text-blue-300 border-blue-500/40",        icon: "🛍️" },
  { value: "other",    label: "Other",          color: "bg-slate-500/20 text-slate-300 border-slate-500/40",     icon: "🔗" },
];

const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: "books",       label: "Books & Study Materials", emoji: "📚" },
  { value: "stationery",  label: "Stationery",              emoji: "✏️" },
  { value: "electronics", label: "Electronics",             emoji: "💻" },
  { value: "courses",     label: "Online Courses",          emoji: "🎓" },
  { value: "kits",        label: "Lab / Science Kits",      emoji: "🔬" },
  { value: "uniforms",    label: "Uniforms / School Bags",  emoji: "🎒" },
  { value: "other",       label: "Other",                   emoji: "📦" },
];

const CLASSES = ["6", "7", "8", "9", "10", "11", "12", "all"];
const BADGES  = ["", "Bestseller", "New Arrival", "Recommended", "Most Popular", "Editor's Pick", "Budget Pick", "Premium"];

const EMPTY: Omit<Product, "id" | "createdAt"> = {
  title: "", description: "", imageUrl: "",
  originalPrice: 0, salePrice: 0,
  platform: "amazon", affiliateUrl: "",
  category: "books", targetClass: ["all"],
  targetSubject: "", badge: "Recommended",
  isActive: true, isFeatured: false,
  rating: 4.5, reviewCount: 0,
};

export default function AffiliateProducts() {
  const [products,    setProducts]    = useState<Product[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [editId,      setEditId]      = useState<string | null>(null);
  const [form,        setForm]        = useState<typeof EMPTY>({ ...EMPTY });
  const [saving,      setSaving]      = useState(false);
  const [search,      setSearch]      = useState("");
  const [filterCat,   setFilterCat]   = useState<string>("all");
  const [filterPlat,  setFilterPlat]  = useState<string>("all");
  const formRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    const snap = await getDocs(query(collection(db, "affiliateProducts"), orderBy("createdAt", "desc")));
    setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const set = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const toggleClass = (cls: string) => {
    setForm((p) => {
      const arr = p.targetClass;
      if (cls === "all") return { ...p, targetClass: ["all"] };
      const without = arr.filter((c) => c !== "all" && c !== cls);
      return { ...p, targetClass: arr.includes(cls) ? without : [...without, cls] };
    });
  };

  const openNew = () => {
    setEditId(null);
    setForm({ ...EMPTY });
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const openEdit = (p: Product) => {
    setEditId(p.id);
    setForm({
      title: p.title, description: p.description, imageUrl: p.imageUrl,
      originalPrice: p.originalPrice, salePrice: p.salePrice,
      platform: p.platform, affiliateUrl: p.affiliateUrl,
      category: p.category, targetClass: p.targetClass ?? ["all"],
      targetSubject: p.targetSubject ?? "", badge: p.badge ?? "",
      isActive: p.isActive, isFeatured: p.isFeatured,
      rating: p.rating ?? 4.5, reviewCount: p.reviewCount ?? 0,
    });
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.affiliateUrl.trim()) {
      alert("Title and Affiliate URL are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        originalPrice: Number(form.originalPrice),
        salePrice:     Number(form.salePrice),
        rating:        Number(form.rating),
        reviewCount:   Number(form.reviewCount),
        updatedAt:     serverTimestamp(),
      };
      if (editId) {
        await updateDoc(doc(db, "affiliateProducts", editId), payload);
      } else {
        await addDoc(collection(db, "affiliateProducts"), { ...payload, createdAt: serverTimestamp() });
      }
      setShowForm(false);
      setEditId(null);
      await load();
    } catch (e: any) {
      alert("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    await deleteDoc(doc(db, "affiliateProducts", id));
    setProducts((p) => p.filter((x) => x.id !== id));
  };

  const toggleField = async (id: string, field: "isActive" | "isFeatured", cur: boolean) => {
    await updateDoc(doc(db, "affiliateProducts", id), { [field]: !cur });
    setProducts((p) => p.map((x) => x.id === id ? { ...x, [field]: !cur } : x));
  };

  const discount = (orig: number, sale: number) =>
    orig > 0 && sale < orig ? Math.round(((orig - sale) / orig) * 100) : 0;

  const filtered = products.filter((p) => {
    if (filterCat  !== "all" && p.category  !== filterCat)  return false;
    if (filterPlat !== "all" && p.platform  !== filterPlat) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const platformMeta = (plat: Platform) => PLATFORMS.find((p) => p.value === plat)!;
  const categoryMeta = (cat: Category)  => CATEGORIES.find((c) => c.value === cat)!;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">🛒 Affiliate Products</h1>
          <p className="text-slate-400 text-sm mt-1">
            Add Amazon & Flipkart books and educational items. Students see "Buy Now" cards. You earn affiliate commission.
          </p>
        </div>
        <button
          onClick={openNew}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-colors flex items-center gap-2 shrink-0"
        >
          ➕ Add Product
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Products", value: products.length,                   icon: "📦", color: "text-indigo-400" },
          { label: "Active",         value: products.filter((p) => p.isActive).length,  icon: "✅", color: "text-emerald-400" },
          { label: "Featured",       value: products.filter((p) => p.isFeatured).length,icon: "⭐", color: "text-amber-400" },
          { label: "Amazon",         value: products.filter((p) => p.platform === "amazon").length, icon: "🛒", color: "text-orange-400" },
        ].map((s) => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-xs mb-1">{s.icon} {s.label}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-56"
        />
        <select
          value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
        </select>
        <select
          value={filterPlat} onChange={(e) => setFilterPlat(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm"
        >
          <option value="all">All Platforms</option>
          {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.icon} {p.label}</option>)}
        </select>
        <span className="text-slate-500 text-sm ml-auto">{filtered.length} product{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* ── PRODUCT FORM ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            ref={formRef}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-6 space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-white">
                {editId ? "✏️ Edit Product" : "➕ Add Product"}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white transition-colors text-2xl leading-none">×</button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Left column */}
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="text-slate-300 text-sm font-bold mb-1.5 block">Product Title *</label>
                  <input
                    value={form.title} onChange={(e) => set("title", e.target.value)}
                    placeholder="e.g. NCERT Mathematics Class 10"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-slate-300 text-sm font-bold mb-1.5 block">Description</label>
                  <textarea
                    value={form.description} onChange={(e) => set("description", e.target.value)}
                    rows={3} placeholder="Why students should buy this…"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Platform */}
                <div>
                  <label className="text-slate-300 text-sm font-bold mb-1.5 block">Platform *</label>
                  <div className="flex gap-2">
                    {PLATFORMS.map((p) => (
                      <button
                        key={p.value} type="button"
                        onClick={() => set("platform", p.value)}
                        className={`flex-1 py-2 rounded-xl border text-sm font-bold transition-all ${
                          form.platform === p.value ? p.color : "bg-slate-800 border-slate-700 text-slate-400"
                        }`}
                      >
                        {p.icon} {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Affiliate URL */}
                <div>
                  <label className="text-slate-300 text-sm font-bold mb-1.5 block">Affiliate URL *</label>
                  <input
                    value={form.affiliateUrl} onChange={(e) => set("affiliateUrl", e.target.value)}
                    placeholder="https://amzn.to/... or https://fkrt.it/..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-slate-500 text-xs mt-1">
                    Paste your Amazon Associates or Flipkart Affiliate tagged URL
                  </p>
                </div>

                {/* Prices */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 text-sm font-bold mb-1.5 block">Original Price (₹)</label>
                    <input
                      type="number" value={form.originalPrice}
                      onChange={(e) => set("originalPrice", e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 text-sm font-bold mb-1.5 block">Sale Price (₹)</label>
                    <input
                      type="number" value={form.salePrice}
                      onChange={(e) => set("salePrice", e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                {discount(form.originalPrice, form.salePrice) > 0 && (
                  <p className="text-emerald-400 text-xs font-bold">
                    ✅ {discount(form.originalPrice, form.salePrice)}% discount will be shown
                  </p>
                )}
              </div>

              {/* Right column */}
              <div className="space-y-4">
                {/* Product Image */}
                <div>
                  <label className="text-slate-300 text-sm font-bold mb-1.5 block">Product Image</label>
                  <MediaUpload
                    type="image"
                    value={form.imageUrl}
                    storagePath="affiliate-products"
                    onUpload={(url) => set("imageUrl", url)}
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="text-slate-300 text-sm font-bold mb-1.5 block">Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.value} type="button"
                        onClick={() => set("category", c.value)}
                        className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all text-left ${
                          form.category === c.value
                            ? "bg-indigo-500/20 border-indigo-500/60 text-indigo-300"
                            : "bg-slate-800 border-slate-700 text-slate-400"
                        }`}
                      >
                        {c.emoji} {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Class */}
                <div>
                  <label className="text-slate-300 text-sm font-bold mb-1.5 block">Target Class</label>
                  <div className="flex flex-wrap gap-2">
                    {CLASSES.map((cls) => (
                      <button
                        key={cls} type="button"
                        onClick={() => toggleClass(cls)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                          form.targetClass.includes(cls)
                            ? "bg-indigo-500/20 border-indigo-500/60 text-indigo-300"
                            : "bg-slate-800 border-slate-700 text-slate-400"
                        }`}
                      >
                        {cls === "all" ? "All Classes" : `Class ${cls}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="text-slate-300 text-sm font-bold mb-1.5 block">Subject (optional)</label>
                  <input
                    value={form.targetSubject} onChange={(e) => set("targetSubject", e.target.value)}
                    placeholder="e.g. Mathematics, Science, all"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Badge + Rating row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 text-sm font-bold mb-1.5 block">Badge</label>
                    <select
                      value={form.badge} onChange={(e) => set("badge", e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm"
                    >
                      {BADGES.map((b) => <option key={b} value={b}>{b || "No badge"}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-300 text-sm font-bold mb-1.5 block">Rating (0–5)</label>
                    <input
                      type="number" min="0" max="5" step="0.1" value={form.rating}
                      onChange={(e) => set("rating", e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex gap-4">
                  {[
                    { label: "Active (visible to students)", field: "isActive" as const },
                    { label: "Featured (show prominently)",   field: "isFeatured" as const },
                  ].map(({ label, field }) => (
                    <label key={field} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox" checked={form[field]}
                        onChange={() => set(field, !form[field])}
                        className="w-4 h-4 accent-indigo-500"
                      />
                      <span className="text-slate-300 text-xs">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Save button */}
            <div className="flex gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold transition-colors"
              >
                {saving ? "Saving…" : editId ? "Update Product" : "Add Product"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors">
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PRODUCTS GRID ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="text-center py-20 text-slate-400">Loading products…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <p className="text-5xl">🛒</p>
          <p className="text-slate-300 font-bold text-lg">No products yet</p>
          <p className="text-slate-500 text-sm">Add Amazon or Flipkart affiliate products for students to buy</p>
          <button onClick={openNew} className="mt-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-colors">
            ➕ Add First Product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {filtered.map((p) => {
            const plat = platformMeta(p.platform);
            const cat  = categoryMeta(p.category);
            const disc = discount(p.originalPrice, p.salePrice);
            return (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all ${
                  p.isFeatured ? "border-amber-500/50" : p.isActive ? "border-slate-700" : "border-slate-800 opacity-60"
                }`}
              >
                {/* Image */}
                <div className="relative h-44 bg-slate-800 flex items-center justify-center overflow-hidden">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-5xl">{cat.emoji}</span>
                  )}
                  {/* Badge + Featured */}
                  <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
                    {p.badge && (
                      <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                        {p.badge}
                      </span>
                    )}
                    {p.isFeatured && (
                      <span className="bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full">
                        ⭐ Featured
                      </span>
                    )}
                    {disc > 0 && (
                      <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                        {disc}% OFF
                      </span>
                    )}
                  </div>
                  {/* Platform */}
                  <div className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${plat.color}`}>
                    {plat.icon} {plat.label}
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {/* Title */}
                  <h3 className="text-white font-bold text-sm line-clamp-2 leading-tight">{p.title}</h3>

                  {/* Category + class */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-400 text-[10px] bg-slate-800 px-2 py-0.5 rounded-full">
                      {cat.emoji} {cat.label}
                    </span>
                    <span className="text-slate-400 text-[10px] bg-slate-800 px-2 py-0.5 rounded-full">
                      Class {(p.targetClass ?? ["all"]).join(", ")}
                    </span>
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline gap-2">
                    <span className="text-emerald-400 text-lg font-black">₹{p.salePrice || p.originalPrice}</span>
                    {disc > 0 && (
                      <span className="text-slate-500 text-sm line-through">₹{p.originalPrice}</span>
                    )}
                    {p.rating > 0 && (
                      <span className="text-amber-400 text-xs ml-auto">★ {p.rating}</span>
                    )}
                  </div>

                  {/* URL preview */}
                  <p className="text-slate-500 text-[10px] truncate">{p.affiliateUrl}</p>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                    <button
                      onClick={() => toggleField(p.id, "isActive", p.isActive)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        p.isActive ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      {p.isActive ? "✅ Active" : "○ Inactive"}
                    </button>
                    <button
                      onClick={() => toggleField(p.id, "isFeatured", p.isFeatured)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        p.isFeatured ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      {p.isFeatured ? "⭐ Featured" : "☆ Feature"}
                    </button>
                    <button onClick={() => openEdit(p)} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">✏️</button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">🗑️</button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* How to get affiliate link guide */}
      <div className="border border-slate-700 rounded-2xl p-6 bg-slate-900/50 space-y-4">
        <h3 className="text-white font-black text-lg">📖 How to Add Affiliate Products</h3>
        <div className="grid grid-cols-2 gap-6 text-sm text-slate-400">
          <div className="space-y-2">
            <p className="text-orange-400 font-bold">🛒 Amazon Associates</p>
            <ol className="space-y-1 list-decimal list-inside">
              <li>Sign up at <span className="text-orange-300">affiliate-program.amazon.in</span></li>
              <li>Search for books/products on Amazon</li>
              <li>Use "Get Link" → "Text and Image" in Associates toolbar</li>
              <li>Copy the short link (amzn.to/…) and paste here</li>
              <li>You earn 4–10% commission per purchase</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="text-blue-400 font-bold">🛍️ Flipkart Affiliate</p>
            <ol className="space-y-1 list-decimal list-inside">
              <li>Sign up at <span className="text-blue-300">affiliate.flipkart.com</span></li>
              <li>Find the product on Flipkart</li>
              <li>Use "Get affiliate link" from dashboard</li>
              <li>Copy the fkrt.it/… link and paste here</li>
              <li>You earn 6–12% commission per purchase</li>
            </ol>
          </div>
        </div>
        <div className="text-slate-500 text-xs pt-2 border-t border-slate-800">
          💡 Best performing categories for school students: NCERT books, Exam guides (RD Sharma, HC Verma), Stationery sets, Scientific calculators, Study lamps
        </div>
      </div>
    </div>
  );
}

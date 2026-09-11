"use client";

// PATH: apps/web/src/lib/storyCategories.ts
// Mirrors mobile lib/storyCategories.ts exactly.
// Central registry for educational story categories. Built-in categories
// are always available; dynamic categories load from the storyCategories/
// Firestore collection so the admin panel can add new ones at any time.

import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

export interface StoryCategory {
  id:       string;   // e.g. "learn", "ai_tips"
  label:    string;   // e.g. "Learn"
  emoji:    string;   // e.g. "📚"
  gradient: [string, string]; // [top, bottom] hex colours
  order:    number;   // display order in horizontal list
}

// ─── Built-in categories — always rendered even if Firestore is offline ──────
export const BUILT_IN_CATEGORIES: StoryCategory[] = [
  { id: "learn",         label: "Learn",         emoji: "📚", gradient: ["#1e1b4b", "#4338ca"], order: 1 },
  { id: "ai_tips",       label: "AI Tips",       emoji: "🤖", gradient: ["#0c1a2e", "#0284c7"], order: 2 },
  { id: "career",        label: "Career",        emoji: "💼", gradient: ["#0d2311", "#15803d"], order: 3 },
  { id: "success",       label: "Success",       emoji: "🌟", gradient: ["#2d1a0a", "#b45309"], order: 4 },
  { id: "opportunities", label: "Opportunities", emoji: "🎯", gradient: ["#1a0a2e", "#7e22ce"], order: 5 },
];

// ─── Backwards-compat mapping — old stories use `type`, not category ─────────
export const TYPE_TO_CATEGORY: Record<string, string> = {
  learning:    "learn",
  earning:     "opportunities",
  ecommerce:   "opportunities",
  challenge:   "career",
  achievement: "success",
  testimonial: "success",
};

export function resolveCategory(
  educationalCategory?: string,
  legacyType?: string
): string {
  if (educationalCategory) return educationalCategory;
  if (legacyType) return TYPE_TO_CATEGORY[legacyType] ?? "learn";
  return "learn";
}

// ─── Hook: merged built-in + Firestore dynamic categories ────────────────────
export function useStoryCategories(): StoryCategory[] {
  const [dynamic, setDynamic] = useState<StoryCategory[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "storyCategories"),
      (snap) => {
        const fromFs: StoryCategory[] = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as StoryCategory))
          .filter((c) => c.label && c.emoji && c.gradient);
        setDynamic(fromFs);
      },
      () => setDynamic([])
    );
    return () => unsub();
  }, []);

  const builtInIds = new Set(BUILT_IN_CATEGORIES.map((c) => c.id));
  const extraDynamic = dynamic.filter((c) => !builtInIds.has(c.id));
  const allCategories = [...BUILT_IN_CATEGORIES, ...extraDynamic];

  const orderOverrides: Record<string, number> = {};
  dynamic.forEach((c) => { if (c.order !== undefined) orderOverrides[c.id] = c.order; });

  return allCategories
    .map((c) => ({ ...c, order: orderOverrides[c.id] ?? c.order }))
    .sort((a, b) => a.order - b.order);
}

// ─── Lookup helper ─────────────────────────────────────────────────────────────
export function getCategoryById(
  id: string,
  categories: StoryCategory[] = BUILT_IN_CATEGORIES
): StoryCategory {
  return (
    categories.find((c) => c.id === id) ??
    BUILT_IN_CATEGORIES.find((c) => c.id === id) ??
    BUILT_IN_CATEGORIES[0]
  );
}

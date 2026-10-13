// PATH: services/skillTaxonomyService.ts
//
// Phase 2D-3 — reads the Phase 2B skill taxonomy (skillCategories, skills)
// for the "Browse by Skill" section and Battle Details' Skill/Category
// display. Same shape/pattern as services/appConfigService.ts (this
// codebase's existing config-read convention) — direct Firestore reads,
// isActive-filtered, order-sorted; no new backend endpoint needed since
// these collections are already signed-in-readable (firestore.rules,
// Phase 2B).
//
// Phase 2D-8 polish: added a short in-memory cache (brief §23 — "do not
// repeatedly fetch the same skill/category" — by 2D-7 there are 5
// different screens in this feature that each independently call these
// two functions on every mount/focus). Fully transparent to every
// existing caller: same function signatures, same return shape, same
// async/Promise timing — just skips the network round-trip when a recent
// result is already in memory. Admin-managed taxonomy data changes rarely
// (apps/admin/src/pages/SkillCategories.tsx), so a short TTL is safe; it
// is not treated as a security/authoritative-data boundary in any way.

import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let categoriesCache: { data: SkillCategory[]; at: number } | null = null;
let skillsCache: { data: Skill[]; at: number } | null = null;

export interface SkillCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  isActive: boolean;
  order: number;
}

export interface Skill {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  isActive: boolean;
  order: number;
}

export async function getActiveSkillCategories(): Promise<SkillCategory[]> {
  if (categoriesCache && Date.now() - categoriesCache.at < CACHE_TTL_MS) {
    return categoriesCache.data;
  }
  try {
    const snap = await getDocs(query(
      collection(db, "skillCategories"),
      where("isActive", "==", true),
      orderBy("order", "asc")
    ));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SkillCategory));
    categoriesCache = { data, at: Date.now() };
    return data;
  } catch {
    // Composite-index-not-ready fallback, same pattern as
    // appConfigService.ts's siblings — client-side sort instead of failing.
    try {
      const snap = await getDocs(query(collection(db, "skillCategories"), where("isActive", "==", true)));
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as SkillCategory))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      categoriesCache = { data, at: Date.now() };
      return data;
    } catch {
      return categoriesCache?.data ?? [];
    }
  }
}

export async function getActiveSkills(): Promise<Skill[]> {
  if (skillsCache && Date.now() - skillsCache.at < CACHE_TTL_MS) {
    return skillsCache.data;
  }
  try {
    const snap = await getDocs(query(
      collection(db, "skills"),
      where("isActive", "==", true),
      orderBy("order", "asc")
    ));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Skill));
    skillsCache = { data, at: Date.now() };
    return data;
  } catch {
    try {
      const snap = await getDocs(query(collection(db, "skills"), where("isActive", "==", true)));
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Skill))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      skillsCache = { data, at: Date.now() };
      return data;
    } catch {
      return skillsCache?.data ?? [];
    }
  }
}

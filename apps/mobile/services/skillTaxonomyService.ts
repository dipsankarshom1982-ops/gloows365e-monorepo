// PATH: services/skillTaxonomyService.ts
//
// Phase 2D-3 — reads the Phase 2B skill taxonomy (skillCategories, skills)
// for the "Browse by Skill" section and Battle Details' Skill/Category
// display. Same shape/pattern as services/appConfigService.ts (this
// codebase's existing config-read convention) — direct Firestore reads,
// isActive-filtered, order-sorted; no new backend endpoint needed since
// these collections are already signed-in-readable (firestore.rules,
// Phase 2B).

import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";

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
  try {
    const snap = await getDocs(query(
      collection(db, "skillCategories"),
      where("isActive", "==", true),
      orderBy("order", "asc")
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SkillCategory));
  } catch {
    // Composite-index-not-ready fallback, same pattern as
    // appConfigService.ts's siblings — client-side sort instead of failing.
    try {
      const snap = await getDocs(query(collection(db, "skillCategories"), where("isActive", "==", true)));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as SkillCategory))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    } catch {
      return [];
    }
  }
}

export async function getActiveSkills(): Promise<Skill[]> {
  try {
    const snap = await getDocs(query(
      collection(db, "skills"),
      where("isActive", "==", true),
      orderBy("order", "asc")
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Skill));
  } catch {
    try {
      const snap = await getDocs(query(collection(db, "skills"), where("isActive", "==", true)));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Skill))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    } catch {
      return [];
    }
  }
}

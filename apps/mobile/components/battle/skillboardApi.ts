// PATH: components/battle/skillboardApi.ts
//
// Phase 2D-7 — Persistent SkillBoard: thin, typed wrappers around the
// ACTUAL authoritative data that already exists for the canonical engine
// (verified against functions/src/battleSkillboardIntegration.ts,
// functions/src/battleRewards.ts, firestore.rules, and
// firestore.indexes.json before writing this file — nothing here is a
// guessed schema or an invented aggregation).
//
// FORENSIC FINDINGS THAT SHAPED THIS FILE (brief §4):
//  - There is NO dedicated "SkillBoard summary" callable/aggregation
//    endpoint anywhere in functions/src. skillPoints and achievementEvents
//    are the only persistent, cross-battle collections, and both are
//    safely, directly readable by the client (`allow read: if
//    request.auth != null` — verified in firestore.rules, not assumed).
//  - firestore.indexes.json has ZERO composite indexes for skillPoints,
//    achievementEvents, submissions, or battleResults. Every query below
//    is therefore deliberately EQUALITY-ONLY (+ optional limit/
//    startAfter) — Firestore serves compound equality-only queries from
//    its automatic single-field indexes; nothing here does
//    `where(...).orderBy(<different field>)`, which WOULD need a
//    composite index that does not exist and cannot be safely assumed
//    deployed in this environment (no way to verify/deploy one here).
//  - Consequence (documented, not hidden): fetchMyBattleHistoryPage's
//    pagination is bounded and cursor-based (a real QueryDocumentSnapshot
//    passed to startAfter), but its PAGE-TO-PAGE order follows Firestore's
//    implicit document-ID order, not guaranteed chronological. Each
//    individual page is additionally sorted by `earnedAt` client-side for
//    a sensible in-page look — a cosmetic re-ordering of an already-
//    fetched, already-bounded, already-authoritative small set, not a
//    calculation of any value. Recommended follow-up (not done here,
//    would need a deploy): a composite index on
//    achievementEvents(studentId, ruleId, earnedAt) for true chronological
//    paging.
//  - skillPoints needs no pagination: one doc per (student, skill) pair,
//    bounded by however many skills the taxonomy defines (a small,
//    admin-managed list — see apps/admin/src/pages/SkillCategories.tsx),
//    so a single equality-only query for the whole set is safe and is NOT
//    the kind of ever-growing "unbounded read" the brief warns against
//    (contrast with achievementEvents, which grows per battle entered).

import { db } from "@/lib/firebase";
import { resolveSkillViewModel } from "./resolveBattleExperience";
import type { Skill, SkillCategory } from "@/services/skillTaxonomyService";
import {
  collection, doc, getDoc, getDocs, getCountFromServer, limit, query,
  startAfter, where, type QueryConstraint, type QueryDocumentSnapshot, type DocumentData,
} from "firebase/firestore";

// ─── Student identity (students/{uid} — own profile only; firestore.rules
// restricts read to `auth.uid == userId`, verified, so this can only ever
// be "my own" profile, never another student's). ──────────────────────
export interface MyProfile {
  name: string;
  studentClass: string;
  profilePic: string;
}

export async function fetchMyProfile(uid: string): Promise<MyProfile | null> {
  const snap = await getDoc(doc(db, "students", uid));
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  return {
    name: typeof d.name === "string" && d.name ? d.name : "Student",
    studentClass: d.class !== undefined && d.class !== null ? String(d.class) : "",
    profilePic: typeof d.profilePic === "string" ? d.profilePic : "",
  };
}

// ─── Skill identity (skillPoints) ─────────────────────────────────────
export interface MySkillEntry {
  skillId: string;
  skillName: string;
  categoryName?: string;
  totalPoints: number;
  battlesParticipated: number;
}

export async function fetchMySkillIdentity(
  uid: string,
  skills: Skill[],
  categories: SkillCategory[]
): Promise<MySkillEntry[]> {
  const snap = await getDocs(query(collection(db, "skillPoints"), where("studentId", "==", uid)));
  const entries = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const skillId = typeof data.skillId === "string" ? data.skillId : "";
    const skillVm = resolveSkillViewModel(skillId, skills, categories);
    return {
      skillId,
      skillName: skillVm?.name ?? "Skill",
      categoryName: skillVm?.categoryName,
      totalPoints: typeof data.totalPoints === "number" ? data.totalPoints : 0,
      battlesParticipated: typeof data.battlesParticipated === "number" ? data.battlesParticipated : 0,
    };
  });
  // Display-order sort only (see file header) — every value here is
  // already authoritative; this just decides which card appears first.
  return entries.sort((a, b) => b.totalPoints - a.totalPoints);
}

// ─── Trophy Case (achievementEvents counts — O(1) via count(), the same
// aggregation-query posture Phase 2C's getMyBattleRank already uses
// server-side; here it's the client SDK's getCountFromServer). ────────
export interface TrophyCounts {
  participated: number;
  top10: number;
  top3: number;
  winner: number;
}

const TROPHY_RULE_IDS = ["participated", "top10", "top3", "winner"] as const;

export async function fetchMyTrophyCounts(uid: string): Promise<TrophyCounts> {
  const counts = await Promise.all(
    TROPHY_RULE_IDS.map(async (ruleId) => {
      const q = query(
        collection(db, "achievementEvents"),
        where("studentId", "==", uid),
        where("ruleId", "==", ruleId)
      );
      const res = await getCountFromServer(q);
      return res.data().count;
    })
  );
  return { participated: counts[0], top10: counts[1], top3: counts[2], winner: counts[3] };
}

// ─── Battle History (paginated, via achievementEvents' "participated"
// row) ──────────────────────────────────────────────────────────────────
// One "participated" achievementEvents doc exists per battle the student
// was actually scored in — written only at finalization (see
// battleSkillboardIntegration.ts) — so this is naturally one row per
// COMPLETED battle, never a phantom "still pending" row. Its own `rank`
// field is already authoritative and on the doc; score/isWinner come from
// a direct, bounded (page-size-scaled) read of battleResults/{battleId},
// finding this student's own entry — the identical lookup
// getMyBattleRank's server implementation performs, done here as a raw
// read since battleResults is already safely client-readable by rules.
export interface HistoryItem {
  battleId: string;
  battleTitle: string;
  skillLabel?: string;
  rank: number;
  score: number | null;
  isWinner: boolean;
  earnedAtMillis: number;
}

export interface HistoryPage {
  items: HistoryItem[];
  nextCursor: QueryDocumentSnapshot<DocumentData> | null;
}

export async function fetchMyBattleHistoryPage(
  uid: string,
  cursor: QueryDocumentSnapshot<DocumentData> | null,
  skills: Skill[],
  categories: SkillCategory[],
  pageSize = 10
): Promise<HistoryPage> {
  const constraints: QueryConstraint[] = [
    where("studentId", "==", uid),
    where("ruleId", "==", "participated"),
  ];
  const q = cursor
    ? query(collection(db, "achievementEvents"), ...constraints, startAfter(cursor), limit(pageSize))
    : query(collection(db, "achievementEvents"), ...constraints, limit(pageSize));
  const snap = await getDocs(q);

  const raw = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const earnedAt = data.earnedAt as { toMillis?: () => number } | undefined;
    return {
      battleId: typeof data.battleId === "string" ? data.battleId : "",
      skillId: typeof data.skillId === "string" ? data.skillId : "",
      rank: typeof data.rank === "number" ? data.rank : 0,
      earnedAtMillis: earnedAt?.toMillis?.() ?? 0,
    };
  });

  const items = await Promise.all(raw.map(async (r): Promise<HistoryItem> => {
    const [battleSnap, resultsSnap] = await Promise.all([
      getDoc(doc(db, "skillBattles", r.battleId)),
      getDoc(doc(db, "battleResults", r.battleId)),
    ]);
    const battleTitle = battleSnap.exists()
      ? ((battleSnap.data()?.title as string | undefined) ?? "Skill Battle")
      : "Skill Battle";
    const skillVm = resolveSkillViewModel(r.skillId, skills, categories);

    let score: number | null = null;
    let isWinner = false;
    if (resultsSnap.exists()) {
      const entries = (resultsSnap.data()?.entries as { studentId: string; score: number; isWinner: boolean }[] | undefined) ?? [];
      const mine = entries.find((e) => e.studentId === uid);
      if (mine) { score = mine.score; isWinner = mine.isWinner; }
    }

    return {
      battleId: r.battleId,
      battleTitle,
      skillLabel: skillVm?.name,
      rank: r.rank,
      score,
      isWinner,
      earnedAtMillis: r.earnedAtMillis,
    };
  }));

  // Cosmetic, within-this-page-only sort — see file header.
  items.sort((a, b) => b.earnedAtMillis - a.earnedAtMillis);

  return {
    items,
    nextCursor: snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null,
  };
}

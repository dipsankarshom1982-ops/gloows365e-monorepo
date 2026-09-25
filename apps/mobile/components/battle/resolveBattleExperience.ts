// PATH: components/battle/resolveBattleExperience.ts
//
// Phase 2D-3 — the presentation adapter (Phase 2D-1 blueprint §32, Phase
// 2D-3 brief §4/§35): the ONE place that looks at a raw skillBattles doc
// and decides (a) which engine it belongs to and (b) how to present it,
// so BattleCard/Battle Details never have to know the difference. This is
// a VIEW MODEL layer — it formats and routes, it does not compute score,
// rank, reward, or eligibility from scratch; those either come from
// authoritative backend reads (Phase 2C's getMyBattleRank etc.) or, for
// eligibility, from a straightforward client-side comparison against
// class lists the STUDENT is allowed to see about themselves (not a
// security boundary — submission eligibility is still independently
// enforced server-side by createBattleSubmission/submitSkillBattleReel;
// this is purely "should we show the Submit button," same posture the
// existing legacy screen already had).
//
// ENGINE DETECTION: a battle is CANONICAL if its `state` field is one of
// the Phase 2B/2C-managed states; otherwise it's LEGACY. This list must
// stay in sync with functions/src/skillBattleDomain.ts's BATTLE_STATES —
// it can't be imported directly (Cloud Functions and the Expo app are
// separate TS projects/runtimes), so it's duplicated here deliberately,
// same as this codebase's other small-enum client copies. Unlike a
// financial table, getting this list stale only affects which UI path a
// battle renders through — the actual state graph is still enforced
// authoritatively server-side (skillBattleDomain.ts, Admin-SDK-only) —
// so this duplication is presentation risk, not a security or money one.
//
// CANONICAL SUBMISSION CTA — DELIBERATE GAP: a canonical battle's CTA
// resolves to "COMING_SOON", never to the legacy Submit screen. Routing a
// canonical battle through Createreelscreen.tsx would call the LEGACY
// submitSkillBattleReel, which writes to `posts` — a collection the new
// engine's scoring/ranking pipeline never reads. That would silently put
// a student's submission in the wrong bucket for a canonical battle,
// never counted. Phase 2D-4's job is to give canonical battles a correct
// new submission entry point (createBattleSubmission); until then, this
// is the honest, safe placeholder — not a shortcut.

import type {
  BattleCardViewModel,
  BattleEngine,
  BattlePresentationStatus,
  CTAState,
  SkillViewModel,
} from "./types";
import type { Skill, SkillCategory } from "@/services/skillTaxonomyService";

const CANONICAL_BATTLE_STATES = new Set([
  "DRAFT", "SCHEDULED", "OPEN", "SUBMISSION_CLOSED", "RANKING_FINALIZATION",
  "RESULT_LOCKED", "WINNERS_ANNOUNCED", "AWARDS_PROCESSING", "COMPLETED", "CANCELLED",
]);

export interface RawBattle {
  id: string;
  title?: string;
  description?: string;
  sponsor?: string;
  // Legacy fields
  startDate?: string; endDate?: string;
  eligibleClasses?: unknown;
  totalPool?: string;
  vcoin_india?: number;
  isActive?: boolean;
  // Canonical fields (Phase 2B/2C)
  state?: string;
  skillId?: string;
  scope?: { type?: string; classFilter?: string[]; locationFilter?: { level?: string; values?: string[] } };
  submissionDeadline?: string;
  competitionEndAt?: string;
  vcoinsPool?: number;
  winnerCount?: number;
  participantCount?: number;
}

export function classifyBattleEngine(battle: RawBattle): BattleEngine {
  return typeof battle.state === "string" && CANONICAL_BATTLE_STATES.has(battle.state) ? "canonical" : "legacy";
}

export function normalizeEligibleClasses(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return (raw as (string | number)[]).map(String);
  if (typeof raw === "number") return [String(raw)];
  if (typeof raw === "string" && raw.includes(",")) return raw.split(",").map((s) => s.trim());
  return [String(raw)];
}

export function isEligibleForClasses(studentClass: string, eligibleClasses: string[]): boolean {
  if (eligibleClasses.length === 0) return true;
  return eligibleClasses.includes(String(studentClass));
}

// Privacy-safe scope label (Phase 2D-3 brief §18) — never renders a
// pincode or exact address, regardless of engine.
export function formatScopeLabel(battle: RawBattle, eligibleClasses: string[]): string {
  const classLabel = eligibleClasses.length > 0
    ? (eligibleClasses.length === 1 ? `Class ${eligibleClasses[0]}` : `Class ${eligibleClasses[0]}–${eligibleClasses[eligibleClasses.length - 1]}`)
    : "";
  const locationValues = battle.scope?.locationFilter?.values;
  const locationLabel = locationValues && locationValues.length > 0 ? locationValues.join(", ") : "";
  if (classLabel && locationLabel) return `${classLabel} · ${locationLabel}`;
  return classLabel || locationLabel || "All India";
}

function resolvePresentationStatus(battle: RawBattle, engine: BattleEngine): BattlePresentationStatus {
  if (engine === "canonical") {
    switch (battle.state) {
      case "DRAFT":
      case "SCHEDULED":
        return "UPCOMING";
      case "OPEN":
        return "LIVE";
      case "SUBMISSION_CLOSED":
      case "RANKING_FINALIZATION":
        return "SUBMISSION_CLOSED";
      case "RESULT_LOCKED":
      case "WINNERS_ANNOUNCED":
      case "AWARDS_PROCESSING":
      case "COMPLETED":
        return "COMPLETED";
      case "CANCELLED":
        return "CANCELLED";
      default:
        return "UPCOMING";
    }
  }
  // Legacy — same date-derived logic as the pre-2D-3 skillbattle.tsx,
  // moved here so both Discovery and Battle Details agree with each
  // other instead of two independent copies.
  const now = Date.now();
  const start = battle.startDate ? new Date(battle.startDate).getTime() : 0;
  const end = battle.endDate ? new Date(battle.endDate).getTime() : Infinity;
  if (now < start) return "UPCOMING";
  if (now > end) return "SUBMISSION_CLOSED"; // legacy has no separate "completed" moment either — treated as closed/completed together below
  return "LIVE";
}

function resolveDeadline(battle: RawBattle, engine: BattleEngine): Date | null {
  const raw = engine === "canonical" ? (battle.submissionDeadline ?? battle.endDate) : battle.endDate;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function resolveReward(battle: RawBattle): { label: string } | undefined {
  if (battle.totalPool) return { label: battle.totalPool };
  const pool = battle.vcoinsPool ?? battle.vcoin_india;
  if (pool && pool > 0) return { label: `${pool.toLocaleString("en-IN")} VCoins` };
  return undefined;
}

export function resolveSkillViewModel(
  skillId: string | undefined,
  skills: Skill[],
  categories: SkillCategory[]
): SkillViewModel | undefined {
  if (!skillId) return undefined;
  const skill = skills.find((s) => s.id === skillId);
  if (!skill) return undefined; // graceful — Phase 2D-3 brief §16, never crash on missing optional taxonomy
  const category = categories.find((c) => c.id === skill.categoryId);
  return { id: skill.id, name: skill.name, categoryId: skill.categoryId, categoryName: category?.name };
}

export function buildBattleCardViewModel(
  battle: RawBattle,
  opts: { skills: Skill[]; categories: SkillCategory[] }
): BattleCardViewModel {
  const engine = classifyBattleEngine(battle);
  const eligibleClasses = normalizeEligibleClasses(battle.eligibleClasses);
  return {
    id: battle.id,
    engine,
    title: battle.title ?? "Skill Battle",
    skill: resolveSkillViewModel(battle.skillId, opts.skills, opts.categories),
    status: resolvePresentationStatus(battle, engine),
    deadline: resolveDeadline(battle, engine),
    reward: resolveReward(battle),
    participantCount: battle.participantCount,
    scope: { label: formatScopeLabel(battle, eligibleClasses) },
    sponsor: battle.sponsor,
  };
}

// ─── CTA state machine (Phase 2D-3 brief §24) ──────────────────────────────
export function resolveCTAState(params: {
  engine: BattleEngine;
  status: BattlePresentationStatus;
  isEligible: boolean | null;
  mySubmissionStatus: "NONE" | "PENDING_MODERATION" | "APPROVED" | "REJECTED" | "WITHDRAWN" | null;
}): CTAState {
  const { engine, status, isEligible, mySubmissionStatus } = params;

  if (status === "CANCELLED") return "CANCELLED";
  if (status === "COMPLETED") return "VIEW_RESULTS";
  if (status === "UPCOMING") return "COMING_SOON";

  // LIVE or SUBMISSION_CLOSED from here on.
  if (mySubmissionStatus === null) return "LOADING";
  if (mySubmissionStatus === "PENDING_MODERATION") return "PENDING_MODERATION";
  if (mySubmissionStatus === "APPROVED") return "APPROVED_COMPETING";
  if (mySubmissionStatus === "REJECTED") return "REJECTED";

  if (status === "SUBMISSION_CLOSED") return "SUBMISSIONS_CLOSED";

  // LIVE, no submission yet.
  if (isEligible === false) return "NOT_ELIGIBLE";
  // See this file's header — canonical submission entry point is Phase 2D-4.
  if (engine === "canonical") return "COMING_SOON";
  return "SUBMIT";
}

export const CTA_COPY: Record<CTAState, string> = {
  NOT_ELIGIBLE: "Not Eligible",
  SUBMIT: "Submit Your Skill",
  PENDING_MODERATION: "Submission Under Review",
  APPROVED_COMPETING: "You're Competing",
  REJECTED: "Submission Not Approved",
  SUBMISSIONS_CLOSED: "Submissions Closed",
  VIEW_RESULTS: "View Results",
  CANCELLED: "Battle Cancelled",
  COMING_SOON: "Coming Soon",
  LOADING: "Loading…",
};

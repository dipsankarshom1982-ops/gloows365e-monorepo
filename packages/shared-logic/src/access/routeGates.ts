// packages/shared-logic/src/access/routeGates.ts
//
// Destination gating for whole route groups — the layout-level half of the
// access-control model in ./featureGate.ts. apps/web mounts these from each
// route segment's layout.tsx and apps/mobile from each navigator's
// screenLayout, so the protected screen is not mounted (no effects, no
// Firestore reads, no API/AI calls) until access is decided.
//
// Two gaps this closes:
//   D1 — child routes only checked their own feature flag (or nothing), so
//        with the parent module OFF a direct URL / deep link still opened
//        them. Every screen in a group now also checks the group's module.
//   D2 — the old gates reported "allowed" while featureFlags/appModules were
//        still loading, so a protected page rendered and ran its startup
//        code before the redirect. evaluateRouteGate() reports "loading"
//        until role, flags and modules are all resolved for the current uid.
//
// The table below is the single source for both platforms. Keys are the
// same featureFlags / appModules ids the page-level useModuleGate /
// useAiGuruFeatureGate calls already use.

import { isAiGuruRouteAllowed, isModuleRouteAllowed, type ModuleLike } from "./featureGate";

export type RouteAccessState = "loading" | "allowed" | "blocked";

/** Which check blocked — the platform picks the redirect target from it
 *  (module/entry → home, AI Guru feature → the AI Guru menu). */
export type RouteBlockReason = "module" | "feature" | "entry";

export interface ModuleGateSpec {
  kind: "module";
  moduleKey: string;
  /** featureFlags/homeSection key of a Home card that also links here. */
  homeSectionKey?: string;
}

/** A destination with no appModules doc of its own — reachable only from
 *  Drawer items / Home cards, so it is open while ANY of them is ON. */
export interface EntryPointGateSpec {
  kind: "entry";
  drawerItemKeys?: readonly string[];
  homeSectionKeys?: readonly string[];
}

export type RouteGateSpec = ModuleGateSpec | EntryPointGateSpec;

export interface AiGuruScreenSpec {
  /** featureFlags/aiGuru key(s); null = module gate only. */
  features: string | readonly string[] | null;
  /** Another independently-controlled entry point that also links to this
   *  screen (same "extraAllowed" rule as featureGate.ts). */
  alsoReachableVia?: { aiGuru?: readonly string[]; homeSection?: readonly string[] };
}

export const MODULE_GATES = {
  aiGuru:      { kind: "module", moduleKey: "ai-guru",      homeSectionKey: "aiguru" },
  seekho:      { kind: "module", moduleKey: "seekho",       homeSectionKey: "seekho_preview" },
  shikshahub:  { kind: "module", moduleKey: "shikshahub" },
  vidyastar:   { kind: "module", moduleKey: "vidyastar",    homeSectionKey: "vidya_star" },
  skillbattle: { kind: "module", moduleKey: "skillbattle",  homeSectionKey: "skillbattle" },
  dsq:         { kind: "module", moduleKey: "dsq",          homeSectionKey: "daily_streak_quiz" },
  knowledgehub:{ kind: "module", moduleKey: "knowledgehub", homeSectionKey: "knowledge_hub" },
  learnfun:    { kind: "module", moduleKey: "learnfun" },
  skillboost:  { kind: "module", moduleKey: "skillboost" },
  skillboard:  { kind: "module", moduleKey: "skillboard" },
  starboard:   { kind: "module", moduleKey: "starboard" },
} as const satisfies Record<string, ModuleGateSpec>;

// Deliberately NOT gated (each has an entry point no admin flag controls, so
// gating it would break that always-on path — see the D1 report):
//   wallet       — Drawer item + header V-Coins badge are unconditional
//                  (web Drawer.tsx: "not something admin toggles off").
//   my-prizes    — Drawer "Surprise gift" banner + vcoins/claim-gift link.
//   reels        — the post-login landing screen on both platforms.
//   create-reel  — mobile dashboard's always-on "Upload Reel" quick action.
//   leaderboard  — no flag or module governs it (Challenge's "leaderboard"
//                  module opens the wallet, not this screen).
export const ENTRY_POINT_GATES = {
  glostore: { kind: "entry", drawerItemKeys: ["glostore"], homeSectionKeys: ["glostore_preview"] },
  referral: { kind: "entry", homeSectionKeys: ["referral"] },
} as const satisfies Record<string, EntryPointGateSpec>;

/** Screen (web: path segment after /ai-guru, "" = index) → feature flag(s).
 *  Same keys each screen's own useAiGuruFeatureGate() call uses. */
export const AI_GURU_SCREENS: Record<string, AiGuruScreenSpec> = {
  "":               { features: null },
  index:            { features: null },
  ask:              { features: "ask_aiguru" },
  content:          { features: "generate" },
  setup:            { features: "generate" },
  generating:       { features: "generate" },
  player:           { features: ["generate", "dashboard", "my_lessons"] },
  dashboard:        { features: "dashboard" },
  "exam-simulator": { features: "exam_simulator" },
  "my-lessons":     { features: ["my_lessons", "revision_reels", "practice_tests"] },
  notebook:         { features: "notebook" },
  "photo-solve":    { features: "photo_solve" },
  skillguru:        { features: "skillguru" },
  "voice-tutor":    { features: "voice_tutor" },
  subscription:     { features: "subscription" },
  // Discover's CREDITS_EXHAUSTED error links here and Discover is controlled
  // independently of the AI Guru module, so it stays reachable while
  // Discover is ON (the feature flag still applies).
  credits:          { features: "subscription", alsoReachableVia: { aiGuru: ["discover"], homeSection: ["discover_preview"] } },
  // No feature flag of its own — the module gate is its only control.
  vidyaguru:        { features: null },
};

/** Screen name → spec; unknown AI Guru screens fall back to module-only. */
export function getAiGuruScreenSpec(screen: string | null | undefined): AiGuruScreenSpec {
  return AI_GURU_SCREENS[screen ?? ""] ?? { features: null };
}

export interface RouteGateContext {
  /** Signed in? Signed-out access is AuthGuard's job, so it passes here. */
  signedIn: boolean;
  roleResolved: boolean;
  isTester: boolean;
  /** featureFlags/* first snapshots have arrived for the current uid. */
  flagsResolved: boolean;
  /** appModules first snapshot has arrived for the current uid. */
  modulesResolved: boolean;
  modules: ModuleLike[];
  homeSection: (key: string) => boolean;
  aiGuru: (key: string) => boolean;
  drawerItem: (key: string) => boolean;
}

export interface RouteGateResult {
  state: RouteAccessState;
  blockedBy: RouteBlockReason | null;
}

const LOADING: RouteGateResult = { state: "loading", blockedBy: null };
const ALLOWED: RouteGateResult = { state: "allowed", blockedBy: null };

/**
 * Decide access for one screen. Order matters:
 *   1. role unresolved → loading (a tester must never be judged as a normal
 *      user while their users/{uid} snapshot is in flight)
 *   2. tester/admin → allowed (existing bypass, no flag data needed)
 *   3. flags/modules unresolved → loading (never fail open on missing data)
 *   4. group gate (module or entry points), then the AI Guru feature gate.
 */
export function evaluateRouteGate(
  spec: RouteGateSpec,
  ctx: RouteGateContext,
  aiGuruScreen?: AiGuruScreenSpec
): RouteGateResult {
  if (!ctx.signedIn) return ALLOWED;
  if (!ctx.roleResolved) return LOADING;
  if (ctx.isTester) return ALLOWED;
  if (!ctx.flagsResolved) return LOADING;
  if (spec.kind === "module" && !ctx.modulesResolved) return LOADING;

  const via = aiGuruScreen?.alsoReachableVia;
  const viaAllowed =
    (via?.aiGuru ?? []).some((k) => ctx.aiGuru(k)) ||
    (via?.homeSection ?? []).some((k) => ctx.homeSection(k));

  if (spec.kind === "module") {
    const moduleAllowed = isModuleRouteAllowed({
      isTester: false,
      modules: ctx.modules,
      moduleKey: spec.moduleKey,
      extraAllowed: (!!spec.homeSectionKey && ctx.homeSection(spec.homeSectionKey)) || viaAllowed,
    });
    if (!moduleAllowed) return { state: "blocked", blockedBy: "module" };
  } else {
    const entryAllowed =
      (spec.drawerItemKeys ?? []).some((k) => ctx.drawerItem(k)) ||
      (spec.homeSectionKeys ?? []).some((k) => ctx.homeSection(k));
    if (!entryAllowed) return { state: "blocked", blockedBy: "entry" };
  }

  const features = aiGuruScreen?.features;
  if (features != null) {
    const featureAllowed = isAiGuruRouteAllowed({
      isTester: false,
      aiGuru: ctx.aiGuru,
      featureKeys: typeof features === "string" ? features : [...features],
    });
    if (!featureAllowed) return { state: "blocked", blockedBy: "feature" };
  }

  return ALLOWED;
}

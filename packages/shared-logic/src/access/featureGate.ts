// packages/shared-logic/src/access/featureGate.ts
//
// Central allow/deny decisions for direct route access to a Learn/
// Challenge module or an AI Guru feature — used by apps/mobile's and
// apps/web's per-platform useModuleGate()/useAiGuruFeatureGate() hooks
// (each app wraps these pure functions with its own router for the
// redirect side effect; the decision logic itself lives here once so it
// isn't duplicated per platform).
//
// Hiding a menu item is not the same as protecting the destination it
// points to — these functions are the second half of that: they get
// called again, at the destination, instead of trusting that reaching
// the screen at all means Admin allows it.

export interface ModuleLike {
  id: string;
  isEnabled?: boolean;
}

/**
 * Same default every list screen already uses (learn.tsx/challenge.tsx/
 * their web mirrors): a module with no appModules/{id} doc yet stays
 * available — only an explicit isEnabled:false blocks it.
 */
export function isModuleConfigEnabled(modules: ModuleLike[], moduleKey: string): boolean {
  return modules.find((m) => m.id === moduleKey)?.isEnabled !== false;
}

/**
 * Allow/deny a Learn/Challenge destination route.
 *
 * `extraAllowed` covers routes also reachable through a *different*,
 * independently-configured entry point that's still enabled — e.g. Home's
 * "aiguru" banner and Learn's "ai-guru" module card both open /ai-guru;
 * VidyaStar has both a Challenge module card and a Home "vidya_star"
 * preview. Disabling one of those entry points must not block a route the
 * other, still-enabled entry point legitimately links to — so the caller
 * ORs in whatever other flag(s) also govern that same destination before
 * calling this.
 */
export function isModuleRouteAllowed(opts: {
  isTester: boolean;
  modules: ModuleLike[];
  moduleKey: string;
  extraAllowed?: boolean;
}): boolean {
  if (opts.isTester) return true;
  if (opts.extraAllowed) return true;
  return isModuleConfigEnabled(opts.modules, opts.moduleKey);
}

/**
 * Allow/deny an AI Guru feature route. `featureKeys` accepts one or more
 * featureFlags/aiGuru keys — several screens are shared by more than one
 * menu card (e.g. ai-guru/my-lessons.tsx serves my_lessons, revision_reels
 * and practice_tests; ai-guru/player.tsx is reached from the generate,
 * dashboard and my_lessons flows) — allowed if ANY resolves true, same
 * "don't block a route another enabled entry point still links to"
 * reasoning as isModuleRouteAllowed above.
 *
 * `extraAllowed` mirrors isModuleRouteAllowed's: a route also reachable
 * through an independently-configured entry point that's still enabled
 * (e.g. /discover: aiGuru.discover OR homeSection.discover_preview) is
 * allowed while that other entry point is ON. Omitted = unchanged behavior.
 */
export function isAiGuruRouteAllowed(opts: {
  isTester: boolean;
  aiGuru: (key: string) => boolean;
  featureKeys: string | string[];
  extraAllowed?: boolean;
}): boolean {
  if (opts.isTester) return true;
  if (opts.extraAllowed) return true;
  const keys = Array.isArray(opts.featureKeys) ? opts.featureKeys : [opts.featureKeys];
  if (keys.length === 0) return true;
  return keys.some((k) => opts.aiGuru(k));
}

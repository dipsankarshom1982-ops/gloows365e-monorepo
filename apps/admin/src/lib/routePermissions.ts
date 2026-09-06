// PATH: apps/admin/src/lib/routePermissions.ts
//
// Moderator Authorization audit, Phase 4 — route-level access resolution
// for main.tsx's ProtectedRoutes. Hiding a sidebar link was never a
// security boundary by itself: any authenticated admin/moderator (anyone
// passing ProtectedRoutes' `isAdmin || isSuperAdmin` check) could
// otherwise reach ANY route's page component by typing its URL directly,
// regardless of what NAV_GROUPS said should be visible to them. This file
// is the single place that answers "how is this URL classified, and what
// (if anything) does it require" — main.tsx's ProtectedRoutes calls it
// once, centrally, instead of every page needing its own guard.
//
// FAIL-CLOSED, Phase 4 corrective follow-up: the first version of this
// file resolved an unrecognized path to `null` and let ProtectedRoutes
// treat that as "render anyway" — safe ONLY because, at the time, every
// real page in main.tsx happened to also have a NAV_GROUPS entry. That
// was a default-ALLOW resting on an invariant nothing enforced: a future
// `<Route path="/new-sensitive-page" .../>` added to main.tsx without a
// matching entry here would have rendered completely unguarded. This
// version makes the classification explicit and the default DENY:
// resolveRouteAccess returns null for anything not explicitly registered
// below, and main.tsx now treats null as "Access Denied," never as
// "allow." A route must be positively recognized before it can render —
// forgetting to register one now makes it INACCESSIBLE, not unprotected.
//
// ─── Route classification model ─────────────────────────────────────────
//   PUBLIC        — reachable without authentication. Not represented as
//                    entries in this file at all: main.tsx's top-level
//                    <Routes> already splits "/login" (public) from "/*"
//                    (-> ProtectedRoutes) BEFORE any pathname ever reaches
//                    this module — a path handled here has, by
//                    construction, already passed that split. Recorded
//                    here only as documentation of the full model; see
//                    this commit's report for the complete route
//                    inventory including /login.
//   AUTHENTICATED — reachable by any authenticated admin/moderator/
//                    superAdmin who already passed ProtectedRoutes'
//                    isAdmin/isSuperAdmin check, with no further
//                    permission required. AUTHENTICATED_SAFE_PATHS below
//                    is currently EMPTY — every route in this app today
//                    maps to an explicit permission (this was already
//                    true of NAV_GROUPS before this file existed; see the
//                    Dashboard discussion in this commit's report for why
//                    "/" is deliberately kept PERMISSION, not moved here).
//                    The category exists so a future genuinely-permission-
//                    free page (e.g. a shared "About" screen) has an
//                    explicit, intentional home instead of being silently
//                    permission-gated or silently unguarded.
//   PERMISSION    — reachable only if the caller's resolved role/
//                    permission set grants the specific permKey.
//                    Populated from NAV_GROUPS below; this is where every
//                    real route in this app is classified today.
//   (unclassified) — resolveRouteAccess returns null. Denied by
//                    main.tsx's ProtectedRoutes unconditionally, with no
//                    exception. This is the fail-closed default.

import { NAV_GROUPS } from "./navigation";
import { hasPermission } from "./permissions";

export type RouteAccessKind = "authenticated" | "permission";

export interface RouteAccessRule {
  path: string;
  kind: RouteAccessKind;
  /** Present, and required to be granted, only when kind === "permission". */
  permKey?: string;
}

// Explicit allowlist of routes reachable by any authenticated admin-panel
// user with no specific permission — see the AUTHENTICATED category note
// above for why this is empty today, not a placeholder oversight.
const AUTHENTICATED_SAFE_PATHS: string[] = [];

const PERMISSION_RULES: RouteAccessRule[] = NAV_GROUPS.flatMap((group) =>
  group.items.map(({ path, permKey }): RouteAccessRule => ({ path, kind: "permission", permKey }))
);

const AUTHENTICATED_RULES: RouteAccessRule[] = AUTHENTICATED_SAFE_PATHS.map(
  (path): RouteAccessRule => ({ path, kind: "authenticated" })
);

// Longest path first, so a more specific listed route (e.g. "/ads/new")
// is checked before a shorter parent one ("/ads") for exact-match
// purposes, and so sub-routes that aren't individually listed (e.g. a
// dynamic "/ads/:id" — NAV_GROUPS only lists the static "/ads/new") still
// correctly fall through to their nearest listed ancestor's rule via
// prefix matching below.
const ALL_RULES: RouteAccessRule[] = [...PERMISSION_RULES, ...AUTHENTICATED_RULES].sort(
  (a, b) => b.path.length - a.path.length
);

function matchesPath(rulePath: string, pathname: string): boolean {
  if (rulePath === "/") return pathname === "/";
  return pathname === rulePath || pathname.startsWith(`${rulePath}/`);
}

/**
 * resolveRouteAccess — the ONLY function that decides how a pathname
 * within ProtectedRoutes' space is classified, using the exact same
 * matching rule Layout.tsx's own isActive() already uses for nav
 * highlighting (root path is exact-match only; everything else is
 * exact-match OR "starts with path + /"), so a route and its nav entry
 * are always judged as the same route.
 *
 * Returns null for any pathname that matches no explicitly registered
 * rule — the fail-closed default. main.tsx's ProtectedRoutes treats this
 * as Access Denied, never as "allow." This deliberately covers BOTH a
 * genuinely nonexistent URL (a typo, an old bookmark) AND a real page
 * registered in main.tsx's <Routes> that a developer forgot to add here —
 * from this function's perspective they are indistinguishable, and both
 * must default to denied; there is no way to be safe otherwise, since the
 * whole point is this file cannot know what main.tsx might someday
 * contain that it doesn't already know about.
 *
 * Accepts an optional `rules` override so this exact matching algorithm
 * can be unit-tested against a small synthetic registry, independent of
 * whatever NAV_GROUPS happens to contain today — see
 * lib/__tests__/routePermissions.test.ts.
 */
export function resolveRouteAccess(pathname: string, rules: RouteAccessRule[] = ALL_RULES): RouteAccessRule | null {
  const sorted = rules === ALL_RULES ? rules : [...rules].sort((a, b) => b.path.length - a.path.length);
  for (const rule of sorted) {
    if (matchesPath(rule.path, pathname)) return rule;
  }
  return null;
}

/**
 * isRouteAllowed — the single, pure, testable function that decides the
 * FULL allow/deny outcome for a pathname (given the caller already passed
 * ProtectedRoutes' earlier `user` / `isAdmin || isSuperAdmin` checks —
 * this function is only ever consulted after that). main.tsx's
 * ProtectedRoutes calls this directly, so there is no separate,
 * hand-written copy of this decision that could drift from what this
 * file's tests actually exercise.
 *
 * Always returns a plain boolean — there is no path through this
 * function that produces a redirect target, which is what makes a
 * redirect loop structurally impossible for anything gated by it: the
 * caller (ProtectedRoutes) either renders the route or renders
 * PermissionDenied in place, never <Navigate>.
 *
 * Decision order:
 *   1. No registered rule for this path at all -> false, unconditionally,
 *      superAdmin included. Fail-closed default: an unrecognized route
 *      (whether truly nonexistent, or a real page a developer forgot to
 *      register here) is never rendered.
 *   2. kind "authenticated" -> true. Any authenticated admin-panel user
 *      who reached this point already passed the isAdmin/isSuperAdmin
 *      check one layer up in ProtectedRoutes.
 *   3. kind "permission", but `permissions` isn't a usable array
 *      (defensive — AuthContext already normalizes it, never trusted a
 *      second time) -> superAdmin still bypasses (their access was never
 *      supposed to depend on this array in the first place), any other
 *      caller is denied.
 *   4. kind "permission", permissions usable -> delegates to
 *      hasPermission(isSuperAdmin, permissions, permKey) — the exact same
 *      function Layout.tsx's sidebar filter already uses, so a route's
 *      accessibility and its nav entry's visibility are always the same
 *      answer.
 */
export function isRouteAllowed(
  pathname: string,
  isSuperAdmin: boolean,
  permissions: unknown,
  rules: RouteAccessRule[] = ALL_RULES
): boolean {
  const access = resolveRouteAccess(pathname, rules);
  if (!access) return false;
  if (access.kind === "authenticated") return true;
  if (!Array.isArray(permissions)) return isSuperAdmin;
  return hasPermission(isSuperAdmin, permissions as string[], access.permKey!);
}

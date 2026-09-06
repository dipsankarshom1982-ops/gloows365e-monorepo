// PATH: apps/admin/src/lib/routePermissions.ts
//
// Moderator Authorization audit, Phase 4 — route-level permission
// resolution for main.tsx's ProtectedRoutes. Hiding a sidebar link was
// never a security boundary by itself: before this file existed, any
// authenticated admin/moderator (anyone passing ProtectedRoutes' existing
// `isAdmin || isSuperAdmin` check) could reach ANY route's page component
// by typing its URL directly, regardless of what NAV_GROUPS said should
// be visible to them. This file is the single place that answers "what
// permission key does this URL require" — main.tsx's ProtectedRoutes
// calls it once, centrally, instead of every page needing its own guard.
//
// SINGLE SOURCE OF TRUTH: derived from lib/navigation.ts's NAV_GROUPS —
// the exact same data Layout.tsx's sidebar uses to decide visibility
// (hasPermission(isSuperAdmin, permissions, permKey)) is what the router
// uses here to decide access. Adding a nav item already requires picking
// its permKey; this file makes that same choice also govern direct-URL
// access, with nothing new to keep in sync. (NAV_GROUPS lives in its own
// dependency-free module rather than being imported from Layout.tsx
// itself specifically so this file — and its tests — never pull in that
// component's React/Firebase dependency chain; see navigation.ts's
// header.)

import { NAV_GROUPS } from "./navigation";

interface RoutePermEntry {
  path: string;
  permKey: string;
}

const ROUTE_PERMISSIONS: RoutePermEntry[] = NAV_GROUPS.flatMap((group) =>
  group.items.map(({ path, permKey }) => ({ path, permKey }))
);

// Longest path first, so a more specific listed route (e.g. "/ads/new")
// is checked before a shorter parent one ("/ads") for exact-match
// purposes, and so sub-routes that aren't individually listed (e.g. a
// dynamic "/ads/:id" — NAV_GROUPS only lists the static "/ads/new") still
// correctly fall through to their nearest listed ancestor's permKey via
// prefix matching below.
const SORTED_ROUTE_PERMISSIONS = [...ROUTE_PERMISSIONS].sort((a, b) => b.path.length - a.path.length);

/**
 * Resolves the permission key required to view a given pathname, using
 * the exact same matching rule Layout.tsx's own isActive() already uses
 * for nav highlighting (root path is exact-match only; everything else is
 * exact-match OR "starts with path + /"), so a route and its nav entry
 * are always judged as the same route.
 *
 * Returns null when no listed route matches at all — this is NOT a
 * fail-open gap: every real protected page in main.tsx corresponds to a
 * NAV_GROUPS entry (verified against the full route list as of this
 * commit), so null only ever occurs for a URL matching nothing router-
 * side either, which resolves to main.tsx's own catch-all
 * (`<Route path="*" element={<Navigate to="/" replace />} />`) —
 * a redirect, never a protected page's content. ProtectedRoutes still
 * treats null as "let it fall through to render <Routes>", which is safe
 * for exactly that reason. If a future route is added to main.tsx without
 * a corresponding NAV_GROUPS entry, it will ALSO resolve to null here and
 * therefore render without a permission check — this is a deliberate
 * trade-off documented in this commit's report, not an oversight; closing
 * it completely would require main.tsx's route table itself to be
 * generated from this same list, which is a larger refactor out of scope
 * for this commit.
 */
export function getRequiredPermissionForPath(pathname: string): string | null {
  for (const { path, permKey } of SORTED_ROUTE_PERMISSIONS) {
    if (path === "/") {
      if (pathname === "/") return permKey;
      continue;
    }
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      return permKey;
    }
  }
  return null;
}

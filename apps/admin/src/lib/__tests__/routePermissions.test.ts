// PATH: apps/admin/src/lib/__tests__/routePermissions.test.ts
//
// Moderator Authorization audit, Phase 4 (corrective follow-up) — tests
// for lib/routePermissions.ts's resolveRouteAccess and isRouteAllowed,
// and (since isRouteAllowed's "permission" branch delegates to it) for
// lib/permissions.ts's hasPermission as used from that exact call site.
//
// IMPORTANT — why this is a plain Node script, not a vitest/jest suite:
// apps/admin has NO test framework configured today (no vitest, no jest,
// no @testing-library/react — confirmed by inspecting package.json and
// pnpm-lock.yaml before writing this). Introducing one is out of scope
// for this security-focused commit: it would mean adding a new
// devDependency and re-resolving pnpm-lock.yaml, which is itself an
// UNMODIFIED, currently-pending file in the real working tree this task
// must not touch or risk diverging (see this commit's report). This file
// is therefore a framework-free, immediately-executable substitute using
// a tiny inline assertion helper (no @types/node either, for the same
// reason) — real, run-right-now evidence rather than a suite that would
// need new infrastructure to ever execute. Both functions under test
// source their data from lib/navigation.ts (a dependency-free module, not
// Layout.tsx directly) specifically so this file bundles and runs without
// pulling in React/Firebase — see navigation.ts's header.
//
// Run it with (from apps/admin/):
//   npx esbuild src/lib/__tests__/routePermissions.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/rp-test.cjs && node /tmp/rp-test.cjs
//
// LIMITATION, stated plainly: this exercises the actual decision
// functions the route guard is built on (resolveRouteAccess,
// isRouteAllowed, hasPermission) with every scenario this task's test
// matrix requires at the LOGIC level — including now testing
// isRouteAllowed directly, which is the EXACT function main.tsx's
// ProtectedRoutes calls (not a hand-written equivalent that could drift).
// It does not render <ProtectedRoutes> itself or assert on DOM output /
// redirect timing — apps/admin has no React-rendering test harness
// (jsdom + @testing-library/react) to do that with, and adding one is the
// same out-of-scope infrastructure decision as above. What CAN be, and
// is, verified directly: isRouteAllowed's type signature only ever
// returns a boolean — there is no code path in it (or in main.tsx's use
// of it) that produces a redirect target, which is what makes a redirect
// loop structurally impossible for anything gated by it. The "redirect
// safety" tests below confirm the decision function's behavior on the
// specific sequence this task asks about (unauthorized -> denied ->
// landing on a route that itself must not ALSO cascade into denial).

import { resolveRouteAccess, isRouteAllowed, RouteAccessRule } from "../routePermissions";
import { hasPermission } from "../permissions";

// Self-contained assertion helper (no @types/node / node:assert — this
// app has no Node type dependency today, and none is worth adding just
// for a standalone verification script) — deep-equal via JSON.stringify
// is sufficient for the plain string/boolean/null values every assertion
// below compares.
const assert = {
  equal(actual: unknown, expected: unknown, msg?: string) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(msg ?? `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  },
};

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (e) {
    console.error(`  FAIL - ${name}`);
    throw e;
  }
}

console.log("resolveRouteAccess (route classification)");

test("dashboard (root) resolves via exact match, kind 'permission'", () => {
  assert.equal(resolveRouteAccess("/"), { path: "/", kind: "permission", permKey: "dashboard" });
});

test("a leaf route not itself listed but sharing a listed prefix resolves via boundary-aware prefix match", () => {
  // "/ads/some-dynamic-id" is never literally in NAV_GROUPS (only "/ads"
  // and the static "/ads/new" are) — this is the dynamic ":id" route.
  assert.equal(resolveRouteAccess("/ads/some-dynamic-id")?.permKey, "ads");
});

test("a literal listed sub-route matches exactly", () => {
  assert.equal(resolveRouteAccess("/ads/new")?.permKey, "ads");
});

test("deeply nested dynamic routes resolve to their listed ancestor", () => {
  assert.equal(resolveRouteAccess("/courses/abc123/lessons")?.permKey, "courses");
  assert.equal(resolveRouteAccess("/quizzes/xyz/questions")?.permKey, "quizzes");
});

test("the direct URL test case from this task: /refunds resolves to the 'refunds' permission", () => {
  assert.equal(resolveRouteAccess("/refunds")?.permKey, "refunds");
});

test("/admins resolves to the 'admins' permission (superAdmin-only per hasPermission's hardcode)", () => {
  assert.equal(resolveRouteAccess("/admins")?.permKey, "admins");
});

test("a route not sharing a real path-segment boundary with a listed route does NOT false-positive match", () => {
  // "/adsfoo" must not match "/ads" just because the string starts with
  // "/ads" — the guard only matches on "/ads" exactly or "/ads/...".
  assert.equal(resolveRouteAccess("/adsfoo"), null);
});

test("REQUIRED (this task): an entirely unregistered route resolves to null (UNKNOWN), never a permission-free pass", () => {
  assert.equal(resolveRouteAccess("/new-unregistered-admin-route"), null);
  assert.equal(resolveRouteAccess("/this-route-does-not-exist"), null);
});

console.log("isRouteAllowed (the exact function ProtectedRoutes calls — full allow/deny decision)");

test("REQUIRED: unknown route is DENIED, even for a superAdmin — nothing to bypass into", () => {
  assert.equal(isRouteAllowed("/new-unregistered-admin-route", false, ["all"]), false);
  assert.equal(isRouteAllowed("/new-unregistered-admin-route", true, ["all"]), false);
});

test("Direct URL test case: moderator manually navigating to /refunds is blocked", () => {
  assert.equal(isRouteAllowed("/refunds", false, ["students", "banners"]), false);
});

test("known permission route: admin WITH the required permission is allowed", () => {
  assert.equal(isRouteAllowed("/students", false, ["students", "banners"]), true);
});

test("known permission route: admin WITHOUT the required permission is denied", () => {
  assert.equal(isRouteAllowed("/coupons", false, ["students", "banners"]), false);
});

test("moderator with an explicitly-granted permission is allowed on that route", () => {
  assert.equal(isRouteAllowed("/data-rights", false, ["data-rights"]), true);
});

test("moderator without that permission is denied on a different route", () => {
  assert.equal(isRouteAllowed("/grievances", false, ["data-rights"]), false);
});

test("superAdmin is allowed on any KNOWN route regardless of their permissions array content", () => {
  assert.equal(isRouteAllowed("/refunds", true, []), true);
  assert.equal(isRouteAllowed("/admins", true, []), true);
  assert.equal(isRouteAllowed("/payments", true, ["irrelevant"]), true);
});

test("fail-closed: an empty permissions array (e.g. AuthContext defaulted after a failed Firestore read) denies every non-superAdmin known route", () => {
  assert.equal(isRouteAllowed("/", false, []), false);
  assert.equal(isRouteAllowed("/students", false, []), false);
});

test("fail-closed: a malformed (non-array) permissions value denies a non-superAdmin but does not affect superAdmin", () => {
  assert.equal(isRouteAllowed("/students", false, undefined), false);
  assert.equal(isRouteAllowed("/students", false, "not-an-array" as unknown), false);
  assert.equal(isRouteAllowed("/students", true, undefined), true);
});

test("the 'all' wildcard grants known permission routes to a non-superAdmin, except the hardcoded admins/refunds/payments exclusions", () => {
  assert.equal(isRouteAllowed("/students", false, ["all"]), true);
  assert.equal(isRouteAllowed("/admins", false, ["all"]), false);
  assert.equal(isRouteAllowed("/refunds", false, ["all"]), false);
});

console.log("kind 'authenticated' (synthetic — no real route uses this today; proves the mechanism, not today's data)");

test("known SAFE route (kind 'authenticated') is allowed for any authenticated caller, no permission needed", () => {
  const syntheticRules: RouteAccessRule[] = [{ path: "/about", kind: "authenticated" }];
  assert.equal(isRouteAllowed("/about", false, [], syntheticRules), true);
  assert.equal(isRouteAllowed("/about", false, undefined, syntheticRules), true); // even with malformed permissions
  assert.equal(isRouteAllowed("/about", true, [], syntheticRules), true);
});

test("a path NOT in the synthetic registry is still denied even though the registry is non-empty", () => {
  const syntheticRules: RouteAccessRule[] = [{ path: "/about", kind: "authenticated" }];
  assert.equal(isRouteAllowed("/somewhere-else", false, ["all"], syntheticRules), false);
});

console.log("redirect safety");

test("REQUIRED: the denial outcome is a plain boolean, never a navigable target — a denied route can never itself trigger further navigation", () => {
  // This is the structural guarantee main.tsx relies on: isRouteAllowed
  // returning `false` causes PermissionDenied to render IN PLACE (see
  // main.tsx), not a <Navigate>. Asserting the return type/values here
  // (never an object, never a path string) is the closest this
  // no-React-harness test suite can get to proving "no redirect loop is
  // possible" — there is no code path that hands back a location to
  // navigate to in the first place.
  const result = isRouteAllowed("/refunds", false, []);
  assert.equal(typeof result, "boolean");
});

test("REQUIRED: an unauthorized attempt on one route followed by landing on another registered route the caller DOES have works without cascading denial", () => {
  // Simulates: moderator denied on /refunds, then legitimately navigates
  // to /students (a route they DO have permission for) — the second
  // check must be independent and must not inherit the first's denial.
  const moderatorPerms = ["students"];
  assert.equal(isRouteAllowed("/refunds", false, moderatorPerms), false);
  assert.equal(isRouteAllowed("/students", false, moderatorPerms), true);
});

console.log(`\n${passed} assertions passed.`);

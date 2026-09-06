// PATH: apps/admin/src/lib/__tests__/routePermissions.test.ts
//
// Moderator Authorization audit, Phase 4 — tests for
// lib/routePermissions.ts's getRequiredPermissionForPath, and (since the
// route guard's actual allow/deny decision is
// `can(requiredPermission)` == `hasPermission(isSuperAdmin, permissions,
// requiredPermission)`) for lib/permissions.ts's hasPermission as used
// from that exact call site.
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
// need new infrastructure to ever execute. getRequiredPermissionForPath
// sources its data from lib/navigation.ts (a dependency-free module, not
// Layout.tsx directly) specifically so this file bundles and runs without
// pulling in React/Firebase — see navigation.ts's header.
//
// Run it with (from apps/admin/):
//   npx esbuild src/lib/__tests__/routePermissions.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/rp-test.cjs && node /tmp/rp-test.cjs
//
// LIMITATION, stated plainly: this exercises the two pure decision
// functions the route guard is built on (getRequiredPermissionForPath,
// hasPermission) with every scenario the audit's test matrix requires at
// the LOGIC level. It does not render <ProtectedRoutes> itself or assert
// on DOM output / redirect timing — apps/admin has no React-rendering
// test harness (jsdom + @testing-library/react) to do that with, and
// adding one is the same out-of-scope infrastructure decision as above.
// ProtectedRoutes' actual branching (documented in main.tsx) is a thin,
// directly-readable composition of exactly these two functions plus the
// existing, already-shipped isAdmin/isSuperAdmin/loading checks — this
// file is the strongest verification practical without new tooling.

import { getRequiredPermissionForPath } from "../routePermissions";
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

console.log("getRequiredPermissionForPath");

test("dashboard (root) resolves via exact match only", () => {
  assert.equal(getRequiredPermissionForPath("/"), "dashboard");
});

test("a leaf route not itself listed but sharing a listed prefix resolves via boundary-aware prefix match", () => {
  // "/ads/some-dynamic-id" is never literally in NAV_GROUPS (only "/ads"
  // and the static "/ads/new" are) — this is the dynamic ":id" route.
  assert.equal(getRequiredPermissionForPath("/ads/some-dynamic-id"), "ads");
});

test("a literal listed sub-route matches exactly", () => {
  assert.equal(getRequiredPermissionForPath("/ads/new"), "ads");
});

test("deeply nested dynamic routes resolve to their listed ancestor", () => {
  assert.equal(getRequiredPermissionForPath("/courses/abc123/lessons"), "courses");
  assert.equal(getRequiredPermissionForPath("/quizzes/xyz/questions"), "quizzes");
});

test("the direct URL test case from this task: /refunds resolves to the 'refunds' permission", () => {
  assert.equal(getRequiredPermissionForPath("/refunds"), "refunds");
});

test("/admins resolves to the 'admins' permission (superAdmin-only per hasPermission's hardcode)", () => {
  assert.equal(getRequiredPermissionForPath("/admins"), "admins");
});

test("a route not sharing a real path-segment boundary with a listed route does NOT false-positive match", () => {
  // "/adsfoo" must not match "/ads" just because the string starts with
  // "/ads" — the guard only matches on "/ads" exactly or "/ads/...".
  assert.equal(getRequiredPermissionForPath("/adsfoo"), null);
});

test("a completely unknown path resolves to null (falls through to main.tsx's catch-all redirect, never protected content)", () => {
  assert.equal(getRequiredPermissionForPath("/this-route-does-not-exist"), null);
});

console.log("hasPermission (the exact function ProtectedRoutes' can() calls)");

test("Direct URL test case: moderator manually navigating to /refunds is blocked", () => {
  // Moderator's default createAdmin-seeded permissions never include
  // "refunds" (in fact hasPermission hardcodes "refunds" to false for any
  // non-superAdmin regardless of their array — see that function).
  assert.equal(hasPermission(false, ["students", "banners"], "refunds"), false);
});

test("Admin WITH the required permission is allowed", () => {
  assert.equal(hasPermission(false, ["students", "banners"], "students"), true);
});

test("Admin WITHOUT the required permission is blocked", () => {
  assert.equal(hasPermission(false, ["students", "banners"], "coupons"), false);
});

test("Moderator with an explicitly-granted permission is allowed on that route", () => {
  assert.equal(hasPermission(false, ["data-rights"], "data-rights"), true);
});

test("Moderator without that permission is blocked on that route", () => {
  assert.equal(hasPermission(false, ["data-rights"], "grievances"), false);
});

test("SuperAdmin is allowed regardless of their permissions array content (explicit, centralized bypass)", () => {
  assert.equal(hasPermission(true, [], "refunds"), true);
  assert.equal(hasPermission(true, [], "admins"), true);
  assert.equal(hasPermission(true, ["irrelevant"], "payments"), true);
});

test("Fail-closed: an empty permissions array (e.g. AuthContext defaulted after a failed Firestore read) denies every non-superAdmin route", () => {
  assert.equal(hasPermission(false, [], "dashboard"), false);
  assert.equal(hasPermission(false, [], "students"), false);
});

test("Fail-closed: 'admins' and 'payments' are never granted to a non-superAdmin even if present in their array (defense against a malformed/tampered permissions doc)", () => {
  assert.equal(hasPermission(false, ["admins"], "admins"), false);
  assert.equal(hasPermission(false, ["payments"], "payments"), false);
});

test("the 'all' wildcard grants every ordinary route to a non-superAdmin except the hardcoded admins/refunds/payments exclusions", () => {
  assert.equal(hasPermission(false, ["all"], "students"), true);
  assert.equal(hasPermission(false, ["all"], "admins"), false);
});

console.log(`\n${passed} assertions passed.`);

// PATH: functions/src/authz.ts
//
// Moderator Authorization Architecture — PHASE 1 (shared authorization
// helper). See functions/src/adminRoles.ts for the claim foundation this
// consumes, and the 2026-09-06 Moderator Authorization Audit for the full
// architecture this implements.
//
// This module is the ONLY place in the codebase that decides "what
// privileged role does this caller have" and "is that role good enough
// for this operation." It does not itself change any existing function's
// behavior — Phase 1 explicitly excludes wiring any privileged Cloud
// Function to use it (that's a later, separately-reviewed commit). It
// exists now so that migration can start from a single, tested,
// centralized implementation instead of ~15 more copy-pasted
// `if (!context.auth?.token?.admin)` checks.
//
// ─── Trust model ─────────────────────────────────────────────────────────
// Every input this module reads comes from `auth.token` — the SERVER-
// VERIFIED Firebase ID token that firebase-functions has already validated
// before request.auth (v2) / context.auth (v1) is ever populated. Nothing
// here reads request.data / the callable's payload, and nothing here ever
// will: a client can send anything it wants in its payload, but it cannot
// forge a claim in its own verified ID token. This is the same trust
// boundary every existing `request.auth?.token?.admin` check in this
// codebase already relies on (adminManagement.ts, refunds.ts,
// tutorPayouts.ts, etc.) — this module only centralizes it, it does not
// change what's trusted.
//
// ─── Source-of-truth hierarchy ───────────────────────────────────────────
// (Full detail in adminRoles.ts's header; restated here because this is
// the file that actually acts on it.)
//   1. `auth.token.adminRole` (new claim, functions/src/adminRoles.ts) —
//      if present and valid, this is authoritative. Nothing else is
//      consulted.
//   2. Legacy `auth.token.superAdmin` / `auth.token.admin` booleans — used
//      ONLY when `adminRole` is absent (an account that predates the
//      backfill, or was deliberately excluded from it). See
//      resolvePrivilegedRole's doc comment below for the exact, audited
//      mapping — in particular, why a bare `admin: true` claim is NEVER
//      interpreted as "moderator."
//   3. `admins/{uid}` Firestore document (`role`, `permissions[]`) — NEVER
//      read here. It is descriptive/UI-only (see adminRoles.ts hierarchy
//      note #2) and must never become a second, unverified source of
//      server-side authorization truth.
//   4. Anything from the client request payload (request.data) — NEVER a
//      source of role information, under any circumstance.

import { HttpsError } from "firebase-functions/v2/https";
import type { AdminRole } from "./adminRoles";

/**
 * Structurally compatible with both firebase-functions v1's
 * `context.auth` and v2's `request.auth` — this codebase uses both APIs
 * (30 v1 onCall vs a handful of v2 onCall, see tutorAccounts.ts's header
 * comment), and this helper needs to work from either call site without
 * forcing a wholesale v1→v2 migration as a prerequisite.
 */
export interface AuthLike {
  uid: string;
  token: { [key: string]: unknown };
}

/**
 * resolvePrivilegedRole — given only a caller's verified auth/token,
 * returns the single AdminRole they hold, or null if they hold none.
 *
 * Resolution order:
 *   1. `token.adminRole` — if it is one of "superAdmin"/"admin"/
 *      "moderator", it wins outright. This is the only path that can ever
 *      resolve "moderator" — see point 3.
 *   2. Legacy fallback (adminRole absent — pre-backfill account):
 *        token.superAdmin === true -> "superAdmin"
 *          This boolean has ALWAYS been unambiguous in this codebase —
 *          adminManagement.ts's createAdmin only ever sets it for the
 *          superAdmin role, and every existing superAdmin-gated function
 *          (createAdmin, removeAdmin, createComboPlan, Payment
 *          Management's searchPaymentOrders/getPaymentDetail) already
 *          trusts it alone. Nothing changes here.
 *        token.admin === true -> "admin"
 *          Deliberately NEVER "moderator" (see point 3).
 *        neither -> null
 *   3. Why a bare `admin: true` claim never falls back to "moderator":
 *      this is the exact behavior the Phase 1 spec calls out — "must NOT
 *      silently interpret admin: true as meaning moderator unless that
 *      mapping is explicitly justified by existing data." It is not
 *      justified: today, EVERY admin-tier account (real admins AND
 *      moderators alike) carries the identical `{ admin: true }` claim
 *      (adminManagement.ts's createAdmin, Task 6 fix) — a bare admin:true
 *      claim with no adminRole yet backfilled is genuinely ambiguous
 *      between the two, and guessing wrong in either direction is unsafe:
 *      guessing "moderator" would suddenly and incorrectly lock a real
 *      admin out of admin-only operations the moment this helper starts
 *      being used; guessing "admin" (what this function actually does)
 *      preserves every existing legitimate admin's access unchanged and
 *      only asks callers who want to EXCLUDE moderators from an operation
 *      to wait for that account's adminRole to be backfilled (via
 *      adminRoles.ts's backfillAdminRoleClaims) before the exclusion can
 *      take effect for it. This is the documented, deliberate migration
 *      trade-off: zero regression risk for existing admins now, in
 *      exchange for moderator-narrowing only becoming fully effective
 *      account-by-account as the backfill runs.
 */
export function resolvePrivilegedRole(auth: AuthLike | null | undefined): AdminRole | null {
  if (!auth || !auth.token) return null;
  const token = auth.token;

  if (token.adminRole === "superAdmin" || token.adminRole === "admin" || token.adminRole === "moderator") {
    return token.adminRole as AdminRole;
  }

  if (token.superAdmin === true) return "superAdmin";
  if (token.admin === true) return "admin";

  return null;
}

/**
 * requireAdminRole — fail-closed authorization gate for privileged Cloud
 * Functions.
 *
 *   - Requires authentication: throws `unauthenticated` if `auth` is
 *     absent (mirrors every existing `if (!context.auth)` check).
 *   - Resolves the caller's role via resolvePrivilegedRole (never trusts
 *     anything else, per the trust model above).
 *   - Throws `permission-denied` unless that role is one of
 *     `allowedRoles` — this is the "support checking allowed roles"
 *     requirement: a caller passes the exact set of roles that may
 *     perform THIS operation (e.g. `["admin", "superAdmin"]` to exclude
 *     moderators from a money-moving function, or
 *     `["moderator", "admin", "superAdmin"]` for a content-review one).
 *   - Fails closed in every branch: no auth -> reject; no resolvable role
 *     -> reject; resolved role not in the allowed set -> reject. There is
 *     no code path in this function that returns normally without the
 *     caller's role being both resolved AND explicitly allowed.
 *   - Returns the resolved role on success, so a caller can log it or
 *     branch further without re-deriving it.
 *
 * NOT called by any existing Cloud Function yet (Phase 1 scope) — adding
 * call sites (and choosing each function's allowedRoles list) is the
 * explicitly-deferred next commit.
 */
export function requireAdminRole(auth: AuthLike | null | undefined, allowedRoles: AdminRole[]): AdminRole {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Login required.");
  }

  const role = resolvePrivilegedRole(auth);
  if (!role || !allowedRoles.includes(role)) {
    throw new HttpsError("permission-denied", "You do not have permission to perform this action.");
  }

  return role;
}

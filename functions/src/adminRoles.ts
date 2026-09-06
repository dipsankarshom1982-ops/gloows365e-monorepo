// PATH: functions/src/adminRoles.ts
//
// Moderator Authorization Architecture — PHASE 1 (role/claim foundation).
// Implements the "Recommended Architecture" from the 2026-09-06 Moderator
// Authorization Audit. This file is ADDITIVE ONLY: it introduces a new
// `adminRole` custom claim alongside the existing `admin`/`superAdmin`
// booleans (functions/src/adminManagement.ts's createAdmin/removeAdmin),
// and does not remove, replace, or stop honoring those booleans anywhere.
// No existing Cloud Function or Firestore rule is changed by this file.
//
// ─── Why a new claim, given `admin`/`superAdmin` already exist? ────────────
// The audit found that "moderator" has never had its own Firebase Auth
// claim: createAdmin grants a moderator the exact same `{ admin: true }`
// claim as a plain admin (see adminManagement.ts's Task 6 comment), so
// every `request.auth.token.admin == true` check in firestore.rules and
// ~15 Cloud Functions — including money-moving ones like processRefund —
// is currently unable to tell a moderator apart from a full admin. This
// file's `adminRole` claim is the piece that makes that distinction
// possible for the first time; functions/src/authz.ts (Phase 1, commit 2)
// is what actually reads it. Gating individual privileged functions on it
// is deliberately NOT done here — that's a separate, later commit
// (approved Phase 1 explicitly excludes it) so this can land, be reviewed,
// and be backfilled onto real accounts with zero behavior change first.
//
// ─── Source-of-truth hierarchy (see functions/src/authz.ts for where this
// is actually consumed) ──────────────────────────────────────────────────
//   1. Firebase custom claims (`adminRole`, and the legacy `admin`/
//      `superAdmin` booleans) — the ONLY inputs a server-side authorization
//      decision may use. These are set exclusively via
//      admin.auth().setCustomUserClaims() (this file, and
//      adminManagement.ts), never derived from anything a client sends.
//   2. `admins/{uid}` Firestore document (`role`, `permissions[]`) — purely
//      descriptive. It is what a superAdmin edits to express *intent*
//      ("this account should be a moderator"), and it is this file's
//      backfill mechanism's INPUT for computing what claim to set — but it
//      is never itself read at authorization time by any Cloud Function or
//      Firestore rule, and this file does not change that. Firestore
//      state and claim state can therefore disagree (e.g. immediately
//      after a superAdmin edits the Firestore doc but before the next
//      backfill run) — when they do, the CLAIM wins, always, because only
//      the claim is ever consulted for an actual authorization decision.
//   3. `admins/{uid}.permissions` — UI nav-visibility only (see
//      apps/admin/src/lib/permissions.ts's hasPermission). Never part of
//      the server-side authorization decision, today or after this file.
//   4. Legacy `admin: true` / `superAdmin: true` claims — kept fully
//      functional; see functions/src/authz.ts for exactly how they're
//      used as a fallback for accounts that haven't been backfilled yet.
//
// This file answers only "how do we compute and apply the new claim
// safely." "How do we use it to authorize a call" is authz.ts.

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

export type AdminRole = "superAdmin" | "admin" | "moderator";

export const ADMIN_ROLES: readonly AdminRole[] = ["superAdmin", "admin", "moderator"] as const;

function isAdminRole(value: unknown): value is AdminRole {
  return value === "superAdmin" || value === "admin" || value === "moderator";
}

/**
 * Pure function: maps the legacy `admins/{uid}.role` Firestore field to the
 * new `adminRole` claim value. No I/O, no side effects — unit-testable in
 * isolation, which is exactly what functions/src/__tests__/adminRoles.test.ts
 * exercises.
 *
 * Fails closed: `"removed"` (adminManagement.ts's removeAdmin sets this),
 * `undefined`/missing, and any value that isn't one of the three known
 * roles all map to `null` — no adminRole is ever granted for them. This
 * function never invents a privileged role that isn't an explicit,
 * currently-active Firestore record; the caller (backfillAdminRoleClaims
 * below) is responsible for treating `null` as "remove any existing
 * adminRole claim," not "leave it unset if already set" — see there.
 */
export function mapLegacyRoleToAdminRole(firestoreRole: string | undefined | null): AdminRole | null {
  if (isAdminRole(firestoreRole)) return firestoreRole;
  return null;
}

export interface AdminRoleBackfillEntry {
  uid: string;
  email?: string;
  previousAdminRole: AdminRole | null;
  computedAdminRole: AdminRole | null;
  changed: boolean;
  skippedReason?: string;
}

/**
 * Computes what backfillAdminRoleClaims would do for one already-fetched
 * (Firestore role, existing custom claims) pair, without performing any
 * write. Split out from the callable below specifically so the decision
 * logic — the part that must never accidentally escalate anyone — can be
 * unit-tested directly, the same way mapLegacyRoleToAdminRole is.
 */
export function computeAdminRoleBackfill(
  uid: string,
  firestoreRole: string | undefined | null,
  existingClaims: Record<string, unknown>,
  email?: string
): { entry: AdminRoleBackfillEntry; nextClaims: Record<string, unknown> } {
  const computedAdminRole = mapLegacyRoleToAdminRole(firestoreRole);
  const previousAdminRole = isAdminRole(existingClaims.adminRole) ? existingClaims.adminRole : null;
  const changed = previousAdminRole !== computedAdminRole;

  // ADDITIVE: every existing claim (admin, superAdmin, role — the tutor
  // claim namespace — anything else) is carried over untouched. This
  // function only ever adds, updates, or removes the single `adminRole`
  // key; it never has the ability to grant `admin`/`superAdmin` where they
  // didn't already exist, which is what "must not accidentally grant
  // additional privileges" (Phase 1 requirement) means in practice here.
  const nextClaims: Record<string, unknown> = { ...existingClaims };
  if (computedAdminRole) {
    nextClaims.adminRole = computedAdminRole;
  } else {
    // Firestore says "removed" / doc missing / unrecognized role — don't
    // leave a stale, now-unjustified adminRole claim behind either.
    delete nextClaims.adminRole;
  }

  return {
    entry: { uid, email, previousAdminRole, computedAdminRole, changed },
    nextClaims,
  };
}

/**
 * backfillAdminRoleClaims — the ONLY way `adminRole` ever gets set on a
 * real account. Requirements this satisfies (Phase 1 spec):
 *
 *   - "Must not run automatically against production users without
 *     explicit operator action": this is an onCall callable, invoked only
 *     when a superAdmin explicitly calls it — nothing in this codebase
 *     triggers it on a schedule, on user creation, or as a side effect of
 *     anything else. It is also dry-run by default (`dryRun` defaults to
 *     true) — a superAdmin must explicitly pass `dryRun: false` to write
 *     anything; the default invocation only reports what WOULD change.
 *   - "Idempotent": re-running it (with dryRun:false) after it has already
 *     run recomputes the same adminRole from the same Firestore data and
 *     writes the same claims again — `changed` is false on the second run
 *     unless the underlying Firestore `admins/{uid}.role` was edited in
 *     between, in which case that new edit is exactly what should be
 *     picked up. No run has any different effect than a single run,
 *     given unchanged inputs.
 *   - "Must not accidentally grant additional privileges": see
 *     computeAdminRoleBackfill's ADDITIVE comment above — `admin`/
 *     `superAdmin` booleans are always carried over unchanged, and
 *     `adminRole` is only ever computed from the account's OWN existing
 *     admins/{uid}.role, never elevated beyond it.
 *   - "Clearly document how existing accounts map to the new role
 *     structure": see mapLegacyRoleToAdminRole above — the entire mapping
 *     is that one small pure function.
 *
 * Does NOT call revokeRefreshTokens: unlike removeAdmin (which narrows
 * access and therefore needs the old token invalidated immediately), this
 * claim is purely additive and gates nothing yet (Phase 1 explicitly does
 * not wire any function to require it) — there is no privilege to race
 * against, so the new claim taking effect on the account's next natural
 * token refresh (same as any other setCustomUserClaims call in this
 * codebase, e.g. registerTutorAccount) is fine.
 */
export const backfillAdminRoleClaims = onCall(async (request) => {
  if (!request.auth?.token?.superAdmin) {
    throw new HttpsError("permission-denied", "Only superAdmins can run the admin-role backfill.");
  }

  const { dryRun = true, uids } = (request.data ?? {}) as { dryRun?: boolean; uids?: string[] };

  const db = admin.firestore();
  const auth = admin.auth();

  let targets: string[];
  if (uids && uids.length > 0) {
    targets = uids;
  } else {
    const snap = await db.collection("admins").get();
    targets = snap.docs.map((d) => d.id);
  }

  const results: AdminRoleBackfillEntry[] = [];

  for (const uid of targets) {
    try {
      const [adminDocSnap, userRecord] = await Promise.all([
        db.doc(`admins/${uid}`).get(),
        auth.getUser(uid).catch(() => null),
      ]);

      if (!userRecord) {
        results.push({
          uid, previousAdminRole: null, computedAdminRole: null, changed: false,
          skippedReason: "Firebase Auth user not found",
        });
        continue;
      }

      const firestoreRole = adminDocSnap.exists ? (adminDocSnap.data()?.role as string | undefined) : undefined;
      const existingClaims = (userRecord.customClaims ?? {}) as Record<string, unknown>;
      const { entry, nextClaims } = computeAdminRoleBackfill(uid, firestoreRole, existingClaims, userRecord.email);

      if (!dryRun && entry.changed) {
        await auth.setCustomUserClaims(uid, nextClaims);
      }

      results.push(entry);
    } catch (e: any) {
      results.push({
        uid, previousAdminRole: null, computedAdminRole: null, changed: false,
        skippedReason: e?.message ?? "unknown error",
      });
    }
  }

  const changedCount = results.filter((r) => r.changed).length;
  console.log(
    `${dryRun ? "🔍 (dry run) " : "✅ "}backfillAdminRoleClaims: processed=${results.length} ` +
    `${dryRun ? "would-change" : "changed"}=${changedCount} by=${request.auth.uid}`
  );

  return { dryRun, results };
});

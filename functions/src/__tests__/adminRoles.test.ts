// PATH: functions/src/__tests__/adminRoles.test.ts
//
// Offline unit tests for functions/src/adminRoles.ts — the Phase 1
// additive role/claim foundation from the 2026-09-06 Moderator
// Authorization Audit. Covers the pure mapping function, the
// (still-pure) per-account backfill decision function, and the
// superAdmin-gated, dry-run-by-default backfillAdminRoleClaims callable
// end to end against the same FakeFirestore/FakeAuth mocks the rest of
// this suite uses.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb, seedAuthUser, resetAuthUsers } from "./helpers/mockFirebaseAdmin";
import { mapLegacyRoleToAdminRole, computeAdminRoleBackfill } from "../adminRoles";

beforeEach(() => {
  fakeDb.reset();
  resetAuthUsers();
});

describe("mapLegacyRoleToAdminRole (pure mapping)", () => {
  test("maps existing superAdmin role", () => {
    expect(mapLegacyRoleToAdminRole("superAdmin")).toBe("superAdmin");
  });
  test("maps existing admin role", () => {
    expect(mapLegacyRoleToAdminRole("admin")).toBe("admin");
  });
  test("maps existing moderator role", () => {
    expect(mapLegacyRoleToAdminRole("moderator")).toBe("moderator");
  });
  test("maps a de-provisioned ('removed') account to null, not a privileged role", () => {
    expect(mapLegacyRoleToAdminRole("removed")).toBeNull();
  });
  test("maps a missing role (no admins/{uid} doc) to null", () => {
    expect(mapLegacyRoleToAdminRole(undefined)).toBeNull();
    expect(mapLegacyRoleToAdminRole(null)).toBeNull();
  });
  test("maps an unrecognized/garbage role value to null (fails closed)", () => {
    expect(mapLegacyRoleToAdminRole("superuser")).toBeNull();
    expect(mapLegacyRoleToAdminRole("")).toBeNull();
  });
});

describe("computeAdminRoleBackfill (per-account decision, still pure)", () => {
  test("computes moderator for a moderator account with no prior adminRole claim", () => {
    const { entry, nextClaims } = computeAdminRoleBackfill("mod_1", "moderator", { admin: true }, "mod@x.com");
    expect(entry).toMatchObject({ uid: "mod_1", previousAdminRole: null, computedAdminRole: "moderator", changed: true });
    // ADDITIVE: pre-existing admin:true claim is preserved untouched.
    expect(nextClaims).toEqual({ admin: true, adminRole: "moderator" });
  });

  test("computes admin for an admin account", () => {
    const { entry, nextClaims } = computeAdminRoleBackfill("admin_1", "admin", { admin: true });
    expect(entry.computedAdminRole).toBe("admin");
    expect(nextClaims).toEqual({ admin: true, adminRole: "admin" });
  });

  test("computes superAdmin for a superAdmin account and preserves both legacy booleans", () => {
    const { entry, nextClaims } = computeAdminRoleBackfill("super_1", "superAdmin", { admin: true, superAdmin: true });
    expect(entry.computedAdminRole).toBe("superAdmin");
    expect(nextClaims).toEqual({ admin: true, superAdmin: true, adminRole: "superAdmin" });
  });

  test("REQUIRED (Commit 6 final validation): an existing UNRELATED custom claim survives the backfill untouched", () => {
    // setCustomUserClaims() overwrites the ENTIRE claims object — the
    // whole point of computeAdminRoleBackfill spreading existingClaims
    // first is that anything this codebase (or a future feature) has put
    // on the token that has nothing to do with admin/moderator status
    // must come through unchanged. "tutorRoleLegacyMigration" here stands
    // in for any such unrelated claim.
    const { nextClaims } = computeAdminRoleBackfill(
      "admin_1", "admin",
      { admin: true, someUnrelatedFeatureFlag: true, tutorRoleLegacyMigration: "v2" }
    );
    expect(nextClaims).toEqual({
      admin: true,
      someUnrelatedFeatureFlag: true,
      tutorRoleLegacyMigration: "v2",
      adminRole: "admin",
    });
  });

  test("never accidentally grants admin/superAdmin: an account with NO existing admin claim stays claim-less except adminRole", () => {
    // Pathological input (shouldn't occur in practice — an admins/{uid}
    // doc with no matching claims at all) — the point is the function
    // must not invent admin:true just because a Firestore role string
    // exists. It only ever adds/updates the adminRole key itself.
    const { nextClaims } = computeAdminRoleBackfill("orphan_1", "admin", {});
    expect(nextClaims).toEqual({ adminRole: "admin" });
    expect(nextClaims.admin).toBeUndefined();
    expect(nextClaims.superAdmin).toBeUndefined();
  });

  test("is idempotent: computing again from the already-updated claims reports no change", () => {
    const first = computeAdminRoleBackfill("mod_1", "moderator", { admin: true });
    const second = computeAdminRoleBackfill("mod_1", "moderator", first.nextClaims);
    expect(second.entry.changed).toBe(false);
    expect(second.entry.previousAdminRole).toBe("moderator");
    expect(second.entry.computedAdminRole).toBe("moderator");
    expect(second.nextClaims).toEqual(first.nextClaims);
  });

  test("removes a stale adminRole claim when Firestore now says 'removed'", () => {
    const { entry, nextClaims } = computeAdminRoleBackfill("mod_1", "removed", { admin: true, adminRole: "moderator" });
    expect(entry).toMatchObject({ previousAdminRole: "moderator", computedAdminRole: null, changed: true });
    expect(nextClaims).toEqual({ admin: true });
    expect("adminRole" in nextClaims).toBe(false);
  });

  test("unrecognized Firestore role never resolves to a privileged adminRole", () => {
    const { entry } = computeAdminRoleBackfill("weird_1", "superuser", { admin: true });
    expect(entry.computedAdminRole).toBeNull();
  });
});

describe("backfillAdminRoleClaims (callable)", () => {
  const SUPERADMIN_REQUEST = (data: unknown) => ({ data, auth: { uid: "super_1", token: { admin: true, superAdmin: true } } });

  test("rejects a non-superAdmin caller (plain admin)", async () => {
    const { backfillAdminRoleClaims } = require("../adminRoles");
    await expect(
      backfillAdminRoleClaims.run({ data: {}, auth: { uid: "admin_1", token: { admin: true } } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("rejects an unauthenticated caller", async () => {
    const { backfillAdminRoleClaims } = require("../adminRoles");
    await expect(
      backfillAdminRoleClaims.run({ data: {}, auth: undefined })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("dry run (default) reports what would change but writes nothing", async () => {
    seedAuthUser("mod_1", "mod@x.com");
    fakeDb.seed("admins/mod_1", { role: "moderator" });
    const { backfillAdminRoleClaims } = require("../adminRoles");

    const result = await backfillAdminRoleClaims.run(SUPERADMIN_REQUEST({}));
    expect(result.dryRun).toBe(true);
    expect(result.results).toContainEqual(
      expect.objectContaining({ uid: "mod_1", computedAdminRole: "moderator", changed: true })
    );

    // No write actually happened — the account's claims are untouched.
    const admin = require("firebase-admin");
    const userAfter = await admin.auth().getUser("mod_1");
    expect(userAfter.customClaims ?? {}).toEqual({});
  });

  test("dryRun:false actually applies the computed claim, additively", async () => {
    seedAuthUser("mod_1", "mod@x.com", { admin: true });
    fakeDb.seed("admins/mod_1", { role: "moderator" });
    const { backfillAdminRoleClaims } = require("../adminRoles");

    const result = await backfillAdminRoleClaims.run(SUPERADMIN_REQUEST({ dryRun: false }));
    expect(result.results).toContainEqual(
      expect.objectContaining({ uid: "mod_1", changed: true })
    );

    const admin = require("firebase-admin");
    const userAfter = await admin.auth().getUser("mod_1");
    expect(userAfter.customClaims).toEqual({ admin: true, adminRole: "moderator" });
  });

  test("is idempotent end to end: running dryRun:false twice yields the same final claims and 'changed:false' the second time", async () => {
    seedAuthUser("admin_1", "a@x.com", { admin: true });
    fakeDb.seed("admins/admin_1", { role: "admin" });
    const { backfillAdminRoleClaims } = require("../adminRoles");

    await backfillAdminRoleClaims.run(SUPERADMIN_REQUEST({ dryRun: false }));
    const second = await backfillAdminRoleClaims.run(SUPERADMIN_REQUEST({ dryRun: false }));

    expect(second.results).toContainEqual(
      expect.objectContaining({ uid: "admin_1", previousAdminRole: "admin", computedAdminRole: "admin", changed: false })
    );
    const admin = require("firebase-admin");
    const userAfter = await admin.auth().getUser("admin_1");
    expect(userAfter.customClaims).toEqual({ admin: true, adminRole: "admin" });
  });

  test("a caller-supplied uids list restricts the backfill scope instead of scanning the whole admins collection", async () => {
    seedAuthUser("admin_1", "a@x.com", { admin: true });
    seedAuthUser("mod_1", "m@x.com", { admin: true });
    fakeDb.seed("admins/admin_1", { role: "admin" });
    fakeDb.seed("admins/mod_1", { role: "moderator" });
    const { backfillAdminRoleClaims } = require("../adminRoles");

    const result = await backfillAdminRoleClaims.run(SUPERADMIN_REQUEST({ uids: ["admin_1"] }));
    expect(result.results).toHaveLength(1);
    expect(result.results[0].uid).toBe("admin_1");
  });

  test("does not fail the whole batch when one uid has no matching Auth user", async () => {
    fakeDb.seed("admins/ghost_1", { role: "admin" });
    seedAuthUser("admin_1", "a@x.com", { admin: true });
    fakeDb.seed("admins/admin_1", { role: "admin" });
    const { backfillAdminRoleClaims } = require("../adminRoles");

    const result = await backfillAdminRoleClaims.run(SUPERADMIN_REQUEST({}));
    const ghost = result.results.find((r: any) => r.uid === "ghost_1");
    expect(ghost).toMatchObject({ computedAdminRole: null, changed: false });
    expect(ghost.skippedReason).toBeTruthy();
    const found = result.results.find((r: any) => r.uid === "admin_1");
    expect(found.computedAdminRole).toBe("admin");
  });
});

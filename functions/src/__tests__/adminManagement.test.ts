// PATH: functions/src/__tests__/adminManagement.test.ts
//
// Offline unit test for functions/src/adminManagement.ts's
// getUserSubscriptionHistory — specifically the bug found during the
// Payment Management investigation and fixed alongside it: the "main"
// (AI Guru) branch queried `subscriptions` by a `userId` field that
// doesn't exist on that collection (subscriptions/{uid} is keyed by uid,
// with no userId field ever written into the doc) — so that branch could
// never have returned a result before the fix. Same mocking approach as
// the rest of this test suite (real module, mocked firebase-admin via
// FakeFirestore, no emulator). Uses v2 onCall's .run(request) testing hook
// (single CallableRequest object), not v1's .run(data, context).

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "./helpers/mockFirebaseAdmin";

const ADMIN_REQUEST = (data: unknown) => ({ data, auth: { uid: "admin_1", token: { admin: true } } });

beforeEach(() => {
  fakeDb.reset();
});

describe("getUserSubscriptionHistory", () => {
  test("rejects a non-admin caller", async () => {
    const { getUserSubscriptionHistory } = require("../adminManagement");
    await expect(
      getUserSubscriptionHistory.run({ data: { userId: "student_1" }, auth: { uid: "student_1", token: {} } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("finds the main (AI Guru) subscription by direct doc lookup, not a broken userId query", async () => {
    fakeDb.seed("subscriptions/student_1", { status: "active", planId: "pro", cycle: "monthly", razorpayOrderId: "order_1" });
    const { getUserSubscriptionHistory } = require("../adminManagement");
    const result = await getUserSubscriptionHistory.run(ADMIN_REQUEST({ userId: "student_1" }));
    expect(result.subscriptions).toHaveLength(1);
    expect(result.subscriptions[0]).toMatchObject({ id: "student_1", source: "main", status: "active", planId: "pro" });
  });

  test("finds the seekho subscription (already worked before the fix — regression guard)", async () => {
    fakeDb.seed("seekho_subscriptions/student_1", { userId: "student_1", plan: "pro", classAccess: [6, 7, 8] });
    const { getUserSubscriptionHistory } = require("../adminManagement");
    const result = await getUserSubscriptionHistory.run(ADMIN_REQUEST({ userId: "student_1" }));
    expect(result.subscriptions).toHaveLength(1);
    expect(result.subscriptions[0]).toMatchObject({ id: "student_1", source: "seekho", plan: "pro" });
  });

  test("returns both when a user has an active subscription in each flow", async () => {
    fakeDb.seed("subscriptions/student_1", { status: "active", planId: "pro" });
    fakeDb.seed("seekho_subscriptions/student_1", { userId: "student_1", plan: "plus" });
    const { getUserSubscriptionHistory } = require("../adminManagement");
    const result = await getUserSubscriptionHistory.run(ADMIN_REQUEST({ userId: "student_1" }));
    expect(result.subscriptions.map((s: any) => s.source).sort()).toEqual(["main", "seekho"]);
  });

  test("returns an empty list for a user with no subscription in either flow", async () => {
    const { getUserSubscriptionHistory } = require("../adminManagement");
    const result = await getUserSubscriptionHistory.run(ADMIN_REQUEST({ userId: "student_nobody" }));
    expect(result.subscriptions).toEqual([]);
  });

  test("rejects a missing userId", async () => {
    const { getUserSubscriptionHistory } = require("../adminManagement");
    await expect(
      getUserSubscriptionHistory.run(ADMIN_REQUEST({}))
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });
});

// Moderator Authorization audit, Phase 3 — updateAdminPermissions replaces
// Admins.tsx's old direct `updateDoc(doc(db,"admins",uid),{permissions})`
// client write. Policy under test (verified against, not invented on top
// of, the existing UI/rules before this callable existed): only a
// superAdmin has ever been able to edit another account's permissions —
// see this function's own header comment in adminManagement.ts.
describe("updateAdminPermissions", () => {
  const SUPERADMIN = { uid: "super_1", token: { admin: true, superAdmin: true } };
  const call = (data: unknown, auth: unknown) =>
    require("../adminManagement").updateAdminPermissions.run({ data, auth });

  function seedTarget(uid: string, role: "admin" | "moderator" | "superAdmin" | "removed", permissions: string[] = []) {
    fakeDb.seed(`admins/${uid}`, { uid, email: `${uid}@x.com`, name: uid, role, permissions, isActive: role !== "removed" });
  }

  test("unauthenticated caller is rejected", async () => {
    await expect(call({ targetUid: "mod_1", permissions: ["students"] }, undefined))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("student is rejected", async () => {
    await expect(call({ targetUid: "mod_1", permissions: ["students"] }, { uid: "student_1", token: {} }))
      .rejects.toMatchObject({ code: "permission-denied" });
  });

  test("tutor is rejected", async () => {
    await expect(call({ targetUid: "mod_1", permissions: ["students"] }, { uid: "tutor_1", token: { role: "TUTOR" } }))
      .rejects.toMatchObject({ code: "permission-denied" });
  });

  test("moderator is rejected", async () => {
    await expect(call({ targetUid: "mod_1", permissions: ["students"] }, { uid: "mod_1", token: { admin: true, adminRole: "moderator" } }))
      .rejects.toMatchObject({ code: "permission-denied" });
  });

  test("an ordinary (non-super) admin is rejected — this ability has never existed for plain admins", async () => {
    seedTarget("mod_1", "moderator");
    await expect(call({ targetUid: "mod_1", permissions: ["students"] }, { uid: "admin_1", token: { admin: true } }))
      .rejects.toMatchObject({ code: "permission-denied" });
  });

  test("admin self-escalation attempt is rejected (an admin has no authority to call this at all, targeting themselves or anyone)", async () => {
    seedTarget("admin_1", "admin");
    await expect(call({ targetUid: "admin_1", permissions: ["admins", "payments"] }, { uid: "admin_1", token: { admin: true } }))
      .rejects.toMatchObject({ code: "permission-denied" });
  });

  test("a superAdmin cannot modify another superAdmin's permissions", async () => {
    seedTarget("super_2", "superAdmin", ["all"]);
    await expect(call({ targetUid: "super_2", permissions: ["students"] }, SUPERADMIN))
      .rejects.toMatchObject({ code: "permission-denied" });
    // Untouched — the rejected attempt must not have changed anything.
    expect(fakeDb.peek("admins/super_2")!.permissions).toEqual(["all"]);
  });

  test("a superAdmin cannot modify their own superAdmin permissions either", async () => {
    seedTarget("super_1", "superAdmin", ["all"]);
    await expect(call({ targetUid: "super_1", permissions: ["students"] }, SUPERADMIN))
      .rejects.toMatchObject({ code: "permission-denied" });
  });

  test("unknown permission is rejected", async () => {
    seedTarget("mod_1", "moderator");
    await expect(call({ targetUid: "mod_1", permissions: ["students", "delete-everything"] }, SUPERADMIN))
      .rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("the 'all' wildcard is rejected for a non-superAdmin target (would be a privilege-injection path)", async () => {
    seedTarget("mod_1", "moderator");
    await expect(call({ targetUid: "mod_1", permissions: ["all"] }, SUPERADMIN))
      .rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("malformed permissions (non-array) is rejected", async () => {
    seedTarget("mod_1", "moderator");
    await expect(call({ targetUid: "mod_1", permissions: "students" }, SUPERADMIN))
      .rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("malformed permission entries (non-string values) are rejected", async () => {
    seedTarget("mod_1", "moderator");
    await expect(call({ targetUid: "mod_1", permissions: ["students", 123, null] }, SUPERADMIN))
      .rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("duplicate permissions are normalized (de-duplicated), not rejected", async () => {
    seedTarget("mod_1", "moderator");
    const result = await call({ targetUid: "mod_1", permissions: ["students", "students", "banners"] }, SUPERADMIN);
    expect(result.permissions.sort()).toEqual(["banners", "students"]);
    expect((fakeDb.peek("admins/mod_1") as any).permissions.sort()).toEqual(["banners", "students"]);
  });

  test("target not found is rejected", async () => {
    await expect(call({ targetUid: "ghost_1", permissions: ["students"] }, SUPERADMIN))
      .rejects.toMatchObject({ code: "not-found" });
  });

  test("a removed admin's permissions cannot be edited", async () => {
    seedTarget("removed_1", "removed");
    await expect(call({ targetUid: "removed_1", permissions: ["students"] }, SUPERADMIN))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("authorized update: superAdmin sets a moderator's permissions — Allow", async () => {
    seedTarget("mod_1", "moderator", ["read"]);
    const result = await call({ targetUid: "mod_1", permissions: ["students", "banners"] }, SUPERADMIN);
    expect(result).toMatchObject({ targetUid: "mod_1", permissions: ["students", "banners"] });
    const stored = fakeDb.peek("admins/mod_1")!;
    expect(stored.permissions).toEqual(["students", "banners"]);
    expect(stored.permissionsUpdatedBy).toBe("super_1");
  });

  test("authorized update: superAdmin sets a plain admin's permissions — Allow", async () => {
    seedTarget("admin_2", "admin", ["read", "write"]);
    const result = await call({ targetUid: "admin_2", permissions: ["refunds"] }, SUPERADMIN);
    // "refunds" IS a valid nav-visibility key even though hasPermission()
    // hardcodes it to false for non-superAdmins client-side — this
    // callable validates against the allowlist of KNOWN keys, not against
    // what hasPermission() ultimately does with them; that hardcoded
    // exclusion is a separate, already-existing client-side UI decision.
    expect(result.permissions).toEqual(["refunds"]);
  });

  test("an empty permissions array is accepted (revokes all module access)", async () => {
    seedTarget("mod_1", "moderator", ["students", "banners"]);
    const result = await call({ targetUid: "mod_1", permissions: [] }, SUPERADMIN);
    expect(result.permissions).toEqual([]);
  });

  test("missing targetUid is rejected", async () => {
    await expect(call({ permissions: ["students"] }, SUPERADMIN)).rejects.toMatchObject({ code: "invalid-argument" });
  });
});

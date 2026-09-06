// PATH: functions/src/__tests__/authz.test.ts
//
// Offline unit tests for functions/src/authz.ts — the Phase 1 shared
// authorization helper from the 2026-09-06 Moderator Authorization Audit.
// No firebase-admin mocking needed: authz.ts only takes a type-only import
// from adminRoles.ts (erased at compile time) and otherwise depends on
// nothing but the verified auth/token object a caller hands it — exactly
// the trust boundary being tested here.

import { resolvePrivilegedRole, requireAdminRole, AuthLike } from "../authz";

const authWith = (token: Record<string, unknown>): AuthLike => ({ uid: "u1", token });

describe("resolvePrivilegedRole", () => {
  test("no auth at all -> null", () => {
    expect(resolvePrivilegedRole(undefined)).toBeNull();
    expect(resolvePrivilegedRole(null)).toBeNull();
  });

  test("authenticated student (no privileged claims at all) -> null", () => {
    expect(resolvePrivilegedRole(authWith({}))).toBeNull();
  });

  test("authenticated tutor (role claim is a DIFFERENT key, 'role', not 'adminRole') -> null", () => {
    expect(resolvePrivilegedRole(authWith({ role: "TUTOR" }))).toBeNull();
    expect(resolvePrivilegedRole(authWith({ role: "TEACHER" }))).toBeNull();
  });

  test("new adminRole claim is authoritative when present", () => {
    expect(resolvePrivilegedRole(authWith({ adminRole: "moderator" }))).toBe("moderator");
    expect(resolvePrivilegedRole(authWith({ adminRole: "admin" }))).toBe("admin");
    expect(resolvePrivilegedRole(authWith({ adminRole: "superAdmin" }))).toBe("superAdmin");
  });

  test("an unrecognized adminRole value is ignored, not trusted verbatim (fails closed, falls through to legacy)", () => {
    expect(resolvePrivilegedRole(authWith({ adminRole: "owner" }))).toBeNull();
    expect(resolvePrivilegedRole(authWith({ adminRole: "owner", admin: true }))).toBe("admin");
  });

  // Moderator Authorization audit, Commit 6 (final validation) — explicit
  // conflicting-claim and malformed-type coverage the earlier phases
  // implied but never asserted directly.
  test("REQUIRED: an explicit adminRole claim wins even when it conflicts with a legacy boolean on the SAME token", () => {
    // A backfilled moderator still carries their original admin:true
    // claim (backfillAdminRoleClaims is additive — see adminRoles.ts) —
    // the explicit adminRole must still win, resolving "moderator," not
    // the more-privileged-looking legacy boolean sitting alongside it.
    expect(resolvePrivilegedRole(authWith({ adminRole: "moderator", admin: true }))).toBe("moderator");
    // Same for a backfilled plain admin who also happens to carry the
    // (extremely unlikely, but not impossible) superAdmin boolean stale
    // from some other path — adminRole still wins outright.
    expect(resolvePrivilegedRole(authWith({ adminRole: "admin", admin: true, superAdmin: true }))).toBe("admin");
  });

  test("malformed adminRole VALUES (wrong type, not just wrong string) never resolve to a privileged role and fail safely to legacy/null", () => {
    expect(resolvePrivilegedRole(authWith({ adminRole: true, admin: true }))).toBe("admin");
    expect(resolvePrivilegedRole(authWith({ adminRole: {}, admin: true }))).toBe("admin");
    expect(resolvePrivilegedRole(authWith({ adminRole: null, admin: true }))).toBe("admin");
    expect(resolvePrivilegedRole(authWith({ adminRole: 1, admin: true }))).toBe("admin");
    expect(resolvePrivilegedRole(authWith({ adminRole: ["moderator"], admin: true }))).toBe("admin");
    // With no legacy boolean to fall back to either, all of these resolve
    // to null — never silently privileged.
    expect(resolvePrivilegedRole(authWith({ adminRole: true }))).toBeNull();
    expect(resolvePrivilegedRole(authWith({ adminRole: {} }))).toBeNull();
    expect(resolvePrivilegedRole(authWith({ adminRole: null }))).toBeNull();
  });

  describe("legacy fallback (no adminRole claim present — pre-backfill account)", () => {
    test("superAdmin:true resolves to 'superAdmin' — this boolean has always been unambiguous", () => {
      expect(resolvePrivilegedRole(authWith({ admin: true, superAdmin: true }))).toBe("superAdmin");
    });

    test("bare admin:true resolves to 'admin' — NEVER 'moderator'", () => {
      // This is the specific behavior the Phase 1 spec calls out: a plain
      // admin:true claim must not be silently interpreted as moderator.
      expect(resolvePrivilegedRole(authWith({ admin: true }))).toBe("admin");
    });

    test("neither boolean set -> null", () => {
      expect(resolvePrivilegedRole(authWith({ admin: false, superAdmin: false }))).toBeNull();
    });
  });
});

describe("requireAdminRole", () => {
  test("unauthenticated caller is rejected", () => {
    expect(() => requireAdminRole(undefined, ["admin", "superAdmin"]))
      .toThrow(expect.objectContaining({ code: "unauthenticated" }));
  });

  test("student (authenticated, no privileged claim) is rejected", () => {
    expect(() => requireAdminRole(authWith({}), ["admin", "superAdmin"]))
      .toThrow(expect.objectContaining({ code: "permission-denied" }));
  });

  test("tutor (role:'TUTOR' claim only) is rejected from an admin-only helper call", () => {
    expect(() => requireAdminRole(authWith({ role: "TUTOR" }), ["admin", "superAdmin"]))
      .toThrow(expect.objectContaining({ code: "permission-denied" }));
  });

  test("moderator is rejected when the operation's allowed list excludes moderators", () => {
    expect(() => requireAdminRole(authWith({ adminRole: "moderator" }), ["admin", "superAdmin"]))
      .toThrow(expect.objectContaining({ code: "permission-denied" }));
  });

  test("moderator is accepted only when explicitly included in allowedRoles", () => {
    expect(requireAdminRole(authWith({ adminRole: "moderator" }), ["moderator", "admin", "superAdmin"]))
      .toBe("moderator");
  });

  test("admin is accepted for an admin-tier operation", () => {
    expect(requireAdminRole(authWith({ admin: true }), ["admin", "superAdmin"])).toBe("admin");
  });

  test("admin is rejected from a superAdmin-only operation", () => {
    expect(() => requireAdminRole(authWith({ admin: true }), ["superAdmin"]))
      .toThrow(expect.objectContaining({ code: "permission-denied" }));
  });

  test("superAdmin is accepted for a superAdmin-only operation", () => {
    expect(requireAdminRole(authWith({ admin: true, superAdmin: true }), ["superAdmin"])).toBe("superAdmin");
  });

  test("superAdmin is accepted for an admin-tier operation too (superAdmin is always at least admin-capable)", () => {
    expect(requireAdminRole(authWith({ admin: true, superAdmin: true }), ["admin", "superAdmin"])).toBe("superAdmin");
  });

  test("unknown/garbage adminRole claim with no legacy booleans is rejected", () => {
    expect(() => requireAdminRole(authWith({ adminRole: "owner" }), ["admin", "superAdmin", "moderator"]))
      .toThrow(expect.objectContaining({ code: "permission-denied" }));
  });

  test("missing role entirely (empty token) is rejected even when every role is allowed", () => {
    expect(() => requireAdminRole(authWith({}), ["moderator", "admin", "superAdmin"]))
      .toThrow(expect.objectContaining({ code: "permission-denied" }));
  });

  describe("legacy migration compatibility", () => {
    test("a not-yet-backfilled admin (admin:true, no adminRole) keeps working exactly as before for admin-tier operations", () => {
      // The whole point of the fallback: this account's behavior against
      // requireAdminRole(["admin","superAdmin"]) is IDENTICAL to what a raw
      // `if (!auth.token.admin)` check already gave it today.
      expect(requireAdminRole(authWith({ admin: true }), ["admin", "superAdmin"])).toBe("admin");
    });

    test("a not-yet-backfilled admin is correctly excluded once a call site narrows to moderator-only", () => {
      expect(() => requireAdminRole(authWith({ admin: true }), ["moderator"]))
        .toThrow(expect.objectContaining({ code: "permission-denied" }));
    });

    test("once backfilled, adminRole takes over and legacy booleans are no longer consulted", () => {
      // Even if the legacy admin boolean were somehow absent post-backfill,
      // the explicit adminRole claim alone is sufficient.
      expect(requireAdminRole(authWith({ adminRole: "moderator" }), ["moderator"])).toBe("moderator");
    });
  });
});

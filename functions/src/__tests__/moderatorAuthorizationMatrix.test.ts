// PATH: functions/src/__tests__/moderatorAuthorizationMatrix.test.ts
//
// Moderator Authorization audit — Commit 6, final validation. This file
// is the single consolidated proof that every Cloud Function actually
// wired to requireAdminRole (functions/src/authz.ts) enforces the exact
// same SuperAdmin/Admin/Moderator/Non-admin/Unauthenticated boundary,
// exercised against the REAL exported callables (not a reimplementation
// or the helper in isolation) via each one's `.run(data, context)`
// testing hook. Individual functions already have their own dedicated
// authorization-boundary tests (refunds.test.ts,
// sensitiveAdminAuthorization.test.ts, adminManagement.test.ts) with
// fuller business-logic context; this file exists to make the CROSS-
// FUNCTION consistency — the actual security property this whole audit
// was about — checkable in one place, in one pass, against one shared
// actor table, rather than only inferable by reading four files side by
// side.
//
// Confirmed final list of functions wired to requireAdminRole (grepped
// against the real source, not assumed from an earlier plan):
//   requireAdminRole(auth, ["admin", "superAdmin"]):
//     processRefund, resolveRefundReconciliation   (refunds.ts)
//     markPayoutPaid, reviewPayoutRequest           (tutorPayouts.ts)
//     deleteContest                                 (vidyastarContest.ts)
//     manualResetAnnualVCoins                        (vcoins.ts)
//     adminEraseStudent                              (dataRights.ts)
//   requireAdminRole(auth, ["superAdmin"]):
//     updateAdminPermissions                         (adminManagement.ts)
// approveContent (adminManagement.ts) is DELIBERATELY excluded — it is
// still gated on the bare legacy `admin` claim, unrestricted for
// moderators, by design (see the Phase 1 audit's "current moderator
// capabilities" finding: content approval is the moderator's actual
// intended job). Not an oversight; not retested here as a boundary since
// its whole point is to NOT deny moderators.
//
// SECURITY PRINCIPLE under test, stated in this task's own words and
// verified below: frontend hiding != authorization; route protection !=
// backend authorization; Firestore document role != authoritative
// security identity; Firebase Auth verified custom claims = the
// authorization source. Every actor fixture below is defined ONLY in
// terms of `auth.token` (the server-verified ID token) — none of these
// tests ever construct a Firestore admins/{uid} document to influence an
// outcome, and the "payload cannot override auth" tests near the bottom
// explicitly prove request.data is inert for authorization purposes.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "./helpers/mockFirebaseAdmin";

beforeEach(() => {
  fakeDb.reset();
});

type ResolvedRole = "superAdmin" | "admin" | "moderator" | null;

interface ActorFixture {
  label: string;
  auth: { uid: string; token: Record<string, unknown> } | undefined;
  resolvedRole: ResolvedRole;
}

// The complete authorization matrix (Phase 1 of this task) — every actor
// category this task requires, defined purely by token shape.
const ACTORS: ActorFixture[] = [
  { label: "SuperAdmin (new adminRole claim)", auth: { uid: "u_super_new", token: { adminRole: "superAdmin" } }, resolvedRole: "superAdmin" },
  { label: "Admin (new adminRole claim)", auth: { uid: "u_admin_new", token: { adminRole: "admin" } }, resolvedRole: "admin" },
  { label: "Moderator (new adminRole claim)", auth: { uid: "u_mod_new", token: { adminRole: "moderator" } }, resolvedRole: "moderator" },
  { label: "Legacy SuperAdmin (superAdmin:true, no adminRole)", auth: { uid: "u_super_legacy", token: { admin: true, superAdmin: true } }, resolvedRole: "superAdmin" },
  { label: "Legacy Admin (admin:true, no adminRole)", auth: { uid: "u_admin_legacy", token: { admin: true } }, resolvedRole: "admin" },
  { label: "Non-admin authenticated user (student/tutor-shaped token)", auth: { uid: "u_plain", token: {} }, resolvedRole: null },
  { label: "Unauthenticated", auth: undefined, resolvedRole: null },
];

function expectedOutcome(actor: ActorFixture, allowedRoles: string[]): "allow" | "deny" {
  if (!actor.auth) return "deny";
  if (!actor.resolvedRole) return "deny";
  return allowedRoles.includes(actor.resolvedRole) ? "allow" : "deny";
}

function expectDenyCode(actor: ActorFixture): "unauthenticated" | "permission-denied" {
  return actor.auth ? "permission-denied" : "unauthenticated";
}

// ── processRefund & resolveRefundReconciliation (refunds.ts) ───────────────
describe("processRefund — full actor matrix", () => {
  const ALLOWED = ["admin", "superAdmin"];
  const call = (auth: ActorFixture["auth"]) =>
    require("../refunds").processRefund.run({ flow: "aiGuruSubscription", razorpayPaymentId: "pay_missing", reason: "test" }, { auth });

  for (const actor of ACTORS) {
    const outcome = expectedOutcome(actor, ALLOWED);
    test(`${actor.label} -> ${outcome}`, async () => {
      if (outcome === "deny") {
        await expect(call(actor.auth)).rejects.toMatchObject({ code: expectDenyCode(actor) });
      } else {
        // No order seeded and no Razorpay secrets configured in this
        // file — the first thing an allowed caller hits past the
        // authorization gate is "Razorpay not configured," a code that
        // is unreachable for a denied caller (they never get that far).
        // Proves pass-through without needing full business-logic setup
        // (already covered end-to-end in refunds.test.ts).
        const err: any = await call(actor.auth).catch((e: any) => e);
        expect(err.code).not.toBe("permission-denied");
        expect(err.code).not.toBe("unauthenticated");
      }
    });
  }
});

describe("resolveRefundReconciliation — full actor matrix", () => {
  const ALLOWED = ["admin", "superAdmin"];
  const call = (auth: ActorFixture["auth"]) =>
    require("../refunds").resolveRefundReconciliation.run({ refundId: "missing", resolution: "not_actually_refunded" }, { auth });

  for (const actor of ACTORS) {
    const outcome = expectedOutcome(actor, ALLOWED);
    test(`${actor.label} -> ${outcome}`, async () => {
      if (outcome === "deny") {
        await expect(call(actor.auth)).rejects.toMatchObject({ code: expectDenyCode(actor) });
      } else {
        await expect(call(actor.auth)).rejects.toMatchObject({ code: "not-found" });
      }
    });
  }
});

// ── markPayoutPaid & reviewPayoutRequest (tutorPayouts.ts) ──────────────────
describe("markPayoutPaid — full actor matrix", () => {
  const ALLOWED = ["admin", "superAdmin"];
  beforeEach(() => {
    process.env["RAZORPAYX_KEY_ID"] = "test_key_id";
    process.env["RAZORPAYX_KEY_SECRET"] = "test_key_secret";
    process.env["RAZORPAYX_ACCOUNT_NUMBER"] = "test_account";
  });
  const call = (auth: ActorFixture["auth"]) =>
    require("../tutorPayouts").markPayoutPaid.run({ requestId: "missing" }, { auth });

  for (const actor of ACTORS) {
    const outcome = expectedOutcome(actor, ALLOWED);
    test(`${actor.label} -> ${outcome}`, async () => {
      if (outcome === "deny") {
        await expect(call(actor.auth)).rejects.toMatchObject({ code: expectDenyCode(actor) });
      } else {
        await expect(call(actor.auth)).rejects.toMatchObject({ code: "not-found" });
      }
    });
  }
});

describe("reviewPayoutRequest — full actor matrix", () => {
  const ALLOWED = ["admin", "superAdmin"];
  const call = (auth: ActorFixture["auth"]) =>
    require("../tutorPayouts").reviewPayoutRequest.run({ requestId: "missing", action: "approve" }, { auth });

  for (const actor of ACTORS) {
    const outcome = expectedOutcome(actor, ALLOWED);
    test(`${actor.label} -> ${outcome}`, async () => {
      if (outcome === "deny") {
        await expect(call(actor.auth)).rejects.toMatchObject({ code: expectDenyCode(actor) });
      } else {
        await expect(call(actor.auth)).rejects.toMatchObject({ code: "not-found" });
      }
    });
  }
});

// ── deleteContest (vidyastarContest.ts) ─────────────────────────────────────
describe("deleteContest — full actor matrix", () => {
  const ALLOWED = ["admin", "superAdmin"];
  const call = (auth: ActorFixture["auth"]) =>
    require("../vidyastarContest").deleteContest.run({ contestId: "missing" }, { auth });

  for (const actor of ACTORS) {
    const outcome = expectedOutcome(actor, ALLOWED);
    test(`${actor.label} -> ${outcome}`, async () => {
      if (outcome === "deny") {
        await expect(call(actor.auth)).rejects.toMatchObject({ code: expectDenyCode(actor) });
      } else {
        await expect(call(actor.auth)).rejects.toMatchObject({ code: "not-found" });
      }
    });
  }
});

// ── manualResetAnnualVCoins (vcoins.ts) ─────────────────────────────────────
describe("manualResetAnnualVCoins — full actor matrix", () => {
  const ALLOWED = ["admin", "superAdmin"];
  const call = (auth: ActorFixture["auth"]) =>
    require("../vcoins").manualResetAnnualVCoins.run({}, { auth });

  for (const actor of ACTORS) {
    const outcome = expectedOutcome(actor, ALLOWED);
    test(`${actor.label} -> ${outcome}`, async () => {
      if (outcome === "deny") {
        await expect(call(actor.auth)).rejects.toMatchObject({ code: expectDenyCode(actor) });
      } else {
        // No users seeded -> genuine success (no external dependency).
        await expect(call(actor.auth)).resolves.toEqual({ success: true, totalProcessed: 0 });
      }
    });
  }
});

// ── adminEraseStudent (dataRights.ts) ───────────────────────────────────────
describe("adminEraseStudent — full actor matrix", () => {
  const ALLOWED = ["admin", "superAdmin"];
  const call = (auth: ActorFixture["auth"]) =>
    require("../dataRights").adminEraseStudent.run({ uid: "target_1" }, { auth });

  for (const actor of ACTORS) {
    const outcome = expectedOutcome(actor, ALLOWED);
    test(`${actor.label} -> ${outcome}`, async () => {
      if (outcome === "deny") {
        await expect(call(actor.auth)).rejects.toMatchObject({ code: expectDenyCode(actor) });
      } else {
        // admin.storage() isn't mocked (out of scope) — the function's
        // own try/catch converts that failure to "internal," itself
        // proof of reaching real deletion logic well past authorization.
        await expect(call(actor.auth)).rejects.toMatchObject({ code: "internal" });
      }
    });
  }
});

// ── updateAdminPermissions (adminManagement.ts) — STRICTER: superAdmin only ─
describe("updateAdminPermissions — full actor matrix (superAdmin-only, NOT admin+superAdmin)", () => {
  const ALLOWED = ["superAdmin"]; // deliberately excludes plain "admin" — see adminManagement.ts's own header comment
  const call = (auth: ActorFixture["auth"]) =>
    require("../adminManagement").updateAdminPermissions.run({ data: { targetUid: "missing", permissions: [] }, auth });

  for (const actor of ACTORS) {
    const outcome = expectedOutcome(actor, ALLOWED);
    test(`${actor.label} -> ${outcome}`, async () => {
      if (outcome === "deny") {
        await expect(call(actor.auth)).rejects.toMatchObject({ code: expectDenyCode(actor) });
      } else {
        await expect(call(actor.auth)).rejects.toMatchObject({ code: "not-found" });
      }
    });
  }

  test("REQUIRED cross-check: a legacy/new-claim ADMIN (not superAdmin) is explicitly denied here, unlike every other function above", () => {
    const adminActor = ACTORS.find((a) => a.label.startsWith("Admin (new"))!;
    expect(expectedOutcome(adminActor, ALLOWED)).toBe("deny");
  });
});

// ── Permission escalation via client-controlled data (Phase 8) ─────────────
describe("privilege escalation via request payload — must have zero effect", () => {
  test("a moderator cannot escalate by sending role/adminRole/permissions fields in the CALL PAYLOAD", async () => {
    // requireAdminRole (functions/src/authz.ts) only ever reads
    // `auth.token` — it has no parameter through which request.data could
    // reach it at all. This test proves that concretely against a real
    // callable: a moderator's auth.token is genuinely moderator-shaped,
    // and the payload separately claims superAdmin-flavored fields that
    // do not exist as legitimate request.data fields for this function —
    // if payload data could ever influence authorization, this is exactly
    // the shape of attempt that would reveal it.
    const maliciousPayload = {
      contestId: "missing",
      role: "superAdmin",
      adminRole: "superAdmin",
      admin: true,
      superAdmin: true,
      isSuperAdmin: true,
      permissions: ["all"],
    };
    await expect(
      require("../vidyastarContest").deleteContest.run(maliciousPayload, {
        auth: { uid: "u_mod", token: { adminRole: "moderator" } },
      })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("an unauthenticated caller cannot escalate by asserting auth-shaped fields inside the DATA payload (only the auth object itself is ever consulted)", async () => {
    await expect(
      require("../vcoins").manualResetAnnualVCoins.run(
        { auth: { uid: "fake", token: { admin: true, superAdmin: true } } }, // payload masquerading as an auth object
        { auth: undefined } // the REAL (absent) auth context
      )
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });
});

// ── What this file does NOT (and cannot, offline) prove — stated
// explicitly rather than implied ──────────────────────────────────────────
// - Arbitrary Firestore admins/{uid}.role tampering: not exercisable here
//   because none of the functions above ever read that document for
//   authorization at all (confirmed by source inspection, not by a test
//   that could fail silently if that ever changed) — see this task's
//   accompanying report's Firestore Rules review section.
// - Arbitrary frontend state / navigation visibility: proven instead in
//   apps/admin/src/lib/__tests__/routePermissions.test.ts, which shows a
//   route's accessibility does not depend on whether Layout.tsx would
//   render its nav link.
// - Live Firebase Auth token forgery / signature verification: outside
//   this offline suite's reach entirely — firebase-functions verifies ID
//   token signatures before request.auth is ever populated, upstream of
//   every function tested here; that verification itself is Firebase
//   platform code, not this repository's, and is not re-tested here.

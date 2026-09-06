// PATH: functions/src/__tests__/sensitiveAdminAuthorization.test.ts
//
// Moderator Authorization audit, Phase 2 / commit 3 — offline authorization-
// boundary tests for the four sensitive functions that had NO prior test
// coverage at all: markPayoutPaid (tutorPayouts.ts), deleteContest
// (vidyastarContest.ts), manualResetAnnualVCoins (vcoins.ts), and
// adminEraseStudent (dataRights.ts). processRefund/resolveRefundReconciliation
// are covered instead in refunds.test.ts, which already had full business-
// logic coverage to extend.
//
// Scope is deliberately narrow: this commit's ONLY behavioral change to
// these four functions is the authorization check at the top (bare
// `.token.admin` -> requireAdminRole(["admin","superAdmin"])) — no
// business logic changed. So these tests verify exactly that: every
// caller shape is correctly accepted or rejected AT THE AUTHORIZATION
// GATE, run against the real exported callable via its `.run(data,
// context)` testing hook (not a reimplementation), with the minimum
// Firestore seeding needed to observe the outcome.
//
// For the "admin/superAdmin allowed" cases, full success-path execution
// is not attempted for markPayoutPaid or adminEraseStudent: markPayoutPaid
// calls out to RazorpayX (an external HTTP API, only network-mocked in
// this repo via a dedicated razorpayXClient test double this file doesn't
// pull in) and adminEraseStudent's deletion helpers call admin.storage()
// (not implemented by the shared FakeFirestore/FakeAuth mock — see
// helpers/mockFirebaseAdmin.ts, which intentionally only mocks firestore
// and auth). Expanding that shared mock to cover RazorpayX/Storage is
// out of scope for a security-only commit (see this commit's message:
// "do not refactor payment logic," "do not change deletion logic").
// Instead, each is driven to the *nearest* clean, deterministic outcome
// past the authorization gate — a precondition failure (`not-found`,
// `failed-precondition`) or an internal error from the unmocked
// dependency — and the test asserts explicitly that this outcome is NOT
// `permission-denied`/`unauthenticated`, which is the only thing that
// would indicate the authorization gate (not the deletion/payout logic)
// was the cause of failure. deleteContest and manualResetAnnualVCoins
// reach genuine success with minimal seeding and are tested that way.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "./helpers/mockFirebaseAdmin";

beforeEach(() => {
  fakeDb.reset();
});

// Shared caller-shape fixtures used across all four functions' boundary
// tables, matching the audit's required test matrix exactly.
const UNAUTHENTICATED = { auth: undefined };
const STUDENT    = { auth: { uid: "student_1", token: {} } };
const TUTOR      = { auth: { uid: "tutor_1", token: { role: "TUTOR" } } };
const MODERATOR  = { auth: { uid: "mod_1", token: { admin: true, adminRole: "moderator" } } };
const ADMIN      = { auth: { uid: "admin_1", token: { admin: true } } };               // legacy, not yet backfilled
const SUPERADMIN = { auth: { uid: "super_1", token: { admin: true, superAdmin: true } } }; // legacy, not yet backfilled
const UNKNOWN_ROLE = { auth: { uid: "weird_1", token: { adminRole: "owner" } } };

describe("markPayoutPaid — role authorization boundary", () => {
  beforeEach(() => {
    process.env["RAZORPAYX_KEY_ID"] = "test_key_id";
    process.env["RAZORPAYX_KEY_SECRET"] = "test_key_secret";
    process.env["RAZORPAYX_ACCOUNT_NUMBER"] = "test_account";
  });

  const call = (context: unknown) =>
    require("../tutorPayouts").markPayoutPaid.run({ requestId: "req_1" }, context);

  test("unauthenticated caller is rejected", async () => {
    await expect(call(UNAUTHENTICATED)).rejects.toMatchObject({ code: "unauthenticated" });
  });
  test("student is rejected", async () => {
    await expect(call(STUDENT)).rejects.toMatchObject({ code: "permission-denied" });
  });
  test("tutor is rejected", async () => {
    await expect(call(TUTOR)).rejects.toMatchObject({ code: "permission-denied" });
  });
  test("moderator is rejected — the vulnerability this commit closes", async () => {
    await expect(call(MODERATOR)).rejects.toMatchObject({ code: "permission-denied" });
  });
  test("unknown role is rejected", async () => {
    await expect(call(UNKNOWN_ROLE)).rejects.toMatchObject({ code: "permission-denied" });
  });
  test("legacy admin passes the authorization gate (reaches a business-logic precondition, not permission-denied)", async () => {
    // No payoutRequests/req_1 doc seeded -> reaches the real "not-found"
    // check, proving the request got past authorization into the actual
    // function body without ever touching RazorpayX.
    const err = await call(ADMIN).catch((e: any) => e);
    expect(err.code).toBe("not-found");
  });
  test("superAdmin passes the authorization gate the same way", async () => {
    const err = await call(SUPERADMIN).catch((e: any) => e);
    expect(err.code).toBe("not-found");
  });
});

describe("deleteContest — role authorization boundary", () => {
  const call = (context: unknown) =>
    require("../vidyastarContest").deleteContest.run({ contestId: "contest_1" }, context);

  test("unauthenticated caller is rejected", async () => {
    await expect(call(UNAUTHENTICATED)).rejects.toMatchObject({ code: "unauthenticated" });
  });
  test("student is rejected", async () => {
    await expect(call(STUDENT)).rejects.toMatchObject({ code: "permission-denied" });
  });
  test("tutor is rejected", async () => {
    await expect(call(TUTOR)).rejects.toMatchObject({ code: "permission-denied" });
  });
  test("moderator is rejected — this function performs an irreversible recursive delete", async () => {
    await expect(call(MODERATOR)).rejects.toMatchObject({ code: "permission-denied" });
  });
  test("unknown role is rejected", async () => {
    await expect(call(UNKNOWN_ROLE)).rejects.toMatchObject({ code: "permission-denied" });
  });
  test("legacy admin succeeds end to end (genuine success path — no external dependency involved)", async () => {
    fakeDb.seed("contests/contest_1", { title: "Test Contest" });
    const result = await call(ADMIN);
    expect(result).toEqual({ success: true });
  });
  test("superAdmin succeeds end to end", async () => {
    fakeDb.seed("contests/contest_1", { title: "Test Contest" });
    const result = await call(SUPERADMIN);
    expect(result).toEqual({ success: true });
  });
});

describe("manualResetAnnualVCoins — role authorization boundary", () => {
  const call = (context: unknown) => require("../vcoins").manualResetAnnualVCoins.run({}, context);

  test("unauthenticated caller is rejected", async () => {
    await expect(call(UNAUTHENTICATED)).rejects.toMatchObject({ code: "unauthenticated" });
  });
  test("student is rejected", async () => {
    await expect(call(STUDENT)).rejects.toMatchObject({ code: "permission-denied" });
  });
  test("tutor is rejected", async () => {
    await expect(call(TUTOR)).rejects.toMatchObject({ code: "permission-denied" });
  });
  test("moderator is rejected — this function resets EVERY user's annual VCoin balance", async () => {
    await expect(call(MODERATOR)).rejects.toMatchObject({ code: "permission-denied" });
  });
  test("unknown role is rejected", async () => {
    await expect(call(UNKNOWN_ROLE)).rejects.toMatchObject({ code: "permission-denied" });
  });
  test("legacy admin succeeds end to end (no users to process — genuine success path)", async () => {
    const result = await call(ADMIN);
    expect(result).toEqual({ success: true, totalProcessed: 0 });
  });
  test("superAdmin succeeds end to end", async () => {
    const result = await call(SUPERADMIN);
    expect(result).toEqual({ success: true, totalProcessed: 0 });
  });
});

describe("adminEraseStudent — role authorization boundary", () => {
  const call = (context: unknown) =>
    require("../dataRights").adminEraseStudent.run({ uid: "target_student_1" }, context);

  test("unauthenticated caller is rejected", async () => {
    await expect(call(UNAUTHENTICATED)).rejects.toMatchObject({ code: "unauthenticated" });
  });
  test("student is rejected", async () => {
    await expect(call(STUDENT)).rejects.toMatchObject({ code: "permission-denied" });
  });
  test("tutor is rejected", async () => {
    await expect(call(TUTOR)).rejects.toMatchObject({ code: "permission-denied" });
  });
  test("moderator is rejected — this function irreversibly deletes a student's entire data footprint", async () => {
    await expect(call(MODERATOR)).rejects.toMatchObject({ code: "permission-denied" });
  });
  test("unknown role is rejected", async () => {
    await expect(call(UNKNOWN_ROLE)).rejects.toMatchObject({ code: "permission-denied" });
  });
  test("legacy admin passes the authorization gate (reaches deletion logic, not permission-denied)", async () => {
    // admin.storage() isn't implemented by the shared mock (out of scope
    // to add for a security-only commit) — adminEraseStudent's own
    // try/catch converts that failure into HttpsError("internal", ...),
    // which is itself proof the call reached real deletion logic well
    // past the authorization check (and even past the audit-log write).
    const err = await call(ADMIN).catch((e: any) => e);
    expect(err.code).toBe("internal");
    // The audit-log entry this function writes BEFORE attempting deletion
    // is a further, independent confirmation that authorization passed.
    const logs = await fakeDb.collection("dataRightsLog").get();
    expect(logs.docs.some((d: any) => d.data().uid === "target_student_1")).toBe(true);
  });
  test("superAdmin passes the authorization gate the same way", async () => {
    const err = await call(SUPERADMIN).catch((e: any) => e);
    expect(err.code).toBe("internal");
  });
});

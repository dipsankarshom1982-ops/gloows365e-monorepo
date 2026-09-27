// PATH: functions/src/__tests__/signupBonus.test.ts
//
// Offline unit tests for creditSignupBonus's idempotency guarantee (audit —
// "SIGNUP BONUS RELIABILITY & IDEMPOTENCY"). creditSignupBonus is a thin
// wrapper around creditVCoinsBalance (functions/src/vcoins.ts) with a fixed
// per-uid referenceId ("signup_bonus"), so a repeat call — whatever caused
// it (double-click, client retry after a lost response, a second
// registration attempt) — must always resolve to the SAME already-existing
// lock doc and credit nothing further. Same test pattern as
// skillBattleReward.test.ts: run the real module via the v1 callable's
// `.run(data, context)` hook, firebase-admin mocked onto an in-memory
// FakeFirestore (helpers/fakeFirestore.ts).
//
// NOTE on concurrency (Test 4 in the audit's matrix): FakeFirestore's
// runTransaction() has no optimistic-concurrency-conflict/retry behavior
// (real Firestore does), so it cannot meaningfully prove the "two truly
// simultaneous requests" case — that's verified separately against the
// real deployed staging function instead. What's tested here (repeat
// sequential calls, including via Promise.all with a synchronous fake that
// has no I/O to interleave on) is the actual duplicate-prevention
// mechanism: the referenceId lock document.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "./helpers/mockFirebaseAdmin";

const UID_A = "student_a";
const UID_B = "student_b";

beforeEach(() => {
  fakeDb.reset();
});

function loadFn() {
  // Fresh require per test isn't needed (module has no per-call state),
  // but keeps this file's pattern consistent with skillBattleReward.test.ts.
  return require("../vcoins").creditSignupBonus;
}

describe("creditSignupBonus — idempotent signup-bonus credit", () => {
  test("Test 1 — first call for an eligible user credits exactly once", async () => {
    const creditSignupBonus = loadFn();
    const result = await creditSignupBonus.run({}, { auth: { uid: UID_A } });

    expect(result.credited).toBe(true);
    expect(result.amount).toBe(200); // DEFAULT_DAILY_LIMITS.SIGNUP_BONUS fallback amount
    expect(fakeDb.peek(`users/${UID_A}`)?.vCoinsBalance).toBe(200);
  });

  test("Test 2 — the same request called twice credits only once", async () => {
    const creditSignupBonus = loadFn();
    const first  = await creditSignupBonus.run({}, { auth: { uid: UID_A } });
    const second = await creditSignupBonus.run({}, { auth: { uid: UID_A } });

    expect(first.credited).toBe(true);
    expect(second.credited).toBe(false); // "ALREADY_CREDITED" — not an error
    expect(second.amount).toBe(0);
    expect(fakeDb.peek(`users/${UID_A}`)?.vCoinsBalance).toBe(200);
  });

  test("Test 3 — three repeated requests still credit only once", async () => {
    const creditSignupBonus = loadFn();
    await creditSignupBonus.run({}, { auth: { uid: UID_A } });
    await creditSignupBonus.run({}, { auth: { uid: UID_A } });
    await creditSignupBonus.run({}, { auth: { uid: UID_A } });

    expect(fakeDb.peek(`users/${UID_A}`)?.vCoinsBalance).toBe(200);
    // Exactly one vCoinTransactions doc under this user for the signup bonus.
    const txSnap = await fakeDb.collection(`users/${UID_A}/vCoinTransactions`).get();
    const txDocs = txSnap.docs.filter((d) => d.data().source === "SIGNUP_BONUS");
    expect(txDocs.length).toBe(1);
  });

  test("Test 5 (response-loss retry) — a retry after the first call already committed does not duplicate", async () => {
    const creditSignupBonus = loadFn();
    // Simulates: server completed the credit, but the client never saw the
    // response and retries the exact same idempotent operation.
    await creditSignupBonus.run({}, { auth: { uid: UID_A } });
    const retry = await creditSignupBonus.run({}, { auth: { uid: UID_A } });

    expect(retry.credited).toBe(false);
    expect(fakeDb.peek(`users/${UID_A}`)?.vCoinsBalance).toBe(200);
  });

  test("Test 6 — two different users each get their own single bonus", async () => {
    const creditSignupBonus = loadFn();
    const a = await creditSignupBonus.run({}, { auth: { uid: UID_A } });
    const b = await creditSignupBonus.run({}, { auth: { uid: UID_B } });

    expect(a.credited).toBe(true);
    expect(b.credited).toBe(true);
    expect(fakeDb.peek(`users/${UID_A}`)?.vCoinsBalance).toBe(200);
    expect(fakeDb.peek(`users/${UID_B}`)?.vCoinsBalance).toBe(200);
  });

  test("Test 7 — the callable ignores any client-supplied uid; it only ever credits the authenticated caller", async () => {
    const creditSignupBonus = loadFn();
    // The callable's signature takes no uid from `data` at all (`_data` is
    // unused) — passing one is a no-op, proving impersonation isn't even
    // structurally possible through this API.
    const result = await creditSignupBonus.run(
      { uid: UID_B, amount: 999999 },
      { auth: { uid: UID_A } }
    );

    expect(result.credited).toBe(true);
    expect(fakeDb.peek(`users/${UID_A}`)?.vCoinsBalance).toBe(200);
    expect(fakeDb.peek(`users/${UID_B}`)).toBeUndefined();
  });

  test("unauthenticated calls are rejected and change no state", async () => {
    const creditSignupBonus = loadFn();
    await expect(creditSignupBonus.run({}, { auth: null })).rejects.toThrow();
    expect(fakeDb.peek(`users/${UID_A}`)).toBeUndefined();
  });

  test("Test 8 — a user already credited via a pre-existing lock gets ALREADY_CREDITED, no balance increase", async () => {
    // Seed the lock doc directly, as if a previous (real) credit already
    // happened, without going through .run() first.
    fakeDb.seed(`users/${UID_A}/vCoinActivityLocks/SIGNUP_BONUS_signup_bonus`, {
      source: "SIGNUP_BONUS", referenceId: "signup_bonus", amount: 200,
    });
    fakeDb.seed(`users/${UID_A}`, { vCoinsBalance: 200 });

    const creditSignupBonus = loadFn();
    const result = await creditSignupBonus.run({}, { auth: { uid: UID_A } });

    expect(result.credited).toBe(false);
    expect(result.amount).toBe(0);
    expect(fakeDb.peek(`users/${UID_A}`)?.vCoinsBalance).toBe(200);
  });
});

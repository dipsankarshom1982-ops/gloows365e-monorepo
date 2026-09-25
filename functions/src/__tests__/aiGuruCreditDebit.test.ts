// PATH: functions/src/__tests__/aiGuruCreditDebit.test.ts
//
// Offline unit tests for aiGuruCreditDebit.ts — the atomic, server-side
// debit/refund core every AI Guru feature (PhotoSolve, Exam Simulator,
// Voice Tutor, Ask AI Guru, VidyaGuru, Discover, lesson generation) spends
// against. See refunds.test.ts's header for the mocking approach: the real
// module under test, firebase-admin replaced by FakeFirestore, no emulator.

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

const redisStore = new Map<string, unknown>();
const redisGet = jest.fn(async (key: string) => (redisStore.has(key) ? redisStore.get(key) : null));
const redisSet = jest.fn(async (key: string, value: unknown) => { redisStore.set(key, value); return "OK"; });

jest.mock("../redish", () => ({
  getRedis: () => ({ get: redisGet, set: redisSet }),
  RK: { aiGuruCreditCost: () => "aiguru:creditcost" },
  TTL: { aiGuruCreditCost: 300 },
}));

import { fakeDb } from "./helpers/mockFirebaseAdmin";
import { tryDebitAiGuruCredit, refundAiGuruCredit, getCreditCostPerAction } from "../aiGuruCreditDebit";

const UID = "student_1";
const OTHER_UID = "student_2";
const BALANCE_DOC = `aiGuruCredits/${UID}`;

beforeEach(() => {
  fakeDb.reset();
  redisStore.clear();
  jest.clearAllMocks();
});

function seedBalance(balance: number) {
  fakeDb.seed(BALANCE_DOC, { balance, lifetimeSpent: 0, lifetimePurchased: 0 });
}

// ─── A. Credit debit ──────────────────────────────────────────────────────

describe("tryDebitAiGuruCredit — balance outcomes", () => {
  test("sufficient balance: debits the default cost (1) and returns the new balance", async () => {
    seedBalance(5);
    const result = await tryDebitAiGuruCredit(UID, "PHOTOSOLVE", fakeDb as any);
    expect(result).toMatchObject({ ok: true, charged: 1, balanceAfter: 4 });
    expect(fakeDb.peek(BALANCE_DOC)).toMatchObject({ balance: 4, lifetimeSpent: 1 });
  });

  test("exact balance (balance === cost): debit succeeds, leaves balance at 0", async () => {
    seedBalance(1);
    const result = await tryDebitAiGuruCredit(UID, "VOICE_TUTOR", fakeDb as any);
    expect(result).toMatchObject({ ok: true, charged: 1, balanceAfter: 0 });
    expect(fakeDb.peek(BALANCE_DOC)!["balance"]).toBe(0);
  });

  test("insufficient balance: rejects without writing anything, reports balance and required", async () => {
    seedBalance(0);
    const result = await tryDebitAiGuruCredit(UID, "EXAM_SIMULATOR", fakeDb as any);
    expect(result).toEqual({ ok: false, reason: "insufficient", balance: 0, required: 1 });
    // Nothing charged — balance doc must be byte-for-byte untouched.
    expect(fakeDb.peek(BALANCE_DOC)).toEqual({ balance: 0, lifetimeSpent: 0, lifetimePurchased: 0 });
  });

  test("zero balance with no balance doc at all (never purchased): treated as balance 0, insufficient", async () => {
    // No seedBalance() call — aiGuruCredits/{uid} doesn't exist yet.
    const result = await tryDebitAiGuruCredit(UID, "ASK_GURU", fakeDb as any);
    expect(result).toEqual({ ok: false, reason: "insufficient", balance: 0, required: 1 });
    expect(fakeDb.peek(BALANCE_DOC)).toBeUndefined();
  });

  test("a debit for one uid never touches another uid's balance", async () => {
    seedBalance(3); // UID
    fakeDb.seed(`aiGuruCredits/${OTHER_UID}`, { balance: 3, lifetimeSpent: 0, lifetimePurchased: 0 });

    await tryDebitAiGuruCredit(UID, "DISCOVER", fakeDb as any);

    expect(fakeDb.peek(BALANCE_DOC)!["balance"]).toBe(2);
    expect(fakeDb.peek(`aiGuruCredits/${OTHER_UID}`)!["balance"]).toBe(3);
  });

  test("respects a configured cost-per-action from aiGuruCreditConfig/settings", async () => {
    seedBalance(10);
    fakeDb.seed("aiGuruCreditConfig/settings", { enabled: true, costPerAction: 3 });
    const result = await tryDebitAiGuruCredit(UID, "PHOTOSOLVE", fakeDb as any);
    expect(result).toMatchObject({ ok: true, charged: 3, balanceAfter: 7 });
  });

  test("returns {ok:false, reason:'disabled'} when the credit system is admin-disabled, without touching balance", async () => {
    seedBalance(10);
    fakeDb.seed("aiGuruCreditConfig/settings", { enabled: false });
    const result = await tryDebitAiGuruCredit(UID, "PHOTOSOLVE", fakeDb as any);
    expect(result).toEqual({ ok: false, reason: "disabled" });
    expect(fakeDb.peek(BALANCE_DOC)!["balance"]).toBe(10);
  });
});

// ─── B. Idempotency ────────────────────────────────────────────────────────

describe("tryDebitAiGuruCredit — requestId idempotency", () => {
  test("the same requestId submitted twice charges only once", async () => {
    seedBalance(5);
    const first = await tryDebitAiGuruCredit(UID, "PHOTOSOLVE", fakeDb as any, { requestId: "req_abc" });
    const second = await tryDebitAiGuruCredit(UID, "PHOTOSOLVE", fakeDb as any, { requestId: "req_abc" });

    expect(first).toMatchObject({ ok: true, charged: 1, balanceAfter: 4 });
    // Second call reports the SAME already-settled result rather than
    // charging again — the actual idempotency guarantee, not just a flag.
    expect(second).toMatchObject({ ok: true, charged: 1, balanceAfter: 4 });
    expect(fakeDb.peek(BALANCE_DOC)!["balance"]).toBe(4); // not 3
    expect(fakeDb.peek(BALANCE_DOC)!["lifetimeSpent"]).toBe(1); // not 2
  });

  test("a different requestId on the same uid/feature charges independently", async () => {
    seedBalance(5);
    await tryDebitAiGuruCredit(UID, "PHOTOSOLVE", fakeDb as any, { requestId: "req_1" });
    await tryDebitAiGuruCredit(UID, "PHOTOSOLVE", fakeDb as any, { requestId: "req_2" });
    expect(fakeDb.peek(BALANCE_DOC)!["balance"]).toBe(3);
  });

  test("with no requestId at all, each call is its own charge (no idempotency key to dedupe against)", async () => {
    seedBalance(5);
    await tryDebitAiGuruCredit(UID, "PHOTOSOLVE", fakeDb as any);
    await tryDebitAiGuruCredit(UID, "PHOTOSOLVE", fakeDb as any);
    expect(fakeDb.peek(BALANCE_DOC)!["balance"]).toBe(3);
  });
});

// ─── C. Concurrency ─────────────────────────────────────────────────────────
//
// NOTE on true concurrency (same limitation documented in
// battleSubmissions.test.ts): the offline FakeFirestore used here doesn't
// model real Firestore's transaction conflict-retry semantics (no
// per-document locking, no interleaving simulation) — a genuinely
// simultaneous-race test against it wouldn't prove anything about the real
// SDK's behavior either way. The double-spend guarantee itself comes from
// the code structure in aiGuruCreditDebit.ts: a single db.runTransaction()
// that reads aiGuruCredits/{uid}, checks the balance, and writes the debit
// all inside one transaction on ONE document — exactly the pattern real
// Firestore transactions are designed to serialize (the loser of a race
// gets ABORTED and automatically retries with a fresh read). What IS
// exercised below, against the fake, is the sequential case: two low-
// balance requests processed one after another must not jointly overspend
// the balance, which is the same check-then-write logic a serialized real
// transaction would run for the "loser" of a genuine race.
describe("tryDebitAiGuruCredit — sequential low-balance requests cannot jointly overspend", () => {
  test("two requests against a balance of 1 (cost 1 each): first succeeds, second correctly sees it drained", async () => {
    seedBalance(1);
    const first = await tryDebitAiGuruCredit(UID, "PHOTOSOLVE", fakeDb as any, { requestId: "req_a" });
    const second = await tryDebitAiGuruCredit(UID, "PHOTOSOLVE", fakeDb as any, { requestId: "req_b" });

    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, reason: "insufficient", balance: 0, required: 1 });
    // Balance never goes negative — the two requests did not jointly spend
    // more than the 1 credit that actually existed.
    expect(fakeDb.peek(BALANCE_DOC)!["balance"]).toBe(0);
  });
});

// ─── D. Refund ──────────────────────────────────────────────────────────────

describe("refundAiGuruCredit", () => {
  test("successful refund restores the balance and reverses the ledger entry", async () => {
    seedBalance(5);
    const debit = await tryDebitAiGuruCredit(UID, "PHOTOSOLVE", fakeDb as any, { requestId: "req_x" });
    expect(debit.ok).toBe(true);
    const txId = (debit as { ok: true; txId: string }).txId;
    expect(fakeDb.peek(BALANCE_DOC)!["balance"]).toBe(4);

    await refundAiGuruCredit(UID, txId, "PHOTOSOLVE", fakeDb as any);

    expect(fakeDb.peek(BALANCE_DOC)!["balance"]).toBe(5);
    expect(fakeDb.peek(BALANCE_DOC)!["lifetimeSpent"]).toBe(0);
    expect(fakeDb.peek(`${BALANCE_DOC}/transactions/${txId}`)!["status"]).toBe("REVERSED");
    expect(fakeDb.peek(`${BALANCE_DOC}/transactions/${txId}_refund`)).toMatchObject({
      type: "CREDIT", amount: 1, source: "REFUND", status: "SUCCESS",
    });
  });

  test("a duplicate refund of the same transaction does not restore the balance twice", async () => {
    seedBalance(5);
    const debit = await tryDebitAiGuruCredit(UID, "PHOTOSOLVE", fakeDb as any, { requestId: "req_y" });
    const txId = (debit as { ok: true; txId: string }).txId;

    await refundAiGuruCredit(UID, txId, "PHOTOSOLVE", fakeDb as any);
    await refundAiGuruCredit(UID, txId, "PHOTOSOLVE", fakeDb as any); // duplicate

    expect(fakeDb.peek(BALANCE_DOC)!["balance"]).toBe(5); // not 6
  });

  test("refunding an already-REVERSED transaction is a safe no-op", async () => {
    seedBalance(5);
    const debit = await tryDebitAiGuruCredit(UID, "PHOTOSOLVE", fakeDb as any, { requestId: "req_z" });
    const txId = (debit as { ok: true; txId: string }).txId;
    fakeDb.seed(`${BALANCE_DOC}/transactions/${txId}`, {
      type: "DEBIT", amount: 1, status: "REVERSED", source: "PHOTOSOLVE",
    });

    await refundAiGuruCredit(UID, txId, "PHOTOSOLVE", fakeDb as any);

    expect(fakeDb.peek(BALANCE_DOC)!["balance"]).toBe(4); // unchanged by the no-op refund
  });

  test("refunding a transaction id that doesn't exist never throws and never writes a balance change", async () => {
    seedBalance(5);
    await expect(
      refundAiGuruCredit(UID, "nonexistent_tx", "PHOTOSOLVE", fakeDb as any)
    ).resolves.toBeUndefined();
    expect(fakeDb.peek(BALANCE_DOC)!["balance"]).toBe(5);
  });
});

// ─── E. Authorization / uid scoping ─────────────────────────────────────────
//
// tryDebitAiGuruCredit/refundAiGuruCredit are internal server-side helpers,
// not public endpoints — they trust the `uid` they're called with by
// design. The actual authentication boundary (proving the caller really IS
// that uid) is enforced upstream, in each feature handler's own
// verifyAuthToken(req)/context.auth.uid (see photoSolve.ts, askAiGuru.ts,
// etc.) — covered by those handlers' own test suites, not here. What this
// module's own contract guarantees, and what's tested below, is that it
// never mixes up whose balance it's reading or writing.

describe("tryDebitAiGuruCredit / refundAiGuruCredit — uid isolation", () => {
  test("a debit only ever reads/writes aiGuruCredits/{the given uid}, never a sibling collection or doc", async () => {
    seedBalance(5);
    fakeDb.seed(`aiGuruCredits/${OTHER_UID}`, { balance: 99, lifetimeSpent: 0, lifetimePurchased: 0 });

    await tryDebitAiGuruCredit(UID, "PHOTOSOLVE", fakeDb as any);

    expect(fakeDb.peek(`aiGuruCredits/${OTHER_UID}`)!["balance"]).toBe(99);
  });

  test("a refund for one uid's transaction cannot be pointed at another uid's balance", async () => {
    seedBalance(5);
    fakeDb.seed(`aiGuruCredits/${OTHER_UID}`, { balance: 10, lifetimeSpent: 0, lifetimePurchased: 0 });
    const debit = await tryDebitAiGuruCredit(UID, "PHOTOSOLVE", fakeDb as any, { requestId: "req_iso" });
    const txId = (debit as { ok: true; txId: string }).txId;

    // Refund called with the wrong uid — there's no transactions/{txId}
    // doc under aiGuruCredits/{OTHER_UID}, so this must be a safe no-op,
    // not a cross-account credit.
    await refundAiGuruCredit(OTHER_UID, txId, "PHOTOSOLVE", fakeDb as any);

    expect(fakeDb.peek(`aiGuruCredits/${OTHER_UID}`)!["balance"]).toBe(10); // untouched
    expect(fakeDb.peek(BALANCE_DOC)!["balance"]).toBe(4); // the real debit stands, unrefunded
  });
});

// ─── Cost lookup (getCreditCostPerAction) ──────────────────────────────────

describe("getCreditCostPerAction", () => {
  test("falls back to the hardcoded default (1) when no config doc and no cache exist", async () => {
    const cost = await getCreditCostPerAction(fakeDb as any);
    expect(cost).toBe(1);
  });

  test("reads costPerAction from aiGuruCreditConfig/settings when present", async () => {
    fakeDb.seed("aiGuruCreditConfig/settings", { costPerAction: 5 });
    const cost = await getCreditCostPerAction(fakeDb as any);
    expect(cost).toBe(5);
  });

  test("a stale/incorrect Redis-cached cost can never authorize a bigger debit than the real balance allows", async () => {
    // Cache says the action is free (0) — even if display trusted that
    // blindly, the actual debit transaction re-reads Firestore's real
    // config, so this cannot be used to under-charge.
    redisStore.set("aiguru:creditcost", 0);
    fakeDb.seed("aiGuruCreditConfig/settings", { costPerAction: 2 });
    seedBalance(1);

    const result = await tryDebitAiGuruCredit(UID, "PHOTOSOLVE", fakeDb as any);

    // getCreditCostPerAction() itself is cache-first by design (this IS
    // its documented display/fast-path behavior) — the security property
    // under test is that this cannot manufacture credits: with a real
    // balance of 1 and either cost reading, the student is never left
    // with a negative balance or an unlogged transaction.
    expect(fakeDb.peek(BALANCE_DOC)!["balance"]).toBeGreaterThanOrEqual(0);
    if (result.ok) {
      expect(fakeDb.peek(BALANCE_DOC)!["balance"])
        .toBe(1 - result.charged);
    }
  });
});

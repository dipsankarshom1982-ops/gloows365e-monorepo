// PATH: functions/src/__tests__/financial/audit.test.ts
// Offline tests for functions/src/financial/audit.ts, following the same
// jest.mock("firebase-admin", ...) + FakeFirestore pattern already
// established by functions/src/__tests__/refunds.test.ts.

jest.mock("firebase-admin", () => require("../helpers/mockFirebaseAdmin").mockAdminModule);

import * as admin from "firebase-admin";
import { fakeDb } from "../helpers/mockFirebaseAdmin";
import { buildFinancialAuditEvent, writeFinancialAuditEvent } from "../../financial/audit";
import { FinancialValidationError } from "../../financial/validation";
import type { FinancialAuditEventInput } from "../../financial/types";

beforeEach(() => {
  fakeDb.reset();
});

function validEvent(overrides: Partial<FinancialAuditEventInput> = {}): FinancialAuditEventInput {
  return {
    action: "PAYMENT_ORDER_CREATED",
    entityType: "bookingPaymentOrder",
    entityId: "order_1",
    actorId: "student_1",
    actorRole: "student",
    bookingId: "booking_1",
    ...overrides,
  };
}

describe("buildFinancialAuditEvent — validation", () => {
  test("accepts a well-formed event", () => {
    expect(() => buildFinancialAuditEvent(validEvent())).not.toThrow();
  });

  test("rejects an unknown action", () => {
    // @ts-expect-error deliberately invalid action
    expect(() => buildFinancialAuditEvent(validEvent({ action: "NOT_A_REAL_ACTION" }))).toThrow(FinancialValidationError);
  });

  test("rejects a missing/empty entityId", () => {
    expect(() => buildFinancialAuditEvent(validEvent({ entityId: "" }))).toThrow(FinancialValidationError);
  });

  test("rejects a missing/empty actorId", () => {
    expect(() => buildFinancialAuditEvent(validEvent({ actorId: "" }))).toThrow(FinancialValidationError);
  });

  test("rejects an invalid actorRole", () => {
    // @ts-expect-error deliberately invalid role
    expect(() => buildFinancialAuditEvent(validEvent({ actorRole: "hacker" }))).toThrow(FinancialValidationError);
  });

  test("rejects a metadata key that looks like a bank account number", () => {
    expect(() =>
      buildFinancialAuditEvent(validEvent({ metadata: { accountNumber: "1234567890" } })),
    ).toThrow(FinancialValidationError);
  });

  test("rejects a metadata key that looks like a Razorpay secret", () => {
    expect(() =>
      buildFinancialAuditEvent(validEvent({ metadata: { razorpaySecret: "x" } })),
    ).toThrow(FinancialValidationError);
  });

  test("rejects an oversized reason string", () => {
    expect(() => buildFinancialAuditEvent(validEvent({ reason: "x".repeat(501) }))).toThrow(FinancialValidationError);
  });

  test("strips undefined optional fields rather than persisting them", () => {
    const built = buildFinancialAuditEvent(validEvent({ refundId: undefined, payoutId: undefined }));
    expect("refundId" in built).toBe(false);
    expect("payoutId" in built).toBe(false);
  });
});

describe("writeFinancialAuditEvent — persistence", () => {
  test("writes an append-only document to financialAuditLogs with a server timestamp", async () => {
    const id = await writeFinancialAuditEvent(validEvent());
    expect(id).toEqual(expect.any(String));

    const stored = fakeDb.peek(`financialAuditLogs/${id}`);
    expect(stored).toBeDefined();
    expect(stored?.["action"]).toBe("PAYMENT_ORDER_CREATED");
    expect(stored?.["entityId"]).toBe("order_1");
    expect(stored?.["bookingId"]).toBe("booking_1");
    expect(stored?.["createdAt"]).toBeDefined(); // resolved FakeTimestamp, not the SERVER_TIMESTAMP sentinel
  });

  test("still throws synchronously on malformed input (does not silently swallow a programmer mistake)", async () => {
    await expect(writeFinancialAuditEvent(validEvent({ entityId: "" }))).rejects.toThrow(FinancialValidationError);
  });

  test("does not throw, and returns null, when the underlying Firestore write fails", async () => {
    const original = (admin as unknown as { firestore: unknown }).firestore;
    (admin as unknown as { firestore: () => never }).firestore = () => {
      throw new Error("simulated Firestore outage");
    };
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(writeFinancialAuditEvent(validEvent())).resolves.toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();

    (admin as unknown as { firestore: unknown }).firestore = original;
    consoleErrorSpy.mockRestore();
  });
});

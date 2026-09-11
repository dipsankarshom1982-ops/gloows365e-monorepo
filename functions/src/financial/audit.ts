// PATH: functions/src/financial/audit.ts
//
// Phase A1 — Financial Domain Foundation. Backend-only, append-only
// financial audit logging helper. Not called from any live code path yet —
// no callable in this phase invokes writeFinancialAuditEvent, and no
// existing money-moving function (processRefund, reviewPayoutRequest,
// markPayoutPaid, etc.) is modified to call it. This phase builds the
// foundation only, per the approved scope.
//
// Discovery: an exhaustive repository search (functions/src, apps/admin/src)
// for auditLog/financialAudit/adminActionLog/AuditEvent found NOTHING —
// confirmed in the prior architecture audit and re-confirmed at the start
// of this phase. There is no existing infrastructure to extend. A new,
// dedicated `financialAuditLogs` collection is therefore introduced here,
// per the locked architecture's explicit allowance for that case.
//
// ── Collection: financialAuditLogs/{autoId} ─────────────────────────────
// firestore.rules is NOT modified by this phase. firestore.rules has no
// wildcard/default rule block (confirmed: no `match /{document=**}` exists
// anywhere in the file) — Firestore's own default-deny semantics mean any
// path with no matching rule, including this new collection, is already
// fully closed to every client read AND write with zero rules change
// required. The Admin SDK (used exclusively by writeFinancialAuditEvent
// below) always bypasses security rules regardless, so this collection is
// reachable ONLY from trusted backend code, both today (by default-deny)
// and after any future phase that might add an explicit admin-read rule
// for a Transaction 360° UI (out of scope this phase).
//
// ── Transaction-ordering recommendation (documented, not yet wired) ────
// For a future critical financial mutation (e.g. confirming a booking
// payment) the recommended pattern is:
//   1. Perform the financial mutation in its own Firestore transaction,
//      exactly as every existing money-moving function in this repo
//      already does (see tutorPayouts.ts, instantHelp.ts's
//      settleInstantHelpSession).
//   2. AFTER that transaction commits, call logFinancialAuditEvent (the
//      non-throwing wrapper below) as a best-effort, non-blocking side
//      effect — NOT inside the same transaction.
// Reasoning: Firestore transactions CAN include extra writes, but coupling
// the audit write into the same transaction as the money-moving write
// buys nothing here (the audit collection has no client reader yet, and
// even later, an admin-facing 360° view can tolerate a few seconds of
// eventual consistency) while adding a real cost: any transient failure
// writing the audit document would abort the entire financial mutation,
// which is exactly the failure mode the "never throw away the original
// financial operation's error because audit logging failed" requirement
// exists to prevent. A best-effort write-after-commit, backed by
// console.error on failure so an ops engineer can spot a gap, is the
// simplest pattern reliably compatible with Firestore and this
// requirement — not an outbox/event-queue system, which would be real
// over-engineering for a single-region Cloud Functions deployment with no
// current cross-service consumer of these events.

import * as admin from "firebase-admin";
import { assertNonEmptyString, assertNoSensitiveMetadataKeys, FinancialValidationError } from "./validation";
import { isFinancialAuditAction } from "./statuses";
import type { FinancialAuditEventInput } from "./types";

const AUDIT_COLLECTION = "financialAuditLogs";
const MAX_REASON_LENGTH = 500;

/**
 * Pure validation + shape-normalization for a financial audit event. Throws
 * FinancialValidationError on malformed input — deliberately synchronous
 * and Firestore-free so it's testable without mocking anything, and so a
 * caller can validate an event BEFORE committing to logging it (e.g. to
 * fail fast during development rather than silently swallowing a
 * programmer mistake, which is a different failure mode than "Firestore
 * itself is unreachable" — see writeFinancialAuditEvent below for that
 * one).
 */
export function buildFinancialAuditEvent(input: FinancialAuditEventInput): FinancialAuditEventInput {
  if (!isFinancialAuditAction(input.action)) {
    throw new FinancialValidationError(`Unknown financial audit action: ${String(input.action)}`);
  }
  assertNonEmptyString(input.entityType, "entityType", 100);
  assertNonEmptyString(input.entityId, "entityId", 200);
  assertNonEmptyString(input.actorId, "actorId", 200);
  assertNonEmptyString(input.actorRole, "actorRole", 20);
  if (!["admin", "superAdmin", "system", "tutor", "student"].includes(input.actorRole)) {
    throw new FinancialValidationError(`Invalid actorRole: ${input.actorRole}`);
  }
  if (input.reason !== undefined) assertNonEmptyString(input.reason, "reason", MAX_REASON_LENGTH);
  assertNoSensitiveMetadataKeys(input.metadata);
  assertNoSensitiveMetadataKeys(input.beforeState);
  assertNoSensitiveMetadataKeys(input.afterState);

  // Strip undefined keys — Firestore rejects `undefined` field values, and
  // MarketplaceFinancialReference's fields are all optional (a given event
  // legitimately carries only a subset).
  const clean: FinancialAuditEventInput = { ...input };
  (Object.keys(clean) as Array<keyof FinancialAuditEventInput>).forEach((key) => {
    if (clean[key] === undefined) delete clean[key];
  });
  return clean;
}

/**
 * Writes ONE append-only financial audit document. Server-side only — this
 * file imports firebase-admin directly and is never bundled into any
 * frontend/shared-logic package (functions/ is a separate deployment unit
 * with its own package.json; nothing under apps/ or packages/ imports from
 * functions/src).
 *
 * Deliberately swallows its own Firestore-level failure (logs via
 * console.error and resolves rather than rejects) so a future caller can
 * fire this after a critical financial mutation WITHOUT risking the
 * original operation's success being reported as a failure just because
 * the audit write hiccupped — see the header's transaction-ordering
 * recommendation. Malformed INPUT (a programmer mistake, e.g. an unknown
 * action name) still throws synchronously via buildFinancialAuditEvent,
 * since that failure mode should be caught in development/tests, not
 * silently discarded in production.
 *
 * Returns the new document's id, or null if the Firestore write itself
 * failed (already logged internally).
 */
export async function writeFinancialAuditEvent(input: FinancialAuditEventInput): Promise<string | null> {
  const event = buildFinancialAuditEvent(input); // throws on bad input — not caught here, by design

  try {
    const db = admin.firestore();
    const ref = await db.collection(AUDIT_COLLECTION).add({
      ...event,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  } catch (err) {
    // Never throw — see header. The caller's real financial operation has
    // already succeeded by the time this is invoked (write-after-commit
    // pattern); losing one audit record must not be reported as if the
    // money movement itself failed.
    console.error(`[financialAudit] failed to write audit event action=${event.action} entityId=${event.entityId}`, err);
    return null;
  }
}

/** Alias kept for call-site clarity where "log" reads better than "write"
 *  (e.g. inside an existing function's post-commit block). Same function. */
export const logFinancialAuditEvent = writeFinancialAuditEvent;

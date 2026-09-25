// PATH: functions/src/financial/validation.ts
//
// Phase A1 — Financial Domain Foundation. Small, generic defensive
// validators shared by ./commission.ts, ./audit.ts, and future financial
// call sites. Backend-only (no firebase-admin import here either, though —
// kept pure/importable from a test file without mocking anything).

export class FinancialValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinancialValidationError";
  }
}

/** Non-empty, reasonably-bounded string (an id, a role, an action name).
 *  `maxLength` guards against an accidentally-huge value ending up in a
 *  Firestore document (see ./audit.ts's document-size requirement). */
export function assertNonEmptyString(value: unknown, label: string, maxLength = 200): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new FinancialValidationError(`${label} must be a non-empty string`);
  }
  if (value.length > maxLength) {
    throw new FinancialValidationError(`${label} must be at most ${maxLength} characters`);
  }
}

export function assertOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): asserts value is T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new FinancialValidationError(`${label} must be one of: ${allowed.join(", ")} — got ${String(value)}`);
  }
}

// Defensive denylist for ./audit.ts's metadata scan — matches the LOCKED
// "no bank details / no Aadhaar-PAN / no raw payment secrets" requirement.
// This is a best-effort guard against an accidental future call site
// passing something it shouldn't, not a cryptographic guarantee: it flags
// suspicious KEY NAMES on the metadata object (case-insensitive), not
// values, since scanning arbitrary string values for e.g. a bank-account-
// shaped number would be unreliable and slow. Call sites remain responsible
// for not putting sensitive data in metadata in the first place — this is
// a safety net, documented as such.
const DENYLISTED_METADATA_KEY_PATTERN =
  /account.?number|ifsc|aadhaar|adhaar|pan.?number|passport|razorpay.?(key|secret)|password|api.?key|bank/i;

export function assertNoSensitiveMetadataKeys(metadata: Record<string, unknown> | undefined): void {
  if (!metadata) return;
  for (const key of Object.keys(metadata)) {
    if (DENYLISTED_METADATA_KEY_PATTERN.test(key)) {
      throw new FinancialValidationError(
        `metadata key "${key}" looks like sensitive financial/PII data and is not allowed in an audit event`,
      );
    }
  }
}

// PATH: functions/src/__tests__/moderation/originalityDeclaration.test.ts
//
// Offline unit tests for the originality declaration validator. Pure
// function, no firebase-admin mocking needed.

import { checkOriginalityDeclaration } from "../../moderation/originalityDeclaration";
import { CURRENT_DECLARATION_VERSION } from "../../moderation/types";

describe("checkOriginalityDeclaration", () => {
  test("both fields omitted: valid, recorded honestly as not accepted (Phase A mobile compatibility)", () => {
    const result = checkOriginalityDeclaration({});
    expect(result.valid).toBe(true);
    expect(result.record.declarationAccepted).toBe(false);
    expect(result.record.declarationVersion).toBeNull();
    expect(result.record.declarationAcceptedAt).toBeNull();
  });

  test("declarationAccepted explicitly false is rejected, not silently downgraded to omitted", () => {
    const result = checkOriginalityDeclaration({ declarationAccepted: false, declarationVersion: CURRENT_DECLARATION_VERSION });
    expect(result.valid).toBe(false);
    expect(result.record.declarationAccepted).toBe(false);
  });

  test("declarationAccepted:true with a tampered/unknown version is rejected", () => {
    const result = checkOriginalityDeclaration({ declarationAccepted: true, declarationVersion: "v999-fake" });
    expect(result.valid).toBe(false);
  });

  test("declarationAccepted as a truthy non-boolean (e.g. the string 'true') is rejected — strict equality only", () => {
    const result = checkOriginalityDeclaration({ declarationAccepted: "true" as any, declarationVersion: CURRENT_DECLARATION_VERSION });
    expect(result.valid).toBe(false);
  });

  test("correct acceptance is recorded with the current version and a real timestamp", () => {
    const before = Date.now();
    const result = checkOriginalityDeclaration({ declarationAccepted: true, declarationVersion: CURRENT_DECLARATION_VERSION });
    expect(result.valid).toBe(true);
    expect(result.record.declarationAccepted).toBe(true);
    expect(result.record.declarationVersion).toBe(CURRENT_DECLARATION_VERSION);
    expect(result.record.declarationAcceptedAt).toBeGreaterThanOrEqual(before);
  });

  test("client cannot invent its own version string and have it accepted, even if declarationAccepted is true", () => {
    const result = checkOriginalityDeclaration({ declarationAccepted: true, declarationVersion: "v2-i-made-this-up" });
    expect(result.valid).toBe(false);
    expect(result.record.declarationVersion).toBeNull();
  });
});

// PATH: functions/src/moderation/originalityDeclaration.ts
//
// Validates the student's originality declaration before a Skill Battle
// submission is accepted. `CURRENT_DECLARATION_VERSION`/
// `ORIGINALITY_DECLARATION_TEXT` (types.ts) are the server's own source
// of truth for what a valid acceptance looks like — a client can never
// invent its own version string and have it accepted.
//
// TIGHTENED (Phase B §6): Phase A shipped this as a soft, compatibility-
// shimmed check because the mobile app didn't show the declaration UI
// yet — an omitted declaration was recorded honestly as "not accepted"
// rather than rejecting the whole submission, to avoid breaking the
// already-working, already-verified-in-production upload flow. The
// mobile app (Createreelscreen.tsx) now shows the actual declaration
// checkbox and always sends both fields, so omitting them entirely is no
// longer a legitimate client shape — it's now rejected outright, same as
// any other forged-field attempt. This does NOT affect historical
// submissions already in Firestore (their stored declarationAccepted/
// declarationVersion/declarationAcceptedAt values are untouched) — it
// only changes what a NEW submission request must include going forward.

import { CURRENT_DECLARATION_VERSION, OriginalityDeclaration } from "./types";

export interface OriginalityDeclarationInput {
  declarationAccepted?: unknown;
  declarationVersion?: unknown;
}

export interface OriginalityDeclarationCheckResult {
  valid: boolean;
  reason?: string;
  record: OriginalityDeclaration;
}

export function checkOriginalityDeclaration(input: OriginalityDeclarationInput): OriginalityDeclarationCheckResult {
  const { declarationAccepted, declarationVersion } = input;
  const REJECTED_RECORD: OriginalityDeclaration = { declarationAccepted: false, declarationVersion: null, declarationAcceptedAt: null };

  if (declarationAccepted !== true) {
    return {
      valid: false,
      reason: "You must accept the originality declaration before submitting.",
      record: REJECTED_RECORD,
    };
  }
  if (declarationVersion !== CURRENT_DECLARATION_VERSION) {
    return {
      valid: false,
      reason: "Originality declaration version is out of date or invalid. Please update the app and try again.",
      record: REJECTED_RECORD,
    };
  }

  return {
    valid: true,
    record: {
      declarationAccepted: true,
      declarationVersion: CURRENT_DECLARATION_VERSION,
      declarationAcceptedAt: Date.now(),
    },
  };
}

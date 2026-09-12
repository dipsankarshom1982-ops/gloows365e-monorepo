// PATH: functions/src/moderation/originalityDeclaration.ts
//
// Validates the student's originality declaration before a Skill Battle
// submission is accepted. `CURRENT_DECLARATION_VERSION`/
// `ORIGINALITY_DECLARATION_TEXT` (types.ts) are the server's own source
// of truth for what a valid acceptance looks like — a client can never
// invent its own version string and have it accepted.
//
// COMPATIBILITY NOTE (Phase A): the live mobile app does not yet show
// this declaration's UI (that ships in Phase B) and today sends neither
// field at all. Hard-rejecting every submission that omits it would
// break the already-working, already-verified-in-production submission
// flow immediately upon deploying this change — see
// battleSubmissions.ts/skillBattleSubmission.ts's call sites for how
// this is handled: an OMITTED declaration is recorded honestly as
// declined (never silently treated as accepted), while a PRESENT but
// invalid one (wrong value, tampered version) is still rejected outright
// — a client cannot benefit from lying about acceptance, it just isn't
// mandatory to send yet. Phase B tightens this to a hard requirement
// once the mobile UI actually collects it.

import { CURRENT_DECLARATION_VERSION, OriginalityDeclaration } from "./types";

export interface OriginalityDeclarationInput {
  declarationAccepted?: unknown;
  declarationVersion?: unknown;
}

export interface OriginalityDeclarationCheckResult {
  // false only when the client explicitly asserted something invalid
  // (accepted:false, or a tampered/unknown version) — never true just
  // because the fields were sent correctly; see `record` for the actual
  // stored state, which additionally distinguishes "never asked" from
  // "declined."
  valid: boolean;
  reason?: string;
  record: OriginalityDeclaration;
}

export function checkOriginalityDeclaration(input: OriginalityDeclarationInput): OriginalityDeclarationCheckResult {
  const { declarationAccepted, declarationVersion } = input;

  // Not sent at all — the pre-Phase-B mobile client's shape. Recorded
  // honestly as not accepted, not rejected outright (see header).
  if (declarationAccepted === undefined && declarationVersion === undefined) {
    return {
      valid: true,
      record: { declarationAccepted: false, declarationVersion: null, declarationAcceptedAt: null },
    };
  }

  if (declarationAccepted !== true) {
    return {
      valid: false,
      reason: "Originality declaration must be explicitly accepted before submitting.",
      record: { declarationAccepted: false, declarationVersion: null, declarationAcceptedAt: null },
    };
  }
  if (declarationVersion !== CURRENT_DECLARATION_VERSION) {
    return {
      valid: false,
      reason: "Originality declaration version is out of date or invalid.",
      record: { declarationAccepted: false, declarationVersion: null, declarationAcceptedAt: null },
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

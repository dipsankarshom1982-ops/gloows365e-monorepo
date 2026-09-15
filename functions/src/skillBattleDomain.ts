// PATH: functions/src/skillBattleDomain.ts
//
// Phase 2B — Product Decision Lock + Domain Foundation.
//
// This file is the server-authoritative half of the Phase 2A blueprint's
// battle lifecycle (§6) and battle-scoping (§7) design — the minimum slice
// authorized for Phase 2B: the canonical state graph and a single
// admin-only, validated transition entry point. It deliberately does NOT
// implement automatic/scheduled transitions, notifications, ranking
// finalization, or result locking's Score-doc side effects — those belong
// to Phase 2C's "battle engine" per the Phase 2A blueprint's phasing.
//
// SECURITY: firestore.rules' skillBattles/{battleId} update rule excludes
// `state` from every client-writable path, admin included — this function
// (running under the Admin SDK, which bypasses rules) is the ONLY writer
// of that field. Same posture as posts/{postId}.status (Phase 1) and
// tutors/{uid}.verified.

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";

const db = admin.firestore();

// ─── Canonical battle state graph (Phase 2A blueprint §6, Decision Lock §12) ──

export const BATTLE_STATES = [
  "DRAFT",
  "SCHEDULED",
  "OPEN",
  "SUBMISSION_CLOSED",
  "RANKING_FINALIZATION",
  "RESULT_LOCKED",
  "WINNERS_ANNOUNCED",
  "AWARDS_PROCESSING",
  "COMPLETED",
  "CANCELLED",
] as const;
export type BattleState = (typeof BATTLE_STATES)[number];

// Terminal states — no outgoing transitions.
const TERMINAL_STATES: ReadonlySet<BattleState> = new Set(["COMPLETED", "CANCELLED"]);

// The forward lifecycle, plus CANCELLED reachable from every pre-lock
// state (cancelling a battle whose ranking is already finalizing or
// locked isn't a supported product flow — a locked result needs the
// correction process from the Phase 2A blueprint §17, not a cancellation,
// which is out of scope for this phase).
export const ALLOWED_TRANSITIONS: Readonly<Record<BattleState, readonly BattleState[]>> = {
  DRAFT:                 ["SCHEDULED", "CANCELLED"],
  SCHEDULED:              ["OPEN", "CANCELLED"],
  OPEN:                    ["SUBMISSION_CLOSED", "CANCELLED"],
  SUBMISSION_CLOSED:        ["RANKING_FINALIZATION", "CANCELLED"],
  RANKING_FINALIZATION:      ["RESULT_LOCKED"],
  RESULT_LOCKED:               ["WINNERS_ANNOUNCED"],
  WINNERS_ANNOUNCED:             ["AWARDS_PROCESSING"],
  AWARDS_PROCESSING:               ["COMPLETED"],
  COMPLETED:                        [],
  CANCELLED:                         [],
};

export function isValidBattleState(value: unknown): value is BattleState {
  return typeof value === "string" && (BATTLE_STATES as readonly string[]).includes(value);
}

export function canTransition(from: BattleState, to: BattleState): boolean {
  if (TERMINAL_STATES.has(from)) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

// ─── transitionBattleState ─────────────────────────────────────────────────
// The only writer of skillBattles/{battleId}.state. Admin-only. Validates
// the transition against the graph above and records a lightweight audit
// entry — NOT the full cross-cutting AuditEvent collection from the
// Phase 2A blueprint (out of scope for this phase), just enough that a
// state change is traceable to who did it and when.

export const transitionBattleState = functionsV1
  .runWith({ timeoutSeconds: 15, memory: "128MB" })
  .https.onCall(async (data: { battleId?: string; targetState?: string }, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    if (context.auth.token.admin !== true) {
      throw new functionsV1.https.HttpsError("permission-denied", "Admin only");
    }

    const { battleId, targetState } = data ?? {};
    if (!battleId || typeof battleId !== "string") {
      throw new functionsV1.https.HttpsError("invalid-argument", "battleId is required");
    }
    if (!isValidBattleState(targetState)) {
      throw new functionsV1.https.HttpsError(
        "invalid-argument",
        `targetState must be one of: ${BATTLE_STATES.join(", ")}`
      );
    }

    const battleRef = db.doc(`skillBattles/${battleId}`);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(battleRef);
      if (!snap.exists) {
        throw new functionsV1.https.HttpsError("not-found", "This battle does not exist.");
      }

      const currentState = snap.data()?.state;
      // Decision 5 (Phase 2B lock): existing battles predate this field
      // entirely — they are NOT backfilled with a guessed state (that
      // would be exactly the "automatic historical migration" the lock
      // forbids). A legacy battle simply isn't transition-managed until
      // an admin explicitly re-creates/opts it in some later phase; this
      // function refuses rather than inventing a starting state for it.
      if (!isValidBattleState(currentState)) {
        throw new functionsV1.https.HttpsError(
          "failed-precondition",
          "This battle predates the Phase 2B state machine and has no managed state — " +
          "it is not eligible for transitionBattleState."
        );
      }

      if (!canTransition(currentState, targetState)) {
        throw new functionsV1.https.HttpsError(
          "failed-precondition",
          `Cannot transition from ${currentState} to ${targetState}. ` +
          `Valid next states: ${ALLOWED_TRANSITIONS[currentState].join(", ") || "(none — terminal)"}`
        );
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.update(battleRef, { state: targetState, updatedAt: now });
      tx.set(battleRef.collection("stateTransitions").doc(), {
        fromState: currentState,
        toState: targetState,
        actorUid: context.auth!.uid,
        createdAt: now,
      });

      return { battleId, fromState: currentState, toState: targetState };
    });
  });
